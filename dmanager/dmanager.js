// Diameter Manager Web Application

// Dependencies
var logger=require("./log").logger;
var fs=require("fs");
var express=require("express");

// Read dmanager configuration
var confObject=JSON.parse(fs.readFileSync("./conf/dmanager.json", {encoding: "utf8"}));

// Instantiate express
var dapp=express();

// Static resources mapping
dapp.use("/stc/bootstrap", express.static(__dirname+"/bower_components/bootstrap/dist"));
dapp.use("/stc/jquery", express.static(__dirname+"/bower_components/jquery/dist"));
dapp.use("/stc/fontawesome", express.static(__dirname+"/bower_components/fontawesome"));
dapp.use("/stc", express.static(__dirname+"/public"));

dapp.get("/", function(req, res){
	res.send("hello world!");
}
);

// Start server
dapp.listen(confObject.port);
logger.info("Diameter manager listening on port "+confObject.port);


