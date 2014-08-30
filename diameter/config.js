// Holder for Diameter configuration

var logger=require("./log").logger;
var fs=require("fs");

// Read diameter configuration
var diameterConfig=JSON.parse(fs.readFileSync("./conf/diameter.json", {encoding: "utf8"}));

// Constructor for the Peer object. Just a holder for the properties
var Peer=function(name, originHost, originRealm, IPAddress, connectionPolicy)
{
	this.name=name;
	this.originHost=originHost;
	this.originRealm=originRealm;
	this.IPAddress=IPAddress;
	this.connectionPolicy=connectionPolicy;
}

var config=function()
{
	var that={};

	// Private variables
	var peers=[];

	// iterator
	var i;

	// Fill peers array
	logger.debug("Diameter Peers");
	for(var i=0; i<diameterConfig.peers.length; i++)
	{
		peers.push(new Peer(diameterConfig.peers[i].name, diameterConfig.peers[i].originHost, diameterConfig.peers[i].originRealm, diameterConfig.peers[i].IPAddress, diameterConfig.peers[i].connectionPolicy));
		logger.debug(JSON.stringify(peers[peers.length-1]));
	}
	logger.debug();

	// Build Methods
	
	// Basic Configuration
	that.getIPAddress=function(){ return diameterConfig.IPAddress;};
	that.getPort=function(){ return diameterConfig.port;};
	that.getOriginHost=function(){ return diameterConfig.originHost;};
	that.getVendorId=function(){ return diameterConfig.vendorId;};
	that.getFirmwareRevision=function(){ return diameterConfig.firmwareRevision;};

	that.getOriginHostFromIPAddress=function(ipAddr){
		for(i=0; i<peers.length; i++){
			if(((peers[i].IPAddress.split(":"))[0])===ipAddr) return peers[i].originHost;
		}
	
		// return null if not found
		return null;
	}

	that.getIPAddressPortFromOriginHost=function(originHost){
		for(i=0; i<peers.length; i++){
			if(peers[i].originHost===originHost) return peers[i].IPAddress;
		}
	
		// return null if not found
		return null;
	}

	return that;
}

exports.config=config();
