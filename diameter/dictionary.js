// Diameter Dictionary

// Dependencies
var fs=require("fs");
var logger=require("./log").logger;

// Read from file
var dictionary=JSON.parse(fs.readFileSync("./conf/dictionary.json", {encoding: "utf8"}));

// Add Maps (code map and name map)
// avpCodeMap={<vendor-id>:{<avpcode>:{<avpDef>}, ...} ...}
// avpNameMap={<avpname>:{<avpDef>}, ...}
var code, name;
var enumCodes;
var vendorName;
var avpDef;
var i, j;
var enumValue;
dictionary.avpCodeMap={};
dictionary.avpNameMap={};

// Iterate through vendors
for(vendorId in dictionary.avp){

	dictionary.avpCodeMap[vendorId]={};

	vendorName=dictionary.vendor[vendorId];

	// Iterate through avps for the vendor
	for(i=0; i<dictionary.avp[vendorId].length; i++){
		avpDef=dictionary.avp[vendorId][i];
		// If enumerated type, add reverse code map for easy reference
		if(avpDef.type==="Enumerated"){
			enumCodes={};
			for(enumValue in avpDef.enumValues) enumCodes[avpDef.enumValues[enumValue]]=enumValue;
			avpDef.enumCodes=enumCodes;
		}
		// Populate avpCodeMap. To retrieve avpDef from code use dictionary.avpCodeMap[vendorId][<avpcode>]
		dictionary.avpCodeMap[vendorId][dictionary.avp[vendorId][i].code]=avpDef;

		// Populate avpNameMap. To retrieve avpDef from name use dictionary.avpNameMap[<avpname>]
		if(vendorName){
			// Add vendorId to avpDef for easy reference
			avpDef.vendorId=vendorId;
			dictionary.avpNameMap[vendorName+"-"+dictionary.avp[vendorId][i].name]=avpDef;
		}
		else dictionary.avpNameMap[dictionary.avp[0][i].name]=dictionary.avp[0][i];
	}
}

// Add application and commands map
dictionary.applicationCodeMap={};
dictionary.applicationNameMap={};
dictionary.commandCodeMap={};
dictionary.commandNameMap={};
for(i=0; i<dictionary.applications.length; i++){
	// Add to application code and name maps
	code=dictionary.applications[i].code; if(code===undefined) throw new Error("Missing code in application dictionary");
	name=dictionary.applications[i].name; if(name===undefined) throw new Error("Missing name in application dictionary");
	dictionary.applicationCodeMap[dictionary.applications[i].code]=dictionary.applications[i];
	dictionary.applicationNameMap[dictionary.applications[i].name]=dictionary.applications[i];
	for(j=0; j<dictionary.applications[i].commands.length; j++){
		// Add to command code and application maps
		code=dictionary.applications[i].commands[j].code; if(code===undefined) throw new Error("Missing code in command dictionary");
		name=dictionary.applications[i].commands[j].name; if(name===undefined) throw new Error("Missing code in command dictionary");
		dictionary.commandCodeMap[dictionary.applications[i].commands[j].code]=dictionary.applications[i].commands[j];
		dictionary.commandNameMap[dictionary.applications[i].commands[j].name]=dictionary.applications[i].commands[j];
	}
}

// For debugging only
dictionary.dumpMaps=function(){
	var vendorId, avpCode, avpName, applicationCode, applicationName, commandCode, commandName;
	logger.debug();
	logger.debug("Dumping AVP codes");
	for(vendorId in dictionary.avpCodeMap){
		logger.debug(vendorId+":");
		for(avpCode in dictionary.avpCodeMap[vendorId]){
			logger.debug("\t"+avpCode+": "+JSON.stringify(dictionary.avpCodeMap[vendorId][avpCode]));
		}
	}
	
	logger.debug();
	logger.debug("Dumping AVP names");
	for(avpName in dictionary.avpNameMap){
		logger.debug("\t"+avpName+": "+JSON.stringify(dictionary.avpNameMap[avpName]));
	}
	logger.debug();
	logger.debug("Dumping Application codes");
	for(applicationCode in dictionary.applicationCodeMap){
		logger.debug("\t"+applicationCode+" "+JSON.stringify(dictionary.applicationCodeMap[applicationCode]));
	}
	logger.debug();
	logger.debug("Dumping Application names");
	for(applicationName in dictionary.applicationNameMap){
		logger.debug("\t"+applicationName+" "+JSON.stringify(dictionary.applicationNameMap[applicationName]));
	}
	logger.debug();
	logger.debug("Dumping Command codes");
	for(commandCode in dictionary.commandCodeMap){
		logger.debug("\t"+commandCode+" "+JSON.stringify(dictionary.commandCodeMap[commandCode]));
	}
	logger.debug();
	logger.debug("Dumping Command names");
	for(commandName in dictionary.commandNameMap){
		logger.debug("\t"+commandName+" "+JSON.stringify(dictionary.commandNameMap[commandName]));
	}
	logger.debug();
}

// dictionary.dumpMaps();


exports.diameterDictionary=dictionary;

