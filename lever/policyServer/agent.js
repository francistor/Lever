// Instrumentation agent
var logger=require("./log").logger;
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
    logger.info("[Agent] listening on port %s", config.node["management"]["httpPort"]);

    httpServer.get("/agent/updateAll", function(req, res){
        logger.verbose("[Agent] Reloading configuration (/agent/updateAll)");
        config.updateAll();
        res.json({});
    });

    httpServer.get("/agent/updateNodeConfig", function(req, res){
        logger.verbose("[Agent] Reloading basic configuration (/agent/updateNodeConfig)");
        config.updateNode();
        res.json({});
    });

    httpServer.get("/agent/updateDispatcherConfig", function(req, res){
        logger.verbose("[Agent] Reloading dispatcher configuration (/agent/updateDispatcherConfig)");
        config.updateDispatcher();
        res.json({});
    });

    httpServer.get("/agent/updateDiameterDictionary", function(req, res){
        logger.verbose("[Agent] Reloading diameter dictionary configuration (/agent/updateDiameterDictionary)");
        config.updateDiameterDictionary();
        res.json({});
    });

    httpServer.get("/agent/getDiameterStats", function(req, res){
        logger.verbose("[Agent] Getting diameter stats (/agent/getDiameterStats)");
        res.json(diameterStats);
    });

    httpServer.get("/agent/getRadiusStats", function(req, res){
        logger.verbose("[Agent] Getting radius stats (/agent/getRadiusStats)");
        res.json(radiusStats);
    });

    httpServer.get("/agent/getPeerStatus", function(req, res){
        logger.verbose("[Agent] Getting connection status (/agent/getPeerStatus)");
       res.json(diameterServer?diameterServer.getPeerStatus():{});
    });

    httpServer.get("/agent/getRadiusServerStatus", function(req, res){
        logger.verbose("[Agent] Getting radius server status ((agent/getRadiusServerStatus)");
        res.json(config.node.radius.radiusServerMap);
    });

    httpServer.get("/agent/stop", function(req,res){
        logger.verbose("[Agent] Stopping process (/agent/stop)");
        setTimeout(function(){process.exit()}, 1000);
        res.json({});
    });
};

exports.createAgent=createAgent;
