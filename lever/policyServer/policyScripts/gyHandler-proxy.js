// Gy message handlers

var logger=require("./../log").logger;
var resultCodes=require("./../message").resultCodes;
var config=require("./../configService").config;
var createMessage=require("./../message").createMessage;

var ccrHandler=function(connection, message){

    var diameterConfig=config.node.diameter;
    var dictionary=config.diameterDictionary;

    var proxyMessage=createMessage();
    var request=proxyMessage.avps;

    proxyMessage.commandCode="Credit-Control";
    proxyMessage.applicationId="Credit-Control";
    // Mandatory attributes
    request["Origin-Host"]=diameterConfig["diameterHost"];
    request["Session-Id"]="thesessionid";
    request["Origin-Realm"]=diameterConfig["diameterRealm"];
    request["Destination-Realm"]="forward";
    request["Destination-Host"]="8950AAA";
    request["Auth-Application-Id"]="Credit-Control";
    request["CC-Request-Type"]="Initial";
    request["CC-Request-Number"]=1;

    // Send message to proxy
    connection.diameterServer.sendRequest(null, proxyMessage, 3000, function(error, response){

        if(error){
            logger.error(error.message);
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

