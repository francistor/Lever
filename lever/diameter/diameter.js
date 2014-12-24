// Main file for Diameter server
// Implements state machine

// TODO: Implement duplicate detection.
// --- Cache of Ent2EndId being processed and processed

var net=require("net");
var dLogger=require("./log").dLogger;
var logMessage=require("./log").logMessage;
var config=require("./config").config;
var createConnection=require("./connections").createConnection;
var createMessage=require("./message").createMessage;
var stats=require("./stats").stats;
var createAgent=require("./agent").createAgent;

var sendCer=require("./baseHandler").sendCer;

// Singleton
var createDiameterStateMachine=function(){

    // Transient variables
    var ipAddress;
    var peer;
    var connection;
    var i;

    // State machine
    var diameterStateMachine={};

    // Connections indexed by hostname or origin ipAddr:port
    var connections={};

    // Reference to messages sent and waiting for answer
    // Holds a reference to the callback function and timer for each destinationHost+HopByHopID
    var requestPointers={};

    // Invoked by the connection when a new complete message is available
    // Call handler if request, or call callback if response and original request is found
    diameterStateMachine.onMessageReceived=function(connection, buffer){
        var requestPointer;
        var message;

        var dispatcher=config.dispatcher;

        try {
            message = createMessage().decode(buffer);
        }catch(e){
            // Message decoding error
            dLogger.error("Diameter decoding error: "+e.message);
            dLogger.error(e.stack);
            connection.socket.end();
            connection.state="Closing";
            // Will be deleted when close event arrives
            return;
        }

        if(dLogger["inDebug"]) {
            dLogger.debug("");
            dLogger.debug("Received message");
            dLogger.debug(JSON.stringify(message, undefined, 2));
            dLogger.debug("");
        }

        if(dLogger["inVerbose"]) logMessage(connection.hostName, config.diameterConfig["originHost"], message);

        if (message.isRequest) {
            // Handle message if there is a handler configured for this type of request
            stats.incrementServerRequest(connection.hostName, message.commandCode);
            if(dLogger["inDebug"]) dLogger.debug(JSON.stringify(dispatcher, undefined, 2));
            // if(there is a handler)
            if(((dispatcher[message.applicationId]||{})[message.commandCode]||{})["handler"]){
                if(dLogger["inDebug"]) dLogger.debug("Message is Request. Dispatching message to: " + dispatcher[message.applicationId][message.commandCode].functionName);
                try {
                    dispatcher[message.applicationId][message.commandCode]["handler"](connection, message);
                }catch(e){
                    stats.incrementServerError(connection.hostName, message.commandCode);
                    dLogger.error("Handler error in "+dispatcher[message.applicationId][message.commandCode].functionName);
                    dLogger.error(e.message);
                    dLogger.error(e.stack);
                }
            }
            else{
                stats.incrementServerError(connection.hostName, message.commandCode);
                dLogger.warn("No handler defined for Application: " + message.applicationId + " and command: " + message.commandCode);
            }
        } else {
            dLogger.debug("Message is Response");
            stats.incrementClientResponse(connection.hostName, message.commandCode, message.avps["Result-Code"]||0);
            requestPointer=requestPointers[connection.hostName+"."+message.hopByHopId];
            if(requestPointer) {
                clearTimeout(requestPointer.timer);
                delete requestPointers[connection.hostName+"."+message.hopByHopId];
                dLogger.debug("Executing callback");
                requestPointer.callback(null, message);
            } else{
                dLogger.debug("Unsolicited response message");
            }
        }
    };

    // Sends a reply using the specified connection
    diameterStateMachine.sendReply=function(connection, message){

        dLogger.debug("");
        dLogger.debug("Sending reply");
        dLogger.debug(JSON.stringify(message, undefined, 2));
        dLogger.debug("");

        if(connection.state!=="Open"){
            dLogger.warn("SendReply - Connection is not in 'Open' state. Discarding message");
        }
        else try {
            if(dLogger["inVerbose"]) logMessage(config.diameterConfig["originHost"], connection.hostName, message);
            connection.socket.write(message.encode());
            stats.incrementServerResponse(connection.hostName, message.commandCode, message.avps["Result-Code"]||0);
        }
        catch(e){
            // Message encoding error
            stats.incrementServerError(connection.hostName, message.commandCode);
            dLogger.error("Could not encode & send reply: "+e.message);
            dLogger.error("Closing connection");
            dLogger.error(e.stack);
            connection.socket.end();
            connection.state="Closing";
            // Will be deleted when close event arrives
        }
    };

    // Sends a request message to he specified hostName
    diameterStateMachine.sendRequest=function(hostName, message, timeout, callback){	// callback is fnc(error, message)

        dLogger.debug("");
        dLogger.debug("Sending request");
        dLogger.debug(JSON.stringify(message, undefined, 2));
        dLogger.debug("");

        connection=connections[hostName];
        if(connection) {
            if(message.applicationId!=="Base" && connection.state!=="Open"){
                stats.incrementClientError(hostName, message.commandCode);
                dLogger.warn("SendRequest - Connection is not in 'Open' state. Discarding message");
            }
            else try {
                if(dLogger["inVerbose"]) logMessage(config.diameterConfig["originHost"], connection.hostName, message);
                connection.socket.write(message.encode());
                stats.incrementClientRequest(hostName, message.commandCode);
                requestPointers[hostName+"."+message.hopByHopId] = {
                    "timer": setTimeout(function () {
                        delete requestPointers[hostName+"."+message.hopByHopId];
                        stats.incrementClientError(hostName, message.commandCode);
                        callback(new Error("timeout"), null);
                    }, timeout),
                    "callback": callback
                };
            } catch(e){
                // Message encoding error
                stats.incrementClientError(connection.hostName, message.commandCode);
                dLogger.error("Could not encode & send request: "+e.message);
                dLogger.error("Closing connection");
                dLogger.error(e.stack);
                connection.socket.end();
                connection.state="Closing";
                // Will be deleted when close event arrives
            }
        }
        else {
            dLogger.warn("Could not send request. No connection to "+hostName);
        }
    };

    // State machine functions

    // Terminate connection
    diameterStateMachine.onConnectionClosed=function(connection){
        dLogger.info("Closing connection to "+connection.hostName);
        if(connections[connection.hostName]) delete connections[connection.hostName];
    };

    ///////////////////////////////////////////////////////////////////////////
    // Active connections
    ///////////////////////////////////////////////////////////////////////////

    // Establishes connections with peers with "active" connection policy, if not already established
    diameterStateMachine.establishConnections=function(){
        dLogger.debug("Checking connections");
        // Iterate through peers and check if a new connection has to be established
        for(i=0; i<config.diameterConfig["peers"].length; i++){
            peer=config.diameterConfig["peers"][i];
            if(peer["connectionPolicy"]==="active" && !connections[peer["originHost"]]){
                dLogger.verbose("Connecting to "+peer["originHost"]+" in address "+peer["IPAddress"]);
                connections[peer["originHost"]]=createConnection(diameterStateMachine, net.connect(peer["IPAddress"].split(":")[1]||3868, peer["IPAddress"].split(":")[0]) , peer["originHost"], "Wait-Conn-Ack");
            }
        }
        // Iterate through connections and check if a connection has to be closed
        // TODO:
    };

    diameterStateMachine.onConnectionACK=function(connection){
        dLogger.verbose("Connection established with "+connection.hostName);
        sendCer(connection);
        connection.state="Wait-CEA";
    };

    diameterStateMachine.onCEAReceived=function(connection){
        // Already handled
        dLogger.debug("CEA received from "+connection.hostName);
        connection.state="Open";
    };

    ///////////////////////////////////////////////////////////////////////////
    // Passive connections
    ///////////////////////////////////////////////////////////////////////////

    // DEPRECATED. ALLOWS MORE THAN ONE ORIGIN-HOST WITH THE SAME IP-ADDRESS
    diameterStateMachine.onConnectionReceived2=function(socket){
        var tmpHostName;

        dLogger.verbose("got connection from "+socket["remoteAddress"]);

        // Check whether there is at least one peer with that IP Address
        peer=null;
        for(i=0; i<config.diameterConfig["peers"].length; i++){
            if(config.diameterConfig["peers"][i]["IPAddress"].split(":")[0]===socket["remoteAddress"]) peer=config.diameterConfig["peers"][i];
        }
        if(peer===null){
            dLogger.info("Received connection from unknown peer "+socket["remoteAddress"]);
            socket.end();
            return;
        }

        // Create new connection. Temporary key is IPAddress:port
        tmpHostName=socket["remoteAddress"]+":"+socket["remotePort"];
        connections[tmpHostName]=createConnection(diameterStateMachine, socket, tmpHostName, "Wait-CER");
    };

    // DEPRECATED. ALLOWS MORE THAN ONE ORIGIN-HOST WITH THE SAME IP-ADDRESS
    diameterStateMachine.onCERReceived2=function(connection, hostName){
        var peerFound=false;
        var tmpHostName=connection.socket["remoteAddress"]+":"+connection.socket["remotePort"];
        connection=connections[tmpHostName];
        if(connection && connection.state==="Wait-CER"){
            // Check that Origin-Host is declared as peer with the received origin IP address
            ipAddress=connection.socket["remoteAddress"];
            for(i=0; i<config.diameterConfig["peers"].length; i++){
                peer=config.diameterConfig["peers"][i];

                if(peer["originHost"]===hostName && peer["IPAddress"].split(":")[0]===connection.socket["remoteAddress"]){
                    peerFound=true;
                    // TODO: Election process should be implemented here
                    // Here we make sure that only one connection from/to a specific host will be established
                    if(!connections[hostName]) {
                        // Index by hostName
                        connections[hostName]=connection;
                        // Remove old entry
                        delete connections[tmpHostName];
                        // Change connection properties
                        connection.hostName = hostName;
                        connection.state = "Open";
                        // Everything OK
                        return true;
                    }
                    else dLogger.warn("Connection already established with "+hostName);
                    break;
                }
            }
        }else{
            dLogger.warn("CER out of sequence for originHost "+connection.socket["remoteAddress"]);
        }

        if(!peerFound) dLogger.warn(hostName+" peer, connecting from "+connection.socket["remoteAddress"]+" not configured");

        // If here, something went wrong
        connection.socket.end();
        connection.state="Closing";
        // Connection will be deleted when close event arrives
        return false;
    };

    // Only one peer for each IPAddress is allowed
    diameterStateMachine.onConnectionReceived=function(socket){
        dLogger.verbose("Got connection from "+socket["remoteAddress"]);

        // Look for Origin-Host in peer table
        peer=null;
        for(i=0; i<config.diameterConfig["peers"].length; i++) if(config.diameterConfig["peers"][i]["IPAddress"].split(":")[0]===socket["remoteAddress"]){
            // Peer found
            peer=config.diameterConfig["peers"][i];

            // Create new connection if does not already exist. Origin-Host is the only one for the connecting IP address
            if(!connections[peer["originHost"]]) connections[peer["originHost"]]=createConnection(diameterStateMachine, socket, peer["originHost"], "Wait-CER");
            else{
                dLogger.warn("Connection to host already exists");
                socket.end();
            }

            return;
        }

        // If here, peer was not found for the origin IP-Address
        dLogger.warn("Received connection from unknown peer "+socket["remoteAddress"]);
        socket.end();
        return;
    };

    // Here the peer declares the origin-host, which must match the one in the peer table
    diameterStateMachine.onCERReceived=function(connection, hostName){
        // Check that the hostName matches the one for the connection
        if(connections[hostName] && connections[hostName].socket["remoteAddress"]==connection.socket["remoteAddress"]){ //if(connections[hostName]===connection))
            connection.state="Open";
            // Everything OK
            return true;
        }

        // If here, something went wrong
        dLogger.warn("Origin-Host "+hostName+" does not match");
        connection.socket.end();
        connection.state="Closing";
        // Connection will be deleted when close event arrives
        return false;
    };

    ///////////////////////////////////////////////////////////////////////////
    // Instrumentation
    ///////////////////////////////////////////////////////////////////////////
    diameterStateMachine.getConnectionsStatus=function(){
        var connectionStatus=[];
        var hostName;
        for(var hostName in connections) if(connections.hasOwnProperty(hostName)){
            connectionStatus.push({hostName: hostName, state: connections[hostName]["state"]});
        }
        return connectionStatus;
    };

    ///////////////////////////////////////////////////////////////////////////
    // Startup
    ///////////////////////////////////////////////////////////////////////////

    var diameterServer;

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
            diameterServer=net.createServer();

            diameterServer.on("connection", diameterStateMachine.onConnectionReceived);

            diameterServer.listen(config.diameterConfig.port||3868);
            dLogger.info("Diameter listening in port "+config.diameterConfig.port);

            // Create management HTTP server
            createAgent(diameterStateMachine);

            // Establish outgoing connections
            diameterStateMachine.establishConnections();
            // Set timer for periodically checking connections
            setInterval(diameterStateMachine.establishConnections, config.diameterConfig["connectionInterval"]||10000);
        }
    });

    return diameterStateMachine;
};

exports.diameterStateMachine=createDiameterStateMachine();







