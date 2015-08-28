/**
 * Created by frodriguezg on 05/01/2015.
 */

var logger=require("../log").logger;
var cdrWriter=require("../cdrService").CDRService;

var accessRequestHandler=function(radiusServer, message){

    logger.info("Access request");

    // Proxy
    /*
    radiusServer.sendRequest("Access-Request", [], "127.0.0.1", 11812, "secret", 2000, 2, function(err, response){
        if(err){
            logger.error("Error in request to proxy server: %s", err.message);
        }
        else{
            radiusServer.sendReply(message, "Access-Accept", []);
        }
    });
    */

    radiusServer.sendServerGroupRequest("Access-Request", [], "remote", function(err, response){
        if(err){
            logger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Access-Accept", []);
        }
    });
};

var accountingRequestHandler=function(radiusServer, message){

    logger.info("Accounting request");

    // Proxy
    radiusServer.sendRequest("Accounting-Request", [], "127.0.0.1", 11813, "secret", 2000, 2, function(err, response){
        if(err){
            logger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Accounting-Response", []);
        }
    });
};


exports.accessRequestHandler=accessRequestHandler;
exports.accountingRequestHandler=accountingRequestHandler;
