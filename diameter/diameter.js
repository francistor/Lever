// Toy diameter server

// Dependencies
var net=require("net");
var fs=require("fs");
var logger=require("./log").logger;
var config=require("./config").config;
var diameterConnections=require("./connections").diameterConnections;

var diameterDictionary=require("./dictionary").diameterDictionary;

logger.info("Diameter toy server version 0.1");

// Create Diameter Server
var diameterServer=net.createServer();

diameterServer.on("connection", function(connection){
	logger.debug("got connection from "+connection.remoteAddress);

	diameterConnections.incomingConnection(connection);
});

diameterServer.listen(config.getPort());
logger.info("Toy Diameter server started in port "+config.getPort());


