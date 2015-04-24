/**
 * Created by francisco on 1/18/15.
 */

// Holds the policySever configuration
// which consists of a set of JSON objects, read from file or from the backend database
// config.<configItem>.<json-object>
// <configItem> may be one of "node", "dispatcher", "dictionary", "cdrChannels" or "policy"

// configService tries to get the configItem from file, reading the conf/<configItem>.json
// file, or the conf/policy/<setName>.json files, and then tries to get the configuration
// from database.

// In the database, the "node" configuration item is filtered by the "hostName" attribute,
// whereas the rest of the configuration items are global.

var Q=require("q");
var os=require("os");
var fs=require("fs");
var MongoClient=require("mongodb").MongoClient;

var dbParams=JSON.parse(fs.readFileSync(__dirname+"/conf/database.json", {encoding: "utf8"}));
dbParams["databaseURL"]=process.env["LEVER_CONFIGDATABASE_URL"];
var hostName=os.hostname();

var createConfig=function(){

    var config={
        node: null,
        dispatcher: null,
        diameterDictionary: null,
        policyParams: {},
        cdrChannels: []
    };

    var DB;

    // Must be called before using the config object
    config.initialize=function(callback){
        if(dbParams["databaseURL"]) MongoClient.connect(dbParams["databaseURL"], dbParams["databaseOptions"], function(err, db){
            if(err) callback(err);
            else{
                DB=db;
                callback(null);
            }
        })
    };

    /**
     * Reads the config.node object
     * @returns promise object with the updated node object or an error
     */
    config.updateNode=function(){

        var cookNode=function(data){

            var node=data;

            if(node.diameter) {
                // Hook route map
                var appConfig;
                var routeMap = {};
                var routes = node.diameter.routes || [];
                if (routes) for (var i = 0; i < routes.length; i++) {
                    appConfig = {peers: routes[i]["peers"], policy: routes[i].policy};
                    if (!routeMap[routes[i]["realm"]]) routeMap[routes[i]["realm"]] = {};
                    routeMap[routes[i]["realm"]][routes[i]["applicationId"]] = appConfig;
                }
                node.diameter.routeMap = routeMap;
            }

            // Hook radius client map
            if(node.radius) {
                var radiusClientMap = {};
                var clients = node.radius.clients || [];
                for (i = 0; i < clients.length; i++) {
                    radiusClientMap[clients[i].IPAddress] = {secret: clients[i].secret, class: clients[i].class, name: clients[i].name};
                }
                node.radius.radiusClientMap = radiusClientMap;

                // Hook radius server map
                var radiusServerMap = {};
                var servers = node.radius.servers || [];
                for (i = 0; i < servers.length; i++) {
                    radiusServerMap[servers[i].name] = servers[i];
                }
                node.radius.radiusServerMap = radiusServerMap;

                // Hook radius server groups
                var radiusServerGroupMap = {};
                var serverGroups = node.radius.serverGroups || [];
                for (i = 0; i < serverGroups.length; i++) {
                    radiusServerGroupMap[serverGroups[i].name] = serverGroups[i];
                }
                node.radius.radiusServerGroupMap = radiusServerGroupMap;
            }

            // Everything OK. Update configuration
            config.node=node;
        };

        var deferred= Q.defer();

        fs.readFile(__dirname+"/conf/node.json", {encoding: "utf8"}, function(err, doc){
            if(err && err.code==='ENOENT'){
                // File not found. Read from database
                if(!DB) throw Error("No configuration found for node. Database url is "+dbParams["databaseURL"]);
                DB.collection("nodes").findOne({"hostName": hostName}, function(err, dbDoc){
                    if(err) deferred.reject(err);
                    else{
                        try{ cookNode(dbDoc);} catch(e){ deferred.reject(e); }
                        deferred.resolve();
                    }
                });
            }
            else{
                // File found. Resolve
                if(err) deferred.reject(err);
                else{
                    try{ cookNode(JSON.parse(doc));} catch(e){ deferred.reject(e); }
                    deferred.resolve();
                }
            }
        });

        return deferred.promise;
    };

    /**
     * Reads the config.dispatcher object
     * @returns promise object with the updated dispatcher object or an error
     */
    // Function to invoke for a message will be config.dispatcherConfig[applicationId][commandCode]["handler"]
    // Signature for handler functions is fnc(connection, message)
    config.updateDispatcher=function(){

        var cookDispatcher=function(data){
            var dispatcher=data["dispatcher"];

            // Hook handlers to dispatcher
            var applicationId;
            var commandCode;
            var dispElement;
            var handlerModule;
            for (applicationId in dispatcher) if (dispatcher.hasOwnProperty(applicationId)) {
                for (commandCode in dispatcher[applicationId]) {
                    if (dispatcher[applicationId].hasOwnProperty(commandCode)) {
                        dispElement = dispatcher[applicationId][commandCode];
                        handlerModule = require(dispElement["module"]);
                        dispElement["handler"] = handlerModule[dispElement["functionName"]];
                    }
                }
            }

            // Everything OK. Update config
            config.dispatcher=dispatcher;
        };

        var deferred= Q.defer();

        fs.readFile(__dirname+"/conf/dispatcher.json", {encoding: "utf8"}, function(err, doc){
            if(err && err.code==='ENOENT'){
                // File not found. Read from database
                if(!DB) throw Error("No configuration found for dispatcher. Database url is "+dbParams["databaseURL"]);
                DB.collection("dispatcher").findOne({}, function(err, dbDoc){
                    if(err) deferred.reject(err);
                    else{
                        try{ cookDispatcher(dbDoc);} catch(e){ deferred.reject(e); }
                        deferred.resolve();
                    }
                })
            }
            else{
                // File found. Resolve
                if(err) deferred.reject(err);
                else{
                    try{ cookDispatcher(JSON.parse(doc));} catch(e){ deferred.reject(e); }
                    deferred.resolve();
                }
            }
        });

        return deferred.promise;

    };

    // dictionary = {
    //      avp: {
    //          <vendor_id>:[
    //              {code:<code>, name:<name>, type:<type>},
    //              {code:<code>, name:<name>, type:<type>}
    //          ]
    //      }
    //
    //      // Generated
    //      avpCodeMap: {
    //          <vendor_id>:{
    //              <code>:<avpDef> --> Added enumCodes if type Enum
    //          }
    //      }
    //      avpNameMap:{
    //          <avp_name>:{        --> Name is <vendor_name>-<avp_name>
    //          }
    //      }
    //      applicationCodeMap:{
    //          <app_code>:<application_def>
    //      }
    //      applicationNameMap:{
    //          <app_name>:<application_def>
    //      }
    //      commandCodeMap:{
    //          <command_code>:<command_def>
    //      }
    //      commandNameMap:{
    //          <command_name>:<command_def>
    //      }
    // }

    /**
     * Reads the config.diameterDictionary object
     * @returns promise object with the updated dispatcher object or an error
     */
    config.updateDiameterDictionary=function(){

        var cookDiameterDictionary=function(data){

            var dictionary=data;

            // Add Maps (code map and name map)
            // avpCodeMap={<vendor-id>:{<avpcode>:{<avpDef>}, ...} ...}
            // avpNameMap={<avpname>:{<avpDef>}, ...}
            var code, name;
            var enumCodes;
            var vendorName;
            var avpDef;
            var i, j;
            var enumValue;
            var vendorId;
            dictionary["avpCodeMap"] = {};
            dictionary["avpNameMap"] = {};

            // Iterate through vendors
            for (vendorId in dictionary["avp"]) if (dictionary["avp"].hasOwnProperty(vendorId)) {

                dictionary["avpCodeMap"][vendorId] = {};

                vendorName = dictionary["vendor"][vendorId];

                // Iterate through avps for the vendor
                for (i = 0; i < dictionary["avp"][vendorId].length; i++) {
                    avpDef = dictionary["avp"][vendorId][i];
                    // If enumerated type, add reverse code map for easy reference
                    if (avpDef.type === "Enumerated") {
                        enumCodes = {};
                        for (enumValue in avpDef["enumValues"]) if (avpDef["enumValues"].hasOwnProperty(enumValue)) enumCodes[avpDef["enumValues"][enumValue]] = enumValue;
                        avpDef.enumCodes = enumCodes;
                    }
                    // Populate avpCodeMap. To retrieve avpDef from code use dictionary["avpCodeMap"][vendorId][<avpcode>]
                    dictionary["avpCodeMap"][vendorId][dictionary["avp"][vendorId][i].code] = avpDef;

                    // Populate avpNameMap. To retrieve avpDef from name use dictionary["avpNameMap"][<avpname>]
                    if (vendorName) {
                        // Add vendorId to avpDef for easy reference
                        avpDef.vendorId = vendorId;
                        dictionary["avpNameMap"][vendorName + "-" + dictionary["avp"][vendorId][i].name] = avpDef;
                    }
                    else dictionary["avpNameMap"][dictionary["avp"][0][i].name] = dictionary["avp"][0][i];
                }
            }

            // Add application and commands map
            dictionary["applicationCodeMap"] = {};
            dictionary["applicationNameMap"] = {};
            dictionary["commandCodeMap"] = {};
            dictionary["commandNameMap"] = {};
            for (i = 0; i < dictionary["applications"].length; i++) {
                // Add to application code and name maps
                code = dictionary["applications"][i].code;
                if (code === undefined) throw new Error("Missing code in application dictionary");
                name = dictionary["applications"][i].name;
                if (name === undefined) throw new Error("Missing name in application dictionary");
                dictionary["applicationCodeMap"][dictionary["applications"][i].code] = dictionary["applications"][i];
                dictionary["applicationNameMap"][dictionary["applications"][i].name] = dictionary["applications"][i];
                for (j = 0; j < dictionary["applications"][i]["commands"].length; j++) {
                    // Add to command code and application maps
                    code = dictionary["applications"][i]["commands"][j].code;
                    if (code === undefined) throw new Error("Missing code in command dictionary");
                    name = dictionary["applications"][i]["commands"][j].name;
                    if (name === undefined) throw new Error("Missing code in command dictionary");
                    dictionary["commandCodeMap"][dictionary["applications"][i]["commands"][j].code] = dictionary["applications"][i]["commands"][j];
                    dictionary["commandNameMap"][dictionary["applications"][i]["commands"][j].name] = dictionary["applications"][i]["commands"][j];
                }
            }

            // Everything OK. Update config
            config.diameterDictionary=dictionary;

        }; // cookDiameterDictionary

        var deferred= Q.defer();

        fs.readFile(__dirname+"/conf/diameterDictionary.json", {encoding: "utf8"}, function(err, doc){
            if(err && err.code==='ENOENT'){
                // File not found. Read from database
                if(!DB) throw Error("No configuration found for diameter dictionary. Database url is "+dbParams["databaseURL"]);
                DB.collection("diameterDictionary").findOne({}, function(err, dbDoc){
                    if(err) deferred.reject(err);
                    else{
                        try{ cookDiameterDictionary(dbDoc);} catch(e){ deferred.reject(e); }
                        deferred.resolve();
                    }
                })
            }
            else{
                // File found. Resolve
                if(err) deferred.reject(err);
                else{
                    try{ cookDiameterDictionary(JSON.parse(doc));} catch(e){ deferred.reject(e); }
                    deferred.resolve();
                }
            }
        });

        return deferred.promise;
    };

    /**
     * Reads the cdrChannels configuration object
     * @returns {*}
     */
    config.updateCdrChannels=function(){

        var cookCdrChannels=function(data){

            var cdrChannels=[];

            for(var i=0; i<data.length; i++){
                if(data[i].enabled){
                    cdrChannels.push(data[i]);
                }
            }

            // Everything OK. Update configuration
            config.cdrChannels=cdrChannels;
        };

        var deferred= Q.defer();

        fs.readFile(__dirname+"/conf/cdrChannels.json", {encoding: "utf8"}, function(err, doc){
            if(err && err.code==='ENOENT'){
                // File not found. Read from database
                if(!DB) throw Error("No configuration found for cdr channels. Database url is "+dbParams["databaseURL"]);
                DB.collection("cdrChannels").find({}).toArray(function(err, dbDocs){
                    if(err) deferred.reject(err);
                    else{
                        try{ cookCdrChannels(dbDocs);} catch(e){ deferred.reject(e); }
                        deferred.resolve();
                    }
                })
            }
            else{
                // File found. Resolve
                if(err) deferred.reject(err);
                else{
                    try{ cookCdrChannels(doc);} catch(e){ deferred.reject(e); }
                    deferred.resolve();
                }
            }
        });

        return deferred.promise;
    };

    config.updatePolicyParams=function(){

        var cookPolicyParams=function(docs){
            var doc;
            var params=config.policyParams;
            for(var i=0; i<docs.length; i++){
                doc=docs[i];
                if(!doc.setName || !doc.key || !doc.values) throw Error("Bad PolicyParams syntax");
                if(!params[doc.setName]) params[doc.setName]={}; // Create set if it does not exist
                params[doc.setName][doc.key]=doc.values;
            }
        };

        var deferred= Q.defer();

        fs.readFile(__dirname+"/conf/policyParams.json", {encoding: "utf8"}, function(err, doc){
            if(err && err.code==='ENOENT'){
                // File not found. Read from database
                if(!DB) throw Error("No configuration found for policy parameters. Database url is "+dbParams["databaseURL"]);
                DB.collection("policyParams").find({}).toArray(function(err, dbDocs){
                    if(err) deferred.reject(err);
                    else{
                        try{ cookPolicyParams(dbDocs);} catch(e){ deferred.reject(e); }
                        deferred.resolve();
                    }
                })
            }
            else{
                // File found. Resolve
                if(err) deferred.reject(err);
                else{
                    try{ cookPolicyParams(doc);} catch(e){ deferred.reject(e); }
                    deferred.resolve();
                }
            }
        });

        return deferred.promise;
    };

    /**
     * Updates all the config object, calling <callback(err)> when the full process has finished
     */
    config.updateAll=function(callback){
        Q.all([config.updateNode(), config.updateDispatcher(), config.updateDiameterDictionary(), config.updatePolicyParams()], config.updateCdrChannels()).then(function(){callback(null)}, callback);
    };

    return config;

};

exports.config=createConfig();
