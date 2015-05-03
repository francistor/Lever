/**
 * Created by frodriguezg on 03/05/2015.
 */

var Q=require("q");
var fs=require("fs");
var readLine=require("readline");
var MongoClient=require("mongodb").MongoClient;
var dbParams=JSON.parse(fs.readFileSync(__dirname + "/conf/database.json", {encoding: "utf8"}));
dbParams["databaseURL"]=process.env["LEVER_CONFIGDATABASE_URL"]||dbParams["databaseURL"];

// /c/code/psa/trunk/code/simpleradius/radius/run/ConfigFiles/AR/DomainConfig.txt
var inputUserFileName=process.argv[2];
var setName=process.argv[3];
if(!inputUserFileName){
    console.log("File name not specified. Usage: loadUserFile <input-file> <set-name>");
    return;
}
if(!setName){
    console.log("Set name not specified. Usage loadUserFile <input-file> <set-name>");
    return;
}
else console.log("Processing "+inputUserFileName+" set name: "+setName);

var documents=[];
var trimmedLine, currentDocument, checkItems, checkItemsArray, checkItemElements, replyItemElements;
var state="initial"; // "initial", "readingKey"

var rl=readLine.createInterface({
    input: fs.createReadStream(inputUserFileName, {encoding: "utf8"}),
    terminal: false
});

rl.on("line", function(line){
    trimmedLine=line.trim();
    if(trimmedLine.length===0){
        // Separator
        if(state==="readingKey"){
            documents.push(currentDocument);
            state="initial";
        }
    }
    else if(trimmedLine.indexOf("#")===0){
       // Comment
    }
    else if(state==="initial"){
        // First line
        currentDocument={};
        currentDocument["setName"]=setName;
        currentDocument["values"]={};
        currentDocument["values"]["check"]={};
        currentDocument["values"]["reply"]={};
        currentDocument["key"]=line.split(/\s/)[0];
        checkItems=line.substring(line.indexOf(currentDocument["key"])+currentDocument["key"].length+1);
        checkItemsArray=checkItems.split(/\s/);
        checkItemsArray.forEach(function(checkItem){
            checkItemElements=checkItem.split("=");
            if(checkItemElements.length===2){
                currentDocument["values"]["check"][checkItemElements[0].trim()]=checkItemElements[1].trim();
            }
            else console.log("Ignoring ckeck item :"+checkItem);
        });

        state="readingKey";
    }
    else if(state==="readingKey"){
        // Subsequent lines
        replyItemElements=line.split("=");
        if(replyItemElements.length===2){
            currentDocument["values"]["reply"][replyItemElements[0].trim()]=replyItemElements[1].trim();
        }
        else console.log("Ignoring reply item: "+line);
    }
});

rl.on("close", function(){
    if(state==="readingKey"){
        documents.push(currentDocument);
    }

    // Write to database
    writePolicyParamsSet(documents, setName);
});

function writePolicyParamsSet(documents, setName){
    // Get database connection
    Q.nfcall(MongoClient.connect, dbParams["databaseURL"], dbParams["databaseOptions"]).then(function(DB){
        // Delete items in setName
        Q.ninvoke(DB.collection("policyParams"), "deleteMany", {setName: setName}, {})
            .then(function(){
                // Insert documents
                return Q.ninvoke(DB.collection("policyParams"), "insertMany", documents, {});
            })
            .then(function(){
                // Close database
                return Q.ninvoke(DB, "close", false);
            })
            .then(function(){
                // Feedback
                console.log(setName+" updated.");
            }).done();
    }).done();
}


