// For sharing winston logging

var debugEnabled=true;

var winston=require("winston");
var fs=require("fs");
// Read and configure logging configuration, logging.json MUST
// contain properties for the transport configurations
var logConfig=JSON.parse(fs.readFileSync("./conf/logging.json", {encoding: "utf8"}));

// Diameter server
var diameterTransports=[];
if("console" in logConfig["diameter"]) diameterTransports.push(new (winston.transports.Console)(logConfig["diameter"].console));
if("file" in logConfig["diameter"]) diameterTransports.push(new (winston.transports.File)(logConfig["diameter"].file));
var dLogger=new (winston.Logger)({
	"transports": diameterTransports
});

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

dLogger["debugEnabled"]=debugEnabled;
hLogger["debugEnabled"]=debugEnabled;
mLogger["debugEnabled"]=debugEnabled;

exports.dLogger=dLogger;
exports.hLogger=hLogger;
exports.mLogger=mLogger;
