// Gy message handlers

var logger=require("./../log").logger;
var resultCodes=require("./../message").resultCodes;
var config=require("./../configService").config;
var createMessage=require("./../message").createMessage;

var ccrHandler=function(connection, message){

    var diameterConfig=config.node.diameter;
    var dictionary=config.diameterDictionary;

    var replyMessage=createMessage(message);
    var reply=replyMessage.avps;

    var request = message.avps;

    // Set mandatory parameters (according to 8950AAA)
    reply["Origin-Host"] = diameterConfig["diameterHost"];
    reply["Session-Id"] = request["Session-Id"];

    // Result code
    reply["Result-Code"] = resultCodes.DIAMETER_SUCCESS;

    // Waste some cpu
    for(var j=0; j<100; j++) Math.pow(Math.random(), Math.random());

    // Send reply
    connection.diameterServer.sendReply(connection, replyMessage);
};

// Declare handlers
exports.ccrHandler=ccrHandler;

