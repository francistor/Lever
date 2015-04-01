// Instrumentation agent
var mLogger=require("./log").mLogger;
var diameterStats=require("./stats").diameterStats;
var radiusStats=require("./stats").radiusStats;
var config=require("./configService").config;
var express=require("express");
var bodyParser=require('body-parser');

var createAgent=function(config, diameterServer, radiusServer){

    // Instantiate express
    var httpServer=express();

    // parse application/json
    httpServer.use(bodyParser.json());

    // Start server
    httpServer.listen(config.node["management"]["httpPort"]);
    mLogger.info("HTTP manager listening on port "+config.node["management"]["httpPort"]);

    httpServer.get("/agent/updateAll", function(req, res){
        mLogger.debug("Reloading configuration");
        config.updateAll();
        res.json({});
    });

    httpServer.get("/agent/updateNodeConfig", function(req, res){
        mLogger.debug("Reloading basic configuration");
        config.updateNode();
        res.json({});
    });

    httpServer.get("/agent/updateDispatcherConfig", function(req, res){
        mLogger.debug("Reloading dispatcher configuration");
        config.updateDispatcher();
        res.json({});
    });

    httpServer.get("/agent/updateDiameterDictionary", function(req, res){
        mLogger.debug("Reloading diameter dictionary configuration");
        config.updateDiameterDictionary();
        res.json({});
    });

    httpServer.get("/agent/updateCdrChannels", function(req, res){
        mLogger.debug("Reloading cdr channels");
        config.updateCdrChannels();
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
       res.json(diameterServer?diameterServer.getPeerStatus():{});
    });

    httpServer.get("/agent/getRadiusServerStatus", function(req, res){
        mLogger.debug("Getting radius server status");
        res.json(config.node.radius.radiusServerMap);
    });
};

exports.createAgent=createAgent;
