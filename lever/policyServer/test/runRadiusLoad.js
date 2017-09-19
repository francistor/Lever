/**
 * Generates radius packets for load testing
 * Generates a sequence of Access-Request, Accounting-Start, Interim-Update and Accounting-Stop
 * Loads a packet template as loadTemplate.json in the current directory, with
 * placeholders of the form ${<expresion of i>} such as ${i % 256} (take the current iteration, n,
 and apply modulo 256)
 */

const fs = require("fs");

var totalThreads=1;
var loadTemplate="loadTemplate.json"

var hostName;
var argument;

for(var i=2; i<process.argv.length; i++){
    argument=process.argv[i];
    if(argument.indexOf("help")!=-1){
        console.log("Usage: node runUnitTest --hostName <hostName> [--totalThreads <number>] [--template <loadTemplate.json>]");
        process.exit(0);
    }

    if(argument=="--hostName") if(process.argv.length>=i){
        hostName=process.argv[i+1];
        console.log("Host name: "+hostName);
    }
	
	if(argument=="--totalThreads") if(process.argv.length>=i){
        totalThreads=parseInt(process.argv[i+1]);
        console.log("Number of threads: "+totalThreads);
    }
	
	if(argument=="--loadTemplate") if(process.argv.length>=i){
        loadTemplate=process.argv[i+1];
        console.log("Using template: "+loadTemplate);
    }
}

// Parameter checkings
if(!hostName){
    console.log("The '--hostName argument is required");
    process.exit(-1);
}

// Create process title so that it can be stopped using pkill --signal SIGINT <process.title>
process.title="policyServer-" + hostName;

// Read packet template
const radiusTemplate = JSON.parse(fs.readFileSync(__dirname + "/" + loadTemplate));

// Start policyServer and invoke sequence of testItem on initialization
var policyServer=require("./../policyServer").createPolicyServer(hostName);
policyServer.initialize(function(err){
    if(err){
        console.log("Error starting radius client load: "+err.message);
        process.exit(-1);
    }
    else{
        console.log("[OK] Radius engine initialized");
        // Start tests
		for(k = 0; k < totalThreads; k++) loadLoop();
    }
});

var finishedThreads=0;
var genPackets=0;
var totalPackets=10;
var startTime=Date.now();

function loadLoop(){
    var packetType = (genPackets % 4 == 0) ? "Access-Request" : "Accounting-Request";
    console.log("Packet: " + JSON.stringify(buildPacket(radiusTemplate[genPackets % 4], parseInt(genPackets / 4))));

    policyServer.radius.sendServerGroupRequest(packetType, buildPacket(radiusTemplate[genPackets % 4], parseInt(genPackets / 4)), "allServers", function (err, response) {
        if (err) console.log("[ERROR] " + err.message);
        else{
			// Intentionally blank for now
        }
        genPackets++;
        if(genPackets<totalPackets) loadLoop();
        else {
			finishedThreads++;
			if(finishedThreads == totalThreads){
				var endTime=Date.now();
				console.log("[OK] Thread finished in %d seconds. Speed is %d operations per second", (endTime-startTime) / 1000, parseInt(totalPackets/((endTime-startTime)/1000)));
				process.exit(0);
			}
        }
    });
}

// Replacements
function buildPacket(template, i){
    var packet = {};
    for(property in template){
        packet[property] = template[property].replace(/\${(.+?)}/, function(match, p1){
            return eval(p1);
        })
    }
    return packet;
}