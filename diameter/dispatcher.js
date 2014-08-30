// Context object and message routing functions

// TODO: Make it tolerant to encode/decode errors
// TODO: test new code for sending messages

var fs=require("fs");
var logger=require("./log").logger;
var config=require("./config").config;
var createMessage=require("./message").createMessage;

// Creates a context object, including original request, basic reply and other info
// Context object contains:
//	originHost: Name of peer that sent the original request
//	request: Parsed Diameter request message
//	reply: Message to send as reply (when invoking dispatcher.sendReply(<context))

function createContext(message, originHost){

	var context={};
	
	// Create basic reply
	var reply=createMessage(message);
	var request=message;
	
	// Build contents 
	context.originHost=originHost;
	context.reply=reply;
	context.request=request;
	
	// Basic answer
	reply.avps["Origin-Host"]=config.getOriginHost();
	if(request.avps["Session-Id"]) reply.avps["Session-Id"]=request.avps["Session-Id"];
	
	return context;
}

// Dispatcher singleton instance
// init is called within the collections object
var _dispatcherInstance={};

_dispatcherInstance.init=function(connections){

    // Holds a reference to the callback function and timer for each destinationHost+HopByHopID
    var requestPointers={};

	// Read dispatcher configuration
	// applicationName: {messageName: { module: <moduleName>, functionName: <functionName>, handler: <function>}}
	var dispatcherConfig=JSON.parse(fs.readFileSync("./conf/dispatcher.json", {encoding: "utf8"}));

	// Hook handlers to dispatcherConfig
	var applicationId;
	var commandCode;
	var dispElement;
    var handlerModule;
	for(applicationId in dispatcherConfig) if(dispatcherConfig.hasOwnProperty(applicationId)){
		for(commandCode in dispatcherConfig[applicationId]) {
            if (dispatcherConfig[applicationId].hasOwnProperty(commandCode)) {
                dispElement = dispatcherConfig[applicationId][commandCode];
                handlerModule = require(dispElement["module"]);
                dispElement["handler"] = handlerModule[dispElement["functionName"]];
            }
        }
	}
	
	// Sends message to appropriate processor
	_dispatcherInstance.dispatchMessage=function(buffer, originHost){

        var requestPointer;
		var message=createMessage().decode(buffer);
		
		logger.debug("");
		logger.debug("Dispatching message");
		logger.debug(JSON.stringify(message, undefined, 2));
		logger.debug("---------------------------");
		logger.debug("");

        if (message.isRequest) {
            // Request. Start process handler passing a new context object
            var context = createContext(message, originHost);

            // Handle message if there is one configured for this type of request
            if (dispatcherConfig[message.applicationId] && dispatcherConfig[message.applicationId][message.commandCode] && dispatcherConfig[message.applicationId][message.commandCode]["handler"]) {
                logger.debug("Dispatching message to: " + dispatcherConfig[message.applicationId][message.commandCode].functionName);
                dispatcherConfig[message.applicationId][message.commandCode]["handler"](context, _dispatcherInstance);
            }
            else logger.warn("No handler defined for Application: " + message.applicationId + " and command: " + message.commandCode);
        } else {
            logger.debug("Received response message");
            requestPointer = requestPointers[message.originHost + message.hopByHopId];
            if (requestPointer) {
                clearTimeout(requestPointer.timer);
                delete requestPointers[message.originHost + message.hopByHopId];
                requestPointer.callback(null, message);
            } else logger.debug("Unsolicited response message");
        }
	};
	
	// Sends answer to origin host
	_dispatcherInstance.sendReply=function(context){
		
		logger.debug("");
		logger.debug("Sending reply");
		logger.debug(JSON.stringify(context.reply, undefined, 2));
		logger.debug("---------------------------");
		logger.debug("");
		
		try{
			connections.sendMessage(context.originHost, context.reply.encode());
		}
		catch(e){
			logger.error("Could not send message: "+e.message);
		}
	};

	// Sends a request message to another peer
	_dispatcherInstance.sendRequest=function(destinationHost, message, timeout, callback){	// callback is fnc(error, message)
        requestPointers[destinationHost+message.hopByHopId]={
            "timer": setTimeout(function(){
                delete requestPointers[destinationHost+message.hopByHopId];
                callback(new Error("timeout"), null);
            }, timeout),
            "callback": callback
        };

        logger.debug("");
        logger.debug("Sending request");
        logger.debug(JSON.stringify(message, undefined, 2));
        logger.debug("---------------------------");
        logger.debug("");

        try{
            connections.sendMessage(destinationHost, message.encode());
        }
        catch(e){
            logger.error("Could not send message: "+e.message);
            delete requestPointers[destinationHost+message.hopByHopId];
            callback(new Error("not sent"), null);
        }
	}
};

// Export the singleton
exports.dispatcher=_dispatcherInstance;