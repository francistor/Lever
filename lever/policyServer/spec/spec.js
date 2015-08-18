var request=require('request');

var serverManagementUrl="http://localhost:9000/agent/";
var clientManagementUrl="http://localhost:9001/agent/";
var metaServerManagementUrl="http://localhost:9002/agent/";

var serverIPAddress="127.0.0.1";
var metaServerIPAddress="192.168.1.102";
var nonExistingServerIPAddress="1.0.0.1";

describe("Peers Testing / ", function() {

    describe("Client Peers", function(){
        it("Connected to test-server", function(done){
            request.get(clientManagementUrl+"getPeerStatus", function(error, response, body) {
                if(body){
                    expect(JSON.parse(body)).toContain({hostName: "test-server", state: "Open"});
                } else expect(body).toBeTruthy();
                done();
            });
        });
    });

    describe("Server Peers", function(){
        it("Connected to test-client and test-metaServer", function(done){
             request.get(serverManagementUrl+"getPeerStatus", function(error, response, body) {
                 if(body){
                     expect(JSON.parse(body)).toContain({hostName: "test-client", state: "Open"});
                     expect(JSON.parse(body)).toContain({hostName: "test-metaServer", state: "Open"});
                 } else expect(body).toBeTruthy();
                 done();
             });
        });
    });

    describe("MetaServer Peers", function(){
        it("Connected to test-server", function(done){
            request.get(metaServerManagementUrl+"getPeerStatus", function(error, response, body) {
                if(body){
                    expect(JSON.parse(body)).toContain({hostName: "test-server", state: "Open"});
                } else expect(body).toBeTruthy();
                done();
            });
        });
    });
});

describe("Radius packets", function(){
   describe("Client radius packets", function(done){
       request.get(clientManagementUrl+"getRadiusStats", function(error, response, body){
           if(body){
               var clientRadiusStats=JSON.parse(body);
               expect(clientRadiusStats.clientAccessRequests["serverIPAddress"]).toEqual(5);
               expect(clientRadiusStats.clientAccessRequests["nonExistingServerIPAddress"]).toEqual(1);
               expect(clientRadiusStats.clientAccessAccepts["serverIPAddress"]).toEqual(2);
               expect(clientRadiusStats.clientAccessRejects["serverIPAddress"]).toEqual(2);
               // Requests with timeout *
               expect(clientRadiusStats.clientAccessTimeouts["serverIPAddress"]).toEqual(2);
               // ErrorThreshold
               expect(clientRadiusStats.clientAccessTimeouts["nonExistingServerIPAddress"]).toEqual(2);
           } else expect(body).toBeTruthy();
           done();
       });
   });
});