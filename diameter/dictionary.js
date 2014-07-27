// Diameter Dictionary

// Dependencies
var fs=require("fs");
var logger=require("./log").logger;

// Read from file
var dictionary=JSON.parse(fs.readFileSync("./conf/dictionary.json", {encoding: "utf8"}));

// Add Map from code to AVPs
// avpCodeMap={<vendor-id>:{<avpcode>:{<avpDef>}, ...} ...}
// avpNameMap={<avpname>:{<avpDef>}, ...}
var enumCodes;
var vendorName;
var avpDef;
var i;
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


// For debugging only
dictionary.dumpMaps=function(){
	logger.debug();
	logger.debug("Dumping codes");
	for(vendorId in dictionary.avpCodeMap){
		logger.debug(vendorId+":");
		for(avpCode in dictionary.avpCodeMap[vendorId]){
			logger.debug("\t"+avpCode+": "+JSON.stringify(dictionary.avpCodeMap[vendorId][avpCode]));
		}
	}
	logger.debug();
	logger.debug("Dumping names");
	for(avpName in dictionary.avpNameMap){
		logger.debug("\t"+avpName+": "+JSON.stringify(dictionary.avpNameMap[avpName]));
	}
	logger.debug();
}
dictionary.dumpMaps();


exports.diameterDictionary=dictionary;

