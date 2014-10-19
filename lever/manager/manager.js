// Diameter Manager Web Application

// Dependencies
var logger=require("./log").logger;
var fs=require("fs");
var express=require("express");
var MongoClient=require("mongodb").MongoClient;
var ObjectID=require('mongodb').ObjectID;
var bodyParser=require('body-parser');

// Read dmanager configuration
var config=JSON.parse(fs.readFileSync("./conf/manager.json", {encoding: "utf8"}));

// Instantiate express
var mApp=express();

// Middleware for JSON
mApp.use(bodyParser.json());

// Static resources mapping
mApp.use("/bower_components", express.static(__dirname+"/bower_components"));
mApp.use("/stc", express.static(__dirname+"/public"));

// Database connection
var configDB;

// Home page is redirected to html/manager.html
mApp.get("/", function(req,res){
    res.redirect("/stc/html/manager.html");
});


// Get list of nodes
mApp.get("/dyn/config/nodeList", function(req, res){
    if(!configDB){
        res.status(500).send("Error: Database connection closed");
    }
    else configDB.collection("diameterConfig").find({}, {}, config["queryOptions"]).toArray(function(err, docs){
        if(!err){
            var nodeList=[];
            docs.forEach(function(doc){nodeList.push(doc.serverName);});
            res.json(nodeList);
        }
        else res.status(500).send("Error: "+err.message);
    });

});

// Reads diameter configuration
mApp.get("/dyn/config/diameterConfiguration/:serverName", function(req, res){
    if(!configDB){
        res.status(500).send("Error: Database connection closed");
    }
    else configDB.collection("diameterConfig").findOne({serverName: req.params.serverName}, {}, config["queryOptions"], function(err, item){
        if(!err){
            if(item)res.json(item);else res.json({error: "serverName not found"});
        }
        else res.status(500).send("Error: "+err.message);
    });
});

// Updates diameter configuration
mApp.post("/dyn/config/diameterConfiguration", function(req, res){
    if(!configDB){
        res.status(500).send("Error: Database connection closed");
    }
    else{
        req.body._id=ObjectID.createFromHexString(req.body._id);
        configDB.collection("diameterConfig").update({"_id": req.body._id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
            if(!err && result===1){
                logger.info("Updated diameter configuration");
                res.json({});
            }
            else if(result===0){
                logger.error("Error updating diameter configuration: Data was modified by another user");
                res.status(500).send("Error: configuration modified by another user");
            }
            else{
                logger.error("Error updating diameter configuration: "+err.message);
                res.status(500).send("Error: "+err.message);
            }
        });
    }
});

// Reads diameter dictionary
mApp.get("/dyn/config/diameterDictionary", function(req, res){
    if(!configDB){
        res.status(500).send("Error: Database connection closed");
    }
    else configDB.collection("dictionaryConfig").findOne({}, {}, config["queryOptions"], function(err, item){
        if(!err){
            if(item) res.json(item);else res.status(500).send("Error: dictionary not found");
        }
        else res.status(500).send("Error: "+err.message);
    });
});

// Updates diameter dictionary
mApp.post("/dyn/config/diameterDictionary", function(req, res){
    if(!configDB){
        rres.status(500).send("Error: Database connection closed");
    }
    else{
        req.body._id=ObjectID.createFromHexString(req.body._id);
        configDB.collection("dictionaryConfig").update({"_id": req.body._id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
            if(!err && result===1){
                logger.info("Updated diameter dictionary");
                res.json({});
            }
            else if(result===0){
                logger.error("Error updating diameter dictionary: Data was modified by another user");
                res.status(500).send("Error: Dictionary modified by another user");
            }
            else{
                logger.error("Error updating diameter dictionary: "+err.message);
                res.status(500).send("Error: "+err.message);;
            }
        });
    }
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


