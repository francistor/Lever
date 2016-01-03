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
//var arm=require("arm").arm;
var arm=require("../arm/arm").arm;

process.title="lever-manager";

// Database connections
var configDB;
var clientDB;
var eventDB;

// Configuration
var requestTimeout=1000;

// Validations
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
    if(!configDB){res.status(500).send("Configuration database connection closed"); logger.error("[/dyn middleware] Connection to configuration database is closed");}
    else if(!clientDB) {res.status(500).send("Client database connection closed"); logger.error("[/dyn middleware] Connection to configuration database is closed");}
    else if(!eventDB) {res.status(500).send("Event database connection closed"); logger.error("[/dyn middleware] Connection to configuration database is closed");}
    else next();
});

// Node middleware. Operations that are node specific. Passes the node config in req.serverConfig
mApp.use("/dyn/node/:hostName/", function (req, res, next){

    if(logger.isDebugEnabled) logger.debug("[/dyn/node/:hostName middleware] Getting node configuration for "+req.params.hostName);

    var hostName=req.params.hostName;
    configDB.collection("nodes").findOne({hostName: req.params.hostName}, {}, config["queryOptions"], function(err, item){
        if(err){
            logger.error("[/dyn/node/:hostName middleware] %s", err.message);
            res.status(500).send(err.message);
        } else {
            if (!item){
                if(logger.isWarnEnabled) logger.warn("[/dyn/node/:hostName middleware] %s", err.message);
                res.status(500).send("HostName " + hostName + " not found");
            }
            else {
                if(logger.isDebugEnabled) logger.debug("[/dyn/node/:hostName middleware] Got node configuration for "+req.params.hostName);
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

    if(logger.isDebugEnabled) logger.debug("[/dyn/node/:hostName/agent/:command middleware] Requesting http://"+nodeManagement.IPAddress+":"+nodeManagement.httpPort+"/agent/"+command);
    request({
            url: "http://"+nodeManagement.IPAddress+":"+nodeManagement.httpPort+"/agent/"+command,
            timeout: requestTimeout
        },
        function(err, response, body){
            if (!err && response.statusCode==200) {
                if(logger.isDebugEnabled) logger.debug("[/dyn/node/:hostName/agent/:command middleware] Command %s executed in %s", command, nodeManagement.IPAddress);
                res.json(JSON.parse(body));
            } else if(err){
                logger.error("[/dyn/node/:hostName/agent/:command middleware] Could not execute %s in server %s due to %s", command, nodeManagement.IPAddress, err.message);
                res.status(500).send("Could not execute "+command+" in node. "+err.message);
            } else {
                logger.error("[/dyn/node/:hostName/agent/:command middleware] Got error status: "+response.statusCode);
                res.status(500).send("Status: "+response.statusCode);
            }
        });
});

// Get list of node names in Array
mApp.get("/dyn/config/nodeList", function(req, res){

    if(logger.isDebugEnabled) logger.debug("[/dyn/config/nodeList] Getting nodes list");

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

    if(logger.isDebugEnabled) logger.debug("[/dyn/node/:hostName/nodeConfiguration] Getting node configuration for %s", req.params.hostName);

    res.json(req.serverConfig);
});

// Updates node configuration (_id based)
mApp.post("/dyn/config/nodeConfiguration", function(req, res){

    if(logger.isDebugEnabled) logger.debug("[/dyn/config/nodeConfiguration] Updating node configuration for %s", req.body._id);

    var _id=ObjectID.createFromHexString(req.body._id);
    req.body._version++;
    req.body._id=_id;

    configDB.collection("nodes").updateOne({"_id": _id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
        if(!err && result.modifiedCount===1){
            if(logger.isInfoEnabled) logger.info("[/dyn/config/nodeConfiguration] Updated node configuration");
            res.json({});
        } else if(!err && result.modifiedCount===0){
            logger.error("[/dyn/config/nodeConfiguration] Error updating node configuration: Data was modified by another user");
            res.status(500).send("Error updating node configuration: Data was modified by another user");
        } else{
            logger.error("[/dyn/config/nodeConfiguration] Error updating node configuration: %s", (err==null?"":err.message));
            res.status(500).send((err||{}).message);
        }
    });
});

// Reads diameter dictionary
mApp.get("/dyn/config/diameterDictionary", function(req, res){

    if(logger.isDebugEnabled) logger.debug("[/dyn/config/diameterDictionary] Getting Diameter dictionary");

    configDB.collection("diameterDictionary").findOne({}, {}, config["queryOptions"], function(err, item){
        if(!err){
            if(item) res.json(item);
            else res.status(500).send("Error: dictionary not found");
        }
        else{
            logger.error("[/dyn/config/diameterDictionary] Error getting Diameter dictionary: "+err.message);
            res.status(500).send(err.message);
        }
    });
});

// Updates diameter dictionary
mApp.post("/dyn/config/updateDiameterDictionary", function(req, res){

    if(logger.isDebugEnabled) logger.debug("[/dyn/config/diameterDictionary] Updating Diameter dictionary for "+JSON.stringify(req.body._id));

    var _id=ObjectID.createFromHexString(req.body._id);
    req.body._version++;
    req.body._id=_id;

    configDB.collection("diameterDictionary").updateOne({"_id": _id, "_version": req.body._version-1}, req.body, config["queryOptions"], function(err, result){
        if(!err && result.modifiedCount===1){
            logger.info("[/dyn/config/diameterDictionary] Updated diameter dictionary");
            res.json({});
        }
        else if(!err && result.modifiedCount===0){
            logger.error("[/dyn/config/diameterDictionary] Error updating diameter dictionary: Data was modified by another user");
            res.status(500).send("Dictionary modified by another user");
        }
        else{
            logger.error("[/dyn/config/diameterDictionary] Error updating diameter dictionary: %s", (err==null?"":err.message));
            res.status(500).send((err||{}).message);
        }
    });
});

/**
 * Creates a new client in the database
 */
mApp.post("/dyn/clients/createClient", function(req, res){

    if(logger.isDebugEnabled) logger.debug("[/dyn/clients/createClient] Creating client %s", JSON.stringify(req.body));

    arm.pCreateClient(req.body).
        then(function(){
            if(logger.isInfoEnabled) logger.info("[/dyn/clients/createClient] Client created %s", JSON.stringify(req.body));
            res.json({});
        }, function(error){
            if(logger.isErrorEnabled) logger.info("[/dyn/clients/createClient] Could not create client: %s", error.message);
            res.status(500).send(error.message);
        });
});

mApp.post("/dyn/clients/deleteClient", function(req, res){

    if(logger.isDebugEnabled) logger.info("[/dyn/clients/deleteClient] Deleting client and points of usage with _id: %s", req.body._id);

    arm.pDeleteClient(req.body._id).
        then(function(result){
            if(result){
                res.json({});
                if(logger.isInfoEnabled) logger.info("[/dyn/clients/deleteClient] Deleted client and points of usage with _id: %s", req.body._id);
            }
            else{
                if(logger.isDebugEnabled) logger.info("[/dyn/clients/deleteClient] Not found client with _id: %s", req.body._id);
                res.status(500).send("Client not found");
            }
        }, function(error){
            res.status(500).send(error.message);
            if(logger.isErrorEnabled) logger.error("[/dyn/clients/deleteClient] Could not delete client: %s", error.message);
        });
});

/**
 * Retrieves the client data given a point of usage
 * json body includes
 *  - searchField: phone|userName|line
 *  - phone|userName|nasPort&nasIPAddress
 */
mApp.post("/dyn/clients/getFullClientData", function(req, res){

    if(logger.isDebugEnabled) logger.info("[/dyn/clients/getFullClientData] Getting client data %s", JSON.stringify(req.body));

    // Get the client context
    var query;
    var searchField=req.body.searchField;
    if(searchField=="phone"){ query={phone: req.body.phone};}
    else if(searchField=="userName"){ query={userName: req.body.userName};}
    else if(searchField=="line"){ query={nasPort: parseInt(req.body.nasPort), nasIPAddress:req.body.nasIPAddress};}
    else if(searchField=="legacyClientId"){query={"provision.legacyClientId": req.body.legacyClientId}}
    else {
        if(logger.isErrorEnabled) logger.info("[/dyn/clients/getFullClientData] Bad query %s", JSON.stringify(req.body));
        res.status(500).send("Bad query");
        return;
    }

    var fullClientContext={};
    arm.pFindClient(query).then(function(client){
        if(!client) throw new Error("Client not found");
        return arm.pGetClientContext(client);
    }).then(function(clientContext){
        fullClientContext=clientContext;
        return arm.pGetClientAllPoU(clientContext.client._id);
    }).then(function(pou){
        fullClientContext.pointsOfUsage=pou;
        res.json(fullClientContext);
    }).fail(function(err){
        if(logger.isErrorEnabled) logger.info("[/dyn/clients/getFullClientData] Could not get client data due to: %s", err.message);
        res.status(500).send("Error: " + err.message);
    });
});

/**
 * Updates the client provision data
 * body must include the client _id field and a "provision" object
 */
mApp.post("/dyn/clients/updateClientProvisionData", function(req, res) {

    if (logger.isDebugEnabled) logger.debug("[/dyn/clients/updateClientProvisionData] Updating Client provision data: %s", JSON.stringify(req.body));

    arm.pUpdateClientProvisionData(req.body).
        then(function(){
            if(logger.isInfoEnabled) logger.info("[/dyn/clients/updateClientProvisionData] Updated Client provision data: %s", JSON.stringify(req.body));
            res.json({});
        }, function(error){
            if(logger.isErrorEnabled) logger.error("[/dyn/clients/updateClientProvisionData] Could not update client data: %s", error.message);
            res.status(500).send(error.message);
        });
});

mApp.post("/dyn/clients/addPoU", function(req, res){

    if(logger.isDebugEnabled) logger.debug("[/dyn/clients/addPoU] Adding point of usage: %s", JSON.stringify(req.body));

    // Cook point of usage to delete
    var pointOfUsage;
    if(req.body.pouType=="phone") pointOfUsage={phone: req.body.pouValue};
    if(req.body.pouType=="userName") pointOfUsage={userName: req.body.pouValue};
    if(req.body.pouType=="line"){
        if(!lineRegEx.test(req.body.pouValue)){
            if(logger.isErrorEnabled) logger.error("[/dyn/clients/addPoU] Bad line: %s", JSON.stringify(req.body));
            res.status(500).send("Bad line");
            return;
        }
        var lineComponents=req.body.pouValue.split(":");
        pointOfUsage={nasPort: lineComponents[1], nasIPAddress: lineComponents[0]};
    }

    // Invoke addition
    arm.pAddPoU(req.body.clientId, pointOfUsage).
        then(function(){
            if(logger.isInfoEnabled) logger.info("[/dyn/clients/addPoU] Added point of usage: %s", JSON.stringify(req.body));
            res.json({});
        }, function(error){
            if(logger.isInfoEnabled) logger.info("[/dyn/clients/addPoU] Could not add point of usage: %s", error.message);
            res.status(500).send(error.message);
        });
});

mApp.post("/dyn/clients/deletePoU", function(req, res){
    if (logger.isDebugEnabled) logger.debug("[/dyn/clients/deletePoU] Deleting point of usage: %s", JSON.stringify(req.body));

    // Invoke deletion
    arm.pDeletePoU(req.body.pou).
        then(function(){
            if(logger.isInfoEnabled) logger.info("[/dyn/clients/deletePoU] Deleted point of usage: %s", JSON.stringify(req.body));
            res.json({});
        }, function(error){
            if(logger.isErrorEnabled) logger.error("[/dyn/clients/deletePoU] Could not delete point of usage: %s", error.message);
            res.status(500).send(error.message);
        });
});

mApp.post("/dyn/clients/buyRecharge", function(req, res){
    if (logger.isDebugEnabled) logger.debug("[/dyn/clients/buyRecharge] Buying recharge: %s", JSON.stringify(req.body));

    // Invoke deletion
    arm.pFindClientContext({_id: req.body.clientId}).
        then(function(clientContext){
            if(!clientContext){
                if(logger.isErrorEnabled) logger.error("[/dyn/clients/buyRecharge] Client not found: %s", JSON.stringify(req.body.clientId));
                res.status(500).send("Client not found");
            } else {
                return arm.pBuyRecharge(clientContext, req.body.rechargeName).
                    then(function(rechargeDone){
                        if(rechargeDone){
                            if(logger.isInfoEnabled) logger.error("[/dyn/clients/buyRecharge] Recharge performed: %s", JSON.stringify(req.body));
                            res.json({});
                        } else {
                            if(logger.isInfoEnabled) logger.error("[/dyn/clients/buyRecharge] Recharge not authorized: %s", JSON.stringify(req.body));
                            res.status(401).send("Not authorized");
                        }
                    });
            }
        }, function(error){
            if(logger.isErrorEnabled) logger.error("[/dyn/clients/buyRecharge] Could not buy recharge: %s", error.message);
            res.status(500).send(error.message);
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
        return arm.pReloadPlansAndCalendars();
    }).then(function(){
        // Start server
        mApp.listen(config["port"]);
        logger.info("[Init] PolicyServer manager listening on port "+config["port"]);
    }).done();
