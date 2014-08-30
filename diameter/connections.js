// Diameter connection

var util=require("util");
var logger=require("./log").logger;
var config=require("./config").config;
var dispatcher=require("./dispatcher").dispatcher;

var createMessage=require("./message").createMessage;

var MAX_MESSAGE_SIZE=4096;

var createDiameterConnection=function(connections, state, socket, originHost)
{
	var dc={};
	
	// Reference to the all connections array
	dc.connections=connections;

	// Peer state machine as per RFC 6733. Adding another state (Wait-CER)
	dc.state=state;

	// Socket
	dc.socket=socket;

	// Diameter identity of peer
	dc.originHost=originHost;

	// Connection buffer
	dc.data=new Buffer(MAX_MESSAGE_SIZE);
	dc.currentMessageLength=0;
	dc.currentDataLength=0;
	
	// Socket buffer
	dc.bufferPtr=0;
	
	// Helper function
	// Copies data in the data buffer up to the specified total message size
	// Returns true if target was met
	function copyData(targetSize, buff){
		// Data to copy is rest to get the target size or whatever is available in the buffer
		var copySize=Math.min(targetSize-dc.currentDataLength, buff.length-dc.bufferPtr);
		
		// Copy from buffer to data
		buff.copy(dc.data, dc.currentDataLength, dc.bufferPtr, dc.bufferPtr+copySize);
		dc.currentDataLength+=copySize;
		dc.bufferPtr+=copySize;
		
		if(dc.bufferPtr===targetSize) return true; else return false;
	}
	
	// Helper function
	// Gets the diameter message size
	function getMessageLength(){
		return dc.data.readInt16BE(1)*256+dc.data.readUInt8(3);
	}

	// Data received
	dc.socket.on("data", function(buffer){
		var messageBuffer;
		logger.debug("Receiving data from "+dc.originHost);
		
		dc.bufferPtr=0;
		// Iterate until all the received buffer has been copied
		// The buffer may span multiple diameter messages
		while(dc.bufferPtr < buffer.length){
		
			if(dc.currentMessageLength===0){
				// Still the message size is unknown. Try to copy the length
				if(copyData(4, buffer)){
					dc.currentMessageLength=getMessageLength();
				}
			}
			else{
				if(copyData(dc.currentMessageLength, buffer)){
					// Create new buffer
					messageBuffer=new Buffer(dc.currentMessageLength);
		
					// Copy data to new buffer
					dc.data.copy(messageBuffer, 0, 0, dc.currentMessageLength);
		
					// Reset buffer
					dc.currentMessageLength=0;
					dc.currentDataLength=0;
		
					dispatcher.dispatchMessage(messageBuffer, dc.originHost);
				}
			}
		}
	});
	
	// Sends a diameter message
	dc.sendMessage=function(buffer){
			var wbytes=dc.socket.write(buffer);
	};
	
		// When socket is closed, delete in connections table
	dc.socket.on("close", function(){
		logger.error("Closing connection");
		connections.endConnection(dc);
	});

	// Error received. Just log. TODO
	dc.socket.on("error", function(){
		logger.error("Error event received");
	});

	return dc;
}

var diameterConnections=function(){
	
	var that={};

	// Private variables
	var connections=[];

	// Iterator
	var i;
	
	// Initialize dispatcher
	dispatcher.init(that);

	// Methods

	// Dump connections to logfile
	that.printConnections=function(){
		if(connections.length===0){
			logger.debug("No connections");
		}
		else{
			logger.debug("Current connections:");
			for(i=0; i<connections.length; i++) logger.debug("originHost: "+connections[i].originHost+", state: "+connections[i].state);
		}
		logger.debug("");
	};

	// Treat new connection arrived
	that.incomingConnection=function(socket){
		// Check is a known peer
		var originHost=config.getOriginHostFromIPAddress(socket.remoteAddress);
	
		// If unknown peer, close
		if(originHost==null){
			logger.warn("Connection rejected due to peer unknown: "+socket.remoteAddress);
			socket.end();
		}
		// If known peer store with "Waiting for CER" state
		else{
			logger.debug("Connection established. Waiting for CER")
			connections.push(createDiameterConnection(that, "Wait-CER", socket, originHost));
		}

		that.printConnections();
	};

	// End connection
	that.endConnection=function(connection){
		logger.debug("Closing connection with "+connection.originHost);
		var index=connections.indexOf(connection);
		if(index>-1) connections.splice(index, 1);

		that.printConnections();
	}
	
	// Send message using one connection
	that.sendMessage=function(destinationHost, buffer){
		var i;
		
		// Look for connection to destinationHost
		for(i=0; i<connections.length; i++){
			if(connections[i].originHost===destinationHost){
				connections[i].sendMessage(buffer);
				return;
			}
		}
		
		throw new Error("No connection to peer");
	}

	return that;
}

exports.diameterConnections=diameterConnections();
