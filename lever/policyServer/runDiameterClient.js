/**
 * Created by frodriguezg on 24/04/2015.
 */

var config=require("./configService").config;
var createMessage=require("./message").createMessage;

var policyServer=require("./policyServer").createPolicyServer();

policyServer.initialize(function(err){
    if(err){
        console.log("Error starting server: "+err.message);
        process.exit(-1);
    }
    else{
        // Check help
        process.argv.forEach(function(argValue){
            if(argValue.indexOf("help")!=-1){
                console.log("Usage: node runDiameterClient <number-of-threads> <interval-between-requests-in-millis>");
                process.exit(0);
            }
        });

        // Init arguments
        var nThreads=parseInt(process.argv[2]||1);
        var requestInterval=parseInt(process.argv[3]||500);

        var diameterConfig=config.node.diameter;
        var dictionary=config.diameterDictionary;

        var theMessage=createMessage();
        theMessage.applicationId="Gx";
        theMessage.commandCode="Credit-Control";
        var request=theMessage.avps;

        // Mandatory attributes
        request["Origin-Host"]=diameterConfig["diameterHost"];
        request["Session-Id"]="session-id-1";
        request["Origin-Realm"]=diameterConfig["diameterRealm"];
        request["Destination-Realm"]="nfvdemo";
        // request["Destination-Host"]="pcrf-1";          // Forced to this host!
        request["Auth-Application-Id"]="Credit-Control";
        request["CC-Request-Type"]="Initial";
        request["CC-Request-Number"]=1;

        function sendRequest(){
            policyServer.diameter.sendRequest(null, theMessage, 3000, function(err, response){
                if(err) console.log(err.message);
                else{
                    console.log(JSON.stringify(response, null, 2));
                }
                if(requestInterval) setTimeout(sendRequest, requestInterval); else sendRequest();
            });
        }

        for(var i=0; i<nThreads; i++) sendRequest();
    }
});


