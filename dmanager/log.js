// For sharing winston logging

var winston=require("winston");
var fs=require("fs");

// Read and configure logging configuration, logging.json may contain properties for the transport configurations
var transports=[];
var logConfig=JSON.parse(fs.readFileSync("./conf/logging.json", {encoding: "utf8"}));
if("console" in logConfig) transports.push(new (winston.transports.Console)(logConfig.console));
if("file" in logConfig) transports.push(new (winston.transports.File)(logConfig.file));
var logger=new (winston.Logger)({
	"transports": transports
});

exports.logger=logger;
