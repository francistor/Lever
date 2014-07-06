// Toy diameter server

// Dependencies
var net=require("net");
var fs=require("fs");
var logger=require("./log").logger;
var peers=require("./peers");
var DiameterConnection=require("./diameterConnection").DiameterConnection;
var diameterConnections=require("./diameterConnection").diameterConnections;

var diameterDictionary=require("./dictionary").diameterDictionary;

logger.info("Diameter toy server version 0.1");

// Read diameter configuration
var diameterConfig=JSON.parse(fs.readFileSync("./conf/diameter.json", {encoding: "utf8"}));

// Load peers table
var peersTable=new peers.PeerTable(diameterConfig.peers);
for (var i=0; i<peersTable.peers.length; i++){logger.verbose("Peer -- name: "+peersTable.peers[i].name+" diameterIdentity: "+peersTable.peers[i].diameterIdentity+" IPAddress: "+peersTable.peers[i].IPAddress+"\n");}

// Create Diameter Server
var diameterServer=net.createServer();

diameterServer.on("connection", function(connection){
	logger.debug("got connection from "+connection.remoteAddress);

	// Check is a known peer
	identity=peersTable.getDiameterIdentity(connection.remoteAddress);
	
	// If unknown peer, close
	if(identity==null)
	{
		logger.debug("Connection rejected due to peer unknown");
		connection.end();
	}
	// If known peer store with "Waiting for CER" state
	else
	{
		logger.debug("Connection established. Wating for CER")
		diameterConnections.push(new DiameterConnection(diameterConnections, "Wait-CER", connection, identity));
	}
});

diameterServer.listen(diameterConfig.port);
logger.info("Toy Diameter server started in port "+diameterConfig.port);


