// Diameter Manager Web Application


// URI conventions
// /dyn                         --> access to database
// /dyn/node/:<nodename>        --> specific for a node
// /dyn/node/:<nodename>/agent  --> proxy to node agent
// /dyn/config                  --> not node specific, or POST with _id

// Dependencies
var logger=require("./log").logger;
var fs=require("fs");
var express=require("express");
var request=require('request');
var MongoClient=require("mongodb").MongoClient;
var ObjectID=require('mongodb').ObjectID;
var bodyParser=require('body-parser');

// Database connection
var configDB;

// Configuration
var requestTimeout=1000;

// Read dmanager configuration
var config=JSON.parse(fs.readFileSync("./conf/manager.json", {encoding: "utf8"}));

// Instantiate express
var mApp=express();

// Middleware for JSON
mApp.use(bodyParser.json());

// Static resources mapping
mApp.use("/bower_components", express.static(__dirname+"/bower_components"));
mApp.use("/stc", express.static(__dirname+"/public"));

// Database middleware
// Just checks that configDB will not throw error when invoked
mApp.use("/dyn", function (req, res, next){
    if(!configDB) res.status(500).send("Error: Database connection closed");
    else next();
});

// Node middleware. Operations that are node specific
mApp.use("/dyn/node/:hostName/", function (req, res, next){
    var hostName=req.params.hostName;
    configDB.collection("nodes").findOne({hostName: req.params.hostName}, {}, config["queryOptions"], function(err, item){
        if(err){
            res.status(500).send(err.message);
        } else {
            if (!item) res.status(500).send("HostName " + hostName + " not found");
            else {
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
    console.log("requesting "+"http://"+management.IPAddress+":"+management.httpPort+"/agent/"+command);

    request({
            url: "http://"+management.IPAddress+":"+management.httpPort+"/agent/"+command,
            timeout: requestTimeout
        },
        function(err, response, body){
            if (!err && response.statusCode==200) {
                res.json(JSON.parse(body));
            } else err ? res.status(500).send("Could not get "+command+" from server. "+err.message) : res.status(500).send("Status: "+response.statusCode);
        });
});


// Home page is redirected to html/manager.html
mApp.get("/", function(req,res){
    res.redirect("/stc/html/manager.html");
});

// Get list of nodes
mApp.get("/dyn/config/nodeList", function(req, res){
    configDB.collection("nodes").find({}, {}, config["queryOptions"]).toArray(function(err, docs){
        if(!err){
            var nodeList=[];
            docs.forEach(function(doc){nodeList.push(doc.hostName);});
            res.json(nodeList);
        }
        else res.status(500).send("Error: "+err.message);
    });
});

// Reads diameter configuration
mApp.get("/dyn/node/:hostName/nodeConfiguration", function(req, res) {
    res.json(req.serverConfig);
});

// Updates node configuration (_id based)
mApp.post("/dyn/config/nodeConfiguration", function(req, res){
    req.body._id=ObjectID.createFromHexString(req.body._id);
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
    configDB.collection("diameterDictionary").findOne({}, {}, config["queryOptions"], function(err, item){
        if(!err){
            if(item) res.json(item);else res.status(500).send("Error: dictionary not found");
        }
        else res.status(500).send(err.message);
    });
});

// Updates diameter dictionary
mApp.post("/dyn/config/diameterDictionary", function(req, res){
    req.body._id=ObjectID.createFromHexString(req.body._id);
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


// Connect to mongodb and start server
MongoClient.connect(config["databaseURL"], config["databaseOptions"], function(err, db){
    if(!err && db){
        // Start server
        mApp.listen(config["port"]);
        configDB=db;
        logger.info("Connected to configuration database "+config["databaseURL"]);
        logger.info("Diameter manager listening on port "+config["port"]);

        db.on('close', function () {
            logger.info("Connection to database closed");
        });
    }
    else{
        logger.error("Could not connect to database");
    }
});


