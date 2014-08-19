// Context object and message routing functions

var fs=require("fs");
var logger=require("./log").logger;
var config=require("./config").config;
var createMessage=require("./message").createMessage;

// Read dispatcher configuration
// applicationName: {messageName: { module: <modulenane>, functionName: <functionName>, handler: <function>}}
var dispatcherConfig=JSON.parse(fs.readFileSync("./conf/dispatcher.json", {encoding: "utf8"}));

// Hook handlers to dispatcherConfig
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
	if(request.avps["Session-Id"]) reply.avps["Session-Id"]=request.avps["Session-Id"];
	
	return context;
}

var createDispatcher=function(connections){

	var dispatcher={};
	
	// Sends message to appropriate processor
	dispatcher.dispatchMessage=function(buffer, originHost){

		var message=createMessage().decode(buffer);
		
		logger.debug("");
		logger.debug("Dispatching message");
		logger.debug(JSON.stringify(message, undefined, 2));
		logger.debug("---------------------------");
		logger.debug("");
		
		if(message.isRequest){
			// Request. Start process handler passing a new context object
			var context=createContext(message, originHost);

			// Handle message if there is one configured for this type of request
			if(dispatcherConfig[message.applicationId] && dispatcherConfig[message.applicationId][message.commandCode] && dispatcherConfig[message.applicationId][message.commandCode]["handler"]){
				logger.debug("Dispatching message to: "+dispatcherConfig[message.applicationId][message.commandCode].functionName);
				dispatcherConfig[message.applicationId][message.commandCode]["handler"](context, dispatcher);
			}
			else logger.warn("No handler defined for Application: "+message.applicationId+" and command: "+message.commandCode);
		}
		else {
			// TODO: Look for pending reply
			logger.debug("TODO. Received response message");
		}
	}
	
	// Sends answer to origin host
	dispatcher.sendReply=function(context){
		
		logger.debug("");
		logger.debug("Sending reply");
		logger.debug(JSON.stringify(context.reply, undefined, 2));
		logger.debug("---------------------------");
		logger.debug("");
		
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