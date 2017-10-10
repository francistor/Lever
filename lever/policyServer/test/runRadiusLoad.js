/**
 * Generates radius packets for load testing
 * Generates a sequence of sessions with the contents specified in the configuration template (file
 * in the current directory) with
 * placeholders of the form ${<expresion of i>} such as ${i % 256} (take the current iteration, n,
 * and apply modulo 256)
 *
 * The "PacketType" attribute is removed before sending the packet
 */

const fs = require("fs");

// Configuration parameters
var totalThreads=1;
var totalSessions=1;
var loadTemplate="loadTemplate.json";
var hostName="test-client";
var showPackets=false;
var showStats=false;

// Indexes
var startTime;
var finishedThreads = 0;
var nextSession = 0;

var authRequests = 0;
var authAccepts = 0;
var authRejects = 0;
var authDrops = 0;
var acctRequests = 0;
var acctResponses = 0;
var acctDrops = 0;

var argument;
for(var i=2; i<process.argv.length; i++){

    argument=process.argv[i];
	
    if(argument.indexOf("help")!=-1){
        console.log("Usage: node runRadiusLoad.sh [--hostName <hostName (default: \"test-client\")>] [--totalSessions <number>] [--totalThreads <number>] [--template <loadTemplate.json>] [--showPackets] [--showStats]");
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
	
	if(argument=="--template") if(process.argv.length>=i){
        loadTemplate=process.argv[i+1];
        console.log("Using template: "+loadTemplate);
    }
	
	if(argument=="--totalSessions") if(process.argv.length>=i){
        totalSessions=parseInt(process.argv[i+1]);
        console.log("Using template: "+loadTemplate);
    }
	
	if(argument=="--showPackets"){
		showPackets=true;
		console.log("Showing packets");
	}
	
	if(argument=="--showStats"){
		showStats=true;
		console.log("Showing stats");
	}
}

// Create process title so that it can be stopped using pkill --signal SIGINT <process.title>
process.title="policyServer-" + hostName;

// Read packet template
const radiusTemplate = JSON.parse(fs.readFileSync(__dirname + "/" + loadTemplate));

// Build random prefix for AcctSessionId
const sessionIdPrefix = parseInt(Math.random()*10000);

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
		startTime=Date.now();
		for(k = 0; k < Math.min(totalThreads, totalSessions); k++) packetLoop(k, 0);
		nextSession = k-1;
    }
});

	
function packetLoop(sessionIndex, packetIndex){		
	// Build the packet to send
	var packet = buildPacket(radiusTemplate[packetIndex], sessionIndex);
	var packetType = (packet["PacketType"]||1) == 1 ? "Access-Request" : "Accounting-Request";
	delete packet["PacketType"];
	// Prepend random part to sessionId
	if(packet["Acct-Session-Id"]) packet["Acct-Session-Id"] = sessionIdPrefix + packet["Acct-Session-Id"];
	
	// Debug
	if(showPackets){
		console.log("-----------------------------------");
		console.log("Session: %d, Packet: %d", sessionIndex, packetIndex);
		console.log("%s: %s", packetType, JSON.stringify(packet));
		console.log("-----------------------------------");
	}
	
	// Send radius packet
	policyServer.radius.sendServerGroupRequest(packetType, packet, "allServers", function (err, response) {
		if(packetType == "Access-Request") authRequests++; else acctRequests++;
		if (err){
			//console.log("[ERROR] " + err.message);
			if(packetType == "Access-Request") authDrops++; else acctDrops++;
		} else{
			if(packetType == "Access-Request"){
				if(response.code == "Access-Reject") authRejects ++;
				else if(response.code == "Access-Accept") authAccepts ++;
			}
			else acctResponses++;
		}
		
		// Print stats
		if(showStats) process.stdout.write("\rAuth sent :" + authRequests + "-> accept: " +authAccepts + "/reject: " + authRejects + "/drop: " + authDrops + " Acct sent: " + acctRequests + "-> resp: " + acctResponses + "/drop: " + acctDrops);
		
		// Continue with the rest of packet sessions (increment packet index in the same session)
		if(++packetIndex < radiusTemplate.length) packetLoop(sessionIndex, packetIndex);
		else {
			// Grab another session if available
			if(++nextSession < totalSessions) packetLoop(nextSession, 0);
			else {
				// All sessions finished
				finishedThreads++;
				if(finishedThreads == totalThreads){
					var endTime=Date.now();
					console.log("\n[OK] Thread finished in %d seconds. Speed is %d operations per second", (endTime-startTime) / 1000, parseFloat((totalSessions*radiusTemplate.length)/((endTime-startTime)/1000)).toFixed(2));
					process.exit(0);
				}
			}
		}
	});
}


// Helper function to replace "i" in packet template
function buildPacket(template, i){
    var packet = {};
    for(property in template){
		value = template[property];
		if(typeof value == "string") value = value.replace(/\${(.+?)}/g, function(match, p1){
            return eval(p1);
        });
		packet[property]=value;
    }
    return packet;
}