// Holds Diameter
/*
var stats={
    serverRequests: {
        total:{
            total: <number>,
            command-code-1: <number>,
            command-code-2: <number>
        },
        originHost-1:{
             total: <number>,
             command-code-1: <number>,
             command-code-2: <number>
             },
        originHost-2:{
             total: <number>,
             command-code-1: <number>,
             command-code-2: <number>
        },
        unknown:<number>
    }
    serverResponses:{},
    clientRequests:{},
    clientResponses{}
}
 */

var createStats;
createStats = function () {
    var stats = {};
    stats.serverRequests = {
        // Peer names
        "total": {
            // Command codes
            "total": 0
        }
    };
    stats.serverResponses = {
        // Peer names
        "total": {
            // Command codes
            "total": 0
        }
    };
    stats.clientRequests = {
        // Peer names
        "total": {
            // Command codes
            "total": 0
        }
    };
    stats.clientResponses = {
        // Peer names
        "total": {
            // Command codes
            "total": 0
        }
    };

    stats.incrementServerRequest = function (originHost, commandCode) {
        var serverRequests = stats.serverRequests;
        serverRequests.total.total++;
        if (serverRequests.total[commandCode]) serverRequests.total[commandCode]++; else serverRequests.total[commandCode] = 1;
        if (serverRequests[originHost]) {
            if (serverRequests[originHost].total) serverRequests[originHost].total++; else serverRequests[originHost].total = 1;
            if (serverRequests[originHost][commandCode]) serverRequests[originHost][commandCode]++; else serverRequests[originHost][commandCode]++;
        } else {
            serverRequests[originHost] = {};
            serverRequests[originHost].total = 1;
            serverRequests[originHost][commandCode] = 1;
        }
    };

    stats.incrementServerResponse = function (destinationHost, commandCode) {
        var serverResponses = stats.serverResponses;
        serverResponses.total.total++;
        if (serverResponses.total[commandCode]) serverResponses.total[commandCode]++; else serverResponses.total[commandCode] = 1;
        if (serverResponses[destinationHost]) {
            if (serverResponses[destinationHost].total) serverResponses[destinationHost].total++; else serverResponses[destinationHost].total = 1;
            if (serverResponses[destinationHost][commandCode]) serverResponses[destinationHost][commandCode]++; else serverResponses[destinationHost][commandCode]++;
        } else {
            serverResponses[destinationHost] = {};
            serverResponses[destinationHost].total = 1;
            serverResponses[destinationHost][commandCode] = 1;
        }
    };

    stats.incrementClientRequest = function (destinationHost, commandCode) {
        var clientRequests = stats.clientRequests;
        clientRequests.total.total++;
        if (clientRequests.total[commandCode]) clientRequests.total[commandCode]++; else clientRequests.total[commandCode] = 1;
        if (serverRequests[destinationHost]) {
            if (clientRequests[destinationHost].total) clientRequests[destinationHost].total++; else clientRequests[destinationHost].total = 1;
            if (clientRequests[destinationHost][commandCode]) clientRequests[destinationHost][commandCode]++; else clientRequests[destinationHost][commandCode]++;
        } else {
            clientRequests[destinationHost] = {};
            clientRequests[destinationHost].total = 1;
            clientRequests[destinationHost][commandCode] = 1;
        }
    };

    stats.incrementClientResponse = function (originHost, commandCode) {
        var clientResponses = stats.clientRequests;
        clientResponses.total.total++;
        if (clientResponses.total[commandCode]) clientResponses.total[commandCode]++; else clientResponses.total[commandCode] = 1;
        if (serverRequests[originHost]) {
            if (clientResponses[originHost].total) clientResponses[originHost].total++; else clientResponses[originHost].total = 1;
            if (clientResponses[originHost][commandCode]) clientResponses[originHost][commandCode]++; else clientResponses[originHost][commandCode]++;
        } else {
            clientResponses[originHost] = {};
            clientResponses[originHost].total = 1;
            clientResponses[originHost][commandCode] = 1;
        }
    };

};

var s=createStats();
exports.stats=s;
