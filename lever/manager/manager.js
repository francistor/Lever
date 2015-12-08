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
var arm=require("arm").arm;

process.title="lever-manager";

// Database connections
var configDB;
var clientDB;
var eventDB;

// Configuration
var requestTimeout=1000;
var phoneRegEx=/[0-9]{9,11}/;
var lineRegEx=/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]{1,10}/;
var userNameRegEx=/.+@.+/;

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
    else if(!clientDB) res.status(500).send("Error: Client database connection closed");
    else if(!eventDB) res.status(500).send("Error: Event database connection closed");
    else next();
});

// Node middleware. Operations that are node specific. Passes the node config in req.serverConfig
mApp.use("/dyn/node/:hostName/", function (req, res, next){
    var hostName=req.params.hostName;
    if(logger.isDebugEnabled) logger.debug("Hostname middleware. Getting node configuration for "+req.params.hostName);
    configDB.collection("nodes").findOne({hostName: req.params.hostName}, {}, config["queryOptions"], function(err, item){
        if(err){
            logger.error("Node middleware: "+err.message);
            res.status(500).send(err.message);
        } else {
            if (!item) res.status(500).send("HostName " + hostName + " not found");
            else {
                if(logger.isDebugEnabled) logger.debug("Hostname middleware. Got node configuration for "+req.params.hostName);
                req.serverConfig = item;
                next();
            }
        }
    });
});

// Node proxy. Just forwards the request to the specified node
mApp.use("/dyn/node/:hostName/agent/:command", function(req, res, next){
    var command=req.params.command;
    var nodeManagement=req.serverConfig.management;
    if(logger.isDebugEnabled) logger.debug("Node proxy middleware. Requesting "+"http://"+nodeManagement.IPAddress+":"+nodeManagement.httpPort+"/agent/"+command);
    request({
            url: "http://"+nodeManagement.IPAddress+":"+nodeManagement.httpPort+"/agent/"+command,
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

// Get list of node names in Array
mApp.get("/dyn/config/nodeList", function(req, res){
    if(logger.isDebugEnabled) logger.debug("Getting nodes list");
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
    if(logger.isDebugEnabled) logger.debug("Updating node configuration for "+JSON.stringify(req.body._id));
    configDB.collection("nodes").updateOne({"_id": _id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
        if(!err && result.modifiedCount===1){
            logger.info("Updated node configuration");
            res.json({});
        } else if(!err && result.modifiedCount===0){
            logger.error("Error updating node configuration: Data was modified by another user");
            res.status(500).send("Configuration modified by another user");
        } else{
            logger.error("Error updating node configuration: "+(err==null?"":err.message));
            res.status(500).send((err||{}).message);
        }
    });
});

// Reads diameter dictionary
mApp.get("/dyn/config/diameterDictionary", function(req, res){
    if(logger.isDebugEnabled) logger.debug("Getting Diameter dictionary");
    configDB.collection("diameterDictionary").findOne({}, {}, config["queryOptions"], function(err, item){
        if(!err){
            if(item) res.json(item); else res.status(500).send("Error: dictionary not found");
        }
        else{
            logger.error("Error getting Diameter dictionary: "+err.message);
            res.status(500).send(err.message);
        }
    });
});

// Updates diameter dictionary
mApp.post("/dyn/config/diameterDictionary", function(req, res){
    var _id=ObjectID.createFromHexString(req.body._id);
    if(logger.isDebugEnabled) logger.debug("Updating Diameter dictionary for "+JSON.stringify(req.body._id));
    configDB.collection("diameterDictionary").updateOne({"_id": _id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
        if(!err && result.modifiedCount===1){
            logger.info("Updated diameter dictionary");
            res.json({});
        }
        else if(!err && result.modifiedCount===0){
            logger.error("Error updating diameter dictionary: Data was modified by another user");
            res.status(500).send("Dictionary modified by another user");
        }
        else{
            logger.error("Error updating diameter dictionary: "+(err==null?"":err.message));
            res.status(500).send((err||{}).message);
        }
    });
});

mApp.post("/dyn/clients/getFullClientData", function(req, res){
    var query;

    // Get the client context
    var searchField=req.body.searchField;
    if(searchField=="phone"){ query={phone: req.body.phone};}
    else if(searchField=="userName"){ query={userName: req.body.userName};}
    else if(searchField=="line"){ query={nasPort: parseInt(req.body.nasPort), nasIPAddress:req.body.nasIPAddress};}
    else {res.status(500).send("Error: Bad query data"); return;}

    var fullClientContext={};
    arm.findClient(query).then(function(client){
        if(!client) throw new Error("Client not found");
        return arm.getClientContext(client);
    }).then(function(clientContext){
        fullClientContext=clientContext;
        return arm.getClientAllPoU(clientContext.client._id);
    }).then(function(pou){
        fullClientContext.pointsOfUsage=pou;
        res.json(fullClientContext);
    }).fail(function(err){
        res.status(500).send("Error: " +  err.message);
    });
});


mApp.post("/dyn/clients/updateClientProvisionData", function(req, res) {
    var _id = ObjectID.createFromHexString(req.body._id);
    if (logger.isDebugEnabled) logger.debug("Updating Client provision data: " + JSON.stringify(req.body));
    clientDB.collection("clients").updateOne({
        "_id": _id,
        "provision._version": req.body.provision._version - 1
    }, {$set:{provision: req.body.provision}}, config["queryOptions"], function (err, result) {
        if (!err && result.modifiedCount === 1) {
            logger.info("Updated client");
            res.json({});
        }
        else if (!err && result.modifiedCount === 0) {
            logger.error("Error updating client provision data: Data was modified by another user");
            res.status(500).send("Client provision data modified by another user");
        }
        else {
            logger.error("Error updating client: "+(err==null?"":err.message));
            res.status(500).send((err||{}).message);
        }
    });
});

mApp.post("/dyn/clients/addPoU", function(req, res){
    var clientId = ObjectID.createFromHexString(req.body.clientId);
    if(logger.isDebugEnabled) logger.debug("Adding point of usage: " + JSON.stringify(req.body));

    var collectionName;
    // Find collection where to do the looking up
    if(req.body.pouType=="phone") collectionName="phones"; else if(req.body.pouType=="userName") collectionName="userNames"; else if(req.body.pouType=="line") collectionName="lines";
    else {res.status(500).send("Bad Point of usage"); return;}

    // Check validity
    var pouDocument;
    if(collectionName=="phones"){
        if(!phoneRegEx.test(req.body.pouValue)){
            res.status(500).send("Bad phone"); return;
        }
        pouDocument={clientId: clientId, phone: req.body.pouValue};
    } else if(collectionName=="userNames"){
        if(!userNameRegEx.test(req.body.pouValue)){
            res.status(500).send("Bad username"); return;
        }
        pouDocument={clientId: clientId, userName: req.body.pouValue};
    } else if(collectionName=="lines"){
        if(!lineRegEx.test(req.body.pouValue)){
            res.status(500).send("Bad line"); return;
        }
        var lineComponents=req.body.pouValue.split(":");
        pouDocument={clientId: clientId, nasPort: lineComponents[1], nasIPAddress: lineComponents[0]};
    }

    // Do insertion
    clientDB.collection(collectionName).insert(pouDocument, null, function(err, result){
        if(!err){
            res.json();
            logger.info("Added point of usage "+ JSON.stringify(req.body));
        }
        else res.status(500).send(err.message);
    });
});

mApp.post("/dyn/clients/deletePoU", function(req, res){
    if (logger.isDebugEnabled) logger.debug("Deleting point of usage: " + JSON.stringify(req.body));

    var collectionName;
    // Find collection where to do the looking up
    if(req.body.pouType=="phone") collectionName="phones"; else if(req.body.pouType=="userName") collectionName="userNames"; else if(req.body.pouType=="line") collectionName="lines";
    else {res.status(500).send("Bad Point of usage"); return;}

    // Do deletion
    clientDB.collection(collectionName).deleteOne({_id: ObjectID.createFromHexString(req.body.pou._id)}, null, function(err, result){
        if(!err){
            res.json();
            logger.info("Deleted point of usage "+ JSON.stringify(req.body));
        }
        else res.status(500).send(err.message);
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
        arm.setDatabaseConnections(configDB, clientDB, eventDB, config["databaseOptions"], config["queryOptions"]);
        return arm.reloadPlansAndCalendars();
    }).then(function(){
        // Start server
        mApp.listen(config["port"]);
        logger.info("PolicyServer manager listening on port "+config["port"]);
    }).done();






