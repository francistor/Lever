var fs=require("fs");
var request=require('request');

var config=require("./../configService").config;
var createMessage=require("./../message").createMessage;

var serverManagementUrl="http://localhost:9000/agent/";
var clientManagementUrl="http://localhost:9001/agent/";
var metaServerManagementUrl="http://localhost:9002/agent/";

//////////////////////////////////////////////
/// Modify according to test scenario
/////////////////////////////////////////////
var serverIPAddress="127.0.0.1";
var metaServerIPAddress="127.0.0.1";
var metaServerExtIPAddress="192.168.1.102";
var nonExistingServerIPAddress="1.0.0.1";

var clientName="test-client";
var serverName="test-server";
var metaServerName="test-metaServer";

// No rolling
var noRollingCDRFileMetaServer="/var/lever/policyServer/cdr/cdr_metaServer_test.txt";

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
        console.log("Error starting server: "+err.message);
        process.exit(-1);
    }
    else{
       console.log("Server started");
       // Start tests
       nextTestItem();
    }
});

// n: index of testItem being executed
var n=0;
var testItems=[
    {
        execute: true,
        description: "Initial Wait",
        type: "Wait",
        waitTime:10000
    },
    {
        execute: true,
        description: "Peers status",
        type: "Peers",
        peers: [
            {peer: "client|test-server", state:"Open", description: "test-client <-> test-server Open"},
            {peer: "server|test-client", state:"Open", description: "test-server <-> test-client Open"},
            {peer: "server|test-metaServer", state:"Open", description: "test-server <-> test-metaServer Open"},
            {peer: "metaServer|test-server", state:"Open", description: "test-metaServer <-> test-server Open"}
        ]
    },
    {
        execute: true,
        description: "Access-Request to be accepted by server locally",
        comments: "Takes one second, due to timeout from non-existing-server",
        type: "Radius",
        code: "Access-Request",
        requestAVPs: {"User-Name":"acceptUser@localRealm"},
        serverGroupName: "allServers",
        stats: [
                {counter: "client|clientAccessRequests|"+nonExistingServerIPAddress, value: 1, description: "Client Access-Request to non existing server"},
                {counter: "client|clientAccessTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Client Access-Timeout from non existing server"},
                {counter: "client|clientAccessRequests|"+serverIPAddress, value: 1, description: "Client Access-Request to server"},
                {counter: "client|clientAccessAccepts|"+serverIPAddress, value: 1, description: "Client Access-Accept from server"},

                {counter: "server|serverAccessRequests|"+clientName, value: 1, description: "Server Access-Request from client"},
                {counter: "server|serverAccessAccepts|"+clientName, value: 1, description: "Server Access-Accept to client"}
        ]
    },
    {
        execute: true,
        description: "Access-Request to be rejected by server locally",
        comments: "Takes one second, due to timeout from non-existing-server",
        type: "Radius",
        code: "Access-Request",
        requestAVPs: {"User-Name":"rejectUser@localRealm"},
        serverGroupName: "allServers",
        stats: [
                {counter: "client|clientAccessRequests|"+nonExistingServerIPAddress, value: 1, description: "Client Access-Request to non existing server"},
                {counter: "client|clientAccessTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Client Access-Timeout from non existing server"},
                {counter: "client|clientAccessRequests|"+serverIPAddress, value: 1, description: "Client Access-Request to server"},
                {counter: "client|clientAccessAccepts|"+serverIPAddress, value: 0, description: "Client Access-Accept from server"},
                {counter: "client|clientAccessRejects|"+serverIPAddress, value: 1, description: "Client Access-Reject from server"},

                {counter: "server|serverAccessRequests|"+clientName, value: 1, description: "Server Access-Request from client"},
                {counter: "server|serverAccessAccepts|"+clientName, value: 0, description: "Server Access-Accept from client"},
                {counter: "server|serverAccessRejects|"+clientName, value: 1, description: "Server Access-Reject from client"}
        ]
    },
    {
        execute: true,
        description: "Access-Request to be discarded by server locally",
        comments: "Client non-existing-server is in quarantine. Takes 2 seconds in timeout to server",
        type: "Radius",
        code: "Access-Request",
        requestAVPs: {"User-Name":"errorUser@localRealm"},
        serverGroupName: "allServers",
        stats: [
            {counter: "client|clientAccessRequests|"+nonExistingServerIPAddress, value: 0, description: "Client Access-Request to non existing server [quarantine]"},
            {counter: "client|clientAccessTimeouts|"+nonExistingServerIPAddress, value: 0, description: "Client Access-Timeout from non existing server [quarantine]"},
            {counter: "client|clientAccessRequests|"+serverIPAddress, value: 1, description: "Client Access-Request to server"},
            {counter: "client|clientAccessTimeouts|"+serverIPAddress, value: 1, description: "Client Access-Timeout from server"},
            {counter: "client|clientAccessAccepts|"+serverIPAddress, value: 0, description: "Client Access-Accept from server"},
            {counter: "client|clientAccessRejects|"+serverIPAddress, value: 0, description: "Client Access-Reject from server"},

            {counter: "server|serverAccessRequests|"+clientName, value: 1, description: "Server Access-Request from client"},
            {counter: "server|serverAccessAccepts|"+clientName, value: 0, description: "Server Access-Accept from client"},
            {counter: "server|serverAccessRejects|"+clientName, value: 0, description: "Server Access-Reject from client"},
            {counter: "server|serverErrors|"+clientName, value: 1, description: "Server Error generated by the policyScript"}
        ]
    },
    {
        execute: true,
        description: "Access-Request to be accepted by remote proxy",
        comments: "Client non-existing-server is in quarantine. Takes 500 ms due to timeout to server non-existing-server",
        type: "Radius",
        code: "Access-Request",
        requestAVPs: {"User-Name":"acceptUser@proxyRealm"},
        serverGroupName: "allServers",
        stats: [
            {counter: "client|clientAccessRequests|"+nonExistingServerIPAddress, value: 0, description: "Client Access-Request to non existing server [quarantine]"},
            {counter: "client|clientAccessTimeouts|"+nonExistingServerIPAddress, value: 0, description: "Client Access-Timeout from non existing server [quarantine]"},
            {counter: "client|clientAccessRequests|"+serverIPAddress, value: 1, description: "Client Access-Request to server"},
            {counter: "client|clientAccessTimeouts|"+serverIPAddress, value: 0, description: "Client Access-Timeout from server"},
            {counter: "client|clientAccessAccepts|"+serverIPAddress, value: 1, description: "Client Access-Accept from server"},
            {counter: "client|clientAccessRejects|"+serverIPAddress, value: 0, description: "Client Access-Reject from server"},

            {counter: "server|serverAccessRequests|"+clientName, value: 1, description: "Server Access-Request from client"},
            {counter: "server|serverAccessAccepts|"+clientName, value: 1, description: "Server Access-Accept from client"},
            {counter: "server|serverAccessRejects|"+clientName, value: 0, description: "Server Access-Reject from client"},

            {counter: "server|clientAccessRequests|"+nonExistingServerIPAddress, value: 1, description: "Server Access-Request to non-existing-server"},
            {counter: "server|clientAccessTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Server Access-Timeout to non-existing-server"},
            {counter: "server|clientAccessRequests|"+metaServerIPAddress, value: 1, description: "Server Access-Request to metaServer"},
            {counter: "server|clientAccessAccepts|"+metaServerIPAddress, value: 1, description: "Server Access-Accept from metaServer"},
            {counter: "server|clientAccessRejects|"+metaServerIPAddress, value: 0, description: "Server Access-Reject from metaServer"},

            {counter: "metaServer|serverAccessRequests|"+serverName, value: 1, description: "Metaserver Access-Request from server [proxy]"},
            {counter: "metaServer|serverAccessAccepts|"+serverName, value: 1, description: "Metaserver Access-Accept to server [proxy]"},
            {counter: "metaServer|serverAccessRejects|"+serverName, value: 0, description: "Metaserver Access-Reject to server [proxy]"}
        ]
    },
    {
        execute: true,
        description: "Access-Request to be rejected by remote proxy",
        comments: "Client non-existing-server is in quarantine. Takes 500 ms due to timeout to server non-existing-server",
        type: "Radius",
        code: "Access-Request",
        requestAVPs: {"User-Name":"rejectUser@proxyRealm"},
        serverGroupName: "allServers",
        stats: [
            {counter: "client|clientAccessRequests|"+nonExistingServerIPAddress, value: 0, description: "Client Access-Request to non existing server [quarantine]"},
            {counter: "client|clientAccessTimeouts|"+nonExistingServerIPAddress, value: 0, description: "Client Access-Timeout from non existing server [quarantine]"},
            {counter: "client|clientAccessRequests|"+serverIPAddress, value: 1, description: "Client Access-Request to server"},
            {counter: "client|clientAccessTimeouts|"+serverIPAddress, value: 0, description: "Client Access-Timeout from server"},
            {counter: "client|clientAccessAccepts|"+serverIPAddress, value: 0, description: "Client Access-Accept from server"},
            {counter: "client|clientAccessRejects|"+serverIPAddress, value: 1, description: "Client Access-Reject from server"},

            {counter: "server|serverAccessRequests|"+clientName, value: 1, description: "Server Access-Request from client"},
            {counter: "server|serverAccessAccepts|"+clientName, value: 0, description: "Server Access-Accept from client"},
            {counter: "server|serverAccessRejects|"+clientName, value: 1, description: "Server Access-Reject from client"},

            {counter: "server|clientAccessRequests|"+nonExistingServerIPAddress, value: 1, description: "Server Access-Request to non-existing-server"},
            {counter: "server|clientAccessTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Server Access-Timeout to non-existing-server"},
            {counter: "server|clientAccessRequests|"+metaServerIPAddress, value: 1, description: "Server Access-Request to metaServer"},
            {counter: "server|clientAccessAccepts|"+metaServerIPAddress, value: 0, description: "Server Access-Accept from metaServer"},
            {counter: "server|clientAccessRejects|"+metaServerIPAddress, value: 1, description: "Server Access-Reject from metaServer"},

            {counter: "metaServer|serverAccessRequests|"+serverName, value: 1, description: "Metaserver Access-Request from server [proxy]"},
            {counter: "metaServer|serverAccessAccepts|"+serverName, value: 0, description: "Metaserver Access-Accept to server [proxy]"},
            {counter: "metaServer|serverAccessRejects|"+serverName, value: 1, description: "Metaserver Access-Reject to server [proxy]"}
        ]
    },
    {
        execute: true,
        description: "Clear quarantines",
        type: "Wait",
        waitTime: 4000
    },
    {
        execute: true,
        description: "Accounting-Request to be answered by server locally",
        comments: " Takes one second due to timeout to server non-existing-server",
        type: "Radius",
        code: "Accounting-Request",
        requestAVPs: {"User-Name":"acceptUser@localRealm"},
        serverGroupName: "allServers",
        stats: [
            {counter: "client|clientAccountingRequests|"+nonExistingServerIPAddress, value: 1, description: "Client Accounting-Request to non existing server"},
            {counter: "client|clientAccountingTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Client Accounting-Timeout from non existing server"},
            {counter: "client|clientAccountingRequests|"+serverIPAddress, value: 1, description: "Client Accounting-Request to server"},
            {counter: "client|clientAccountingResponses|"+serverIPAddress, value: 1, description: "Client Accounting-Response from server"},

            {counter: "server|serverAccountingRequests|"+clientName, value: 1, description: "Server Accounting-Request from client"},
            {counter: "server|serverAccountingResponses|"+clientName, value: 1, description: "Server Accounting-Response to client"}
        ]
    },
    {
        execute: true,
        description: "Accounting-Request to be discarded by server locally",
        comments: "Takes 2,5 secs. 500 due to timeout to non-existing-server and 2 seg due to timeout to server",
        type: "Radius",
        code: "Accounting-Request",
        requestAVPs: {"User-Name":"errorUser@localRealm"},
        serverGroupName: "allServers",
        stats: [
            {counter: "client|clientAccountingRequests|"+nonExistingServerIPAddress, value: 1, description: "Client Accounting-Request to non existing server"},
            {counter: "client|clientAccountingTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Client Accounting-Timeout from non existing server"},
            {counter: "client|clientAccountingRequests|"+serverIPAddress, value: 1, description: "Client Accounting-Request to server"},
            {counter: "client|clientAccountingTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Client Accounting-Timeout from non existing server"},
            {counter: "client|clientAccountingResponses|"+serverIPAddress, value: 0, description: "Client Accounting-Response from server"},

            {counter: "server|serverAccountingRequests|"+clientName, value: 1, description: "Server Accounting-Request from client"},
            {counter: "server|serverAccountingResponses|"+clientName, value: 0, description: "Server Accounting-Response to client"},
            {counter: "server|serverErrors|"+clientName, value: 1, description: "Server Error generated by the policyScript"}
        ]
    },
    {
        execute: true,
        description: "Accounting-Request to be proxied to metaServer",
        comments: "Takes 500 due to timeout to non-existing-server. Client non-existing server is in quarantine",
        type: "Radius",
        code: "Accounting-Request",
        requestAVPs: {"User-Name":"acceptUser@proxyRealm"},
        serverGroupName: "allServers",
        stats: [
            {counter: "client|clientAccountingRequests|"+nonExistingServerIPAddress, value: 0, description: "Client Accounting-Request to non existing server [quarantine]"},
            {counter: "client|clientAccountingTimeouts|"+nonExistingServerIPAddress, value: 0, description: "Client Accounting-Timeout from non existing server [quarantine]"},
            {counter: "client|clientAccountingRequests|"+serverIPAddress, value: 1, description: "Client Accounting-Request to server"},
            {counter: "client|clientAccountingTimeouts|"+serverIPAddress, value: 0, description: "Client Accounting-Timeout from server"},
            {counter: "client|clientAccountingResponses|"+serverIPAddress, value: 1, description: "Client Accounting-Response from server"},

            {counter: "server|serverAccountingRequests|"+clientName, value: 1, description: "Server Accounting-Request from client"},
            {counter: "server|serverAccountingResponses|"+clientName, value: 1, description: "Server Accounting-Accept from client"},

            {counter: "server|clientAccountingRequests|"+nonExistingServerIPAddress, value: 1, description: "Server Accounting-Request to non-existing-server"},
            {counter: "server|clientAccountingTimeouts|"+nonExistingServerIPAddress, value: 1, description: "Server Accounting-Timeout to non-existing-server"},
            {counter: "server|clientAccountingRequests|"+metaServerIPAddress, value: 1, description: "Server Accounting-Request to metaServer"},
            {counter: "server|clientAccountingResponses|"+metaServerIPAddress, value: 1, description: "Server Accounting-Response from metaServer"},

            {counter: "metaServer|serverAccountingRequests|"+serverName, value: 1, description: "Metaserver Accounting-Request from server [proxy]"},
            {counter: "metaServer|serverAccountingResponses|"+serverName, value: 1, description: "Metaserver Accounting-Response to server [proxy]"}
        ]
    },
    {
        execute: true,
        description: "Capabilities Exchange. Gy CCR-Initial to be proxied to metaServer",
        type: "Diameter",
        applicationId: "Credit-Control",
        commandCode: "Credit-Control",
        destinationRealm: "ne",
        requestAVPs:{
            "Session-Id":"test-session-id-1",
            "Auth-Application-Id":"Credit-Control",
            "CC-Request-Type":"Initial",
            "CC-Request-Number": 1
        },
        replyAVPs:[
            {property: "Session-Id", value:["test-session-id-1"], description: "Session-Id mirrors the one sent"}
        ],
        stats:[
            {counter: "client|clientRequests|"+serverName+"|Capabilities-Exchange", value: 1, description: "CER to server"},
            {counter: "client|clientResponses|"+serverName+"|Capabilities-Exchange|2001", value: 1, description: "CEA from server"},
            {counter: "client|clientRequests|"+serverName+"|Credit-Control", value: 1, description: "Credit-Control to server"},
            {counter: "client|clientResponses|"+serverName+"|Credit-Control|2001", value: 1, description: "Credit-Control/0 from server"},

            {counter: "server|serverRequests|"+clientName+"|Capabilities-Exchange", value: 1, description: "CER from client"},
            {counter: "server|serverResponses|"+clientName+"|Capabilities-Exchange|2001", value: 1, description: "CEA to client"},
            {counter: "server|clientRequests|"+metaServerName+"|Capabilities-Exchange", value: 1, description: "CER to metaServer"},
            {counter: "server|clientResponses|"+metaServerName+"|Capabilities-Exchange|2001", value: 1, description: "CEA from metaServer"},
            {counter: "server|serverRequests|"+clientName+"|Credit-Control", value: 1, description: "Credit-Control from client"},
            {counter: "server|serverResponses|"+clientName+"|Credit-Control|2001", value: 1, description: "Credit-Control to client"},

            {counter: "metaServer|serverRequests|"+serverName+"|Capabilities-Exchange", value: 1, description: "CER from server"},
            {counter: "metaServer|serverResponses|"+serverName+"|Capabilities-Exchange|2001", value: 1, description: "CEA to server"}
        ]
    },
    {
        execute: true,
        description: "Wait to flush CDR. May be not necessary",
        type: "Wait",
        waitTime: 1000
    },
    {
        execute: true,
        description: "Check Accounting CDR in metaServer",
        type: "CheckCDR",
        file: noRollingCDRFileMetaServer,
        cdr:[
            {content: "User-Name=acceptUser@proxyRealm", description: "User-Name in CDR"}
        ]

    }
];

// Executes each test item in sequence
function nextTestItem(){
    // Check if we have already finished
    if(n>=testItems.length){
        console.log("[TEST] All tests finished");
        // Write support file for the benefit of external programs
        fs.writeFileSync(__dirname+"/testFinished.txt", "Tests finished");
        return;
    }

    var testItem=testItems[n];
    n++;

    // Skip testItem if so specified
    if(!testItem.execute){
        setTimeout(nextTestItem, 0);
        return;
    }

    console.log("[Test] "+testItem.description);
    /////////////////////////////////////////////////
    // Radius
    /////////////////////////////////////////////////
    if(testItem.type=="Radius") {
        // Send radius request
        policyServer.radius.sendServerGroupRequest(testItem.code, testItem.requestAVPs, testItem.serverGroupName, function (err, response) {
            if (err) console.log("[Test] Error: " + err.message);
            else {
                console.log("[Test] Response:" + JSON.stringify(response.attributes));
            }
            checkStats(testItem.stats, "Radius");
        });
    /////////////////////////////////////////////////
    // Diameter
    /////////////////////////////////////////////////
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
            if (err) console.log("[Test] Error: " + err.message);
            else {
                console.log("[Test] Response:" + JSON.stringify(response.avps));
            }
            checkAVPs(testItem.replyAVPs, response.avps);
            checkStats(testItem.stats, "Diameter");
        });
    } else if (testItem.type=="CheckCDR"){
        checkCDR(testItem.file, testItem.cdr);
    /////////////////////////////////////////////////
    // Peers
    /////////////////////////////////////////////////
    } else if(testItem.type=="Peers"){
        checkPeers(testItem.peers, 0);
    /////////////////////////////////////////////////
    // Wait
    /////////////////////////////////////////////////
    } else if(testItem.type=="Wait"){
        setTimeout(nextTestItem, testItem.waitTime);

    } else setTimeout(nextTestItem, 0);
}

// Function to check Radius or Diameter statistics. Not the final value but the increment is checked
// Stats have state. Need to store them outside checking function
var prevStats={};
var nextStats={};
function checkStats(statsSpec, protocol){
    var statItems;
    var prevCounter;
    var nextCounter;
    var j;

    // Whether to invoke radius or diameter REST URL
    var statsFunction;
    if(protocol=="Radius") statsFunction="getRadiusStats"; else statsFunction="getDiameterStats";

    // Shift stats
    prevStats=nextStats;
    nextStats={};

    // Get stats for client, server and metaserver
    request.get(clientManagementUrl+statsFunction, function(error, response, body) {
        if(!body) throw new Error("Could not get stats for client");
        nextStats["client"]=JSON.parse(body);

        request.get(serverManagementUrl+statsFunction, function(error, response, body) {
            if(!body) throw new Error("Could not get stats for server");
            nextStats["server"]=JSON.parse(body);

            request.get(metaServerManagementUrl+statsFunction, function(error, response, body) {
                if(!body) throw new Error("Could not get stats for metaServer");
                nextStats["metaServer"]=JSON.parse(body);

                // Check the result
                // For each specification of result
                statsSpec.forEach(function(spec){
                    // Each counter is specified as a JSON property. The "|" is used instead of "." due to
                    // issues with ip addresses as property names
                    statItems=spec.counter.split("|");
                    prevCounter=prevStats;
                    nextCounter=nextStats;
                    // Iterate through property names (|)
                    for(j=0; j<statItems.length; j++){
                        if(prevCounter.hasOwnProperty(statItems[j])) prevCounter=prevCounter[statItems[j]]; else prevCounter=0;
                        if(nextCounter.hasOwnProperty(statItems[j])) nextCounter=nextCounter[statItems[j]]; else nextCounter=0;
                    }

                    // Test
                    if(nextCounter==(prevCounter+spec.value)) console.log("\t[Test][OK] "+spec.description+" "+prevCounter+"/"+nextCounter+" +"+spec.value); else console.log("\t[Test][ERROR] "+spec.description+" "+prevCounter+"/"+nextCounter+" +"+spec.value);
                });

                setTimeout(nextTestItem, 0);
            });
        });
    });
}

// Function to check the received attributes in the Radius or Diameter response
function checkAVPs(specs, responseAVPs){
    var responseValue;
    var specItems;
    specs.forEach(function(spec){
        specItems=spec.property.split("|");
        responseValue=responseAVPs;
        for(var j=0; j<specItems.length; j++){
            if(responseValue.hasOwnProperty(specItems[j])) responseValue=responseValue[specItems[j]];
            else{
                responseValue=null;
                break;
            }
        }

        // Test
        if(JSON.stringify(responseValue)==JSON.stringify(spec.value)) console.log("\t[Test][OK] "+spec.description+" "+JSON.stringify(spec.value)); else console.log("\t[Test][ERROR] "+spec.description+" "+JSON.stringify(spec.value)+" found: "+JSON.stringify(responseValue));
    });
}

// Checks whether a specific string is present in the CDR file
function checkCDR(file, specs){
    var fullCDRContents=fs.readFileSync(file, {encoding: "utf8"});
    specs.forEach(function(spec){
        // Test
        if(fullCDRContents.indexOf(spec.content)!=-1) console.log("\t[Test][OK] "+spec.description); else console.log("\t[Test][ERROR] "+spec.description+" "+spec.content+" not found");
    });

    setTimeout(nextTestItem, 0);
}

function checkPeers(peersSpec){
    var peerStats={};
    var propertyItems;
    var hostName;
    var state;
    var node;
    var j;

    request.get(clientManagementUrl+"getPeerStatus", function(error, response, body) {
        if (!body) throw new Error("Could not get peers for client");
        peerStats["client"] = JSON.parse(body);

        request.get(serverManagementUrl + "getPeerStatus", function (error, response, body) {
            if (!body) throw new Error("Could not get peers for server");
            peerStats["server"] = JSON.parse(body);

            console.log(body);

            request.get(metaServerManagementUrl + "getPeerStatus", function (error, response, body) {
                if (!body) throw new Error("Could not get peers for metaServer");
                peerStats["metaServer"] = JSON.parse(body);

                // For each specification of result
                peersSpec.forEach(function(spec){
                    propertyItems=spec.peer.split("|");
                    node=propertyItems[0];
                    hostName=propertyItems[1];
                    state="Not Found";
                    for(j=0; j<peerStats[node].length; j++){
                        if(peerStats[node][j]["hostName"]==hostName){
                            state=peerStats[node][j]["state"];
                            break;
                        }
                    }

                    // Test
                    if(state==spec.state) console.log("\t[Test][OK] "+spec.description); else console.log("\t[Test][ERROR] "+spec.description+" "+state);
                });

                setTimeout(nextTestItem, 0);
            });
        });
    });
}





