// File based configuration
var dLogger=require("./log").dLogger;
var fs=require("fs");

var createFileConfig=function(){

    var fileConfig={};

    // Updates the diameter configuration for the config object
    // If sync is true, the updater function is executed within the call
    // updaterFunction takes as a parameter the JSON diameterConfiguration
    // object
    fileConfig.getDiameterConfiguration=function(sync, updaterFunction){
        var diameterConfig;
        if(sync){
            diameterConfig=JSON.parse(fs.readFileSync("./conf/diameter.json", {encoding: "utf8"}));
            updaterFunction(diameterConfig);
        }
        else{
            fs.readFile("./conf/diameter.json", {encoding: "utf8"}, function(err, data){
                if(err) dLogger.error("Error updating Diameter configuration: "+err.message);
                else{
                    try{
                        config["diameterConfig"]=JSON.parse(data);
                        updaterFunction(diameterConfig);
                    }catch(e){
                        dLogger.error("Error reading Diameter configuration: "+err.message);
                    }
                }
            });
        }
    };

    // Updates the dispatcher configuration for the config object
    // If sync is true, the updater function is executed within the call
    // updaterFunction takes as a parameter the JSON dispatcher configuration
    // object
    fileConfig.getDispatcherConfiguration=function(sync, updaterFunction){
        var dispatcher;
        if(sync){
            dispatcher=JSON.parse(fs.readFileSync("./conf/dispatcher.json", {encoding: "utf8"}));
            updaterFunction(dispatcher);
        }
        else{
            fs.readFile("./conf/dispatcher.json", {encoding: "utf8"}, function(err, data){
                if(err) dLogger.error("Error updating dispatcher configuration: "+err.message);
                else{
                    try{
                        dispatcher=JSON.parse(data);
                        updaterFunction(dispatcher);
                    }catch(e){
                        dLogger.error("Error reading dispatcher configuration: "+err.message);
                    }
                }
            });
        }
    };

    // Updates the dictionary configuration for the config object
    // If sync is true, the updater function is executed within the call
    // updaterFunction takes as a parameter the JSON dictionary
    // object
    fileConfig.getDictionaryConfiguration=function(sync, updaterFunction){
        var dictionary;
        if(sync){
            dictionary=JSON.parse(fs.readFileSync("./conf/dictionary.json", {encoding: "utf8"}));
            updaterFunction(dictionary);
        }
        else{
            fs.readFile("./conf/dictionary.json", {encoding: "utf8"}, function(err, data){
                if(err) dLogger.error("Error updating dictionary configuration: "+err.message);
                else{
                    try{
                        config["dictionary"]=JSON.parse(data);
                        updaterFunction(dictionary);
                    }catch(e){
                        dLogger.error("Error reading dictionary configuration: "+err.message);
                    }
                }
            });
        }
    };

    return fileConfig;
}

exports.config=createFileConfig();