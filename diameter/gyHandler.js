// Gy message handlers

var logger=require("./log").logger;
var resultCodes=require("./message").resultCodes;
var dictionary=require("./dictionary").diameterDictionary;
var config=require("./config").config;

var ccrHandler=function(context, dispatcher){

	var reply=context.reply.avps;
	var request=context.request.avps;
	
	// Set mandatory parameters
	// TODO
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;
	
	// Send reply
	dispatcher.sendReply(context);
}

// Declare handlers
exports.ccrHandler=ccrHandler;

