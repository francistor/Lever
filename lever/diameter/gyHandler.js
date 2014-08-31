// Gy message handlers

var hLogger=require("./log").hLogger;
var resultCodes=require("./message").resultCodes;
var dictionary=require("./dictionary").diameterDictionary;
var config=require("./config").config;
var createMessage=require("./message").createMessage;

var ccrHandler=function(connection, message){

    var replyMessage=createMessage(message);
    var reply=replyMessage.avps;

    var request=message.avps;

    // Set mandatory parameters
    reply["Origin-Host"]=config.diameter["originHost"];
    reply["Session-Id"]=request["Session-Id"];
	// TODO: Rest of parameters
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;

    // Send reply
    connection.diameterStateMachine.sendReply(connection, replyMessage);
}

// Declare handlers
exports.ccrHandler=ccrHandler;

