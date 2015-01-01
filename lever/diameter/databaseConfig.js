// Database based configuration
// A new connection is established for getting each item
var dLogger=require("./log").dLogger;
var fs=require("fs");
var os=require("os");
var Db=require("mongodb").Db;

// Read database configuration
var dbParams=JSON.parse(fs.readFileSync("./conf/database.json", {encoding: "utf8"}));
var hostName=os.hostname();

var createDatabaseConfig=function(){

    var databaseConfig={};

    // Updates the diameter configuration for the config object
    // updaterFunction(err, diameterConfig)
    databaseConfig.getConfigurationItem=function(collectionName, filter, updaterFunction){
        Db.connect(dbParams["databaseURL"], dbParams["databaseOptions"], function(err, db){
            if(err){
                updaterFunction(err, null);
            }
            else{
                db.collection(collectionName).findOne(filter, function(err, doc){
                    if(err) updaterFunction(err, null);
                    else if(!doc) updaterFunction(new Error(collectionName+" not found for "+hostName), null);
                    else{
                        try{ updaterFunction(null, doc);}
                        catch(e){updaterFunction(e, null);}
                        finally{ db.close();}
                    }
                });
            }
        });
    };

    databaseConfig.getDiameterConfiguration=function(updaterFunction){
        databaseConfig.getConfigurationItem("diameterConfig", {"hostName": hostName}, updaterFunction);
    };

    databaseConfig.getRouteConfiguration=function(updaterFunction){
        databaseConfig.getConfigurationItem("routeConfig", {"hostName": hostName}, updaterFunction);
    };

    databaseConfig.getDispatcherConfiguration=function(updaterFunction){
        databaseConfig.getConfigurationItem("dispatcherConfig", {}, updaterFunction);
    };

    databaseConfig.getDictionaryConfiguration=function(updaterFunction){
        databaseConfig.getConfigurationItem("dictionaryConfig", {}, updaterFunction);
    };

    return databaseConfig;
}

exports.config=createDatabaseConfig();