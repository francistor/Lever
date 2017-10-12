var fs=require("fs");
var request=require('request');
var Q=require("q");

var config=require("./../configService").config;
var createMessage=require("./../message").createMessage;
var arm=require("arm").arm;

var serverManagementUrl="http://localhost:9000/agent/";
var clientManagementUrl="http://localhost:9001/agent/";
var metaServerManagementUrl="http://localhost:9002/agent/";

var testSpec="./testSpec";
var hostName;
var argument;
for(var i=2; i<process.argv.length; i++){
    argument=process.argv[i];
    if(argument.indexOf("help")!=-1){
        console.log("Usage: node runUnitTest [--hostName <hostName>] [--testSpec <filename without .js>");
        process.exit(0);
    }

    if(argument=="--hostName") if(process.argv.length>=i){
        hostName=process.argv[i+1];
        console.log("[TEST] Host name: "+hostName);
    }
	
	if(argument=="--testSpec") if(process.argv.length>=i){
        testSpec="./"+process.argv[i+1];
        console.log("[TEST] TestSpec: "+testSpec);
    }
}

testItems=require(testSpec).testItems;

// Create process title so that it can be stopped using pkill --signal SIGINT <process.title>
process.title="policyServer-"+hostName;

// Start policyServer and invoke sequence of testItem on initialization
var policyServer=require("./../policyServer").createPolicyServer(hostName);
policyServer.initialize(function(err, logger){
    if(err){
        console.log("Error starting server: "+err.message);
        process.exit(-1);
    }
    else{		
		// Initialize arm library
		arm.setLogger(logger);
		arm.setDatabaseConnections(config.getConfigDB(), config.getClientDB(), config.getEventDB(), config.getDBQueryOptions(), config.getDBWriteOptions());
		arm.setConfigProperties({
			maxBytesCredit: null,
			maxSecondsCredit: null,
			minBytesCredit: 0,
			minSecondsCredit: 0,
			expirationRandomSeconds: null});
		
		arm.pReloadPlansAndCalendars().then(function(){
			console.log("Server started");
			// Start tests
			nextTestItem();
			
		}, function(){
			console.log("Error initializing arm library");
			process.exit(-1);
		});
    }
});


// n: index of testItem being executed
var n=0;

// Executes each test item in sequence
function nextTestItem(){
    // Check if we have already finished
    if(n>=testItems.length){
        console.log("[TEST] All tests finished");
        // Write support file for the benefit of external programs
        fs.writeFileSync(__dirname+"/testFinished.txt", "Tests finished");
        return;
    }

    var testItem=testItems[n];
    n++;

    // Skip testItem if so specified
    if(!testItem.execute){
        setTimeout(nextTestItem, 0);
        return;
    }

    console.log("[Test] "+testItem.description);
    /////////////////////////////////////////////////
    // Radius
    /////////////////////////////////////////////////
    if(testItem.type=="Radius") {
        // Send radius request
        policyServer.radius.sendServerGroupRequest(testItem.code, testItem.requestAVPs, testItem.serverGroupName, function (err, response) {
            if (err) console.log("[Test] Error: " + err.message);
            else {
                console.log("[Test] Response:" + JSON.stringify(response.attributes));
            }
            checkStats(testItem.stats, "Radius");
        });
    /////////////////////////////////////////////////
    // Diameter
    /////////////////////////////////////////////////
    } else if (testItem.type=="Diameter") {
        // Build diameter request
        var requestMessage = createMessage();
        requestMessage.applicationId = testItem.applicationId;
        requestMessage.commandCode = testItem.commandCode;
        requestMessage.avps = testItem.requestAVPs;
        // Add standard avps
        requestMessage.avps["Origin-Host"] = config.node.diameter.diameterHost;
        requestMessage.avps["Origin-Realm"] = config.node.diameter.diameterRealm;
        requestMessage.avps["Destination-Realm"] = testItem.destinationRealm;

        // Send Diameter request
        policyServer.diameter.sendRequest(null, requestMessage, 1000, function (err, response) {
            if (err) console.log("[Test] Error: " + err.message);
            else {
                console.log("[Test] Response:" + JSON.stringify(response.avps));
            }
            checkAVPs(testItem.replyAVPs, response.avps);
            checkStats(testItem.stats, "Diameter");
        });
    } else if (testItem.type=="CheckCDR"){
        checkCDR(testItem.file, testItem.cdr);
    /////////////////////////////////////////////////
    // Peers
    /////////////////////////////////////////////////
    } else if(testItem.type=="Peers"){
        checkPeers(testItem.peers, 0);
    /////////////////////////////////////////////////
    // Wait
    /////////////////////////////////////////////////
    } else if(testItem.type=="Wait"){
        setTimeout(nextTestItem, testItem.waitTime);

    } else setTimeout(nextTestItem, 0);
}

// Function to check Radius or Diameter statistics. Not the final value but the increment is checked
// Stats have state. Need to store them outside checking function
var prevStats={};
var nextStats={};
function checkStats(statsSpec, protocol){
    var statItems;
    var prevCounter;
    var nextCounter;
    var j;

    // Whether to invoke radius or diameter REST URL
    var statsFunction;
    if(protocol=="Radius") statsFunction="getRadiusStats"; else statsFunction="getDiameterStats";

    // Shift stats
    prevStats=nextStats;
    nextStats={};

    // Get stats for client, server and metaserver
    request.get(clientManagementUrl+statsFunction, function(error, response, body) {
        if(!body) throw new Error("Could not get stats for client");
        nextStats["client"]=JSON.parse(body);

        request.get(serverManagementUrl+statsFunction, function(error, response, body) {
            if(!body) throw new Error("Could not get stats for server");
            nextStats["server"]=JSON.parse(body);

            request.get(metaServerManagementUrl+statsFunction, function(error, response, body) {
                if(!body) throw new Error("Could not get stats for metaServer");
                nextStats["metaServer"]=JSON.parse(body);

                // Check the result
                // For each specification of result
                statsSpec.forEach(function(spec){
                    // Each counter is specified as a JSON property. The "|" is used instead of "." due to
                    // issues with ip addresses as property names
                    statItems=spec.counter.split("|");
                    prevCounter=prevStats;
                    nextCounter=nextStats;
                    // Iterate through property names (|)
                    for(j=0; j<statItems.length; j++){
                        if(prevCounter.hasOwnProperty(statItems[j])) prevCounter=prevCounter[statItems[j]]; else prevCounter=0;
                        if(nextCounter.hasOwnProperty(statItems[j])) nextCounter=nextCounter[statItems[j]]; else nextCounter=0;
                    }

                    // Test
                    if(nextCounter==(prevCounter+spec.value)) console.log("\t[Test][OK] "+spec.description+" "+prevCounter+"/"+nextCounter+" +"+spec.value); else console.log("\t[Test][ERROR] "+spec.description+" "+prevCounter+"/"+nextCounter+" +"+spec.value);
                });

                setTimeout(nextTestItem, 0);
            });
        });
    });
}

// Function to check the received attributes in the Radius or Diameter response
function checkAVPs(specs, responseAVPs){
    var responseValue;
    var specItems;
	// For each item to check
    specs.forEach(function(spec){
		// Properties to check are specified by using the "|" character instead of the "." character
        specItems=spec.property.split("|");
        responseValue=responseAVPs;
		// Navigate to the value, using "|" as separator
        for(var j=0; j<specItems.length; j++){
            if(responseValue.hasOwnProperty(specItems[j])) responseValue=responseValue[specItems[j]];
            else{
                responseValue=null;
                break;
            }
        }

        // Check value
        if(JSON.stringify(responseValue)==JSON.stringify(spec.value)) console.log("\t[Test][OK] "+spec.description+" "+JSON.stringify(spec.value)); else console.log("\t[Test][ERROR] "+spec.description+" "+JSON.stringify(spec.value)+" found: "+JSON.stringify(responseValue));
    });
}

// Checks whether a specific string is present in the CDR file
function checkCDR(file, specs){
    var fullCDRContents=fs.readFileSync(file, {encoding: "utf8"});
    specs.forEach(function(spec){
        // Test
        if(fullCDRContents.indexOf(spec.content)!=-1) console.log("\t[Test][OK] "+spec.description); else console.log("\t[Test][ERROR] "+spec.description+" "+spec.content+" not found");
    });

    setTimeout(nextTestItem, 0);
}

function checkPeers(peersSpec){
    var peerStats={};
    var propertyItems;
    var hostName;
    var state;
    var node;
    var j;

    request.get(clientManagementUrl+"getPeerStatus", function(error, response, body) {
        if (!body) throw new Error("Could not get peers for client");
        peerStats["client"] = JSON.parse(body);

        request.get(serverManagementUrl + "getPeerStatus", function (error, response, body) {
            if (!body) throw new Error("Could not get peers for server");
            peerStats["server"] = JSON.parse(body);

            console.log(body);

            request.get(metaServerManagementUrl + "getPeerStatus", function (error, response, body) {
                if (!body) throw new Error("Could not get peers for metaServer");
                peerStats["metaServer"] = JSON.parse(body);

                // For each specification of result
                peersSpec.forEach(function(spec){
                    propertyItems=spec.peer.split("|");
                    node=propertyItems[0];
                    hostName=propertyItems[1];
                    state="Not Found";
                    for(j=0; j<peerStats[node].length; j++){
                        if(peerStats[node][j]["hostName"]==hostName){
                            state=peerStats[node][j]["state"];
                            break;
                        }
                    }

                    // Test
                    if(state==spec.state) console.log("\t[Test][OK] "+spec.description); else console.log("\t[Test][ERROR] "+spec.description+" "+state);
                });

                setTimeout(nextTestItem, 0);
            });
        });
    });
}





