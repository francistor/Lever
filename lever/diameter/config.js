// Holder for Diameter configuration
var dLogger=require("./log").dLogger;
var fs=require("fs");

var createConfig=function(){

    var config={};

    // Read diameter configuration
    config.diameter=JSON.parse(fs.readFileSync("./conf/diameter.json", {encoding: "utf8"}));
    // TODO: Validate configuration here

    // applicationName: {messageName: { module: <moduleName>, functionName: <functionName>, handler: <function>}}
    config.dispatcher=JSON.parse(fs.readFileSync("./conf/dispatcher.json", {encoding: "utf8"}));
    // TODO: Validate configuration here

    config.startUpdateDiameter=function(){
        fs.readFile("./conf/diameter.json", {"encoding": "utf8"}, function(err, data){
            if(!err){
                config.diameter=JSON.parse(data);
                dLogger.info("Updated diameter configuration");
            }
        });
    };

    return config;
}

exports.config=createConfig();
