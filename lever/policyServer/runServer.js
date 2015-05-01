/**
 * Created by frodriguezg on 24/04/2015.
 */

var policyServer=require("./policyServer").createPolicyServer();

policyServer.initialize(function(err){
    if(err){
        console.log("Error starting server: "+err.message);
        process.exit(-1);
    }
    else{
       console.log("Server started");
    }
});


