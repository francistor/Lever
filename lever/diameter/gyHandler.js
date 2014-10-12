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
    request["Origin-Host"]=diameterConfig["originHost"];
    request["Session-Id"]="thesessionid";

    // Send message to proxy
    connection.diameterStateMachine.sendRequest("8950AAA", proxyMessage, 1000, function(error, response){

        if(error){
            hLogger.error(error.message);
        }
        else {
            // TODO: Check result code
            var replyMessage = createMessage(message);
            var reply = replyMessage.avps;

            var request = message.avps;

            // Set mandatory parameters
            reply["Origin-Host"] = diameterConfig["originHost"];
            reply["Session-Id"] = request["Session-Id"];
            // TODO: Rest of parameters

            // Result code
            reply["Result-Code"] = resultCodes.DIAMETER_SUCCESS;

            // Send reply
            connection.diameterStateMachine.sendReply(connection, replyMessage);
        }
    });

};

// Declare handlers
exports.ccrHandler=ccrHandler;

