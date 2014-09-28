// Instrumentation agent
var mLogger=require("./log").mLogger;
var stats=require("./stats").stats;
var config=require("./config").config;
var express=require("express");
var bodyParser=require('body-parser');

var createAgent=function(diameterStateMachine){

    // Instantiate express
    var httpServer=express();

    // parse application/json
    httpServer.use(bodyParser.json());

    // Start server
    httpServer.listen(config.diameterConfig["management"]["httpPort"]);
    mLogger.info("HTTP manager listening on port "+config.diameterConfig["management"]["httpPort"]);

    httpServer.get("/dyn/agent/readDiameterConfig", function(req, res){
        mLogger.debug("Reloading diameter configuration");
        config.readDiameterConfiguration();
        res.json({});
    });

    httpServer.get("/dyn/agent/diameterStats", function(req, res){
        mLogger.debug("Getting stats");
        res.json(stats);
    });
};

exports.createAgent=createAgent;
