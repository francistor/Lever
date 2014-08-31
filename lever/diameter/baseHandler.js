// Base Diameter message handlers

var hLogger=require("./log").hLogger;
var os=require("os");
var resultCodes=require("./message").resultCodes;
var dictionary=require("./dictionary").diameterDictionary;
var config=require("./config").config;
var createMessage=require("./message").createMessage;

var DEFAULT_TIMEOUT=10000;

function getIPAddresses(){
    var i;
    var ifzName, interfaces;
    var IPAddresses=[];

    if(config.diameter["IPAddress"]){
        IPAddresses=config.diameter["IPAddress"];
    } else {
        interfaces=os.networkInterfaces();
        for(ifzName in interfaces) if(interfaces.hasOwnProperty(ifzName)){
            for(i=0; i<interfaces[ifzName].length; i++){
                if(!interfaces[ifzName][i]["internal"])  IPAddresses.push(interfaces[ifzName][i]["address"]);
            }
        }
    }
    return IPAddresses;
}

var sendCer=function(connection){
    var requestMessage=createMessage();
    var request=requestMessage.avps;

    requestMessage.applicationId="Base";
    requestMessage.commandCode="Capabilities-Exchange";

    // Set mandatory parameters
    request["Origin-Host"]=config.diameter["originHost"];
    request["Origin-Realm"]=config.diameter["originRealm"];
    request["Host-IP-Address"]=getIPAddresses();
    request["Vendor-Id"]=config.diameter["vendorId"];
    request["Product-Name"]=config.diameter["productName"];
    request["Firmware-Revision"]=config.diameter["firmwareRevision"];

    // Add supported applications
    var applicationName;
    var authApplications=[];
    var acctApplications=[];
    for(applicationName in dictionary.applicationNameMap) if(dictionary.applicationNameMap.hasOwnProperty(applicationName)){
        if(dictionary.applicationNameMap[applicationName].type==="auth") authApplications.push(applicationName);
        if(dictionary.applicationNameMap[applicationName].type==="acct") acctApplications.push(applicationName);
    }
    request["Auth-Application-Id"]=authApplications;
    request["Acct-Application-Id"]=acctApplications;

    // Send message
    connection.diameterStateMachine.sendRequest(connection.hostName, requestMessage, DEFAULT_TIMEOUT, function(err, message){
        // TODO: Check response
        if(!err){
            if(message.avps["Result-Code"][0]===resultCodes.DIAMETER_SUCCESS){
                connection.diameterStateMachine.onCEAReceived(connection);
            }
            else{
                hLogger.error("CEA Error. Unsuccessful result code");
                // Connection will be deleted in the "close" event handler
                connection.socket.end();
            }
        }
        else{
            hLogger.error("Error in CEA: "+err.message);
            // Connection will be deleted in the "close" event handler
            connection.socket.end();
        }
    });

};

var cerHandler=function(connection, message){

    var replyMessage=createMessage(message);
	var reply=replyMessage.avps;
    var request=message.avps;

    if(!connection.diameterStateMachine.onCERReceived(connection, request["Origin-Host"][0])) return;
	
	// Set mandatory parameters
    reply["Origin-Host"]=config.diameter["originHost"];
    reply["Origin-Realm"]=config.diameter["originRealm"];
    reply["Host-IP-Address"]=getIPAddresses();
	reply["Vendor-Id"]=config.diameter["vendorId"];
	reply["Firmware-Revision"]=config.diameter["firmwareRevision"];
	
	// Add supported applications
	var applicationName;
	var authApplications=[];
	var acctApplications=[];
	for(applicationName in dictionary.applicationNameMap) if(dictionary.applicationNameMap.hasOwnProperty(applicationName)){
		if(dictionary.applicationNameMap[applicationName].type==="auth") authApplications.push(applicationName);
		if(dictionary.applicationNameMap[applicationName].type==="acct") acctApplications.push(applicationName);
	}
	reply["Auth-Application-Id"]=authApplications;
	reply["Acct-Application-Id"]=acctApplications;
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;
	
	// Send reply
	connection.diameterStateMachine.sendReply(connection, replyMessage);
};

var watchdogHandler=function(connection, message){

    var replyMessage=createMessage(message);
    var reply=replyMessage.avps;

    // Set mandatory parameters
    reply["Origin-Host"]=config.diameter["originHost"];
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;

    // Send reply
    connection.diameterStateMachine.sendReply(connection, replyMessage);
};

var disconnectPeerHandler=function(connection, message){

    var replyMessage=createMessage(message);
    var reply=replyMessage.avps;

    // Set mandatory parameters
    reply["Origin-Host"]=config.diameter["originHost"];
	
	// Result code
	reply["Result-Code"]=resultCodes.DIAMETER_SUCCESS;
	
	// Send reply
    connection.diameterStateMachine.sendReply(connection, replyMessage);
};

// Declare handlers
exports.cerHandler=cerHandler;
exports.watchdogHandler=watchdogHandler;
exports.disconnectPeerHandler=disconnectPeerHandler;

// Other exports
exports.sendCer=sendCer;

