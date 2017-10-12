/**
 * Created by frodriguezg on 19/12/2015.
 */

var serverIPAddress="127.0.0.1";
var metaServerIPAddress="127.0.0.1";
var metaServerExtIPAddress="192.168.1.102";
var nonExistingServerIPAddress="1.0.0.1";

var clientName="test-client";
var serverName="test-server";
var metaServerName="test-metaServer";

// No rolling
var noRollingCDRFileMetaServer="/var/lever/policyServer/cdr/cdr_metaServer_test.txt";

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

exports.testItems=testItems;
