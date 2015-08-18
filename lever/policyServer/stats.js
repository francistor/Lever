// Holds Diameter statistics
// host -> command [-> resultCode (for responses)]

// serverRequests[originHost][commandCode]
// serverResponses[destinationHost][commandCode][resultCode]
// clientRequests[originHost][commandCode]
// clientResponses[destinationHost][commandCode][resultCode]
// serverErrors[originHost][commandCode]
// clientErrors[originHost][commandCode]

var createDiameterStats = function () {
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

var createRadiusStats=function(){

    var stats={};

    // Server
    stats.serverAccessRequests={};
    stats.serverAccessAccepts={};
    stats.serverAccessRejects={};

    stats.serverAccountingRequests={};
    stats.serverAccountingResponses={};

    stats.serverCoARequests={};
    stats.serverCoAAccepts={};
    stats.serverCoARejects={};

    stats.serverOtherRequests={};
    stats.serverOtherResponses={};

    // Client
    stats.clientAccessRequests={};
    stats.clientAccessAccepts={};
    stats.clientAccessRejects={};
    stats.clientAccessTimeouts={};

    stats.clientAccountingRequests={};
    stats.clientAccountingResponses={};
    stats.clientAccountingTimeouts={};

    stats.clientCoARequests={};
    stats.clientCoAAccepts={};
    stats.clientCoARejects={};
    stats.clientCoATimeouts={};

    stats.clientOtherRequests={};
    stats.clientOtherResponses={};
    stats.clientOtherTimeouts={};

    stats.serverErrors={};
    stats.clientErrors={};

    stats.incrementServerAccessRequest=function(clientName) {
        stats.serverAccessRequests[clientName]= (stats.serverAccessRequests[clientName]||0)+1;
    };

    stats.incrementServerAccessAccept=function(clientName) {
        stats.serverAccessAccepts[clientName]= (stats.serverAccessAccepts[clientName]||0)+1;
    };

    stats.incrementServerAccessReject=function(clientName) {
        stats.serverAccessRejects[clientName]= (stats.serverAccessRejects[clientName]||0)+1;
    };

    stats.incrementServerAccountingRequest=function(clientName) {
        stats.serverAccountingRequests[clientName]= (stats.serverAccountingRequests[clientName]||0)+1;
    };

    stats.incrementServerAccountingResponse=function(clientName) {
        stats.serverAccountingResponses[clientName]= (stats.serverAccountingResponses[clientName]||0)+1;
    };

    stats.incrementServerCoARequest=function(clientName) {
        stats.serverCoARequests[clientName]= (stats.serverCoARequests[clientName]||0)+1;
    };

    stats.incrementServerCoAAccept=function(clientName) {
        stats.serverCoAAccepts[clientName]= (stats.serverCoAAccepts[clientName]||0)+1;
    };

    stats.incrementServerCoAReject=function(clientName) {
        stats.serverCoARejects[clientName]= (stats.serverCoARejects[clientName]||0)+1;
    };

    stats.incrementServerOtherRequest=function(clientName) {
        stats.serverOtherRequests[clientName]= (stats.serverOtherRequests[clientName]||0)+1;
    };

    stats.incrementServerOtherResponse=function(clientName) {
        stats.serverOtherResponses[clientName]= (stats.serverOtherResponses[clientName]||0)+1;
    };

    stats.incrementClientAccessRequest=function(ipAddress) {
        stats.clientAccessRequests[ipAddress]= (stats.clientAccessRequests[ipAddress]||0)+1;
    };

    stats.incrementClientAccessAccept=function(ipAddress) {
        stats.clientAccessAccepts[ipAddress]= (stats.clientAccessAccepts[ipAddress]||0)+1;
    };

    stats.incrementClientAccessReject=function(ipAddress) {
        stats.clientAccessRejects[ipAddress]= (stats.clientAccessRejects[ipAddress]||0)+1;
    };

    stats.incrementClientAccessTimeout=function(ipAddress) {
        stats.clientAccessTimeouts[ipAddress]= (stats.clientAccessTimeouts[ipAddress]||0)+1;
    };

    stats.incrementClientAccountingRequest=function(ipAddress) {
        stats.clientAccountingRequests[ipAddress]= (stats.clientAccountingRequests[ipAddress]||0)+1;
    };

    stats.incrementClientAccountingResponse=function(ipAddress) {
        stats.clientAccountingResponses[ipAddress]= (stats.clientAccountingResponses[ipAddress]||0)+1;
    };

    stats.incrementClientAccountingTimeout=function(ipAddress) {
        stats.clientAccountingTimeouts[ipAddress]= (stats.clientAccountingTimeouts[ipAddress]||0)+1;
    };

    stats.incrementClientCoARequest=function(ipAddress) {
        stats.clientCoARequests[ipAddress]= (stats.clientCoARequests[ipAddress]||0)+1;
    };

    stats.incrementClientCoAAccept=function(ipAddress) {
        stats.clientCoAAccepts[ipAddress]= (stats.clientCoAAccepts[ipAddress]||0)+1;
    };

    stats.incrementClientCoAReject=function(ipAddress) {
        stats.clientCoARejects[ipAddress]= (stats.clientCoARejects[ipAddress]||0)+1;
    };

    stats.incrementClientCoATimeout=function(ipAddress) {
        stats.clientCoATimeouts[ipAddress]= (stats.clientCoATimeouts[ipAddress]||0)+1;
    };

    stats.incrementClientOtherRequest=function(ipAddress) {
        stats.clientOtherRequests[ipAddress]= (stats.clientOtherRequests[ipAddress]||0)+1;
    };

    stats.incrementClientOtherResponse=function(ipAddress) {
        stats.clientOtherResponses[ipAddress]= (stats.clientOtherResponses[ipAddress]||0)+1;
    };

    stats.incrementClientOtherTimeout=function(ipAddress) {
        stats.clientOtherTimeouts[ipAddress]= (stats.clientOtherTimeouts[ipAddress]||0)+1;
    };

    stats.incrementServerError=function(clientName) {
        stats.serverErrors[clientName]= (stats.serverErrors[clientName]||0)+1;
    };

    stats.incrementClientError=function(ipAddress) {
        stats.clientErrors[ipAddress]= (stats.clientErrors[ipAddress]||0)+1;
    };

    // Helper functions
    stats.incrementServerRequest=function(clientName, code){
        if(code.substring(0, 6)=="Access") stats.incrementServerAccessRequest(clientName);
        else if(code.substring(0, 10)==("Accounting")) stats.incrementServerAccountingRequest(clientName);
        else if(code.substring(0, 3)=="CoA") stats.incrementServerCoARequest(clientName);
        else stats.incrementServerOtherRequest(clientName);
    };

    stats.incrementServerResponse=function(clientName, code){
        if(code=="Access-Accept") stats.incrementServerAccessAccept(clientName);
        else if(code=="Access-Reject") stats.incrementServerAccessReject(clientName);
        else if(code=="Accounting-Response") stats.incrementServerAccountingResponse(clientName);
        else if(code=="CoA-ACK") stats.incrementServerCoAAccept(clientName);
        else if(code=="CoA-NAK") stats.incrementServerCoAReject(clientName);
    };

    stats.incrementClientRequest=function(ipAddress, code){
        if(code.substring(0, 6)=="Access") stats.incrementClientAccessRequest(ipAddress);
        else if(code.substring(0, 10)=="Accounting") stats.incrementClientAccountingRequest(ipAddress);
        else if(code.substring(0, 3)=="CoA") stats.incrementClientCoARequest(ipAddress);
        else stats.incrementClientOtherRequest(ipAddress);
    };

    stats.incrementClientResponse=function(ipAddress, code){
        if(code=="Access-Accept") stats.incrementClientAccessAccept(ipAddress);
        else if(code=="Access-Reject") stats.incrementClientAccessReject(ipAddress);
        else if(code=="Accounting-Response") stats.incrementClientAccountingResponse(ipAddress);
        else if(code=="CoA-ACK ") stats.incrementClientCoAAccept(ipAddress);
        else if(code=="CoA-NAK") stats.incrementClientCoAReject(ipAddress);
        else stats.incrementClientOtherResponse(ipAddress);
    };

    stats.incrementClientTimeout=function(ipAddress, code){
        if(code.substring(0, 6)=="Access") stats.incrementClientAccessTimeout(ipAddress);
        else if(code.substring(0, 10)=="Accounting") stats.incrementClientAccountingTimeout(ipAddress);
        else if(code.substring(0, 3)=="CoA") stats.incrementClientCoATimeout(ipAddress);
        else stats.incrementClientOtherTimeout(ipAddress);
    };


    return stats;
};

exports.diameterStats=createDiameterStats();
exports.radiusStats=createRadiusStats();
