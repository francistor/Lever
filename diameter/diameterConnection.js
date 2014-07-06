// Diameter connection

var logger=require("./log").logger;
var util=require("util");
EventEmitter=require("events").EventEmitter;

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
		logger.debug("Closing connection with "+self.peerDiameterIdentity);
		index=diameterConnections.indexOf(self);
		if(index>-1) connections.splice(index, 1);
		printConnections();
	});

	// Data recevied
	this.socket.on("data", function(buffer){
		logger.debug("Receiving data from "+self.peerDiameterIdentity);
		logger.debug("Version: "+buffer.readUInt8(0));
		logger.debug("Message size: "+buffer.readInt16BE(1)*256+buffer.readUInt8(3));
	});
}

util.inherits(DiameterConnection, EventEmitter);

var diameterConnections=[];

function printConnections()
{
	if(diameterConnections.length===0) logger.debug("No connections");
	else for(var i=0; i<diameterConnections.length; i++) logger.debug("identity: "+diameterConnections[i].peerDiameterIdentity+" state: "+diameterConnections[i].state);
}

exports.DiameterConnection=DiameterConnection;
exports.diameterConnections=diameterConnections;
