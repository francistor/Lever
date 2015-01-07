// For sharing winston logging

var winston=require("winston");
var fs=require("fs");
// Read and configure logging configuration, logging.json MUST
// contain properties for the transport configurations
var logConfig=JSON.parse(fs.readFileSync(__dirname+"/conf/logging.json", {encoding: "utf8"}));

// Diameter server
var diameterTransports=[];
if("console" in logConfig["diameter"]) diameterTransports.push(new (winston.transports.Console)(logConfig["diameter"].console));
if("file" in logConfig["diameter"]) diameterTransports.push(new (winston.transports.File)(logConfig["diameter"].file));
var dLogger=new (winston.Logger)({
	"transports": diameterTransports
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

// handler functions handlers
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

dLogger["inDebug"]=logConfig.diameter.console.level==="debug" || logConfig.diameter.console.level=="silly" ||logConfig.diameter.file.level==="debug" || logConfig.diameter.file.level=="silly";
hLogger["inDdebug"]=logConfig.handlers.console.level==="debug" || logConfig.handlers.console.level=="silly" ||logConfig.handlers.file.level==="debug" || logConfig.handlers.file.level=="silly";
mLogger["inDdebug"]=logConfig.management.console.level==="debug" || logConfig.management.console.level=="silly" ||logConfig.management.file.level==="debug" || logConfig.management.file.level=="silly";

dLogger["inVerbose"]=logConfig.diameter.console.level==="verbose" || logConfig.diameter.console.level=="debug" ||logConfig.diameter.file.level==="verbose" || logConfig.diameter.file.level=="debug";
hLogger["inVerbose"]=logConfig.handlers.console.level==="verbose" || logConfig.handlers.console.level=="debug" ||logConfig.handlers.file.level==="verbose" || logConfig.handlers.file.level=="debug";
mLogger["inVerbose"]=logConfig.management.console.level==="verbose" || logConfig.management.console.level=="debug" ||logConfig.management.file.level==="verbose" || logConfig.management.file.level=="debug";

exports.dLogger=dLogger;
exports.hLogger=hLogger;
exports.mLogger=mLogger;

