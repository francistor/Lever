/**
 * Created by frodriguezg on 19/12/2015.
 */

var hostName;
var argument;
for(var i=2; i<process.argv.length; i++){
    argument=process.argv[i];
    if(argument.indexOf("help")!=-1){
        console.log("Usage: node runUnitTest [--hostName <hostName>]");
        process.exit(0);
    }

    if(argument=="--hostName") if(process.argv.length>=i){
        hostName=process.argv[i+1];
        console.log("Host name: "+hostName);
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
        testPerformance();
        testPerformance();
        testPerformance();
    }
});

var n=0;
var nMax=10000;
var startTime=Date.now();

function testPerformance(){

    policyServer.radius.sendServerGroupRequest("Accounting-Request", {"User-Name":"acceptUser@localRealm", "NAS-IP-Address": "200.200.200.200"}, "allServers", function (err, response) {
        if (err) console.log("[Test] Error: " + err.message);
        else{
        }
        n++;
        if(n<nMax) testPerformance();
        else {
            var endTime=Date.now();
            console.log("Test finished in "+(endTime-startTime)+" millis. Speed is "+nMax/((endTime-startTime)/1000));
        }
    });

}
