/**
 * Test cases for MasMovil BAF radius server
 */

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
        comments: "Should answer with Huawei-Domain-Name mmvl-ftth-cgn1",
        type: "Radius",
        code: "Access-Request",
		serverGroupName: "allServers",
        requestAVPs: {"User-Name":"void@void", "User-Password":"void", "NAS-IP-Address":"200.1.1.1", "Calling-Station-Id": "4000_1"},
        errorFn: function(err){
			console.log("[ERROR] %s", err.message);
		},
		responseFn: function(response){
			if(response.attributes["Huawei-Domain-Name"]=="mmvl-ftth-cgn1") console.log("[OK] Received correct domain name");
			else console.log("[ERROR] %s", JSON.stringify(response.attributes));
		}
    }
];

exports.testItems=testItems;
