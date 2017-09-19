/**
 * Created by frodriguezg on 04/01/2015.
 */

var dgram=require("dgram");
var logger=require("./log").logger;

var createRadiusClientPorts=function(radiusServer, basePort, numPorts, listenAddress, boundCallback){

    var radiusClientPorts={};

    var basePort=basePort;
    var numPorts=numPorts;
    var maxIndex=numPorts*256;

    var currentIndex=0;

    // Socket status is true if bound
    var socketStatus=[];

    // Create the client sockets
    var sockets=[];

    for(var i=0; i<numPorts; i++) {

        // Create and bind socket
        sockets[i]=dgram.createSocket("udp4");
        // God forgive me for using this closure!
        sockets[i].bind(basePort + i, listenAddress, function(sIndex){
            return function(err){
                if(err){
                    if(boundCallback) boundCallback(err, logger);
                    else throw err;
                }
                else socketBound(sIndex);
            }
        }(i)); // Invoke a function that returns a function for the bind callback. Pass index i as a parameter

        // Setup event listeners
        sockets[i].on("message", onMessage);
    }
    if(logger.isInfoEnabled) logger.info("%d radius client sockets created over IP Address %s and base port %d", numPorts, listenAddress, basePort);

    // Message handler. MUST be a response
    function onMessage(buffer, rinfo){
        radiusServer.onResponseReceived(buffer, rinfo, this.address());
    }

    function onError(err){
        if(logger.isErrorEnabled) logger.error("Radius client socket error: %s", err.message);
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
    function socketBound(sIndex){
        socketStatus[sIndex]=true;
        for(var i=0; i<numPorts; i++) {
            if(typeof(socketStatus[i])=="undefined") return;
        }

        // No error
        if(boundCallback) boundCallback(null);
    }

    return radiusClientPorts;
};

exports.createRadiusClientPorts=createRadiusClientPorts;
