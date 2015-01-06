// File based configuration
var dLogger=require("./log").dLogger;
var fs=require("fs");

var createFileConfig=function(){

    var fileConfig={};

    // Updates the node configuration for the config object
    // updaterFunction(err, diameterConfig)
    fileConfig.getNodeConfiguration=function(updaterFunction){
        var diameterConfig;
        fs.readFile("./conf/node.json", {encoding: "utf8"}, function(err, data){
            if(err){
                updaterFunction(err, null);
            }
            else{
                try{
                    nodeConfig=JSON.parse(data);
                    updaterFunction(null, nodeConfig);
                }catch(e){
                    updaterFunction(e, null);
                }
            }
        });
    };

    // Updates the dispatcher configuration for the config object
    // updaterFunction(err, dispatcher)
    fileConfig.getDispatcherConfiguration=function(updaterFunction){
        var dispatcher;
        fs.readFile("./conf/dispatcher.json", {encoding: "utf8"}, function(err, data){
            if(err){
                updaterFunction(err, null);
            }
            else{
                try{
                    dispatcher=JSON.parse(data);
                    updaterFunction(null, dispatcher);
                }catch(e){
                    updaterFunction(e, null);
                }
            }
        });
    };

    // Updates the dictionary configuration for the config object
    // updaterFunction(err, dictionary)
    fileConfig.getDiameterDictionary=function(updaterFunction){
        var dictionary;
        fs.readFile("./conf/diameterDictionary.json", {encoding: "utf8"}, function(err, data){
            if(err){
                updaterFunction(err, null);
            }
            else{
                try{
                    dictionary=JSON.parse(data);
                    updaterFunction(null, dictionary);
                }catch(e){
                    updaterFunction(e, null);
                }
            }
        });

    };

    return fileConfig;
}

exports.config=createFileConfig();