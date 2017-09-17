/**
 * Created by frodriguezg on 19/12/2015.
 */

var totalThreads=1;
var hostName;
var argument;
for(var i=2; i<process.argv.length; i++){
    argument=process.argv[i];
    if(argument.indexOf("help")!=-1){
        console.log("Usage: node runUnitTest [--hostName <hostName>] [--totalThreads <number>]");
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
}

// Create process title so that it can be stopped using pkill --signal SIGINT <process.title>
process.title="policyServer-"+hostName;

// Start policyServer and invoke sequence of testItem on initialization
var policyServer=require("./../policyServer").createPolicyServer(hostName);
policyServer.initialize(function(err){
    if(err){
        console.log("Error starting client for performance test: "+err.message);
        process.exit(-1);
    }
    else{
        console.log("[Test] Performance client started");
        // Start tests
		for(k = 0; k < totalThreads; k++) perfLoop();
    }
});

var finishedThreads=0;
var receivedPackets=0;
var totalPackets=10000;
var startTime=Date.now();

function perfLoop(){

    policyServer.radius.sendServerGroupRequest("Accounting-Request", {"User-Name":"acceptUser@localRealm", "NAS-IP-Address": "200.200.200.200"}, "allServers", function (err, response) {
        if (err) console.log("[Test] Error: " + err.message);
        else{
			// Intentionally blank for now
        }
        receivedPackets++;
        if(receivedPackets<totalPackets) perfLoop();
        else {
			finishedThreads++;
			if(finishedThreads == totalThreads){
				var endTime=Date.now();
				console.log("Thread finished in %d seconds. Speed is %d operations per second", (endTime-startTime) / 1000, parseInt(totalPackets/((endTime-startTime)/1000)));
			}
        }
    });
}
