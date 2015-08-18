load("urlConfig.js");

// Add parameter with hostname to policyserver
// If RadiusPort is 0, do no start radius server

// Client --> Server --> MetaServer

//var hostname=hostname();
var hostname="test";
var serverName=hostname+"-server";
var clientName=hostname+"-client";
var metaServerName=hostname+"-metaServer";
var metaServerNameExt="8950AAA";
var radiusClientNameExt="radiusTool";
var diameterClientNameExt="diameterTool";

var realm="lever";
var metaRealm="metaLever";
var clientRealm="clientLever";

var serverManagementPort=9000;
var clientManagementPort=9001;
var metaServerManagementPort=9002;

// Non loopback address of this node
var ipAddress="192.168.1.102";

print("");
print("----------------------------------");
print("Creating nodes configuration");
print("----------------------------------");


// test-client 0, 0, 93868
// test-server 1812, 1813, 3868
// test-metaserver, 2812, 2813, 4868
// 8950AAA, 11812, 11813, 13868 [Non loopback address]
// diameter-tool, 0, 0, ?


// -client, -server, -metaserver1 (lever), -metaserver2 (8950AAA)

// Remove mongodb://
var db=connect(leverConfigDatabase.substring(10));
db.nodes.drop();

var serverNode=
{
    "_version": 1001,
	"hostName": serverName,

    "radius": {
        "_version": 1001,
        "IPAddress": 0,
        "authPort": 1812,
        "acctPort": 1813,

        "clients": [
            {"name": clientName, "IPAddress": "127.0.0.1", "secret": "secret", "class": "none"},
            {"name": radiusClientNameExt, "IPAddress": ipAddress, "secret": "secret", "class": "none"}
        ],

        "servers": [
            {"name": "non-existing-server", "IPAddress": "1.0.0.1", "secret": "secret", "class": "none", "ports": {"Access-Request": 2812, "Accounting-Request": 2813, "CoA-Request": 13799}, "timeoutMillis": 500, "tries": 1, "errorThreshold": 2, "quarantineTimeMillis": 4000},
            {"name": metaServerName, "IPAddress": "127.0.0.1", "secret": "secret", "class": "none", "ports": {"Access-Request": 2812, "Accounting-Request": 2813, "CoA-Request": 13799}, "timeoutMillis": 500, "tries": 1, "errorThreshold": 2, "quarantineTimeMillis": 4000},
            {"name": metaServerNameExt, "IPAddress": ipAddress, "secret": "secret", "class": "none", "ports": {"Access-Request": 11812, "Accounting-Request": 11813, "CoA-Request": 13799}, "timeoutMillis": 500, "tries": 1, "errorThreshold": 2, "quarantineTimeMillis": 4000}

        ],
        "serverGroups": [
            {"name": "allRadiusServers", "servers": ["non-existing-server", metaServerName], "policy": "fixed"},
            {"name": "ExternalServer", "servers": [metaServerNameExt], "policy": "fixed"}
        ],

        "baseClientPort": 40000,
        "numClientPorts": 10
    },

    "diameter": {
        "IPAddress-not-used": "127.0.0.1",
        "port": 3868,
        "diameterHost": serverName,
        "diameterRealm": realm,
        "vendorId": 1101,
        "productName": "Lever",
        "firmwareRevision": 1,
        "connectionInterval": 10000,
        "peers": [
            {
                "name": clientName,
                "diameterHost": clientName,
                "IPAddress": "127.0.0.1",
                "connectionPolicy": "passive"
            },
            {
                "name": diameterClientNameExt,
                "diameterHost": diameterClientNameExt,
                "IPAddress": ipAddress,
                "connectionPolicy": "passive"
            },
            {
                "name": metaServerName,
                "diameterHost": metaServerName,
                "IPAddress": "127.0.0.1:4868",
                "connectionPolicy": "active",
                "watchdogInterval": 10000
            },
            {
                "name": metaServerNameExt,
                "diameterHost": metaServerNameExt,
                "IPAddress": ipAddress+":13868",
                "connectionPolicy": "active",
                "watchdogInterval": 10000
            }
        ],

        "routes": [
            {"realm": "all", "applicationId": "*", "peers": [metaServerName, metaServerNameExt], "policy": "fixed"},
            {"realm": metaRealm, "applicationId": "*", "peers": [metaServerName], "policy": "fixed"},
            {"realm": "*", "applicationId": "Credit-Control", "peers": [metaServerNameExt, metaServerName], "policy": "fixed"}
        ]
    },

    cdrChannels:[
        {name: "file", "type": "file", "location": "/var/lever/policyServer/cdr/cdr_server_test", "extension": ".txt", "rolling": "none", "format": "livingstone", "enabled": true},
        {name: "database", "type": "database", "location": "mongodb://cdrdb.lever/cdr", "collection": "cdr", "filter": ["User-Name", "NAS-IP-Address", "NAS-Port"], "enabled": false}
    ],

    "management":{
        "IPAddress": "localhost",
        "httpPort": serverManagementPort
    }
};

var clientNode=
{
    "_version": 1001,
    "hostName": clientName,

    "radius": {
        "_version": 1001,
        "IPAddress": 0,
        "authPort": 0,
        "acctPort": 0,

        "servers": [
            {"name": serverName, "IPAddress": "127.0.0.1", "secret": "secret", "class": "none", "ports": {"Access-Request": 1812, "Accounting-Request": 1813, "CoA-Request": 3799}, "timeoutMillis": 2000, "tries": 1, "errorThreshold": 2, "quarantineTimeMillis": 4000},
            {"name": "non-existing-server", "IPAddress": "1.0.0.1", "secret": "secret", "class": "none", "ports": {"Access-Request": 2812, "Accounting-Request": 2813, "CoA-Request": 13799}, "timeoutMillis": 1000, "tries": 1, "errorThreshold": 2, "quarantineTimeMillis": 4000}
        ],

        "serverGroups": [
            {"name": "allServers", "servers": ["non-existing-server", serverName], "policy": "fixed"}
        ],

        "baseClientPort": 40100,
        "numClientPorts": 10
    },

    "diameter": {
        "IPAddress-not-used": "127.0.0.1",
        "listenAddress": "0.0.0.0",
        "port": 93868,
        "diameterHost": clientName,
        "diameterRealm": clientRealm,
        "vendorId": 1101,
        "productName": "Lever",
        "firmwareRevision": 1,
        "connectionInterval": 10000,
        "peers": [
            {
                "name": serverName,
                "diameterHost": serverName,
                "IPAddress": "127.0.0.1",
                "connectionPolicy": "active",
                "watchdogInterval": 10000
            }
        ],

        "routes": [
            {"realm": "*", "applicationId": "*", "peers": [serverName], "policy": "fixed"}
        ]
    },

    cdrChannels:[
        {name: "file", "type": "file", "location": "/var/lever/policyServer/cdr/cdr_client_test", "extension": ".txt", "rolling": "none", "format": "livingstone", "enabled": true},
        {name: "database", "type": "database", "location": "mongodb://cdrdb.lever/cdr", "collection": "cdr", "filter": ["User-Name", "NAS-IP-Address", "NAS-Port"], "enabled": false}
    ],

    "management":{
        "IPAddress": "localhost",
        "httpPort": clientManagementPort
    }
};

var metaServerNode=
{
    "_version": 1001,
    "hostName": metaServerName,

    "radius": {
        "_version": 1001,
        "IPAddress": 0,
        "authPort": 2812,
        "acctPort": 2813,

        "clients": [
            {"name": serverName, "IPAddress": "127.0.0.1", "secret": "secret", "class": "none"}
        ],

        "baseClientPort": 40200,
        "numClientPorts": 10
    },

    "diameter": {
        "IPAddress-not-used": "127.0.0.1",
        "port": 4868,
        "diameterHost": metaServerName,
        "diameterRealm": metaRealm,
        "vendorId": 1101,
        "productName": "Lever",
        "firmwareRevision": 1,
        "connectionInterval": 10000,
        "peers": [
            {
                "name": serverName,
                "diameterHost": serverName,
                "IPAddress": "127.0.0.1:3868",
                "connectionPolicy": "passive"
            }
        ]
    },

    cdrChannels:[
        {name: "file", "type": "file", "location": "/var/lever/policyServer/cdr/cdr_metaServer_test", "extension": ".txt", "rolling": "none", "format": "livingstone", "enabled": true},
        {name: "database", "type": "database", "location": "mongodb://cdrdb.lever/cdr", "collection": "cdr", "filter": ["User-Name", "NAS-IP-Address", "NAS-Port"], "enabled": false}
    ],

    "management":{
        "IPAddress": "localhost",
        "httpPort": metaServerManagementPort
    }
};

db.nodes.insert(serverNode);
db.nodes.insert(clientNode);
db.nodes.insert(metaServerNode);
print("done");
print("");

print("----------------------------------");
print("Creating Dispatcher configuration");
print("----------------------------------");

db.dispatcher.drop();

var dispatcher=
{
	"_version": 1001,
	"dispatcher":{
		"Base":
		{
			"Capabilities-Exchange": 
			{
				"module":"./baseHandler",
				"functionName": "cerHandler"
			},
			"Device-Watchdog":
			{
				"module":"./baseHandler",
				"functionName": "watchdogHandler"			
			},
			"Disconnect-Peer":
			{
				"module":"./baseHandler",
				"functionName": "disconnectPeerHandler"			
			}
		},
		"Credit-Control":
		{
			"Credit-Control":
			{
				"module":"./policyScripts/gyHandler-test",
				"functionName": "ccrHandler"
			}
		},
        "Gx":
        {
            "Credit-Control":
            {
                "module":"./policyScripts/gxHandler",
                "functionName": "ccrHandler"
            }
        },
        "Radius":
        {
            "Access-Request":
            {
                "module":"./policyScripts/radiusHandler-test",
                "functionName": "accessRequestHandler"
            },
            "Accounting-Request":
            {
                "module":"./policyScripts/radiusHandler-test",
                "functionName": "accountingRequestHandler"
            }
        }
	}
};

db.dispatcher.insert(dispatcher);
print("done");
print("");

print("----------------------------------");
print("Creating CDR Channels configuration");
print("----------------------------------");
db.cdrChannels.drop();

var localFileChannel={
    "type": "file",
    "location": "/var/lever/policyServer/cdr/cdr_test",
    "extension": ".txt",
    "rolling": "none",
    "format": "livingstone",
    "enabled": true
};

var dbChannel={
    "type": "database",
    "location": "mongodb://cdrdb.lever/cdr",
    "collection": "cdr",
    "filter": ["User-Name", "NAS-IP-Address", "NAS-Port"],
    "enabled": true
};

db.cdrChannels.insert(localFileChannel);
db.cdrChannels.insert(dbChannel);

print("done");
print("");

print("----------------------------------");
print("Creating Policy configuration");
print("----------------------------------");


db.policyParams.drop();

// APN and Target

var apn_internet_unifon={
    setName:"apn",
    key: "internet.unifon",
    values: {
        targets:["psa", "spb", "wap-gw"]
    }
};

var apn_empresas={
    setName:"apn",
    key: "empresas",
    values: {
        targets:["psa", "spb", "rcs"]
    }
};

var target_psa={
    setName:"targets",
    key: "psa",
    values: {
        ipAddresses: ["192.168.1.101", "192.168.1.102"],
        timeoutMs: 750,
        retries: 2
    }
};

var target_spb={
    setName:"targets",
    key: "spb",
    values: {
        ipAddresses: ["192.168.1.101", "192.168.1.102"],
        timeoutMs: 750,
        retries: 2
    }
};

var target_rcs={
    setName:"targets",
    key: "rcs",
    values: {
        ipAddresses: ["192.168.1.101"],
        timeoutMs: 1500,
        retries: 1
    }
};

db.policyParams.insert(apn_internet_unifon);
db.policyParams.insert(apn_empresas);
db.policyParams.insert(target_psa);
db.policyParams.insert(target_spb);
db.policyParams.insert(target_rcs);

// DomainConfig
var domain_speedy={
    setName: "domain",
    key: "speedy",
    values:{
        provisionType: "database",
        doProxyAuth: true,
        doProxyServiceAcct: true,
        radiusProxyGroup: "speedy",
        avps:{
            "Unisphere-Virtual-Router": "wbc2"
        }
    }
};

var domain_arnet={
    setName: "domain",
    key: "arnet",
    values:{
        provisionType: "none",
        doProxyAuth: true,
        doProxyServiceAcct: true,
        radiusProxyGroup: "arnet",
        avps:{
            "Unisphere-Virtual-Router": "arnet"
        }
    }
};

db.policyParams.insert(domain_speedy);
db.policyParams.insert(domain_arnet);

// ServiceConfig
var service_permissive={
    setName: "service",
    key: "permissive",
    values:{
        avps:{
            "Reply-Message": "Permissive service"
        }
    }
};

var service_sd3M={
    setName: "service",
    key: "sd3M",
    values:{
        avps:{
            "Reply-Message": "sd3M"
        }
    }
};

db.policyParams.insert(service_permissive);
db.policyParams.insert(service_sd3M);

var global_params={
    setName: "global",
    key: "global",
    values:{
        serviceOnSubscriptionNotFound: "permissive"
    }
};

db.policyParams.insert(global_params);
