// Gy message handlers

var hLogger=require("./log").hLogger;
var resultCodes=require("./message").resultCodes;
var config=require("./config").config;
var createMessage=require("./message").createMessage;

var ccrHandler=function(connection, message){

    var diameterConfig=config.diameterConfig;
    var dictionary=config.dictionary;

    var replyMessage=createMessage(message);
    var reply=replyMessage.avps;

    var request=message.avps;

    // Set mandatory parameters
    reply["Origin-Host"]=diameterConfig["originHost"];
    reply["Session-Id"]=request["Session-Id"];
	// TODO: Rest of parameters
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;

    // Send reply
    connection.diameterStateMachine.sendReply(connection, replyMessage);
};

// Declare handlers
exports.ccrHandler=ccrHandler;

