// Diameter Dictionary

// Dependencies
var fs=require("fs");
var logger=require("./log").logger;

// Read from file
var dictionary=JSON.parse(fs.readFileSync("./conf/dictionary.json", {encoding: "utf8"}));

// Add Map from code to AVPs
dictionary.avpsCodeMap=[];
for(i=0; i<dictionary.avps.length; i++)
{
	dictionary.avpsCodeMap[dictionary.avps[i].code]=dictionary.avps[i];
}

// Add Map from names to AVPs
dictionary.namesMap={};
for(i=0; i<dictionary.avps.length; i++)
{
	dictionary.namesMap[dictionary.avps[i].name]=dictionary.avps[i];
}

// Functions for debugging
dictionary.print=function(){console.log("--------------")};

dictionary.printAVPCodes=function(){
	logger.debug("Dumping codes");
	for(i=0; i<dictionary.avps.length; i++) logger.debug("Code: "+dictionary.avps[i].code+" Definition: "+JSON.stringify(dictionary.avpsCodeMap[dictionary.avps[i].code]));
	logger.debug("");
}

dictionary.printAVPNames=function(){
	logger.debug("Dumping names");
	for(i=0; i<dictionary.avps.length; i++) logger.debug("Name: "+dictionary.avps[i].name+" Definition: "+JSON.stringify(dictionary.namesMap[dictionary.avps[i].name]));
	logger.debug("");
}

exports.diameterDictionary=dictionary;

