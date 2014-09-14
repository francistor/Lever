// Diameter Manager Web Application

// Dependencies
var logger=require("./log").logger;
var fs=require("fs");
var express=require("express");
var MongoClient=require("mongodb").MongoClient;
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

mApp.get("/dyn/config/diameterConfiguration", function(req, res){
    if(!configDB){
        res.json({"error": "Database closed"});
    }
    else configDB.collection("diameterConfig").findOne({}, {}, config["queryOptions"], function(err, item){
        if(!err){
            res.json(item);
        }
        else res.json({"error": err.message});
    });
});

mApp.post("/dyn/config/diameterConfiguration", function(req, res){
    if(!configDB){
        res.json({"error": "Database closed"});
    }
    else configDB.collection("diameterConfig").update({"_id": req.body._id}, req.body, config["queryOptions"], function(err, result){
        if(!err && result===1){
            logger.info("Updated diameter configuration");
            res.json({});
        }
        else if(result===0){
            logger.error("Error updating diameter configuration: Data was modified by another user");
            res.json({"error": "Data modified by another user"});
        }
        else{
            logger.error("Error updating diameter configuration: "+err.message);
            res.json({"error": err.message});
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


