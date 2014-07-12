// Holder for Diameter configuration

var fs=require("fs");
var logger=require("./log").logger;

// Read diameter configuration
var confObject=JSON.parse(fs.readFileSync("./conf/diameter.json", {encoding: "utf8"}));

// Constructor for the Peer object. Just a holder for the properties
var Peer=function(name, diameterIdentity, IPAddress, connectionPolicy)
{
	this.name=name;
	this.diameterIdentity=diameterIdentity;
	this.IPAddress=IPAddress;
	this.connectionPolicy=connectionPolicy;
}

var config=function()
{
	var that={};

	// Private variables
	var peers=[];
	var port=confObject.port;

	// iterator
	var i;

	// Fill peers array
	for(var i=0; i<confObject.peers.length; i++)
	{
		peers.push(new Peer(confObject.peers[i].name, confObject.peers[i].diameterIdentity, confObject.peers[i].IPAddress, confObject.peers[i].connectionPolicy));
		console.log(JSON.stringify(peers[peers.length-1]));
		
	}

	// Build Methods
	that.getPort=function(){ return port;}

	that.getDiameterIdentityFromIPAddress=function(ipAddr){
		for(i=0; i<peers.length; i++){
			if((peers[i].IPAddress.split(":"))[0]===ipAddr) return peers[i].diameterIdentity;
		}
	
		// return null if not found
		return null;
	}

	that.getIPAddressPortFromDiameterIdentity=function(identity){
		for(i=0; i<peers.length; i++){
			if(peers[i].diameterIdentity===identity) return peers[i].IPAddress;
		}
	
		// return null if not found
		return null;
	}

	return that;
}

exports.config=config();
