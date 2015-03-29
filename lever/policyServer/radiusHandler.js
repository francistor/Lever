/**
 * Created by frodriguezg on 05/01/2015.
 */

var hLogger=require("./log").hLogger;
var cdrWriter=require("./cdrService").CDRService;

var handleAccessRequest=function(radiusServer, message){
    hLogger.info("handleAccessRequest");

    radiusServer.sendReply(message, "Access-Accept", []);

    /*
    // Proxy
    radiusServer.sendRequest("Access-Request", [], "127.0.0.1", 11812, "secret", 2000, 2, function(err, response){
        if(err){
            hLogger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Access-Accept", []);
        }
    });
    */
};

var handleAccountingRequest=function(radiusServer, message){
    hLogger.info("handleAccountingRequest");

    radiusServer.sendReply(message, "Accounting-Response", []);

    cdrWriter.writeCDR(message);

    /*
    // Proxy
    radiusServer.sendRequest("Accounting-Request", [], "127.0.0.1", 11813, "secret", 2000, 2, function(err, response){
        if(err){
            hLogger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Accounting-Response", []);
        }
    });
    */
};

exports.radiusHandler={handleAccessRequest:handleAccessRequest, handleAccountingRequest:handleAccountingRequest};
