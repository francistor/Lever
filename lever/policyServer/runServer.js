
var hostName;
var argument;

for(var i=2; i<process.argv.length; i++){
    argument=process.argv[i];
    if(argument.indexOf("help")!=-1){
        console.log("Usage: node runSever [--hostName <hostName>]");
        process.exit(0);
    }

    if(argument=="--hostName") if(process.argv.length>=i){
        hostName=process.argv[i+1];
        console.log("Host name: "+hostName);
    }
}

// Create process title so that it can be stopped using pkill --signal SIGINT <process.title>
process.title="policyServer-"+hostName;

var policyServer=require("./policyServer").createPolicyServer(hostName);

policyServer.initialize(function(err){
    if(err){
        console.log("Error starting server: "+err.message);
        process.exit(-1);
    }
    else{
       console.log("Server started");
    }
});


