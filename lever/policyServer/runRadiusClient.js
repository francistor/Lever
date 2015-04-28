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
        policyServer.radius.sendServerRequest("Access-Request", [], "8950AAA-toshiba", function(err, response){
            if(err) console.log(err.message);
            else{
                console.log(JSON.stringify(response, null, 2));
            }
        });
    }
});


