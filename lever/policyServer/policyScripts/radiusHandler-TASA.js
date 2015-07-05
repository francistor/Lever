var Q=require("q");
var hLogger=require("../log").hLogger;
var cdrWriter=require("../cdrService").CDRService;
var arm=require("../arm").arm;
var config=require("../configService").config;

var accessRequestHandler=function(radiusServer, message){

    hLogger.info("Access request");

    var clientContext=null;

    // Normalize the request packet

    // Process packet
    getClientData().then(function(){
        if(!clientContext || !clientContext.plan){
            // Client not found
            hLogger.warn("Client not found");
            var permissiveService=config.policyParams["global"]["global"]["serviceOnSubscriptionNotFound"];
            if(permissiveService){
                radiusServer.sendReply(message, "Access-Accept", {"Reply-Message": "Permissive service"});
            }
            else{
                radiusServer.sendReply(message, "Access-Reject", {"Reply-Message": "Client not found"});
            }
            return;
        }

        validateClient().then(function(validationResult){
            if(validationResult==false){
                // Proxy rejected
                if(hLogger["inVerbose"]) hLogger.verbose("Remote server sent Auth-Reject");
                radiusServer.sendReply(message, "Access-Reject", {"Reply-Message": "Proxy Rejected"});
            }
            else{
                // Proxy accepted
                radiusServer.sendReply(message, "Access-Accept", {"Reply-Message": "Plan name is 101"});

                // TODO
                // Store in state server
                // Map output parameters
            }
        }, function(){
            // Proxy error
            hLogger.warn("Error proxying request");
        }).done();

        }, function(err){
            // Database error getting client
            hLogger.error("Database error getting client data: "+err.message);
            radiusServer.sendReply(message, "Access-Reject", {"Reply-Message": err.message});
        }).done();

    /**
     * Returns a promise after getting clientContext. Client would be null if not found
     * @returns {*}
     */
    function getClientData(){
        var clientDataPromise;

        // Get the client data
        if((config.policyParams["domain"]["speedy"]||{})["provisionType"]=="database"){
            clientDataPromise=arm.getClientContext({nasPort: message.attributes["NAS-Port"], nasIPAddress: message.attributes["NAS-IP-Address"]});
        }
        else{
            var emptyClientContext={client: null, plan: null};
            clientDataPromise=Q(emptyClientContext);
        }

        return clientDataPromise.then(function(cc){
            clientContext=cc;
        });
    }

    /**
     * Returns promise with fulfilled value true or false, or rejected if proxy error
     * clientContext is decorated with proxy attributes
     * @param clientContext
     * @param message
     */
    function validateClient(){
        var proxyPromise;
        if((config.policyParams["domain"]["speedy"]||{})["doProxyAuth"]==true){
            // Proxy validation
            proxyPromise=Q.ninvoke(radiusServer, "sendServerGroupRequest", "Access-Request", [], "local");
        } else {
            proxyPromise=Q(null);
        }

        return proxyPromise.then(function(message){
            if(message==null) return true;
            if(message.code=="Access-Reject") return false;

            // Decorate clientContext
            return true;
        });
    }
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
