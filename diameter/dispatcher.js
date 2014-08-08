// Context object and message routing functions

var fs=require("fs");
var logger=require("./log").logger;
var config=require("./config").config;
var createMessage=require("./message").createMessage;

// Read dispatcher configuration
var dispatcherConfig=JSON.parse(fs.readFileSync("./conf/dispatcher.json", {encoding: "utf8"}));

// Hook handlers
var applicationId;
var commandCode;
var dispElement
for(applicationId in dispatcherConfig){
	for(commandCode in dispatcherConfig[applicationId]){
		var dispElement=dispatcherConfig[applicationId][commandCode]
		dispElement["handler"]=require(dispElement["module"])[dispElement["functionName"]];
	}
}

// Creates a context object, including original request, basic reply and other info
function createContext(message, originHost){

	var context={};
	context.originHost=originHost;
	
	// Create basic reply
	var reply=createMessage(message);
	var request=message;
	
	context.reply=reply;
	context.request=request;
	
	// Basic answer
	reply.avps["Origin-Host"]=config.getOriginHost();
	if(request.avps["Session-ID"]) reply.avps["Session-ID"]=request.avps["Session-Id"];
	
	return context;
}

var createDispatcher=function(connections){

	var dispatcher={};
	
	// Sends message to appropriate processor
	dispatcher.dispatchMessage=function(buffer, originHost){

		var message=createMessage().decode(buffer);
		//console.log(JSON.stringify(message, undefined, 2));
		
		if(message.isRequest){
			// Request
			var context=createContext(message, originHost);

			if(dispatcherConfig[message.applicationId] && dispatcherConfig[message.applicationId][message.commandCode] && dispatcherConfig[message.applicationId][message.commandCode]["handler"]){
				dispatcherConfig[message.applicationId][message.commandCode]["handler"](context, dispatcher);
			}
			else logger.warn("No handler defined for Application: "+message.applicationId+" and command: "+message.commandCode);
		}
		else {
			// TODO: Look for pending reply
		}
	}
	
	// Sends answer to origin host
	dispatcher.sendReply=function(context){
		var buffer=context.reply.encode();
		
		try{
			connections.sendMessage(context.originHost, buffer);
		}
		catch(e){
			logger.error("Could not send message: "+e.message);
		}
	}

	// Sends a request message to another peer
	dispatcher.sendRequest=function(message, timeout, callback){	// callback is fnc(error, message)
	}
	
	return dispatcher;
}

exports.createDispatcher=createDispatcher;