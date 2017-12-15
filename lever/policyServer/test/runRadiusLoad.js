/**
 * Generates radius packets for load testing
 * Generates a sequence of sessions with the contents specified in the configuration template (file
 * in the current directory) with
 * placeholders of the form 
 * 	${<expresion of i>} such as ${i % 256} (take the current iteration, i, and apply modulo 256)
 *  ${<expression of r>} where r is a random number of 32 bits generated just once for all the run (same for all sessions)
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
        console.log("Total sessions: "+totalSessions);
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
const radiusTemplate = JSON.parse(fs.readFileSync(loadTemplate));

// Build random number
const rnd = parseInt(Math.random()*65536);

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
	var packet = buildPacket(radiusTemplate[packetIndex], sessionIndex, rnd);
	var packetType=getAndDeletePacketType(packet);
	
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
					console.log("\n[OK] Finished in %d seconds. Speed is %d operations per second", (endTime-startTime) / 1000, parseFloat((totalSessions*radiusTemplate.length)/((endTime-startTime)/1000)).toFixed(2));
					process.exit(0);
				}
			}
		}
	});
}


// Helper function to replace "i" and "r" in packet template
function buildPacket(attrs, i, r){
	if(!Array.isArray(attrs)){
		// Template in hash format
		var packet = {};
		for(property in attrs){
			value = attrs[property];
			if(typeof value == "string") value=value.replace(/\${(.+?)}/g, function(match, p1){return eval(p1);});
			packet[property]=value;
		}
	} else {
		packet = JSON.parse(JSON.stringify(attrs));
		// Template in array format
		for(var ax=0; ax<packet.length; ax++){
			var avp=packet[ax];
			// Standard
			if(avp.length==2 && typeof avp[1]=="string") avp[1]=avp[1].replace(/\${(.+?)}/g, function(match, p1){return eval(p1);});
			// Vendor specific
			if(avp.length==3){
				for(var bx=0; bx<avp[2].length; bx++){
					if(typeof avp[2][bx][1]=="string") avp[2][bx][1]=avp[2][bx][1].replace(/\${(.+?)}/g, function(match, p1){return eval(p1);});
				}
			}
		}
	}
	return packet;
}

// Session template may inlcude a fake "PacketType" attribute which is retrieved (1-->Access-Request, 4-->Accounting-Request) and removed with this function
// Thus, attrs passed to the function are modified
function getAndDeletePacketType(attrs){
	if(!Array.isArray(attrs)){
		// Attributes are in hash format
		var packetType = (attrs["PacketType"]||1) == 1 ? "Access-Request" : "Accounting-Request";
		delete attrs["PacketType"];
		return packetType;
	}
	else {
		// Attributes are in array format
		for(var cx=0; cx<attrs.length; cx++){
			if(attrs[cx][0]=="PacketType"){
				packetType = (attrs[cx][1]) == 1 ? "Access-Request" : "Accounting-Request";
				attrs.splice(cx, 1);
				return packetType;
			}
		}
	}
}