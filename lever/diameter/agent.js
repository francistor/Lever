// Instrumentation agent
var mLogger=require("./log").mLogger;
var stats=require("./stats").stats;
var config=require("./config").config;
var express=require("express");
var bodyParser=require('body-parser');

var createAgent=function(diameterServer){

    // Instantiate express
    var httpServer=express();

    // parse application/json
    httpServer.use(bodyParser.json());

    // Start server
    httpServer.listen(config.node["management"]["httpPort"]);
    mLogger.info("HTTP manager listening on port "+config.node["management"]["httpPort"]);

    httpServer.get("/agent/updateDiameterConfig", function(req, res){
        mLogger.debug("Reloading diameter configuration");
        config.readDiameterConfiguration();
        res.json({});
    });

    httpServer.get("/agent/updateDispatcherConfig", function(req, res){
        mLogger.debug("Reloading dispatcher configuration");
        config.readDispatcher();
        res.json({});
    });

    httpServer.get("/agent/updateDictionary", function(req, res){
        mLogger.debug("Reloading dictionary configuration");
        config.readDictionary();
        res.json({});
    });

    httpServer.get("/agent/getDiameterStats", function(req, res){
        mLogger.debug("Getting stats");
        res.json(stats);
    });

    httpServer.get("/agent/getPeerStatus", function(req, res){
        mLogger.debug("Getting connection status");
        res.json(diameterServer.getPeerStatus());
    });
};

exports.createAgent=createAgent;
