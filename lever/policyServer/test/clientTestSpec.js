/**
 * Test cases for MasMovil BAF radius server
 */
 
var child_process=require('child_process');

var serverIPAddress="127.0.0.1";
var clientName="test-client";

var testItems=[
    {
        execute: true,
        description: "Initial Wait",
        type: "Wait",
        waitTime:1000
    },
    {
        execute: true,
        description: "Access-Request for CGNAT/Unblocked user on nas-ip-address 1",
        comments: "Should answer with Huawei-Domain-Name mmvl-ftth-nat1",
        type: "Radius",
        code: "Access-Request",
		serverGroupName: "allServers",
        requestAVPs: [["User-Name","void@void"], ["User-Password","void"], ["NAS-IP-Address","200.1.1.1"], ["Calling-Station-Id", "4000_1"]],
        errorFn: function(err){
			console.log("\t[ERROR] %s", err.message);
		},
		responseFn: function(response){
			if
			(
				response.code=="Access-Accept" &&
				response.attributes["Vendor-Specific"] &&
				response.attributes["Vendor-Specific"]["Huawei-Domain-Name"]=="mmvl-ftth-nat1"
			) console.log("\t[OK] Received correct domain name");
			else console.log("\t[ERROR] %s", JSON.stringify(response.attributes));
		}
    },
    {
        execute: true,
        description: "Access-Request for Dynamic/Unblocked user on nas-ip-address 1",
        comments: "Should answer with Huawei-Domain-Name mmvl-ftth-dyn1",
        type: "Radius",
        code: "Access-Request",
		serverGroupName: "allServers",
		requestAVPs: [["User-Name","void@void"], ["User-Password","void"], ["NAS-IP-Address","200.1.1.1"], ["Calling-Station-Id", "4000_2"]],
        errorFn: function(err){
			console.log("\t[ERROR] %s", err.message);
		},
		responseFn: function(response){
			if
			(
				response.code=="Access-Accept" &&
				response.attributes["Vendor-Specific"] &&
				response.attributes["Vendor-Specific"]["Huawei-Domain-Name"]=="mmvl-ftth-dyn1"
			) console.log("\t[OK] Received correct domain name");
			else console.log("\t[ERROR] %s", JSON.stringify(response.attributes));
		}
    },
    {
        execute: true,
        description: "Access-Request for Fixed IP/Unblocked user on nas-ip-address 1",
        comments: "Should answer with Huawei-Domain-Name mmvl-ftth-static1",
        type: "Radius",
        code: "Access-Request",
		serverGroupName: "allServers",
		requestAVPs: [["User-Name","void@void"], ["User-Password","void"], ["NAS-IP-Address","200.1.1.1"], ["Calling-Station-Id", "4000_3"]],
        errorFn: function(err){
			console.log("\t[ERROR] %s", err.message);
		},
		responseFn: function(response){
			// Domain Name
			if
			(
				response.code=="Access-Accept" &&
				response.attributes["Vendor-Specific"] &&
				response.attributes["Vendor-Specific"]["Huawei-Domain-Name"]=="mmvl-ftth-static1"
			) console.log("\t[OK] Received correct domain name");
			else console.log("\t[ERROR] Incorrect domain name %s", JSON.stringify(response.attributes));
			// Fixed IPAddress
			if
			(
				response.attributes["Framed-IP-Address"].includes("199.1.1") && response.attributes["Framed-IP-Netmask"]=="255.255.255.255" && !response.attributes["Huawei-Netmask"]
			) console.log("\t[OK] Received correct IP Address attributes");
			else console.log("\t[ERROR] Incorrect fixed IP address attributes %s", JSON.stringify(response.attributes));
		}
    },
    {
        execute: true,
        description: "Access-Request for Blocked user on nas-ip-address 1",
        comments: "Should answer with Huawei-Domain-Name mmvl-ftth-blocked1",
        type: "Radius",
        code: "Access-Request",
		serverGroupName: "allServers",
		requestAVPs: [["User-Name","void@void"], ["User-Password","void"], ["NAS-IP-Address","200.1.1.1"], ["Calling-Station-Id", "4000_4"]],
        errorFn: function(err){
			console.log("\t[ERROR] %s", err.message);
		},
		responseFn: function(response){
			// Domain Name
			if
			(
				response.code=="Access-Accept" &&
				response.attributes["Vendor-Specific"] &&
				response.attributes["Vendor-Specific"]["Huawei-Domain-Name"]=="mmvl-ftth-blocked1"
			) console.log("\t[OK] Received correct domain name");
			else console.log("\t[ERROR] Incorrect domain name %s", JSON.stringify(response.attributes));
		}
    },
	{
        execute: true,
        description: "Access-Request for Fixed IP/Unblocked user on nas-ip-address 1 (FTTH)",
        comments: "Should answer with Huawei-Domain-Name mmvl-ftth-static1 and /24 mask",
        type: "Radius",
        code: "Access-Request",
		serverGroupName: "allServers",
		requestAVPs: [["User-Name","void@void"], ["User-Password","void"], ["NAS-IP-Address","200.1.1.1"], ["Vendor-Specific", "ADSL-Forum", [["ADSL-Agent-Circuit-Id", "OLTA10 xpon 1/20/30/43"]]]],
        errorFn: function(err){
			console.log("\t[ERROR] %s", err.message);
		},
		responseFn: function(response){
			// Domain Name
			if
			(
				response.code=="Access-Accept" &&
				response.attributes["Vendor-Specific"] &&
				response.attributes["Vendor-Specific"]["Huawei-Domain-Name"]=="mmvl-ftth-static1"
			) console.log("\t[OK] Received correct domain name");
			else console.log("\t[ERROR] Incorrect domain name %s", JSON.stringify(response.attributes));
			// Fixed IPAddress
			if
			(
				response.attributes["Framed-IP-Address"].includes("200.1.1") && response.attributes["Vendor-Specific"]["Huawei-Subnet-Mask"]=="255.255.255.0" && !response.attributes["Framed-IP-Netmask"]
			) console.log("\t[OK] Received correct IP Address attributes");
			else console.log("\t[ERROR] Incorrect fixed IP address attributes %s", JSON.stringify(response.attributes));
		}
    },
	{
        execute: true,
        description: "Database unavailable",
        comments: "Should get a timeout",
        type: "Radius",
        code: "Access-Request",
		serverGroupName: "allServers",
		requestAVPs: [["User-Name","void@void"], ["User-Password","void"], ["NAS-IP-Address","200.1.1.1"], ["Calling-Station-Id", "4000_1"]],
		prepareFn: function(){
				child_process.execSync("echo 'radius' | sudo -S service mariadb stop");
		},
        errorFn: function(err){
			console.log("\t[OK] Got a timeout");
		},
		responseFn: function(response){
			console.log("\t[ERROR] Got a response")
		}
    },
	{
        execute: true,
        description: "Restart database",
        comments: "No output expected",
        type: "Wait",
		waitTime: 5000,
		prepareFn: function(){
				child_process.execSync("echo 'radius' | sudo -S service mariadb start");
		}
    }
];

exports.testItems=testItems;
