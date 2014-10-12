// Holds Diameter statistics
// host -> command [-> resultCode (for responses)]

// serverRequests[originHost][commandCode]
// serverResponses[destinationHost][commandCode][resultCode]
// clientRequests[originHost][commandCode]
// clientResponses[destinationHost][commandCode][resultCode]

var createStats;
createStats = function () {
    var stats = {};
    stats.serverRequests = {};
    stats.serverResponses = {};
    stats.clientRequests = {};
    stats.clientResponses = {};
    stats.serverErrors = {};
    stats.clientErrors = {};

    stats.incrementServerRequest = function (originHost, commandCode) {
        var serverRequests = stats.serverRequests;
        // Create path if does not exist
        if(!serverRequests[originHost]){
            serverRequests[originHost]={};
            serverRequests[originHost][commandCode]=0;
        } else if(!serverRequests[originHost][commandCode]){
            serverRequests[originHost][commandCode]=0;
        }
        serverRequests[originHost][commandCode]++;
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

    stats.incrementClientRequest = function (originHost, commandCode) {
        var clientRequests = stats.clientRequests;
        // Create path if does not exist
        if(!clientRequests[originHost]){
            clientRequests[originHost]={};
            clientRequests[originHost][commandCode]=0;
        } else if(!clientRequests[originHost][commandCode]){
            clientRequests[originHost][commandCode]=0;
        }
        clientRequests[originHost][commandCode]++;
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

    stats.incrementServerError=function(originHost, commandCode){
        var serverErrors=stats.serverErrors;
        // Create path if does not exist
        if(!serverErrors[originHost]){
            serverErrors[originHost]={};
            serverErrors[originHost][commandCode]=0;
        }
        else if(!serverErrors[originHost][commandCode]){
            serverErrors[originHost][commandCode]=0;
        }
        serverErrors[originHost][commandCode]++;
    };

    stats.incrementClientError=function(destinationHost, commandCode){
        var clientErrors=stats.clientErrors;
        // Create path if does not exist
        if(!clientErrors[destinationHost]){
            clientErrors[destinationHost]={};
            clientErrors[destinationHost][commandCode]=0;
        }
        else if(!clientErrors[destinationHost][commandCode]){
            clientErrors[destinationHost][commandCode]=0;
        }
        clientErrors[destinationHost][commandCode]++;
    };

    return stats;
};

var s=createStats();
exports.stats=s;
