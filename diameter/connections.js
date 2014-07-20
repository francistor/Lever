// Diameter connection

var logger=require("./log").logger;
var util=require("util");
var config=require("./config").config;
var diameterCodec=require("./codec");
var createMessage=require("./message").createMessage;
var EventEmitter=require("events").EventEmitter;

var DiameterConnection=function(connections, state, socket, identity)
{
	// Reference to the all connections array
	this.connections=connections;

	// Peer state machine as per RFC 6733. Adding another state (Wait-CER)
	this.state=state;

	// Socket
	this.socket=socket;

	// Diameter identity of peer
	this.peerDiameterIdentity=identity;

	// Buffer
	this.data=null;

	// Store my identity
	var self=this;

	// When socket is closed, delete in connections table
	this.socket.on("close", function(){
		connections.endConnection(self);
	});

	// Error received. Just log. TODO
	this.socket.on("error", function(){
		logger.error("Error event received");
	});

	// Data recevied
	this.socket.on("data", function(buffer){
		logger.debug("Receiving data from "+self.peerDiameterIdentity);
		logger.debug("Version: "+buffer.readUInt8(0));
		logger.debug("Message size: "+buffer.readInt16BE(1)*256+buffer.readUInt8(3));

		logger.info(JSON.stringify(createMessage().decode(buffer), undefined, 2));
	});
}

util.inherits(DiameterConnection, EventEmitter);

var diameterConnections=function(){
	
	var that={};

	// Private variables
	var connections=[];

	// Iterator
	var i;

	// Methods

	// Dump connections to logfile
	that.printConnections=function(){
		if(connections.length===0){
			logger.debug("No connections");
		}
		else{
			logger.debug("Current connections:");
			for(i=0; i<connections.length; i++) logger.debug("identity: "+connections[i].peerDiameterIdentity+", state: "+connections[i].state);
		}
		logger.debug("");
	}

	// Treat new connection arrived
	that.incomingConnection=function(socket){
		// Check is a known peer
		var identity=config.getDiameterIdentityFromIPAddress(socket.remoteAddress);
	
		// If unknown peer, close
		if(identity==null){
			logger.warn("Connection rejected due to peer unknown: "+socket.remoteAddress);
			s.end();
		}
		// If known peer store with "Waiting for CER" state
		else{
			logger.debug("Connection established. Wating for CER")
			connections.push(new DiameterConnection(that, "Wait-CER", socket, identity));
		}

		that.printConnections();
	}

	// End connection
	that.endConnection=function(connection){
		logger.debug("Closing connection with "+connection.peerDiameterIdentity);
		var index=connections.indexOf(connection);
		if(index>-1) connections.splice(index, 1);

		that.printConnections();
	}

	return that;
}

exports.diameterConnections=diameterConnections();
