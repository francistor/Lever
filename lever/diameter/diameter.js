// Main file for Diameter server
// Implements state machine

// TODO: Implement duplicate detection.
// --- Cache of Ent2EndId being processed

var net=require("net");
var dLogger=require("./log").dLogger;
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

    // Hook handlers to dispatcherConfig
    // Function to invoke for a message will be config.dispatcher[applicationId][commandCode]["handler"]
    // Signature for handler functions is fnc(connection, message)
    var applicationId;
    var commandCode;
    var dispElement;
    var handlerModule;
    for(applicationId in config.dispatcher) if(config.dispatcher.hasOwnProperty(applicationId)){
        for(commandCode in config.dispatcher[applicationId]) {
            if (config.dispatcher[applicationId].hasOwnProperty(commandCode)) {
                dispElement = config.dispatcher[applicationId][commandCode];
                handlerModule = require(dispElement["module"]);
                dispElement["handler"] = handlerModule[dispElement["functionName"]];
            }
        }
    }

    // Invoked by the connection when a new complete message is available
    // Call handler if request, or call callback if response and original request is found
    diameterStateMachine.onMessageReceived=function(connection, buffer){
        var requestPointer;
        var message;

        try {
            message = createMessage().decode(buffer);
        }catch(e){
            // Message decoding error
            dLogger.error("Diameter decoding error: "+e.message);
            connection.socket.end();
            connection.state="Closing";
            // Will be deleted when close event arrives
            return;
        }

        dLogger.debug("");
        dLogger.debug("Received message");
        dLogger.debug(JSON.stringify(message, undefined, 2));
        dLogger.debug("");

        if (message.isRequest) {
            // Handle message if there is one configured for this type of request
            stats.incrementServerRequest(connection.hostName, message.commandCode);
            if (config.dispatcher[message.applicationId] && config.dispatcher[message.applicationId][message.commandCode] && config.dispatcher[message.applicationId][message.commandCode]["handler"]) {
                dLogger.debug("Message is Request. Dispatching message to: " + config.dispatcher[message.applicationId][message.commandCode].functionName);
                try {
                    config.dispatcher[message.applicationId][message.commandCode]["handler"](connection, message);
                }catch(e){
                    stats.incrementServerError(connection.hostName, message.commandCode);
                    dLogger.error("Handler error in "+config.dispatcher[message.applicationId][message.commandCode].functionName);
                    dLogger.error(e.message);
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
            if (requestPointer) {
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
            connection.socket.write(message.encode());
            stats.incrementServerResponse(connection.hostName, message.commandCode, message.avps["Result-Code"]||0);
        }
        catch(e){
            // Message encoding error
            stats.incrementServerError(connection.hostName, message.commandCode);
            dLogger.error("Could not encode & send message: "+e.message);
            dLogger.error("Closing connection");
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
                dLogger.error("Could not encode & send message: "+e.message);
                dLogger.error("Closing connection");
                connection.socket.end();
                connection.state="Closing";
                // Will be deleted when close event arrives
            }
        }
        else {
            dLogger.warn("Could not send message. No connection to "+hostName);
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
        dLogger.info("Checking connections");
        // Iterate through peers and check if a new connection has to be established
        for(i=0; i<config.diameter["peers"].length; i++){
            peer=config.diameter["peers"][i];
            if(peer["connectionPolicy"]==="active" && !connections[peer["originHost"]]){
                dLogger.debug("Connecting to "+peer["originHost"]+" in "+peer["IPAddress"]);
                connections[peer["originHost"]]=createConnection(diameterStateMachine, net.connect(peer["IPAddress"].split(":")[1]||3868, peer["IPAddress"].split(":")[0]) , peer["originHost"], "Wait-Conn-Ack");
            }
        }
        // Iterate through connections and check if a connection has to be closed
        // TODO:
    };

    diameterStateMachine.onConnectionACK=function(connection){
        dLogger.debug("Connection established with "+connection.hostName);
        connection.state="Wait-CEA";
        sendCer(connection);
    };

    diameterStateMachine.onCEAReceived=function(connection){
        dLogger.debug("CEA received from "+connection.hostName);
        connection.state="Open";
    };

    diameterStateMachine.establishConnections();

    setInterval(diameterStateMachine.establishConnections, config.diameter["connectionInterval"]||10000);

    ///////////////////////////////////////////////////////////////////////////
    // Passive connections
    ///////////////////////////////////////////////////////////////////////////
    diameterStateMachine.onConnectionReceived=function(socket){
        var tmpHostName;

        dLogger.debug("got connection from "+socket["remoteAddress"]);

        // Check whether there is at least one peer with that IP Address
        peer=null;
        for(i=0; i<config.diameter["peers"].length; i++){
            if(config.diameter["peers"][i]["IPAddress"].split(":")[0]===socket["remoteAddress"]) peer=config.diameter["peers"][i];
        }
        if(peer===null){
            dLogger.info("Received connection from unknown peer");
            socket.end();
            return;
        }

        // Create new connection. Temporary key is IPAddress:port
        tmpHostName=socket["remoteAddress"]+":"+socket["remotePort"];
        connections[tmpHostName]=createConnection(diameterStateMachine, socket, tmpHostName, "Wait-CER");
    };

    diameterStateMachine.onCERReceived=function(connection, hostName){
        connection=connections[connection.socket["remoteAddress"]+":"+connection.socket["remotePort"]];
        if(connection && connection.state==="Wait-CER"){
            // Check that Origin-Host is declared as peer with the received origin IP address
            ipAddress=connection.socket["remoteAddress"];
            for(i=0; i<config.diameter["peers"].length; i++){
                peer=config.diameter["peers"][i];

                if(peer["originHost"]===hostName && peer["IPAddress"].split(":")[0]===connection.socket["remoteAddress"]){
                    // TODO: Election process should be implemented here
                    // Here we make sure that only one connection from/to a specific host will be established
                    if(!connections[hostName]) {
                        connection.hostName = hostName;
                        connection.state = "Open";
                        // Everything OK
                        return true;
                    }
                    else dLogger.warn("Connection already established with "+hostName);
                }
                dLogger.warn(hostName+" peer, connecting from "+connection.socket["remoteAddress"]+" not configured");
            }
        }else{
            dLogger.warn("CER out of sequence for originHost "+connection.socket["remoteAddress"]);
            connection.socket.end();
        }

        // If here, something went wrong
        connection.socket.end();
        connection.state="Closing";
        // Connection will be deleted when close event arrives
        return false;
    };

    // Create Listener on Diameter port (or configured)
    var diameterServer=net.createServer();

    diameterServer.on("connection", function(socket){
        diameterStateMachine.onConnectionReceived(socket);
    });

    diameterServer.listen(config.diameter.port||3868);
    dLogger.info("Diameter listening in port "+config.diameter.port);

    createAgent();

    return diameterStateMachine;
};

exports.diameterStateMachine=createDiameterStateMachine();







