// Peer and PeerTable Objects

// Constructor for the Peer object. Just a holder for the properties
var Peer=function(name, diameterIdentity, IPAddress, connectionPolicy)
{
	this.name=name;
	this.diameterIdentity=diameterIdentity;
	this.IPAddress=IPAddress;
	this.connectionPolicy=connectionPolicy;
}

// Constructor for PeerTable. Holder for peers plus helper functions
var PeerTable=function(peers)
{
	// Populate the contents of the table using the configuration information
	this.peers=[];
	for(var i=0; i<peers.length; i++)
	{
		this.peers.push(new Peer(peers[i].name, peers[i].diameterIdentity, peers[i].IPAddress, peers[i].connectionPolicy));
	}
}


// Gets the diameterIdentity for the specified IPAddress
PeerTable.prototype.getDiameterIdentity=function(IPAddress)
{
	for(var i=0; i<this.peers.length; i++)
	{
		if((this.peers[i].IPAddress.split(":"))[0]===IPAddress) return this.peers[i].diameterIdentity;
	}
	
	// return null if not found
	return null;
}

exports.Peer=Peer;
exports.PeerTable=PeerTable;
