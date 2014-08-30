// Holder for Diameter configuration
var fs=require("fs");

// Read diameter configuration
var diameterConfig=JSON.parse(fs.readFileSync("./conf/diameter.json", {encoding: "utf8"}));

// applicationName: {messageName: { module: <moduleName>, functionName: <functionName>, handler: <function>}}
var dispatcherConfig=JSON.parse(fs.readFileSync("./conf/dispatcher.json", {encoding: "utf8"}));

// TODO: Validate configuration here

exports.diameterConfig=diameterConfig;
exports.dispatcherConfig=dispatcherConfig;
