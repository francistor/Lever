var hLogger=require("../log").hLogger;
var cdrWriter=require("../cdrService").CDRService;

var accessRequestHandler=function(radiusServer, message){

    hLogger.info("Access request");


};

var accountingRequestHandler=function(radiusServer, message){

    hLogger.info("Accounting request");

    // Proxy
    radiusServer.sendRequest("Accounting-Request", [], "127.0.0.1", 11813, "secret", 2000, 2, function(err, response){
        if(err){
            hLogger.error("Error in request to proxy server: "+err.message);
        }
        else{
            radiusServer.sendReply(message, "Accounting-Response", []);
        }
    });
};


exports.accessRequestHandler=accessRequestHandler;
exports.accountingRequestHandler=accountingRequestHandler;
