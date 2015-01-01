// Gy message handlers

var hLogger=require("./log").hLogger;
var resultCodes=require("./message").resultCodes;
var config=require("./config").config;
var createMessage=require("./message").createMessage;

var ccrHandler=function(connection, message){

    var diameterConfig=config.diameterConfig;
    var dictionary=config.dictionary;

    var proxyMessage=createMessage();
    var request=proxyMessage.avps;

    proxyMessage.commandCode="Credit-Control";
    proxyMessage.applicationId="Credit-Control";
    // Mandatory attributes
    request["Origin-Host"]=diameterConfig["diameterHost"];
    request["Session-Id"]="thesessionid";
    request["Origin-Realm"]=diameterConfig["diameterRealm"];
    if(diameterConfig["diameterRealm"]=="toshiba") request["Destination-Realm"]="samsung"; else request["Destination-Realm"]="toshiba";
    request["Auth-Application-Id"]="Credit-Control";
    request["CC-Request-Type"]="Initial";
    request["CC-Request-Number"]=1;

    // Send message to proxy
    connection.diameterServer.sendRequest(null, proxyMessage, 3000, function(error, response){

        if(error){
            hLogger.error(error.message);
        }
        else {
            // TODO: Check result code
            var replyMessage = createMessage(message);
            var reply = replyMessage.avps;

            var request = message.avps;

            // Set mandatory parameters (according to 8950AAA)
            reply["Origin-Host"] = diameterConfig["diameterHost"];
            reply["Session-Id"] = request["Session-Id"];
            // TODO: Other parameters

            // Result code
            reply["Result-Code"] = resultCodes.DIAMETER_SUCCESS;

            // Send reply
            connection.diameterServer.sendReply(connection, replyMessage);
        }
    });

};

// Declare handlers
exports.ccrHandler=ccrHandler;

