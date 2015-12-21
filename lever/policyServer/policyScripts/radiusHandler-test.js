var config=require("./../configService").config;
var logger=require("../log").logger;
var cdrWriter=require("../cdrService").CDRService;
var stats=require("../stats").radiusStats;

var accessRequestHandler=function(radiusServer, message){

    if(!message.attributes["User-Name"]){
        stats.incrementServerError(message._clientName);
        logger.error("Radius request without User-Name from %s", message._clientName);
        return;
    }

    // Get Realm
    var userNameItems=message.attributes["User-Name"].split("@");
    var realm;
    var userName=userNameItems[0];
    if(userNameItems.length==2) realm=userNameItems[1]; else realm="";

    if(config.node.hostName=="test-server"){
        // Domain to treat locally
        if(realm=="localRealm"){
            if(userName=="acceptUser"){
                // Resolve with accept
                radiusServer.sendReply(message, "Access-Accept", {"Reply-Message": "User authenticated"});
            } else if(userName=="rejectUser"){
                // Resolve with reject
                radiusServer.sendReply(message, "Access-Reject", {"Reply-Message": "User rejected"});
            } else if(userName=="errorUser"){
                // Discard packet
                stats.incrementServerError(message._clientName);
            }
        } else if(realm=="proxyRealm"){
            // Proxy and answer back with proxied response
            radiusServer.sendServerGroupRequest(message.code, message.attributes, "allRadiusServers", function(err, response){
                radiusServer.sendReply(message, response.code, response.attributes);
            });
        }
    }
    else if(config.node["hostName"]=="test-metaServer"){
        if(userName=="acceptUser"){
            // Resolve with accept
            radiusServer.sendReply(message, "Access-Accept", {"Reply-Message": "User authenticated by proxy"});
        } else if(userName=="rejectUser"){
            // Resolve with reject
            radiusServer.sendReply(message, "Access-Reject", {"Reply-Message": "User rejected by proxy"});
        } else if(userName=="errorUser"){
            // Discard packet
            stats.incrementServerError(message._clientName);
        }
    }
};

var accountingRequestHandler=function(radiusServer, message){

    if(!message.attributes["User-Name"]){
        stats.incrementServerError(message._clientName);
        logger.error("Radius request without User-Name from %s", message._clientName);
        return;
    }

    // Get Realm
    var userNameItems=message.attributes["User-Name"].split("@");
    var realm;
    var userName=userNameItems[0];
    if(userNameItems.length==2) realm=userNameItems[1]; else realm="";

    if(config.node.hostName=="test-server"){
        // Domain to treat locally
        if(realm=="localRealm"){
            if(userName=="acceptUser"){
                // Resolve with response
                radiusServer.sendReply(message, "Accounting-Response", {"Reply-Message": "Accounting received"});
                cdrWriter.writeCDR(message);
            } else if(userName=="errorUser"){
                // Discard packet
                stats.incrementServerError(message._clientName);
            }
        } else if(realm=="proxyRealm"){
            // Proxy and answer back with proxied response
            radiusServer.sendServerGroupRequest(message.code, message.attributes, "allRadiusServers", function(err, response){
                radiusServer.sendReply(message, response.code, response.attributes);
            });
        }
    }
    else if(config.node["hostName"]=="test-metaServer"){
        if(userName=="acceptUser"){
            // Write CDR
            cdrWriter.writeCDR(message);
            // Force flush for TESTING
            cdrWriter.closeChannels();

            // Resolve with accept
            radiusServer.sendReply(message, "Accounting-Response", {"Reply-Message": "Accounting received by proxy"});
        } else if(userName=="errorUser"){
            // Discard packet
            stats.incrementServerError(message._clientName);
        }
    }
};


exports.accessRequestHandler=accessRequestHandler;
exports.accountingRequestHandler=accountingRequestHandler;
