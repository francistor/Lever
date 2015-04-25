/**
 * Created by frodriguezg on 04/01/2015.
 */

var dgram=require("dgram");
var dLogger=require("./log").dLogger;

var createRadiusClientPorts=function(radiusServer, basePort, numPorts, listenAddress, cb){

    var radiusClientPorts={};

    var basePort=basePort;
    var numPorts=numPorts;
    var maxIndex=numPorts*256;

    var currentIndex=0;

    // Pointer to function to be called when bind process finishes
    var boundCallback=cb;
    // Socket status is true if bound
    var socketStatus=[];

    // Create the client sockets
    var sockets=[];

    var socket;
    for(var i=0; i<numPorts; i++) {

        // Create and bind socket
        socket=dgram.createSocket("udp4");
        socket.bind(basePort + i, listenAddress, function(err){
            if(err){
                if(boundCallback) boundCallback(err);
                else throw err;
            }
            else checkBoundFinished();
        });

        // Setup event listeners
        socket.on("message", onMessage);
        sockets.push(socket);
    }
    dLogger.info(numPorts+" radius client sockets created over IP Address "+listenAddress+" and base port "+basePort);

    // Message handler. MUST be a response
    function onMessage(buffer, rinfo){
        radiusServer.onResponseReceived(buffer, rinfo, this.address());
    }

    function onError(err){
        dLogger.error("Radius client socket error: "+err.message);
    }

    // Chooses a port and Id and returns it
    // PolicySever does not attempt to make sure that each socket+identifier has only
    // one live (not timed-out) request
    radiusClientPorts.getClientSocket=function(){

        // Get the socket and Id to use
        var socketIndex=Math.floor(currentIndex/256);
        var originPort=basePort+socketIndex;
        var radiusIdentifier=currentIndex%256;

        // Move on pointer
        currentIndex=(currentIndex+1)%maxIndex;

        return({id: radiusIdentifier, socket:sockets[socketIndex]});
    };

    /**
     * Check the status of the sockets (whether they are bound). If all the bound processes have been resolved,
     * call callback
     */
    function checkBoundFinished(){
        for(var i=0; i<numPorts; i++) {
            if(typeof(socketStatus[i])=="undefined") return;
        }

        // No error
        if(boundCallback) boundCallback(null);
    }

    return radiusClientPorts;
};

exports.createRadiusClientPorts=createRadiusClientPorts;
