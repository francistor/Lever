/**
 * Created by frodriguezg on 05/01/2015.
 */

var hLogger=require("../log").hLogger;
var cdrWriter=require("../cdrService").CDRService;

var accessRequestHandler=function(radiusServer, message){

    hLogger.info("Access request");

    // Proxy
    /*
    radiusServer.sendRequest("Access-Request", [], "127.0.0.1", 11812, "secret", 2000, 2, function(err, response){
        if(err){
            hLogger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Access-Accept", []);
        }
    });
    */

    radiusServer.sendServerGroupRequest("Access-Request", [], "remote", function(err, response){
        if(err){
            hLogger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Access-Accept", []);
        }
    });
};

var accountingRequestHandler=function(radiusServer, message){

    hLogger.info("Access request");

    // Proxy
    radiusServer.sendRequest("Access-Request", [], "127.0.0.1", 11812, "secret", 2000, 2, function(err, response){
        if(err){
            hLogger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Access-Accept", []);
        }
    });
};


exports.accessRequestHandler=accessRequestHandler;
exports.accountingRequestHandler=accountingRequestHandler;
