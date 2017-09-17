// Main file for Diameter server
// Implements state machine
// TODO: Implement duplicate detection.
// --- Cache of Ent2EndId being processed and processed

var Q=require("q");
var net=require("net");
var dgram=require("dgram"); 
var radius=require("radius");
var logger=require("./log").logger;
var createConnection=require("./diameterConnection").createConnection;
var createRadiusClientPorts=require("./radiusClientPorts").createRadiusClientPorts;
var createMessage=require("./message").createMessage;
var diameterStats=require("./stats").diameterStats;
var radiusStats=require("./stats").radiusStats;
var createAgent=require("./agent").createAgent;
var config=require("./configService").config;
var arm=require("arm").arm;

// Singleton
var createPolicyServer=function(hostName){
    
    // Diameter Server
    var diameterServer={};

    // Radius server
    var radiusServer={};

    // Exportable
    var policyServer={
        diameter: diameterServer,
        radius: radiusServer
    };

    // Peer table
    // Entries as {<diameterHost>: <connection object>}
    var peerConnections={};

    // Radius client connections helper object
    var radiusClientPorts;

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
    function findConnection(message){
        var i;
        
        // If Destination-Host is present, use it
        if(message.avps["Destination-Host"]) return peerConnections[message.avps["Destination-Host"]];
        
        // Otherwise, route based on Destination-Realm
        else if(message.avps["Destination-Realm"]){
            // Lookup in routing configuration
            var chkRoute, route;
            var routes=config.node.diameter.routes;
            for(i=0; i<routes.length; i++){
                chkRoute=routes[i];
                if(chkRoute["realm"]=="*" || chkRoute["realm"]==message.avps["Destination-Realm"]){
                    if(chkRoute["applicationId"]=="*" || chkRoute["applicationId"]==message.applicationId){
                        route=chkRoute;
                        break;
                    }
                }
            }
            if(route){
                // Policy is "fixed"
                if(route["policy"]=="fixed") {
                    for (i=0; i<route["peers"].length; i++) {
                        if(logger.isDebugEnabled) logger.debug("Checking peer %s", route["peers"][i]);
                        if(peerConnections[route["peers"][i]]) if(peerConnections[route["peers"][i]].getState()=="Open") return peerConnections[route["peers"][i]];
                    }
                    if(logger.isVerboseEnabled) logger.verbose("All routes closed [fixed policy]");
                    return null;
                }
                else {
                    // Policy is "random"
                    var activePeerEntries=[];
                    for (i = 0; i < route["peers"].length; i++) {
                        if(logger.isDebugEnabled) logger.debug("Checking peer %s", route["peers"][i]);
                        if(peerConnections[route["peers"][i]]) if (peerConnections[route["peers"][i]].getState() == "Open") activePeerEntries.push(peerConnections[route["peers"][i]]);
                    }
                    if(activePeerEntries.length>0) return activePeerEntries[Math.floor(Math.random()*activePeerEntries.length)];
                    else if(logger.isVerboseEnabled) logger.verbose("All routes closed [random policy]");
                }
            }
            else{
                if(logger.isWarnEnabled) logger.warn("No route for Destination-Realm: %s and Application-Id: ", message.avps["Destination-Realm"], message.applicationId);
                return null;
            }
        }
        // Unable to deliver
        else{
            if(logger.isWarnEnabled) logger.warn("Message has no routing AVP");
            return null;
        }
    }

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
            if(logger.isErrorEnabled) logger.error("Diameter decoding error: %s", e.message);
            if(logger.isVerboseEnabled) logger.verbose(e.stack);
            connection.end();
            return;
        }

        if(logger.isDebugEnabled) {
            logger.debug("");
            logger.debug("Receiving message --------------------");
            logger.debug(JSON.stringify(message, null, 2));
            logger.debug("");
        }

        logger.logDiameterMessage(connection.diameterHost, config.node.diameter["diameterHost"], message);

        if (message.isRequest) {
            // Handle message if there is a handler configured for this type of request
            diameterStats.incrementServerRequest(connection.diameterHost, message.commandCode);
            // if(there is a handler)
            if(((dispatcher[message.applicationId]||{})[message.commandCode]||{})["handler"]){
                if(logger.isDebugEnabled) logger.debug("Message is Request. Dispatching message to: %s", dispatcher[message.applicationId][message.commandCode].functionName);
                try {
                    dispatcher[message.applicationId][message.commandCode]["handler"](connection, message);
                }catch(e){
                    diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
                    if(logger.isErrorEnabled){
                        logger.error("Handler error in %s ", dispatcher[message.applicationId][message.commandCode].functionName);
                        logger.error(e.message);
                        if(logger.isVerboseEnabled) logger.verbose(e.stack);
                    }
                }
            }
            else{
                diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
                if(logger.isWarnEnabled) logger.warn("No handler defined for Application: %s and command: %s", message.applicationId, message.commandCode);
            }
        } else {
            if(logger.isDebugEnabled) logger.debug("Message is Response");
            diameterStats.incrementClientResponse(connection.diameterHost, message.commandCode, message.avps["Result-Code"]||0);
            requestPointer=diameterRequestPointers[connection.diameterHost+"."+message.hopByHopId];
            if(requestPointer) {
                clearTimeout(requestPointer.timer);
                delete diameterRequestPointers[connection.diameterHost+"."+message.hopByHopId];
                if(logger.isDebugEnabled) logger.debug("Executing callback");
                try {
                    requestPointer.callback(null, message);
                }
                catch(err){
                    if(logger.isErrorEnabled){
                        logger.error("Error in diameter response callback: %s", err.message);
                        if(logger.isDebugEnabled) logger.verbose(err.stack);
                    }
                }
            } else{
                if(logger.isWarnEnabled) logger.warn("Unsolicited or stale response message from %s", connection.diameterHost);
            }
        }
    };

    /**
     * Sends a reply using the specified connection
     * @param connection
     * @param message
     */
    diameterServer.sendReply=function(connection, message){

        if(logger.isDebugEnabled) {
            logger.debug("");
            logger.debug("Sending reply ------------------------");
            logger.debug(JSON.stringify(message, null, 2));
            logger.debug("");
        }

        if(connection.getState()!=="Open"){
            logger.warn("SendReply - Connection is not in 'Open' state. Discarding message");
            diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
        }
        else try {
            logger.logDiameterMessage(config.node.diameter["diameterHost"], connection.diameterHost, message);
            connection.write(message.encode());
            diameterStats.incrementServerResponse(connection.diameterHost, message.commandCode, message.avps["Result-Code"]||0);
        }
        catch(err){
            // Message encoding error
            diameterStats.incrementServerError(connection.diameterHost, message.commandCode);
            if(logger.isErrorEnabled){
                logger.error("Could not encode and send reply: %s", err.message);
                logger.error("Closing connection");
                if(logger.isDebugEnabled) logger.verbose(err.stack);
            }
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

        if(logger.isDebugEnabled) {
            logger.debug("");
            logger.debug("Sending request ----------------------");
            logger.debug(JSON.stringify(message, null, 2));
            logger.debug("");
        }

        // Route Message if no connection was specified
        if(!connection) connection=findConnection(message);

        if(connection) {
            if(message.applicationId!=="Base" && connection.getState()!=="Open"){
                diameterStats.incrementClientError(connection.diameterHost, message.commandCode);
                logger.warn("SendRequest - Connection is not in 'Open' state. Discarding message");
                if(callback) callback(new Error("Connection is not in 'Open' state"));
            }
            else try {
                logger.logDiameterMessage(config.node.diameter["diameterHost"], connection.diameterHost, message);
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
            } catch(err){
                // Message encoding error
                diameterStats.incrementClientError(connection.diameterHost, message.commandCode);
                if(logger.isErrorEnabled){
                    logger.error("Could not encode and send request: "+e.message);
                    logger.error("Closing connection");
                    if(logger.isDebugEnabled) logger.verbose(err.stack);
                }
                connection.end();
                if(callback) callback(err);
            }
        }
        else {
            logger.warn("Could not send request. No route to destination");
            if(callback) callback(new Error("No route to destination"), null);
        }
    };

    ///////////////////////////////////////////////////////////////////////////
    // Active connections
    ///////////////////////////////////////////////////////////////////////////

    // Establishes connections with peers with "active" connection policy, if not already established
    function manageConnections(){
        logger.debug("Checking connections");
        var i;
        
        // Iterate through peers and check if a new connection has to be established
        for(i=0; i<config.node.diameter["peers"].length; i++){
            var peer=config.node.diameter["peers"][i];

            // Make sure entry exists in peer table
            if(!peerConnections[peer["diameterHost"]]) peerConnections[peer["diameterHost"]]=createConnection(diameterServer, peer["diameterHost"], peer["dwrInterval"]);

            // Establish connection if necessary
            if(peer["connectionPolicy"]==="active" && peerConnections[peer["diameterHost"]].getState()=="Closed"){
                logger.info("Connecting to %s in address %s", peer["diameterHost"], peer["IPAddress"]);
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
            if(!found){
                logger.info("Disconnecting from %s", diameterHost);
                peerConnections[diameterHost].end();
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    // Passive connections
    ///////////////////////////////////////////////////////////////////////////

    /**
     * Invoked when a new connection is received.
     * @param socket
     */
    function onDiameterConnectionReceived(socket){
        if(logger.isVerboseEnabled) logger.verbose("Got connection from %s", socket["remoteAddress"]);

        // Look for Origin-Host in peer table
        var peer=null;
        var i;
        for(i=0; i<config.node.diameter["peers"].length; i++) if(config.node.diameter["peers"][i]["IPAddress"].indexOf(socket["remoteAddress"]!==-1)){
            // Peer found
            peer=config.node.diameter["peers"][i];

            // Make sure that entry exist in peerConnections table, or create it otherwise
            if(!peerConnections[peer["diameterHost"]]) peerConnections[peer["diameterHost"]]=createConnection(diameterServer, peer["diameterHost"], peer["dwrInterval"]);

            // If closed, set socket to newly received connection
            if(peerConnections[peer["diameterHost"]].getState()=="Closed"){
                peerConnections[peer["diameterHost"]].attachConnection(socket);
            }
            else{
                logger.warn("There is already a non closed connection to the host %s", peer["diameterHost"]);
                socket.end();
            }
            return;
        }

        // If here, peer was not found for the origin IP-Address
        logger.warn("Received connection from unknown peer %s", socket["remoteAddress"]);
        socket.end();
    }

    ///////////////////////////////////////////////////////////////////////////
    // Radius functions
    ///////////////////////////////////////////////////////////////////////////
    function onRadiusSocketError(err){
        logger.error("Radius server socket error: %s", err.message);
    }

    /**
     * Called when radius request received on auth port
     * @param buffer
     * @param rinfo
     */
    function onRadiusAuthRequestReceived(buffer, rinfo){
        onRadiusRequestReceived(this, buffer, rinfo);
    }

    /**
     * Called when radius request received on acct port
     * @param buffer
     * @param rinfo
     */
    function onRadiusAcctRequestReceived(buffer, rinfo){
        onRadiusRequestReceived(this, buffer, rinfo);
    }

    /**
     * Called when a datagram is received on any of the server sockets (auth or acct)
     *
     * Server requests is always incremented
     * Server error if socket error, no handler or handler generates exception
     *
     * @param buffer
     * @param rinfo
     * @param socket
     */
    function onRadiusRequestReceived(socket, buffer, rinfo){
        if(logger.isDebugEnabled) logger.debug("Radius request received from %s with %s bytes of data"+rinfo.address, buffer.length);
        var client=config.node.radius.radiusClientMap[rinfo.address];
        if(!client){
            logger.warn("Radius request from unknown client: %s", rinfo.address);
            return;
        }

        try {
            var radiusMessage=radius.decode({packet: buffer, secret: client.secret});
            logger.logRadiusServerRequest(client.name, radiusMessage.code);
            radiusStats.incrementServerRequest(client.name, radiusMessage.code);

            // Decorate message
            radiusMessage._socket=socket;
            radiusMessage._ipAddress=rinfo.address;
            radiusMessage._port=rinfo.port;
            radiusMessage._secret=client.secret;
            radiusMessage._clientName=client.name;
        }
        catch(err){
            radiusStats.incrementServerError(client.name);
            if(logger.isErrorEnabled){
                logger.error("Error decoding radius packet: %s"+err.message);
                if(logger.isVerboseEnabled) logger.verbose(e.stack);
            }
            return;
        }

        var dispatcher=config.dispatcher;

        // if(there is a handler)
        if(((dispatcher["Radius"]||{})[radiusMessage.code]||{})["handler"]){
            if(logger.isDebugEnabled) logger.debug("Message is Request. Dispatching message to: %s", dispatcher["Radius"][radiusMessage.code].functionName);
            try {
                dispatcher["Radius"][radiusMessage.code]["handler"](radiusServer, radiusMessage);
            }catch(err){
                radiusStats.incrementServerError(client.name);
                if(logger.isErrorEnabled){
                    logger.error("Radius handler error in %s", dispatcher["Radius"][radiusMessage.code].functionName);
                    logger.error(err.message);
                    if(logger.isDebugEnabled) logger.verbose(err.stack);
                }
            }
        }
        else{
            radiusStats.incrementServerError(client.name);
            if(logger.isErrorEnabled) logger.error("Unknown code: %s", radiusMessage.code);
        }
    }

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

        logger.logRadiusServerResponse(requestMessage._clientName, code);
        radiusStats.incrementServerResponse(requestMessage._clientName, code);
        requestMessage._socket.send(buffer, 0, buffer.length, requestMessage._port, requestMessage._ipAddress);
    };

    /**
     * Sends a radius request to the specified ip address and port.
     *
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
        if(!nTries || nTries<=0) throw new Error("nTries should be >0");

        // Number of packets already sent
        var tried=0;

        try {
            var rParams=radiusClientPorts.getClientSocket();
            var radiusRequest={
                code: code,
                secret: secret,
                identifier: rParams.id,
                attributes: attributes
                /*add_message_authenticator: false */};

            var buffer=radius.encode(radiusRequest);

            // Send the message
            logger.logRadiusClientRequest(ipAddress, code, false);
            rParams.socket.send(buffer, 0, buffer.length, port, ipAddress);
            radiusStats.incrementClientRequest(ipAddress, code);

            // Setup response hook
            var timeoutFnc=function(){
                tried++;
                radiusStats.incrementClientTimeout(ipAddress, code);
                if(tried==nTries){
                    // Timeout and retries expired
                    delete radiusRequestPointers[rParams.socket.address().port+":"+rParams.id];

                    if(callback) callback(new Error("timeout"));
                }
                else {
                    // Re-send the message
                    logger.logRadiusClientRequest(ipAddress, code, true);
                    rParams.socket.send(buffer, 0, buffer.length, port, ipAddress);
                    radiusStats.incrementClientRequest(ipAddress, code);

                    // Re-set response hook
                    radiusRequestPointers[rParams.socket.address().port+":"+rParams.id]["timer"]=setTimeout(timeoutFnc, timeout);
                }
            };
            radiusRequestPointers[rParams.socket.address().port+":"+rParams.id]={
                "timer": setTimeout(timeoutFnc, timeout),
                "callback": callback,
                "secret": secret
            };
        }
        catch(err){
            if(logger.isErrorEnabled) logger.error("Could not send radius request: %s", err.message);
            if(logger.isDebugEnabled) logger.verbose(err.stack);

            radiusStats.incrementClientError(ipAddress);
            if(callback) callback(err, null);
        }
    };

    /**
     * Sends the radius request to the specified server, using the configured parameters
     * Throws exception if the serverName is not known
     * @param code
     * @param attributes
     * @param serverName
     * @param callback //(err, response)//
     */
    radiusServer.sendServerRequest=function(code, attributes, serverName, callback){
        var servers=config.node.radius.radiusServerMap;
        if(!servers[serverName]) throw serverName+" radius server is unknown";

        var server=servers[serverName];
        if(server["quarantineDate"] && server["quarantineDate"].getTime()>Date.now()){
            callback(new Error(serverName+" in quarantine"));
            return;
        }

        radiusServer.sendRequest(code, attributes, server["IPAddress"], server["ports"][code], server["secret"], server["timeoutMillis"], server["tries"], function(err, response){
            if(err){
                server["nErrors"]=(server["nErrors"]||0)+1;
                if(server["nErrors"]>=server["errorThreshold"]){
                    // Setup quarantine time
                    if(logger.isWarnEnabled) logger.warn("%s in now in quarantine", serverName);
                    server["quarantineDate"]=new Date(Date.now()+server["quarantineTimeMillis"]);
                    server["nErrors"]=0;
                }
                if(callback) callback(err);
            }
            else{
                // Success, and nError is thus reset
                server["nErrors"]=0;
                if(callback) callback(null, response);
            }
        });
    };

    /**
     * Iterates through the server group to send the specified radius packet. It tries to
     * send it to a single server
     * @param code
     * @param attributes
     * @param serverGroupName
     * @param callback
     */
    radiusServer.sendServerGroupRequest=function(code, attributes, serverGroupName, callback){
        var serverGroups=config.node.radius.radiusServerGroupMap;
        if(!serverGroups[serverGroupName]) throw new Error(serverGroupName+" radius server group is unknown");

        var serverGroup=serverGroups[serverGroupName];
        var nServers=serverGroup["servers"].length;
        var r;
        if(serverGroup["policy"]=="fixed") r=0; else r=Math.floor(Math.random()*nServers);
        var i=0;
        var makeRequest=function(serverName){
            radiusServer.sendServerRequest(code, attributes, serverName, function(err, response){
                if(!err) callback(null, response);
                else{
                    i++;
                    if(i<nServers) makeRequest(serverGroup["servers"][(i+r)%nServers]);
                    else callback(new Error("Tried all servers"));
                }
            });
        };

        makeRequest(serverGroup["servers"][(i+r)%nServers]);
    };

    /**
     * Called when a response is received on a client socket
     * @param buffer message received
     * @param rInfo remote info
     * @param lInfo local info (socket.address()
     */
    radiusServer.onResponseReceived=function(buffer, rInfo, lInfo){
        if(logger.isDebugEnabled) logger.debug("Radius response received from %s with %s bytes of data",rInfo.address, buffer.length);

        // Pre-decode message
        var response;
        try{
            response=radius.decode_without_secret({packet: buffer});
        } catch(err){
            logger.error("Error decoding response: %s", err.message);
            radiusStats.incrementClientError(rInfo.address);
            return;
        }

        // Lookup in response hooks
        var requestPointer=radiusRequestPointers[lInfo.port+":"+response.identifier];
        if(!requestPointer){
            logger.warn("Unsolicited or stale response from %s", rInfo.address);
            return;
        }

        var callback=requestPointer.callback;
        clearTimeout(requestPointer.timer);
        delete radiusRequestPointers[lInfo.port+":"+response.identifier];

        // decode message
        try {
            response = radius.decode({packet: buffer, secret: requestPointer.secret});
        } catch(err){
            logger.error("Error decoding response: %s", err.message);
            radiusStats.incrementClientError(rInfo.address);
            return;
        }

        // Log and increment counter
        logger.logRadiusClientResponse(rInfo.address, response.code);
        radiusStats.incrementClientResponse(rInfo.address, response.code);

        // Process message
        logger.debug("Executing callback");
        try{
            callback(null, response);
        }
        catch(err){
            if(logger.isErrorEnabled) logger.error("Error in radius response callback: %s", err.message);
            if(logger.isDebugEnabled) logger.verbose(err.stack);
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

    policyServer.initialize=function(initCallback) {
        var radiusAuthSocket;
        var radiusAcctSocket;
        var diameterSocket;

        config.initialize(hostName).then(function () {

                // Initialize arm library
                arm.setLogger(logger);
                arm.setDatabaseConnections(config.getConfigDB(), config.getClientDB(), config.getEventDB(), config.getDBQueryOptions(), config.getDBWriteOptions());
                arm.setConfigProperties({
                    maxBytesCredit: null,
                    maxSecondsCredit: null,
                    minBytesCredit: 0,
                    minSecondsCredit: 0,
                    expirationRandomSeconds: null});

                return arm.pReloadPlansAndCalendars();

            }).then(function(){
                // Create management HTTP server
                createAgent(config, diameterServer, radiusServer);

                // Diameter //
                if (config.node.diameter) {
                    // Create Listener on Diameter port
                    diameterSocket = net.createServer();
                    diameterSocket.on("connection", onDiameterConnectionReceived);
                    diameterSocket.listen(config.node.diameter.port || 3868, config.node.diameter.listenAddress);
                    logger.info("Diameter listening in port %s", config.node.diameter.port);

                    // Establish outgoing connections
                    manageConnections();

                    // Set timer for periodically checking connections
                    setInterval(manageConnections, config.node.diameter["connectionInterval"] || 10000);
                } else {
                    logger.info("Diameter server not started");
                }

                // Radius
                if (config.node.radius) {
                    // Server sockets
					if(config.node.radius.authPort && config.node.radius.acctPort) {
						
						radiusAuthSocket = dgram.createSocket("udp4");
						radiusAcctSocket = dgram.createSocket("udp4");
						radiusAuthSocket.bind(config.node.radius.authPort, config.node.radius.listenIPAddress);
						radiusAcctSocket.bind(config.node.radius.acctPort, config.node.radius.listenIPAddress);
						radiusAuthSocket.on("message", onRadiusAuthRequestReceived);
						radiusAcctSocket.on("message", onRadiusAcctRequestReceived);
						radiusAuthSocket.on("error", onRadiusSocketError);
						radiusAcctSocket.on("error", onRadiusSocketError);
						logger.info("Radius auth listening in port %s", config.node.radius.authPort);
						logger.info("Radius acct listening in port %s", config.node.radius.acctPort);
					}

                    // Client sockets
                    // TODO TODO TODO TODO: Turn this into a promise
                    radiusClientPorts = createRadiusClientPorts(radiusServer, config.node.radius.baseClientPort, config.node.radius.numClientPorts, config.node.radius.clientIPAddress, initCallback);
                } else {
                    logger.info("Radius server not started");
                    // Startup done
                    if (initCallback) initCallback(null);
                }
            }, function (err) {
                if(logger.isErrorEnabled) logger.error("Configuration initialization error: %s", err.message);
                if(logger.isDebugEnabled) logger.verbose(err.stack);
                if (initCallback) initCallback(err);
            }
        ).done();
    };

    return policyServer;

};

exports.createPolicyServer=createPolicyServer;







