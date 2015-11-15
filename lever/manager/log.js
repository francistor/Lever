// For sharing winston logging

var winston=require("winston");
var fs=require("fs");

var createLogger=function() {

	// Read and configure logging configuration, logging.json may contain properties for the transport configurations
	var transports = [];
	var logConfig = JSON.parse(fs.readFileSync(__dirname + "/conf/logging.json", {encoding: "utf8"}));

	// Load transports configuration
	var loggerTransports=[];
	var transport;
	for(var transportKey in logConfig) if(logConfig.hasOwnProperty(transportKey) && transportKey.substring(0, 1)!="_"){
		transport=new winston.transports[logConfig[transportKey]["type"]](logConfig[transportKey]["properties"]);
		transport._name=transportKey;
		loggerTransports.push(transport);
	}

	// Instantiate logger
	var logger=new (winston.Logger)({
		"transports": loggerTransports
	});

	// Helper function to check if level is enabled
	logger.isLevelEnabled=function(level){
		for(var transport in logger.transports) if(logger.transports.hasOwnProperty(transport)){
			if(logger.levels[level]>=logger.levels[logger.transports[transport].level]) return true;
		}
		return false;
	};

	// Sets cached level-enabled properties
	logger.updateLevelCache=function(){
		logger.isErrorEnabled=logger.isLevelEnabled("error");       // 5
		logger.isWarnEnabled=logger.isLevelEnabled("warn");         // 4
		logger.isInfoEnabled=logger.isLevelEnabled("info");         // 3
		logger.isVerboseEnabled=logger.isLevelEnabled("verbose");   // 2
		logger.isDebugEnabled=logger.isLevelEnabled("debug");       // 1
		logger.isSillyEnabled=logger.isLevelEnabled("silly");       // 0
	};

	logger.updateLevelCache();
	return logger;
};

exports.logger=createLogger();
