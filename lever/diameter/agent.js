// Instrumentation agent
var mLogger=require("./log").mLogger;
var stats=require("./stats").stats;
var config=require("./config").config;
var express=require("express");

var createAgent=function(diameterStateMachine){

    // Instantiate express
    var httpServer=express();

    // Start server
    httpServer.listen(config.diameter["management"]["httpPort"]);
    mLogger.info("HTTP manager listening on port "+config.diameter["management"]["httpPort"]);

    httpServer.get("/dyn/get/diameterConfig", function(req, res){
        mLogger.debug("Getting diameter configuration");
        res.json(config.diameter);
    });

    httpServer.get("/dyn/pull/diameterConfig", function(req, res){
        mLogger.debug("Updating diameter configuration");
        config.startUpdateDiameter();
        res.json({});
    });

    httpServer.get("/dyn/get/diameterStats", function(req, res){
        mLogger.debug("Getting stats");
        res.json(stats);
    });
};

exports.createAgent=createAgent;
