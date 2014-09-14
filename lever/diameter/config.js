// Holder for Configurations

var backendConfig=require("./fileConfig").config;
var dLogger=require("./log").dLogger;

var createConfig=function(){

    var config={"diameterConfig":{}, "dispatcher":{}, "dictionary":{}};

    // Updates
    config.pullDiameterConfiguration=function(sync){
       backendConfig.getDiameterConfiguration(sync, function(diameterConfig){
           config.diameterConfig=diameterConfig;
       });
    };

    // Updates the dispatcher object within the config object
    // In case of error reading configuration, nothing is done
    config.pullDispatcher=function(sync){
        backendConfig.getDispatcherConfiguration(sync, function(dispatcher){

            // Hook handlers to dispatcher
            // Function to invoke for a message will be config.dispatcherConfig[applicationId][commandCode]["handler"]
            // Signature for handler functions is fnc(connection, message)
            var applicationId;
            var commandCode;
            var dispElement;
            var handlerModule;
            for (applicationId in dispatcher) if (dispatcher.hasOwnProperty(applicationId)) {
                for (commandCode in dispatcher[applicationId]) {
                    if (dispatcher[applicationId].hasOwnProperty(commandCode)) {
                        dispElement = dispatcher[applicationId][commandCode];
                        handlerModule = require(dispElement["module"]);
                        dispElement["handler"] = handlerModule[dispElement["functionName"]];
                    }
                }
            }

            // Everything ok, replace dispatcher
            config.dispatcher=dispatcher;
        });
    };

    // Updates the dictionary object within the config object
    // In case of error reading configuration, nothing is done
    config.pullDictionary=function(sync) {
        backendConfig.getDictionaryConfiguration(sync, function(dictionary){

            // Add Maps (code map and name map)
            // avpCodeMap={<vendor-id>:{<avpcode>:{<avpDef>}, ...} ...}
            // avpNameMap={<avpname>:{<avpDef>}, ...}
            var code, name;
            var enumCodes;
            var vendorName;
            var avpDef;
            var i, j;
            var enumValue;
            var vendorId;
            dictionary["avpCodeMap"] = {};
            dictionary["avpNameMap"] = {};

            // Iterate through vendors
            for (vendorId in dictionary["avp"]) if (dictionary["avp"].hasOwnProperty(vendorId)) {

                dictionary["avpCodeMap"][vendorId] = {};

                vendorName = dictionary["vendor"][vendorId];

                // Iterate through avps for the vendor
                for (i = 0; i < dictionary["avp"][vendorId].length; i++) {
                    avpDef = dictionary["avp"][vendorId][i];
                    // If enumerated type, add reverse code map for easy reference
                    if (avpDef.type === "Enumerated") {
                        enumCodes = {};
                        for (enumValue in avpDef["enumValues"]) if (avpDef["enumValues"].hasOwnProperty(enumValue)) enumCodes[avpDef["enumValues"][enumValue]] = enumValue;
                        avpDef.enumCodes = enumCodes;
                    }
                    // Populate avpCodeMap. To retrieve avpDef from code use dictionary["avpCodeMap"][vendorId][<avpcode>]
                    dictionary["avpCodeMap"][vendorId][dictionary["avp"][vendorId][i].code] = avpDef;

                    // Populate avpNameMap. To retrieve avpDef from name use dictionary["avpNameMap"][<avpname>]
                    if (vendorName) {
                        // Add vendorId to avpDef for easy reference
                        avpDef.vendorId = vendorId;
                        dictionary["avpNameMap"][vendorName + "-" + dictionary["avp"][vendorId][i].name] = avpDef;
                    }
                    else dictionary["avpNameMap"][dictionary["avp"][0][i].name] = dictionary["avp"][0][i];
                }
            }

            // Add application and commands map
            dictionary["applicationCodeMap"] = {};
            dictionary["applicationNameMap"] = {};
            dictionary["commandCodeMap"] = {};
            dictionary["commandNameMap"] = {};
            for (i = 0; i < dictionary["applications"].length; i++) {
                // Add to application code and name maps
                code = dictionary["applications"][i].code;
                if (code === undefined) throw new Error("Missing code in application dictionary");
                name = dictionary["applications"][i].name;
                if (name === undefined) throw new Error("Missing name in application dictionary");
                dictionary["applicationCodeMap"][dictionary["applications"][i].code] = dictionary["applications"][i];
                dictionary["applicationNameMap"][dictionary["applications"][i].name] = dictionary["applications"][i];
                for (j = 0; j < dictionary["applications"][i]["commands"].length; j++) {
                    // Add to command code and application maps
                    code = dictionary["applications"][i]["commands"][j].code;
                    if (code === undefined) throw new Error("Missing code in command dictionary");
                    name = dictionary["applications"][i]["commands"][j].name;
                    if (name === undefined) throw new Error("Missing code in command dictionary");
                    dictionary["commandCodeMap"][dictionary["applications"][i]["commands"][j].code] = dictionary["applications"][i]["commands"][j];
                    dictionary["commandNameMap"][dictionary["applications"][i]["commands"][j].name] = dictionary["applications"][i]["commands"][j];
                }
            }

            // Everything went well, replace dictionary
            config.dictionary=dictionary;
        });


    };

    // For debugging purposes only
    config.dumpDictionaryMaps=function() {
        var dictionary=config.dictionary;

        var vendorId, avpCode, avpName, applicationCode, applicationName, commandCode, commandName;
        dLogger.debug();
        dLogger.debug("Dumping AVP codes");
        for (vendorId in dictionary["avpCodeMap"]) if (dictionary["avpCodeMap"].hasOwnProperty(vendorId)) {
            dLogger.debug(vendorId + ":");
            for (avpCode in dictionary["avpCodeMap"][vendorId]) if (dictionary["avpCodeMap"][vendorId].hasOwnProperty(avpCode)) {
                dLogger.debug("\t" + avpCode + ": " + JSON.stringify(dictionary["avpCodeMap"][vendorId][avpCode]));
            }
        }

        dLogger.debug();
        dLogger.debug("Dumping AVP names");
        for (avpName in dictionary["avpNameMap"]) if (dictionary["avpNameMap"].hasOwnProperty(avpName)) {
            dLogger.debug("\t" + avpName + ": " + JSON.stringify(dictionary["avpNameMap"][avpName]));
        }
        dLogger.debug();
        dLogger.debug("Dumping Application codes");
        for (applicationCode in dictionary["applicationCodeMap"]) if (dictionary["applicationCodeMap"].hasOwnProperty(applicationCode)) {
            dLogger.debug("\t" + applicationCode + " " + JSON.stringify(dictionary["applicationCodeMap"][applicationCode]));
        }
        dLogger.debug();
        dLogger.debug("Dumping Application names");
        for (applicationName in dictionary["applicationNameMap"]) if (dictionary["applicationNameMap"].hasOwnProperty(applicationName)) {
            dLogger.debug("\t" + applicationName + " " + JSON.stringify(dictionary["applicationNameMap"][applicationName]));
        }
        dLogger.debug();
        dLogger.debug("Dumping Command codes");
        for (commandCode in dictionary["commandCodeMap"]) if (dictionary["commandCodeMap"].hasOwnProperty(commandCode)) {
            dLogger.debug("\t" + commandCode + " " + JSON.stringify(dictionary["commandCodeMap"][commandCode]));
        }
        dLogger.debug();
        dLogger.debug("Dumping Command names");
        for (commandName in dictionary["commandNameMap"]) if (dictionary["commandNameMap"].hasOwnProperty(commandName)) {
            dLogger.debug("\t" + commandName + " " + JSON.stringify(dictionary["commandNameMap"][commandName]));
        }
        dLogger.debug();
    };

    return config;
};

exports.config=createConfig();
