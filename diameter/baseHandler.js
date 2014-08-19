// Base Diameter message handlers

var logger=require("./log").logger;
var resultCodes=require("./message").resultCodes;
var dictionary=require("./dictionary").diameterDictionary;
var config=require("./config").config;

var cerHandler=function(context, dispatcher){

	var reply=context.reply.avps;
	var request=context.request.avps;
	
	// Set mandatory parameters
	if(config.getIPAddress()){
		reply["Host-IP-Address"]=config.getIPAddress();
	} else {
		// TODO: add all ip addresses here if listening address not specified
	}
	
	reply["Vendor-Id"]=config.getVendorId();
	reply["Firmware-Revision"]=config.getFirmwareRevision();
	
	// Add supported applications
	var applicationName;
	var authApplications=[];
	var acctApplications=[];
	for(applicationName in dictionary.applicationNameMap){
		if(dictionary.applicationNameMap[applicationName].type==="auth") authApplications.push(applicationName);
		if(dictionary.applicationNameMap[applicationName].type==="acct") acctApplications.push(applicationName);
	}
	reply["Auth-Application-Id"]=authApplications;
	reply["Acct-Application-Id"]=acctApplications;
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;
	
	// Send reply
	dispatcher.sendReply(context);
}

var watchdogHandler=function(context, dispatcher){

	var reply=context.reply.avps;
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;
	
	// Send reply
	dispatcher.sendReply(context);

}

var disconnectPeerHandler=function(context, dispatcher){

	var reply=context.reply.avps;
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;
	
	// Send reply
	dispatcher.sendReply(context);
}

// Declare handlers
exports.cerHandler=cerHandler;
exports.watchdogHandler=watchdogHandler;
exports.disconnectPeerHandler=disconnectPeerHandler;

