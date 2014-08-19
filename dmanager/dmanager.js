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
dapp.use("/bower_components", express.static(__dirname+"/bower_components"));
dapp.use("/stc", express.static(__dirname+"/public"));

// GET diameter configuration file
// Tries to parse it as JSON
dapp.get("/dyn/get/diameterConfiguration", function(req, res){
	fs.readFile(__dirname+"/../diameter/conf/diameter.json", {encoding: "utf8"}, function(err, data){
		if(err){
			res.send(500, { error: 'Could not get diameter configuration file' });
		}
		else{
			try{
				var diameterConfig=JSON.parse(data);
				res.json(diameterConfig);
			}
			catch(e){ res.send(500, { error: 'Could not parse diameter configuration file' });}
		}
	});
});

// Start server
dapp.listen(confObject.port);
logger.info("Diameter manager listening on port "+confObject.port);


