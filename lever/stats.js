// Holds Diameter statistics
// host -> command [-> resultCode (for responses)]

var createStats;
createStats = function () {
    var stats = {};
    stats.serverRequests = {};
    stats.serverResponses = {};
    stats.clientRequests = {};
    stats.clientResponses = {};

    stats.incrementServerRequest = function (destinationHost, commandCode) {
        var serverRequests = stats.serverRequests;
        // Create path if does not exist
        if(!serverRequests[destinationHost]){
            serverRequests[destinationHost]={};
            serverRequests[destinationHost][commandCode]=0;
        } else if(!serverRequests[destinationHost][commandCode]){
            serverRequests[destinationHost][commandCode]=0;
        }
        serverRequests[destinationHost][commandCode]++;
    };

    stats.incrementServerResponse = function (destinationHost, commandCode, resultCode) {
        var serverResponses = stats.serverResponses;
        // Create path if does not exist
        if(!serverResponses[destinationHost]){
            serverResponses[destinationHost]={};
            serverResponses[destinationHost][commandCode]={};
            serverResponses[destinationHost][commandCode][resultCode]=0;
        } else if(!serverResponses[destinationHost][commandCode]){
            serverResponses[destinationHost][commandCode]={};
            serverResponses[destinationHost][commandCode][resultCode]=0;
        } else if(!serverResponses[destinationHost][commandCode][resultCode]){
            serverResponses[destinationHost][commandCode][resultCode]=0;
        }
        serverResponses[destinationHost][commandCode][resultCode]++;
    };

    stats.incrementClientRequest = function (destinationHost, commandCode) {
        var clientRequests = stats.clientRequests;
        // Create path if does not exist
        if(!clientRequests[destinationHost]){
            clientRequests[destinationHost]={};
            clientRequests[destinationHost][commandCode]=0;
        } else if(!clientRequests[destinationHost][commandCode]){
            clientRequests[destinationHost][commandCode]=0;
        }
        clientRequests[destinationHost][commandCode]++;
    };

    stats.incrementClientResponse = function (destinationHost, commandCode, resultCode) {
        var clientResponses = stats.clientResponses;
        // Create path if does not exist
        if(!clientResponses[destinationHost]){
            clientResponses[destinationHost]={};
            clientResponses[destinationHost][commandCode]={};
            clientResponses[destinationHost][commandCode][resultCode]=0;
        } else if(!clientResponses[destinationHost][commandCode]){
            clientResponses[destinationHost][commandCode]={};
            clientResponses[destinationHost][commandCode][resultCode]=0;
        } else if(!clientResponses[destinationHost][commandCode][resultCode]){
            clientResponses[destinationHost][commandCode][resultCode]=0;
        }
        clientResponses[destinationHost][commandCode][resultCode]++;
    };

};

var s=createStats();
exports.stats=s;
