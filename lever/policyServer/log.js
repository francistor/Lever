var winston=require("winston");
var fs=require("fs");

var createLogger=function(){

    var configFile=process.env["LOG_CONFIG_FILE"]||"logging.json";
    var logConfig=JSON.parse(fs.readFileSync(__dirname+"/conf/"+configFile, {encoding: "utf8"}));
    var messageLogLevel=logConfig["_messageLogLevel"];

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

    // Helper function to update the log level
    logger.setLogLevel=function(transportKey, level){
        logger.transport.forEach(function(transport){
            if(transport._name===transportKey) transport.level=level;
        });

        logger.updateLevelCache();
    };

    // Logging of messages
    logger.logDiameterMessage=function(originHost, destinationHost, message){
        var header=message.isRequest ? "Diameter Request":"Diameter Response";
        logger.log(messageLogLevel, "[%s], %s --> %s: %s : %s", header, originHost, destinationHost, message.applicationId, message.commandCode+(message.avps["Result-Code"] ? " - "+message.avps["Result-Code"] : ""));
    };

    logger.logRadiusServerRequest=function(clientName, code){
        logger.log(messageLogLevel, "[Radius %s], %s --> ME", code, clientName);
    };

    logger.logRadiusServerResponse=function(clientName, code){
        logger.log(messageLogLevel, "[Radius %s], ME --> %s", code, clientName);
    };

    logger.logRadiusClientRequest=function(ipAddress, code, tried){
        logger.log(messageLogLevel, "[Radius %s], ME --> %s %s", code, ipAddress, (tried>0 ? " [retransmission]":""));
    };

    logger.logRadiusClientResponse=function(ipAddress, code){
        logger.log(messageLogLevel, "[Radius %s], %s --> ME", code, ipAddress);
    };

    logger.updateLevelCache();

    return logger;
};

exports.logger=createLogger();



