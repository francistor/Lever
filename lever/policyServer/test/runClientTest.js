var fs=require("fs");
var request=require('request');
var Q=require("q");

var config=require("./../configService").config;
var createMessage=require("./../message").createMessage;

var testSpec="clientTestSpec";
var hostName;
var argument;
for(var i=2; i<process.argv.length; i++){
    argument=process.argv[i];
    if(argument.indexOf("help")!=-1){
        console.log("Usage: node runClientTest.js --testSpec <filename without .js> [--hostName <hostName>]");
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
		nextTestItem();
    }
});


// n: index of testItem being executed
var n=0;

// Executes each test item in sequence
function nextTestItem(){
    // Check if we have already finished
    if(n>=testItems.length){
        console.log("[TEST] All tests finished");
        process.exit(0);
    }

    var testItem=testItems[n];
    n++;

    // Skip testItem if so specified
    if(!testItem.execute){
        setTimeout(nextTestItem, 0);
        return;
    }

    console.log("[Test] "+testItem.description);

    if(testItem.type=="Radius") {
        // Send radius request
        policyServer.radius.sendServerGroupRequest(testItem.code, testItem.requestAVPs, testItem.serverGroupName, function (err, response) {
            if (err) testItem.errorFn(err); else testItem.responseFn(response);
			setTimeout(nextTestItem, 0);
        });
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
            if (err) testItem.errorFn(err);
			else testItem.responseFn(response);
			setTimeout(nextTestItem, 0);
        });
    } else if(testItem.type=="Wait"){
        setTimeout(nextTestItem, testItem.waitTime);

    } else setTimeout(nextTestItem, 0);
}







