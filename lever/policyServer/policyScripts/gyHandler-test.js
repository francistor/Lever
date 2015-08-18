// Gy message handlers

var hLogger=require("./../log").hLogger;
var resultCodes=require("./../message").resultCodes;
var config=require("./../configService").config;
var createMessage=require("./../message").createMessage;

var ccrHandler=function(connection, message){

    var diameterConfig=config.node.diameter;
    //var dictionary=config.diameterDictionary;

    var requestAttributes;
    var proxyMessage;
    var proxyAttributes;
    var replyMessage;
    var replyAttributes;

    if(config.node.hostName=="test-server"){
        // Proxy request

        proxyMessage=createMessage();
        proxyMessage.applicationId=message.applicationId;
        proxyMessage.commandCode=message.commandCode;

        // Clone AVPs
        proxyMessage.avps=JSON.parse(JSON.stringify(message.avps));
        proxyAttributes=proxyMessage.avps;

        // Modify attributes
        proxyAttributes["Origin-Host"]=diameterConfig["diameterHost"];
        proxyAttributes["Origin-Realm"]=diameterConfig["diameterRealm"];
        proxyAttributes["Destination-Realm"]="any";

        // Send message to proxy
        connection.diameterServer.sendRequest(null /* connection not specified */, proxyMessage, 1000, function(error, response){
            if(error){
                hLogger.error(error.message);
                return;
            }

            // Generate reply
            replyMessage=createMessage(message);

            // Clone AVP
            replyMessage.avps=JSON.parse(JSON.stringify(response.avps));
            replyAttributes=replyMessage.avps;

            // Modify attributes
            replyAttributes["Origin-Host"]=diameterConfig["diameterHost"];
            replyAttributes["Origin-Realm"]=diameterConfig["diameterRealm"];

            // Send reply
            connection.diameterServer.sendReply(connection, replyMessage);
        });
    }

    else if(config.node.hostName=="test-metaServer"){

        replyMessage=createMessage(message);
        replyAttributes=replyMessage.avps;
        requestAttributes=message.avps;

        // Fill response message
        replyAttributes["Origin-Host"]=diameterConfig["diameterHost"];
        replyAttributes["Origin-Realm"]=diameterConfig["diameterRealm"];
        replyAttributes["Session-Id"]=requestAttributes["Session-Id"][0];
        replyAttributes["CC-Request-Type"]=requestAttributes["CC-Request-Type"][0];
        replyAttributes["CC-Request-Number"]=requestAttributes["CC-Request-Number"][0];
        replyAttributes["Result-Code"]=resultCodes.DIAMETER_SUCCESS;

        // Send reply
        connection.diameterServer.sendReply(connection, replyMessage);
    }
};

// Declare handlers
exports.ccrHandler=ccrHandler;

