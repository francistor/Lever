// Instrumentation agent
var mLogger=require("./log").mLogger;
var diameterStats=require("./stats").diameterStats;
var radiusStats=require("./stats").radiusStats;
var config=require("./config").config;
var express=require("express");
var bodyParser=require('body-parser');

var createAgent=function(diameterServer, radiusServer){

    // Instantiate express
    var httpServer=express();

    // parse application/json
    httpServer.use(bodyParser.json());

    // Start server
    httpServer.listen(config.node["management"]["httpPort"]);
    mLogger.info("HTTP manager listening on port "+config.node["management"]["httpPort"]);

    httpServer.get("/agent/updateNodeConfig", function(req, res){
        mLogger.debug("Reloading basic configuration");
        config.readNodeConfiguration();
        res.json({});
    });

    httpServer.get("/agent/updateDispatcherConfig", function(req, res){
        mLogger.debug("Reloading dispatcher configuration");
        config.readDispatcher();
        res.json({});
    });

    httpServer.get("/agent/updateDiameterDictionary", function(req, res){
        mLogger.debug("Reloading diameter dictionary configuration");
        config.readDiameterDictionary();
        res.json({});
    });

    httpServer.get("/agent/getDiameterStats", function(req, res){
        mLogger.debug("Getting diameter stats");
        res.json(diameterStats);
    });

    httpServer.get("/agent/getRadiusStats", function(req, res){
        mLogger.debug("Getting radius stats");
        res.json(radiusStats);
    });

    httpServer.get("/agent/getPeerStatus", function(req, res){
        mLogger.debug("Getting connection status");
        res.json(diameterServer.getPeerStatus());
    });
};

exports.createAgent=createAgent;
