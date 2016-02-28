/**
 * Created by frodriguezg on 25/02/2016.
 */

/**
 * YANG model is
 *
 * module <module-name>
 *     grouping <properties-file-name>
 *         leaf <property-name>
 *
 *     grouping <section-file-name>
 *          grouping <section-name>
 *              leaf <propety-name>
 *
 *
 *
 */

// TODO: Fix content-types

process.title="lever-manager";

var port=8888;

var fs=require("fs");
var logger=require("./log.js").logger;
var DOMParser=require('xmldom').DOMParser;
var XMLSerializer=require('xmldom').XMLSerializer;
var express=require('express');
var bodyParser=require('body-parser');
var app=express();

// Middleware for JSON
app.use(bodyParser.json());

// Contents of the master configuration file (JSON)
var masterConfig;

// parsedContent
/**
 *  modules:{
 *      <module>:{
 *          name: <name>,
 *          revision: <revision>
 *          containers:{
 *              <container>:{
 *                  file: <file-path>,
 *                  type: "properties",
 *                  raw_data: [],
 *                  properties: {
 *                      <property>:{
 *                          value: <property-value>,
 *                          index: <pointer-to-rawdata>
 *                      }
 *                  }
 *              }
 *              <container>:{
 *                  file: <file-path>,
 *                  type: "section.properties",
 *                  raw_data: [],
 *                  containers:{
 *                      <container>:{
 *                          properties: {
 *                              <property>:{
 *                                  value: <property-value>,
 *                                  index: <pointer-to-rawdata>
 *                              }
 *                          }
 *                      }
 *                  }
 *              }
 *          }
 *      }
 *  }
 */

var parsedContent={modules:{}};

app.get("/", function(req, res){
    res.send("Restconf server");
});

app.get("/.well-known/host-meta", function(req, res){
    var doc=new DOMParser().parseFromString("<XRD>hello</XRD>");
    doc.documentElement.setAttribute("xmlns", "http://docs.oasis-open.org/ns/xri/xrd-1.0");
    var serializer=new XMLSerializer();
    //res.set('Content-Type', 'application/xrd+xml');
    res.send(serializer.serializeToString(doc));
});

app.get("/restconf", function(req, res){
    res.json(buildExportContent(parsedContent));
});

app.get("/restconf/(:module):(:file)", function(req, res){
    var node=(buildExportContent(parsedContent)[req.params.module]||{})[req.params.file];
    if(node){
        var result={};
        result[req.params.module+":"+req.params.file]=node;
        res.json(result);
    }
    else res.status(404).send("resource not found");
});

app.get("/restconf/(:module):(:file)/:c1", function(req,res){
    var node=((buildExportContent(parsedContent)[req.params.module]||{})[req.params.file]||{})[req.params.c1];
    if(node){
        var result={};
        result[req.params.c1]=node;
        res.json(result);
    }
    else res.status(404).send("resource not found");
});

app.get("/restconf/(:module):(:file)/:c1/:c2", function(req,res){
    var node=(((buildExportContent(parsedContent)[req.params.module]||{})[req.params.file]||{})[req.params.c1]||{})[req.params.c2];
    if(node){
        var result={};
        result[req.params.c2]=node;
        res.json(result);
    }
    else res.status(404).send("resource not found");
});

// Initialization. Read config file
fs.readFile(__dirname+"/conf/managed_files.json", {encoding: "utf8"}, function(err, doc){
    if(err){
        logger.error("Error reading configuration file");
        process.exit(-1);
    }
    else {
        masterConfig=JSON.parse(doc);
        loadFiles(parsedContent, masterConfig);
        app.listen(8888, function(){
            logger.info("Restconf server listening on %d", port);
        });
    }
});

////////////////////////////////////////////////////////////////////////////////
// Support functions
////////////////////////////////////////////////////////////////////////////////

function loadFiles(parsedContent, masterConfig){

    // Iterate through modules
    for(var moduleName in masterConfig["modules"]) if(masterConfig["modules"].hasOwnProperty(moduleName)){

        // Iterate through files. Each file is mapped to a container in the module
        for(var containerName in masterConfig["modules"][moduleName]["containers"]) if(masterConfig["modules"][moduleName]["containers"].hasOwnProperty(containerName)) loadFile(parsedContent, masterConfig, moduleName, containerName);
    }
}

/**
 * Loads the contents of a file into the parsed configuration
 * @param parsedContent repository of data to export
 * @param masterConfig main configuration file
 * @param moduleName name of module
 * @param containerName name of container that exposes the file
 */
function loadFile(parsedContent, masterConfig, moduleName, containerName){
    var containerNode=masterConfig["modules"][moduleName]["containers"][containerName];
    var parsedContainer={};
    logger.info("Loading file: %s with format %s", containerNode.path, containerNode.format);
    fs.readFile(containerNode.path, {encoding: "utf8"}, function(err, fileContents){
        if(err) logger.error("Error reading file %s: %s", containerNode.path, err.message);
        else{
            logger.info("Adding content to %s/%s", moduleName, containerName);
            if(containerNode.format==="properties") parsedContainer=parsePropertiesFile(fileContents);
            else if(containerNode.format==="section.properties") parsedContainer=parseSectionPropertiesFile(fileContents);
            else logger.error("Unrecognized file format %s", containerNode.format);
        }

        // Copy result to parsed Content. In case of error will be an empty object
        if(!parsedContent["modules"][moduleName]) parsedContent["modules"][moduleName]={};
        if(!parsedContent["modules"][moduleName]["containers"]) parsedContent["modules"][moduleName]["containers"]={};
        if(!parsedContent["modules"][moduleName]["containers"][containerName]) parsedContent["modules"][moduleName]["containers"][containerName]={};
        parsedContent["modules"][moduleName]["containers"][containerName]=parsedContainer;
    });
}

/**
 * Parses a file with "properties" format
 * @param fileContents
 * @returns {{raw_data: Array, properties: {}}}
 */
function parsePropertiesFile(fileContents){
    var line;
    var keyValue;
    var parsedFileContents={"raw_data":fileContents.split(/\r?\n/), "properties":{}};
    for(var i=0; i<parsedFileContents["raw_data"].length; i++){
        line=parsedFileContents["raw_data"][i];
        if(line.trim().length===0 || line.trim().lastIndexOf("#", 0)===0) continue;
        keyValue=line.split("=");
        if(keyValue.length!=2) continue;
        parsedFileContents.properties[keyValue[0].trim()]={value: keyValue[1].trim(), index: i};
    }

    return parsedFileContents;
}

/**
 * Parses a file with "section.properties" format
 * @param fileContents
 * @returns {{raw_data: Array, containers: {}}}
 */
function parseSectionPropertiesFile(fileContents) {
    var line;
    var keyValue;
    var currentSectionName;
    var currentSection;
    var parsedFileContents={"raw_data":fileContents.split(/\r?\n/), "containers":{}};
    for(var i=0; i<parsedFileContents["raw_data"].length; i++){
        line=parsedFileContents["raw_data"][i];
        if(line.trim().length===0 || line.trim().lastIndexOf("#", 0)===0) continue;
        var sectionMatch=line.trim().match(/\[(.+)\]/);
        if(sectionMatch){
            currentSectionName=sectionMatch[1];
            currentSection={properties:{}};
            parsedFileContents.containers[currentSectionName]=currentSection;
        }
        else if(currentSection){
            keyValue = line.split("=");
            if (keyValue.length != 2) continue;
            currentSection["properties"][keyValue[0].trim()]={value: keyValue[1].trim(), index: i};
        }
    }
    return parsedFileContents;
}

function buildExportContent(parsedContent){
    var exportContent={};
    var modules=parsedContent["modules"];
    for(var moduleName in modules) if(modules.hasOwnProperty(moduleName)){
        exportContent[moduleName]={};
        var containers=modules[moduleName]["containers"];
        for(var containerName in containers) if(containers.hasOwnProperty(containerName)){
            exportContent[moduleName][containerName]={};
            var sections=containers[containerName]["containers"];
            if(sections) {
                for (var sectionName in sections) if (sections.hasOwnProperty(sectionName)) {
                    exportContent[moduleName][containerName][sectionName] = {};
                    for (var propertyName in sections[sectionName]["properties"]) if (sections[sectionName]["properties"].hasOwnProperty(propertyName)) {
                        exportContent[moduleName][containerName][sectionName][propertyName] = sections[sectionName]["properties"][propertyName]["value"];
                    }
                }
            }
            else{
                for(propertyName in containers[containerName]["properties"]) if(containers[containerName]["properties"].hasOwnProperty(propertyName)){
                        exportContent[moduleName][containerName][propertyName]=containers[containerName]["properties"][propertyName]["value"];
                }
            }
        }
    }

    return exportContent;
}