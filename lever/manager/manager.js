// Diameter Manager Web Application


// URI conventions
// /dyn                         --> access to database
// /dyn/node/:<nodename>        --> specific for a node
// /dyn/node/:<nodename>/agent  --> proxy to node agent
// /dyn/config                  --> not node specific, or POST with _id

// Dependencies
var Q=require("q");
var logger=require("./log").logger;
var fs=require("fs");
var express=require("express");
var request=require('request');
var MongoClient=require("mongodb").MongoClient;
var ObjectID=require('mongodb').ObjectID;
var bodyParser=require('body-parser');

process.title="lever-manager";

// Database connections
var configDB;
var clientDB;
var eventDB;

// Configuration
var requestTimeout=1000;

// Read manager configuration
var config=JSON.parse(fs.readFileSync(__dirname+"/conf/manager.json", {encoding: "utf8"}));
config.configDatabaseURL=process.env["LEVER_CONFIGDATABASE_URL"]||config.configDatabaseURL;
config.clientDatabaseURL=process.env["LEVER_CLIENTDATABASE_URL"]||config.clientDatabaseURL;
config.eventDatabaseURL=process.env["LEVER_EVENTDATABASE_URL"]||config.eventDatabaseURL;

if(!config.configDatabaseURL) throw Error("Configuration Database URL not found in conf/manager.json or environment variable LEVER_CONFIGDATABASE_URL");
if(!config.clientDatabaseURL) throw Error("Client Database URL not found in conf/manager.json or environment variable LEVER_CLIENTDATABASE_URL");
if(!config.eventDatabaseURL) throw Error("Event Database URL not found in conf/manager.json or environment variable LEVER_EVENTDATABASE_URL");

// Instantiate express
var mApp=express();

// Middleware for JSON
mApp.use(bodyParser.json());

// Static resources mapping
mApp.use("/bower_components", express.static(__dirname+"/bower_components"));
mApp.use("/stc", express.static(__dirname+"/public"));

// Home page is redirected to html/manager.html
mApp.get("/", function(req,res){
    res.redirect("/stc/html/manager.html");
});

// Database middleware
// Just checks that configDB will not throw error when invoked
mApp.use("/dyn", function (req, res, next){
    if(!configDB) res.status(500).send("Error: Configuration database connection closed");
    if(!clientDB) res.status(500).send("Error: Client database connection closed");
    if(!eventDB) res.status(500).send("Error: Event database connection closed");
    else next();
});

// Node middleware. Operations that are node specific
mApp.use("/dyn/node/:hostName/", function (req, res, next){
    var hostName=req.params.hostName;
    if(logger.inDebug) logger.debug("Hostname middleware. Getting node configuration for "+req.params.hostName);
    configDB.collection("nodes").findOne({hostName: req.params.hostName}, {}, config["queryOptions"], function(err, item){
        if(err){
            logger.error("Node middleware: "+err.message);
            res.status(500).send(err.message);
        } else {
            if (!item) res.status(500).send("HostName " + hostName + " not found");
            else {
                if(logger.inDebug) logger.debug("Hostname middleware. Got node configuration for"+req.params.hostName);
                req.serverConfig = item;
                next();
            }
        }
    });
});

// Node proxy. Just forwards the request to the specified node
mApp.use("/dyn/node/:hostName/agent/:command", function(req, res, next){
    var command=req.params.command;
    var management=req.serverConfig.management;
    if(logger.inDebug) logger.debug("Node proxy middleware. Requesting "+"http://"+management.IPAddress+":"+management.httpPort+"/agent/"+command);
    request({
            url: "http://"+management.IPAddress+":"+management.httpPort+"/agent/"+command,
            timeout: requestTimeout
        },
        function(err, response, body){
            if (!err && response.statusCode==200) {
                res.json(JSON.parse(body));
            } else if(err){
                logger.error("Node proxy middleware. Could not get: "+command+" from server. "+err.message);
                res.status(500).send("Could not get "+command+" from server. "+err.message);
            } else {
                logger.error("Node proxy middleware. Got status: "+response.statusCode);
                res.status(500).send("Status: "+response.statusCode);
            }
        });
});

// Get list of nodes
mApp.get("/dyn/config/nodeList", function(req, res){
    if(logger.inDebug) logger.debug("Getting nodes list");
    configDB.collection("nodes").find({}, {}, config["queryOptions"]).toArray(function(err, docs){
        if(!err){
            var nodeList=[];
            docs.forEach(function(doc){nodeList.push(doc.hostName);});
            res.json(nodeList);
        }
        else {
            logger.error();
            res.status(500).send("Error: "+err.message);
        }
    });
});

// Reads basic node configuration
mApp.get("/dyn/node/:hostName/nodeConfiguration", function(req, res) {
    res.json(req.serverConfig);
});

// Updates node configuration (_id based)
mApp.post("/dyn/config/nodeConfiguration", function(req, res){
    req.body._id=ObjectID.createFromHexString(req.body._id);
    if(logger.inDebug) logger.debug("Updating node configuration for "+req.body._id);
    configDB.collection("nodes").update({"_id": req.body._id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
        if(!err && result===1){
            logger.info("Updated node configuration");
            res.json({});
        }
        else if(result===0){
            logger.error("Error updating node configuration: Data was modified by another user");
            res.status(500).send("Configuration modified by another user");
        }
        else{
            logger.error("Error updating node configuration: "+err.message);
            res.status(500).send(err.message);
        }
    });
});

// Reads diameter dictionary
mApp.get("/dyn/config/diameterDictionary", function(req, res){
    if(logger.inDebug) logger.debug("Getting Diameter dictionary");
    configDB.collection("diameterDictionary").findOne({}, {}, config["queryOptions"], function(err, item){
        if(!err){
            if(item) res.json(item);else res.status(500).send("Error: dictionary not found");
        }
        else{
            logger.error("Error getting Diameter dictionary: "+err.message);
            res.status(500).send(err.message);
        }
    });
});

// Updates diameter dictionary
mApp.post("/dyn/config/diameterDictionary", function(req, res){
    req.body._id=ObjectID.createFromHexString(req.body._id);
    if(logger.inDebug) logger.debug("Updating Diameter dictionary for "+req.body._id);
    configDB.collection("diameterDictionary").update({"_id": req.body._id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
        if(!err && result===1){
            logger.info("Updated diameter dictionary");
            res.json({});
        }
        else if(result===0){
            logger.error("Error updating diameter dictionary: Data was modified by another user");
            res.status(500).send("Dictionary modified by another user");
        }
        else{
            logger.error("Error updating diameter dictionary: "+err.message);
            res.status(500).send(err.message);
        }
    });
});

// Get client
mApp.post("/dyn/clients/findClient", function(req, res){
    var clientData={};
    var collectionName;
    var query;
    if(logger.inDebug) logger.info("Got findClient request as "+JSON.stringify(req.body));
    var searchField=req.body.field;
    if(searchField=="phone"){ collectionName="phones"; query={phone: req.body.phone};}
    if(searchField=="userNames"){ collectionName="userName"; query={userName: req.body.userName};}
    if(searchField=="line"){ collectionName="lines"; query={nasPort: req.body.phone, nasIPAddress:req.body.nasIPAddress};}
    if(searchField=="legacyClientId"){ collectionName="clients"; query={legacyClientId: req.body.legacyClientId};}
    // Search the PoU
    if(logger.inDebug) logger.debug("Finding clientId based on "+collectionName);
    clientDB.collection(collectionName).findOne(query, {}, config["queryOptions"], function(err, pou){
        if(!err){
            if(!pou) { res.json({}); return;}

            // Search the Client
            if(logger.inDebug) logger.debug("Finding client "+pou.clientId);
            clientDB.collection("clients").findOne({clientId: pou.clientId}, {}, config["queryOptions"], function (err, client) {
                if (!err) {
                    if(!client) { res.json({}); logger.warn("PoU without client"); return;}
                    clientData.client = client;

                    // Get the plan data
                    if(logger.inDebug) logger.debug("Finding plan "+client.provision.planName);
                    configDB.collection("plans").findOne({name: client.provision.planName}, {}, config["queryOptions"], function (err, plan) {
                        if (!err) {
                            clientData.plan = plan;

                            // Get all PoU
                            if(logger.inDebug) logger.debug("Finding all PoU for "+client.clientId);
                            getClientPoU(client.clientId).then(function(clientPoU){
                                clientData.pointsOfUsage=clientPoU;
                                res.json(clientData);
                            }, function(err){
                                logger.error("Error finding client. Error getting PoUs: "+err.message+" "+JSON.stringify(req.body));
                                res.status(500).send("Error: " + err.message);
                            });
                        }
                        else{
                            logger.error("Error finding client. Error getting plan: "+err.message+" "+JSON.stringify(req.body));
                            res.status(500).send("Error: " + err.message);
                        }
                    });
                }
                else{
                    logger.error("Error finding client. Error getting client: "+err.message+" "+JSON.stringify(req.body));
                    res.status(500).send("Error: " + err.message);
                }
            });
        }
        else{
            logger.error("Error finding client. Error finding client from PoU: "+err.message+" "+JSON.stringify(req.body));
            res.status(500).send("Error: "+err.message);
        }
    });
});


// Initialization
Q.all(
    // Connect to all three databases
    [
        Q.nfcall(MongoClient.connect, config.configDatabaseURL, config["databaseOptions"]),
        Q.nfcall(MongoClient.connect, config.clientDatabaseURL, config["databaseOptions"]),
        Q.nfcall(MongoClient.connect, config.eventDatabaseURL, config["databaseOptions"])
    ]).spread(function(a, b, c){
        configDB=a;
        clientDB=b;
        eventDB=c;
    }).then(function(){
        // Start server
        mApp.listen(config["port"]);
        logger.info("PolicyServer manager listening on port "+config["port"]);
    }).done();


// Connect to mongodb and start server
/*
MongoClient.connect(config["databaseURL"], config["databaseOptions"], function(err, db){
    if(!err && db){
        // Start server
        mApp.listen(config["port"]);
        configDB=db;
        logger.info("Connected to configuration database "+config["databaseURL"]);
        logger.info("PolicyServer manager listening on port "+config["port"]);

        db.on('close', function () {
            logger.info("Connection to database closed");
        });
    }
    else{
        logger.error("Could not connect to database");
    }
});
*/

////////////////////////////////////////////////////////////////////
// Helper functions

// Returns promise to be resolved with an object containing all client PoU
function getClientPoU(clientId){
    return Q.all(
        // Connect to all three databases
        [
            Q.ninvoke(clientDB.collection("phones").find({clientId: clientId}, {}, config["queryOptions"]), "toArray"),
            Q.ninvoke(clientDB.collection("userNames").find({clientId: clientId}, {}, config["queryOptions"]), "toArray"),
            Q.ninvoke(clientDB.collection("lines").find({clientId: clientId}, {}, config["queryOptions"]), "toArray")
        ]).spread(function(phones, userNames, lines){
            return {
                phones: phones,
                userNames: userNames,
                lines: lines
            }
        });
}


