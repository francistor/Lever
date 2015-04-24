// For sharing winston logging

var winston=require("winston");
var fs=require("fs");
// Read and configure logging configuration, logging.json MUST
// contain properties for the transport configurations
var logConfig=JSON.parse(fs.readFileSync(__dirname+"/conf/logging.json", {encoding: "utf8"}));

// Diameter server
var policyServerTransports=[];
if("console" in logConfig["policyServer"]) policyServerTransports.push(new (winston.transports.Console)(logConfig["policyServer"].console));
if("file" in logConfig["policyServer"]) policyServerTransports.push(new (winston.transports.File)(logConfig["policyServer"].file));
var dLogger=new (winston.Logger)({
	"transports": policyServerTransports
});

dLogger.logDiameterMessage=function(originHost, destinationHost, message){
    var header=message.isRequest ? "[REQUEST]":"[RESPONSE]";
    dLogger.verbose(header+" "+originHost+"-->"+destinationHost+":"+message.applicationId+":"+message.commandCode+(message.avps["Result-Code"] ? " - "+message.avps["Result-Code"] : ""));
};

dLogger.logRadiusServerRequest=function(clientName, code){
    dLogger.verbose(clientName+"-->ME:"+code);
};

dLogger.logRadiusServerResponse=function(clientName, code){
    dLogger.verbose("ME-->"+clientName+":"+code);
};

dLogger.logRadiusClientRequest=function(ipAddress, code, tried){
    dLogger.verbose("ME-->"+ipAddress+":"+code+(tried>0 ? " [retransmission]":""));
};

dLogger.logRadiusClientResponse=function(ipAddress, code){
    dLogger.verbose(ipAddress+"-->ME:"+code);
};

// handler functions
var handlerTransports=[];
if("console" in logConfig["handlers"]) handlerTransports.push(new (winston.transports.Console)(logConfig["handlers"].console));
if("file" in logConfig["handlers"]) handlerTransports.push(new (winston.transports.File)(logConfig["handlers"].file));
var hLogger=new (winston.Logger)({
    "transports": handlerTransports
});

// Diameter Manager server
var managementTransports=[];
if("console" in logConfig["management"]) managementTransports.push(new (winston.transports.Console)(logConfig["management"].console));
if("file" in logConfig["management"]) managementTransports.push(new (winston.transports.File)(logConfig["management"].file));
var mLogger=new (winston.Logger)({
    "transports": managementTransports
});

// Credit control api
var armTransports=[];
if("console" in logConfig["arm"]) armTransports.push(new (winston.transports.Console)(logConfig["arm"].console));
if("file" in logConfig["arm"]) managementTransports.push(new (winston.transports.File)(logConfig["arm"].file));
var aLogger=new (winston.Logger)({
    "transports": armTransports
});

// TODO: Change name from "diameter" to "policyServer" and add ==="verbose" to debug
dLogger["inDebug"]=logConfig.policyServer.console.level==="debug" ||logConfig.policyServer.file.level==="debug";
aLogger["inDebug"]=logConfig.arm.console.level==="debug" || logConfig.arm.file.level==="debug";
hLogger["inDebug"]=logConfig.handlers.console.level==="debug" ||logConfig.handlers.file.level==="debug";
mLogger["inDebug"]=logConfig.management.console.level==="debug" ||logConfig.management.file.level==="debug";

dLogger["inVerbose"]=logConfig.policyServer.console.level==="verbose" || logConfig.policyServer.console.level==="debug" ||logConfig.policyServer.file.level==="verbose" || logConfig.policyServer.file.level==="debug";
aLogger["inVerbose"]=logConfig.arm.console.level==="verbose" || logConfig.arm.console.level==="debug" ||logConfig.arm.file.level==="verbose" || logConfig.arm.file.level==="debug";
hLogger["inVerbose"]=logConfig.handlers.console.level==="verbose" || logConfig.handlers.console.level==="debug" ||logConfig.handlers.file.level==="verbose" || logConfig.handlers.file.level==="debug";
mLogger["inVerbose"]=logConfig.management.console.level==="verbose" || logConfig.management.console.level==="debug" ||logConfig.management.file.level==="verbose" || logConfig.management.file.level==="debug";

exports.dLogger=dLogger;
exports.aLogger=aLogger;
exports.hLogger=hLogger;
exports.mLogger=mLogger;

