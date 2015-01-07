// Main file for Diameter server
// Implements state machine
// TODO: Implement duplicate detection.
// --- Cache of Ent2EndId being processed and processed

var net=require("net");
var dgram=require("dgram");
var radius=require("radius");
var radiusHandler=require("./radiusHandler").radiusHandler;
var dLogger=require("./log").dLogger;
var config=require("./config").config;
var createConnection=require("./diameterConnection").createConnection;
var createRadiusClientConnections=require("./radiusConnection").createRadiusClientConnections;
var createMessage=require("./message").createMessage;
var diameterStats=require("./stats").diameterStats;
var radiusStats=require("./stats").radiusStats;
var createAgent=require("./agent").createAgent;

process.title="lever-policyserver";

// Singleton
var createPolicyServer=function(){
    
    // Diameter Server
    var diameterServer={};

    // Radius server
    var radiusServer={};

    // Peer table
    // Entries as {<diameterHost>: <connection object>}
    var peerConnections={};

    // Radius client connections helper object
    var radiusClientConnections;

    // Reference to diameter messages sent and waiting for answer (both requests or responses)
    // Holds a reference to the callback function and timer for each destinationHost+HopByHopID
    var diameterRequestPointers={};

    // Reference to client messages sent and waiting for answer (can only be requests)
    // Holds a reference to the callback function and timer for each destinationClient+RadiusIdentifier

    var radiusRequestPointers={};

    /** Returns the appropriate diameter connection
     *
     * @param message
     * @returns peerConnectionsEntry
     */
    diameterServer.findConnection=function(message){
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

        if(dLogger["inVerbose"]) dLogger.logDiameterMessage(connection.diameterHost, config.node.diameter["diameterHost"], message);

        if (message.isRequest) {
            // Handle message if there is a handler configured for this type of request
            diameterStats.incrementServerRequest(connection.diameterHost, message.commandCode);
            // if(there is a handler)
            if(((dispatcher[message.applicationId]||{})[message.commandCode]||{})["handler"]){
                if(dLogger["inDebug"]) dLogger.debug("Message is Request. Dispatching message to: "+dispatcher[message.applicationId][message.commandCode].functionName);
                try {
                    dispatcher[message.applicationId][message.commandCode]["handler"](connection, message);
                }catch(e){
                    diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
                    dLogger.error("Handler error in "+dispatcher[message.applicationId][message.commandCode].functionName);
                    dLogger.error(e.message);
                    dLogger.error(e.stack);
                }
            }
            else{
                diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
                dLogger.warn("No handler defined for Application: " + message.applicationId + " and command: " + message.commandCode);
            }
        } else {
            dLogger.debug("Message is Response");
            diameterStats.incrementClientResponse(connection.diameterHost, message.commandCode, message.avps["Result-Code"]||0);
            requestPointer=diameterRequestPointers[connection.diameterHost+"."+message.hopByHopId];
            if(requestPointer) {
                clearTimeout(requestPointer.timer);
                delete diameterRequestPointers[connection.diameterHost+"."+message.hopByHopId];
                dLogger.debug("Executing callback");
                try {
                    requestPointer.callback(null, message);
                }
                catch(err){
                    dLogger.error("Error in diameter response callback: "+err.message);
                }
            } else{
                dLogger.warn("Unsolicited or stale response message from "+connection.diameterHost);
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
            diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
        }
        else try {
            if(dLogger["inVerbose"]) dLogger.logDiameterMessage(config.node.diameter["diameterHost"], connection.diameterHost, message);
            connection.write(message.encode());
            diameterStats.incrementServerResponse(connection.diameterHost, message.commandCode, message.avps["Result-Code"]||0);
        }
        catch(e){
            // Message encoding error
            diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
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
        if(!connection) connection=diameterServer.findConnection(message);

        if(connection) {
            if(message.applicationId!=="Base" && connection.getState()!=="Open"){
                diameterStats.incrementClientError(connection.diameterHost, message.commandCode);
                dLogger.warn("SendRequest - Connection is not in 'Open' state. Discarding message");
            }
            else try {
                if(dLogger["inVerbose"]) dLogger.logDiameterMessage(config.node.diameter["diameterHost"], connection.diameterHost, message);
                connection.write(message.encode());
                diameterStats.incrementClientRequest(connection.diameterHost, message.commandCode);
                diameterRequestPointers[connection.diameterHost+"."+message.hopByHopId] = {
                    "timer": setTimeout(function () {
                        delete diameterRequestPointers[connection.diameterHost+"."+message.hopByHopId];
                        diameterStats.incrementClientError(connection.diameterHost, message.commandCode);
                        callback(new Error("timeout"), null);
                    }, timeout),
                    "callback": callback
                };
            } catch(e){
                // Message encoding error
                diameterStats.incrementClientError(connection.diameterHost, message.commandCode);
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
    // Radius functions
    ///////////////////////////////////////////////////////////////////////////
    radiusServer.onSocketError=function(err){
        dLogger.error("Radius server socket error: "+err.message);
    };

    /**
     * Called when a datagram is received on any of the server sockets (auth or acct)
     * @param buffer
     * @param rinfo
     */
    radiusServer.onRequestReceived=function(buffer, rinfo){
        if(dLogger["inDebug"]) dLogger.debug("Radius request received from "+rinfo.address+" with "+buffer.length+" bytes of data");
        var client=config.node.radius.radiusClientMap[rinfo.address];
        if(!client){
            dLogger.warn("Radius request from unknown client: "+rinfo.address);
            return;
        }

        try {
            var radiusMessage=radius.decode({packet: buffer, secret: client.secret});
            dLogger.logRadiusServerRequest(client.name, radiusMessage.code);
            radiusStats.incrementServerRequest(client.name, radiusMessage.code);

            // Decorate message
            radiusMessage._ipAddress=rinfo.address;
            radiusMessage._port=rinfo.port;
            radiusMessage._secret=client.secret;
            radiusMessage._clientName=client.name;
        }
        catch(e){
            radiusStats.incrementServerError(client.name);
            dLogger.error("Error decoding radius packet: "+e.message);
            return;
        }

        try {
            // Handle message
            if (radiusMessage.code=="Access-Request") {
                radiusHandler.handleAccessRequest(radiusServer, radiusMessage);
            }
            else if (radiusMessage.code=="Accounting-Request") {
                radiusHandler.handleAccountingRequest(radiusServer, radiusMessage);
            }
            else dLogger.error("Unknown code: "+radiusMessage.code);
        }
        catch(e){
            radiusStats.incrementServerError(client.name);
            dLogger.error("Radius Handler error: "+e.message);
        }
    };

    /**
     * Invoked by the handlers to send a reply radius message
     * @param requestMessage the original request message
     * @param code of the message to send
     * @param attributes to send
     */
    radiusServer.sendReply=function(requestMessage, code, attributes){
        var radiusReply={
            code:code,
            packet: requestMessage,
            secret: requestMessage._secret,
            attributes:attributes};

        var buffer=radius.encode_response(radiusReply);

        radiusStats.incrementServerResponse(requestMessage._clientName, code);
        radiusAuthSocket.send(buffer, 0, buffer.length, requestMessage._port, requestMessage._ipAddress);
    };

    /**
     * Invoked by the handlers to send a radius message.
     * @param code
     * @param attributes
     * @param ipAddress
     * @param port
     * @param secret
     * @param timeout
     * @param nTries
     * @param callback
     */
    radiusServer.sendRequest=function(code, attributes, ipAddress, port, secret, timeout, nTries, callback){
        // Checks
        if(nTries<=0) throw new Error("nTries should be >0");
        if(!callback) throw new Error("Callback parameter is required");

        // Number of packets already sent
        var tried=0;

        try {
            var rParams=radiusClientConnections.getClientSocket();
            var radiusRequest={
                code: code,
                secret: secret,
                identifier: rParams.id,
                attributes: attributes
                /*add_message_authenticator: false */};

            var buffer=radius.encode(radiusRequest);
            radiusStats.incrementClientRequest(code, ipAddress);

            // Send the message
            dLogger.logRadiusClientRequest(ipAddress, code, false);
            rParams.socket.send(buffer, 0, buffer.length, port, ipAddress);

            // Setup response hook
            var timeoutFnc=function(){
                tried++;
                if(tried==nTries){
                    // Timeout and retries expired
                    delete radiusRequestPointers[ipAddress+":"+rParams.id];
                    radiusStats.incrementClientError(ipAddress);
                    if(callback) callback(new Error("timeout"));
                }
                else {
                    // Re-send the message
                    dLogger.logRadiusClientRequest(ipAddress, code, true);
                    rParams.socket.send(buffer, 0, buffer.length, port, ipAddress);

                    // Re-set response hook
                    radiusRequestPointers[ipAddress+":"+rParams.id]["timer"]=setTimeout(timeoutFnc, timeout);
                }
            };

            radiusRequestPointers[ipAddress+":"+rParams.id]={
                "timer": setTimeout(timeoutFnc, timeout),
                "callback": callback,
                "secret": secret
            };
        }
        catch(err){
            dLogger.error("Could not send radius request: "+err.message);
            radiusStats.incrementClientError(ipAddress);
        }
    };

    radiusServer.onResponseReceived=function(buffer, rinfo){
        if(dLogger["inDebug"]) dLogger.debug("Radius response received from "+rinfo.address+" with "+buffer.length+" bytes of data");

        // Pre-decode message
        var response=radius.decode_without_secret({packet: buffer});

        // Lookup in response hooks
        var requestPointer=radiusRequestPointers[rinfo.address+":"+response.identifier];
        if(!requestPointer){
            dLogger.warn("Unsolicited or stale response from "+rinfo.address);
            return;
        }

        // decode message
        response=radius.decode({packet: buffer, secret: requestPointer.secret});

        // Log and increment counter
        dLogger.logRadiusClientResponse(rinfo.address, response.code);
        radiusStats.incrementClientResponse(rinfo.address, response.code);

        // Process message
        clearTimeout(requestPointer.timer);
        delete radiusRequestPointers[rinfo.address+"."+response.identifier];
        dLogger.debug("Executing callback");
        try{
            requestPointer.callback(null, response);
        }
        catch(err){
            dLogger.error("Error in diameter response callback: "+err.message);
        }
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
    var radiusAuthSocket;
    var radiusAcctSocket;

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

            // Diameter //

            // Create Listener on Diameter port
            diameterSocket=net.createServer();
            diameterSocket.on("connection", diameterServer.onConnectionReceived);
            diameterSocket.listen(config.node.diameter.port||3868);
            dLogger.info("Diameter listening in port "+config.node.diameter.port);

            // Establish outgoing connections
            diameterServer.manageConnections();

            // Set timer for periodically checking connections
            setInterval(diameterServer.manageConnections, config.node.diameter["connectionInterval"]||10000);


            // Radius //

            // Server sockets
            radiusAuthSocket=dgram.createSocket("udp4");
            radiusAcctSocket=dgram.createSocket("udp4");
            radiusAuthSocket.bind(config.node.radius.authPort, config.node.radius.IPAddress);
            radiusAcctSocket.bind(config.node.radius.acctPort, config.node.radius.IPAddress);
            radiusAuthSocket.on("message", radiusServer.onRequestReceived);
            radiusAcctSocket.on("message", radiusServer.onRequestReceived);
            radiusAuthSocket.on("error", radiusServer.onSocketError);
            radiusAcctSocket.on("error", radiusServer.onSocketError);
            dLogger.info("Radius auth listening in port "+config.node.radius.authPort);
            dLogger.info("Radius acct listening in port "+config.node.radius.acctPort);

            // Client sockets
            radiusClientConnections=createRadiusClientConnections(radiusServer, config.node.radius.baseClientPort, 10, config.node.radius.IPAddress);

            // Create management HTTP server
            createAgent(diameterServer, radiusServer);
        }
    });

};

createPolicyServer();







