// Main file for Diameter server
// Implements state machine
// TODO: Implement duplicate detection.
// --- Cache of Ent2EndId being processed and processed

var net=require("net");
var dLogger=require("./log").dLogger;
var logMessage=require("./log").logMessage;
var config=require("./config").config;
var createConnection=require("./connection").createConnection;
var createMessage=require("./message").createMessage;
var stats=require("./stats").stats;
var createAgent=require("./agent").createAgent;

// Singleton
var createDiameterServer=function(){
    
    // State machine
    var diameterServer={};

    // Peer table
    // Entries as {<diameterHost>: <connection object>}
    var peerConnections={};

    // Reference to messages sent and waiting for answer
    // Holds a reference to the callback function and timer for each destinationHost+HopByHopID
    var requestPointers={};

    // TODO: Test routing using * as realm and as application-id
    // TODO: Test fixed and random policies
    /** Returns the appropriate connection
     *
     * @param message
     * @returns peerConnectionsEntry
     */
    var findConnection=function(message){
        var i;
        
        // If Destination-Host is present, use it
        if(message.avps["Destination-Host"]) return peerConnections[message.avps["Destination-Host"]];
        
        // Otherwise, route based on Destination-Realm
        else if(message.avps["Destination-Realm"]){
            // Lookup in routing configuration
            var realms=config.node.diameter.routeMap;
            var peerConfig=(realms[message.avps["Destination-Realm"]]||realms["*"]||{})[message.applicationId] || (realms[message.avps["Destination-Realm"]]||realms["*"]||{})["*"];
            if(peerConfig){
                if(peerConfig["policy"]=="fixed") {
                    for (i=0; i<peerConfig["peers"].length; i++) {
                        dLogger.debug("Checking peer "+peerConfig["peers"][i]);
                        if(peerConnections[peerConfig["peers"][i]]) if(peerConnections[peerConfig["peers"][i]].getState()=="Open") return peerConnections[peerConfig["peers"][i]];
                    }
                    dLogger.verbose("All routes closed [fixed policy]");
                    return null;
                }
                else {
                    // Policy is "random"
                    var activePeerEntries=[];
                    for (i = 0; i < peerConfig["peers"].length; i++) {
                        if(peerConnections[peerConfig["peers"][i]]) if (peerConnections[peerConfig["peers"][i]].getState() == "Open") activePeerEntries.push(peerConnections[peerConfig["peers"][i]]);
                    }
                    if(activePeerEntries.length>0) return activePeerEntries[Math.floor(Math.random()*activePeerEntries.length)];
                    else dLogger.verbose("All routes closed [random policy]");
                }
            }
            else{
                dLogger.warn("No route for Destination-Realm: "+message.avps["Destination-Realm"]+" and Application-Id: "+message.applicationId);
                return null;
            }
        }
        // Unable to deliver
        else{
            dLogger.warn("Message has no routing AVP");
            return null;
        }
    };

    /**
     * Invoked by the connection when a new complete message is available
     * Call handler if request, or call callback if response and original request is found
     * @param connection
     * @param buffer
     */
    diameterServer.onMessageReceived=function(connection, buffer){
        var requestPointer;
        var message;

        var dispatcher=config.dispatcher;

        try {
            message=createMessage().decode(buffer);
        }catch(e){
            // Message decoding error
            dLogger.error("Diameter decoding error: "+e.message);
            dLogger.error(e.stack);
            connection.end();
            return;
        }

        if(dLogger["inDebug"]) {
            dLogger.debug("");
            dLogger.debug("Received message");
            dLogger.debug(JSON.stringify(message, null, 2));
            dLogger.debug("");
        }

        if(dLogger["inVerbose"]) logMessage(connection.diameterHost, config.node.diameter["diameterHost"], message);

        if (message.isRequest) {
            // Handle message if there is a handler configured for this type of request
            stats.incrementServerRequest(connection.diameterHost, message.commandCode);
            // if(there is a handler)
            if(((dispatcher[message.applicationId]||{})[message.commandCode]||{})["handler"]){
                if(dLogger["inDebug"]) dLogger.debug("Message is Request. Dispatching message to: "+dispatcher[message.applicationId][message.commandCode].functionName);
                try {
                    dispatcher[message.applicationId][message.commandCode]["handler"](connection, message);
                }catch(e){
                    stats.incrementServerError(connection.diameterHost, message.commandCode);
                    dLogger.error("Handler error in "+dispatcher[message.applicationId][message.commandCode].functionName);
                    dLogger.error(e.message);
                    dLogger.error(e.stack);
                }
            }
            else{
                stats.incrementServerError(connection.diameterHost, message.commandCode);
                dLogger.warn("No handler defined for Application: " + message.applicationId + " and command: " + message.commandCode);
            }
        } else {
            dLogger.debug("Message is Response");
            stats.incrementClientResponse(connection.diameterHost, message.commandCode, message.avps["Result-Code"]||0);
            requestPointer=requestPointers[connection.diameterHost+"."+message.hopByHopId];
            if(requestPointer) {
                clearTimeout(requestPointer.timer);
                delete requestPointers[connection.diameterHost+"."+message.hopByHopId];
                dLogger.debug("Executing callback");
                requestPointer.callback(null, message);
            } else{
                dLogger.warn("Unsolicited or stale response message");
            }
        }
    };

    /**
     * Sends a reply using the specified connection
     * @param connection
     * @param message
     */
    diameterServer.sendReply=function(connection, message){

        if(dLogger["inDebug"]) {
            dLogger.debug("");
            dLogger.debug("Sending reply");
            dLogger.debug(JSON.stringify(message, null, 2));
            dLogger.debug("");
        }

        if(connection.getState()!=="Open"){
            dLogger.warn("SendReply - Connection is not in 'Open' state. Discarding message");
            stats.incrementServerError(connection.diameterHost, message.commandCode);
        }
        else try {
            if(dLogger["inVerbose"]) logMessage(config.node.diameter["diameterHost"], connection.diameterHost, message);
            connection.write(message.encode());
            stats.incrementServerResponse(connection.diameterHost, message.commandCode, message.avps["Result-Code"]||0);
        }
        catch(e){
            // Message encoding error
            stats.incrementServerError(connection.diameterHost, message.commandCode);
            dLogger.error("Could not encode & send reply: "+e.message);
            dLogger.error("Closing connection");
            dLogger.error(e.stack);
            connection.end();
        }
    };

    /**
     * Sends a request message to the destination specified by the Destination-Host or Destination-Realm attributes
     * in the message. If the "connection" parameter is present, the request is sent using the specified connection
     * @param connection. If null, the request will be routed based on the Destination-Host or Destination-Realm attributes of the message
     * @param message
     * @param timeout
     * @param callback
     */
    diameterServer.sendRequest=function(connection, message, timeout, callback){	// callback is fnc(error, message)

        if(dLogger["inDebug"]) {
            dLogger.debug("");
            dLogger.debug("Sending request");
            dLogger.debug(JSON.stringify(message, null, 2));
            dLogger.debug("");
        }

        // Route Message if no connection was specified
        if(!connection) connection=findConnection(message);

        if(connection) {
            if(message.applicationId!=="Base" && connection.getState()!=="Open"){
                stats.incrementClientError(connection.diameterHost, message.commandCode);
                dLogger.warn("SendRequest - Connection is not in 'Open' state. Discarding message");
            }
            else try {
                if(dLogger["inVerbose"]) logMessage(config.node.diameter["diameterHost"], connection.diameterHost, message);
                connection.write(message.encode());
                stats.incrementClientRequest(connection.diameterHost, message.commandCode);
                requestPointers[connection.diameterHost+"."+message.hopByHopId] = {
                    "timer": setTimeout(function () {
                        delete requestPointers[connection.diameterHost+"."+message.hopByHopId];
                        stats.incrementClientError(connection.diameterHost, message.commandCode);
                        callback(new Error("timeout"), null);
                    }, timeout),
                    "callback": callback
                };
            } catch(e){
                // Message encoding error
                stats.incrementClientError(connection.diameterHost, message.commandCode);
                dLogger.error("Could not encode & send request: "+e.message);
                dLogger.error("Closing connection");
                dLogger.error(e.stack);
                connection.end();
            }
        }
        else {
            dLogger.warn("Could not send request. No route to destination");
            callback(new Error("No route to destination"), null);
        }
    };

    ///////////////////////////////////////////////////////////////////////////
    // Active connections
    ///////////////////////////////////////////////////////////////////////////

    // Establishes connections with peers with "active" connection policy, if not already established
    diameterServer.manageConnections=function(){
        dLogger.debug("Checking connections");
        var i;
        
        // Iterate through peers and check if a new connection has to be established
        for(i=0; i<config.node.diameter["peers"].length; i++){
            var peer=config.node.diameter["peers"][i];

            // Make sure entry exists in peer table
            if(!peerConnections[peer["diameterHost"]]) peerConnections[peer["diameterHost"]]=createConnection(diameterServer, peer["diameterHost"], peer["dwrInterval"]);

            // Establish connection if necessary
            if(peer["connectionPolicy"]==="active" && peerConnections[peer["diameterHost"]].getState()=="Closed"){
                dLogger.info("Connecting to "+peer["diameterHost"]+" in address "+peer["IPAddress"]);
                peerConnections[peer["diameterHost"]].connect(peer["IPAddress"].split(":")[1]||3868, peer["IPAddress"].split(":")[0]);
            }
        }

        // Iterate through current peers and check if a connection has to be closed
        var found;
        for(var diameterHost in peerConnections) if(peerConnections.hasOwnProperty(diameterHost)){
            found=false;
            for(i=0; i<config.node.diameter["peers"].length; i++){
                if(config.node.diameter["peers"][i]["diameterHost"]==diameterHost){
                    found=true;
                    break;
                }
            }
            if(!found) peerConnections[diameterHost].end();
        }
    };

    ///////////////////////////////////////////////////////////////////////////
    // Passive connections
    ///////////////////////////////////////////////////////////////////////////

    /**
     * Invoked when a new connection is received.
     * @param socket
     */
    diameterServer.onConnectionReceived=function(socket){
        dLogger.verbose("Got connection from "+socket["remoteAddress"]);

        // Look for Origin-Host in peer table
        var peer=null;
        var i;
        for(i=0; i<config.node.diameter["peers"].length; i++) if(config.node.diameter["peers"][i]["IPAddress"].split(":")[0]===socket["remoteAddress"]){
            // Peer found
            peer=config.node.diameter["peers"][i];

            // Make sure that entry exist in peer table, or create it otherwise
            if(!peerConnections[peer["diameterHost"]]) peerConnections[peer["diameterHost"]]=createConnection(diameterServer, peer["diameterHost"], peer["dwrInterval"]);

            // If closed, set socket to newly received connection
            if(peerConnections[peer["diameterHost"]].getState()=="Closed"){
                peerConnections[peer["diameterHost"]].attachConnection(socket);
            }
            else{
                dLogger.warn("There is already a non closed connection to the host "+peer["diameterHost"]);
                socket.end();
            }
            return;
        }

        // If here, peer was not found for the origin IP-Address
        dLogger.warn("Received connection from unknown peer "+socket["remoteAddress"]);
        socket.end();
    };

    ///////////////////////////////////////////////////////////////////////////
    // Instrumentation
    ///////////////////////////////////////////////////////////////////////////
    diameterServer.getPeerStatus=function(){
        var peerStatus=[];
        for(var diameterHost in peerConnections) if(peerConnections.hasOwnProperty(diameterHost)){
            peerStatus.push({hostName: diameterHost, state: peerConnections[diameterHost].getState()});
        }
        return peerStatus;
    };

    ///////////////////////////////////////////////////////////////////////////
    // Startup
    ///////////////////////////////////////////////////////////////////////////

    var diameterSocket;

    // Read configuration and initialize
    config.readAll(function(err){
        if(err){
            dLogger.error("Initialization error");
            dLogger.error(err.stack);
            process.exit(-1);
        }
        else{
            /////////////////////////////////////////////
            // Initialization
            ////////////////////////////////////////////

            // Create Listener on Diameter port (or configured)
            diameterSocket=net.createServer();

            diameterSocket.on("connection", diameterServer.onConnectionReceived);

            diameterSocket.listen(config.node.diameter.port||3868);
            dLogger.info("Diameter listening in port "+config.node.diameter.port);

            // Create management HTTP server
            createAgent(diameterServer);

            // Establish outgoing connections
            diameterServer.manageConnections();

            // Set timer for periodically checking connections
            setInterval(diameterServer.manageConnections, config.node.diameter["connectionInterval"]||10000);
        }
    });

    return diameterServer;
};

exports.diameterServer=createDiameterServer();







