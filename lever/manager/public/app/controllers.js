var managerControllers=angular.module('managerControllers', []);

var requestTimeout=2000;

// List of nodes
managerControllers.controller("NodeListController", ['$scope', '$http', 'niceAlert', function($scope, $http, niceAlert){

    $scope.nodes=[];

    // Populate list of nodes
    $http.get("/dyn/config/nodeList", {timeout: requestTimeout})
        .success(function(data){
            $scope.nodes=data;
        }).error(function(data, status, headers, config, statusText){
            niceAlert.error(data);
        })
}]);
	
// Diameter configuration
managerControllers.controller("NodeConfigController", ['$scope', '$http', '$routeParams', 'niceAlert', function($scope, $http, $routeParams, niceAlert){

		$scope.nodeConfig={};

        // Get diameterConfig
        $http({
            method  : 'GET',
            url     : "/dyn/node/"+$routeParams.hostName+"/nodeConfiguration",
            timeout: requestTimeout
        }).success(function(data){
            $scope.nodeConfig=data;
        }).error(function(data, status, headers, config, statusText){
            // Shows inline error message
            niceAlert.error(data);
        });

		// Deletes the peer with the specified index
		$scope.deletePeer=function(index){
            $scope.nodeConfig.diameter["peers"].splice(index, 1);
		};
		
		// Adds a new, empty peer
		$scope.addPeer=function(){
			var peers=$scope.nodeConfig.diameterConfig["peers"];
			if(peers) peers.push({"name":"New_peer", "diameterHost":"-"});
		};

        // Adds a new entry in the routing table
        $scope.addRoute=function(){
            $scope.nodeConfig.diameter["routes"].push({realm:"New_realm", applicationId:"New_ApplicationId", peers:[], policy:"fixed"});
        };

        // Deletes a route
        $scope.deleteRoute=function(index){
            $scope.nodeConfig.diameter["routes"].splice(index, 1);
        };

        // Saves the node
        $scope.updateNodeConfig=function(){
            if(!$scope.nodeConfig) return;

            // Update version of diameter config
            $scope.nodeConfig["_version"]++;
            // Post update
            $http({
                method  : 'POST',
                url     : "/dyn/config/nodeConfiguration",
                data    : $scope.nodeConfig,
                timeout: requestTimeout
            }).success(function(data){
                niceAlert.info("Configuration updated.");
            }).error(function(data, status, headers, config, statusText){
                // Shows inline error message
                niceAlert.error(data);
            });
        };

        // Deletes the radius client with the specified index
        $scope.deleteClient=function(index){
            $scope.nodeConfig.radius["clients"].splice(index, 1);
        };

        // Adds a new, empty radius client
        $scope.addClient=function(){
            var clients=$scope.nodeConfig.radius["clients"];
            if(clients) clients.push({"name":"New_Client", "IPAddress":"127.0.0.1", "secret":"secret", "class": ""});
        };
	}]);

// Diameter Dictionary
managerControllers.controller("DiameterDictionaryController", ['$scope', '$http', 'niceAlert', function($scope, $http, $niceAlert){

    $scope.diameterDictionary={};
    $scope.vendors=[];
    $scope.types=[
        {name: 'Unsigned32', type:'Unsigned32'},
        {name: 'Enumerated', type:'Enumerated'},
        {name: 'OctectString', type:'OctectString'},
        {name: 'DiamIdent', type:'DiamIdent'},
        {name: 'UTF8String', type:'UTF8String'},
        {name: 'Address', type:'Address'},
        {name: 'Grouped', type:'Grouped'}
    ];

    $http({
        method  : 'GET',
        url     : "/dyn/config/diameterDictionary",
        timeout: requestTimeout
    }).success(function(data){
        // Add default vendor
        data.vendor["0"]="Standard";
        // Add rest of vendors
        for (vendor in data.vendor) {
            if (data.vendor.hasOwnProperty(vendor)) $scope.vendors.push(vendor);
        }
        $scope.diameterDictionary = data;
    }).error(function(data, status, headers, config, statusText){
        // Shows inline error message
        niceAlert.error(data);
    });
}]);

// Node statistics
managerControllers.controller("NodeStatsController", ['$scope', '$http', '$routeParams', 'niceAlert', function($scope, $http, $routeParams, niceAlert){

    $scope.diameterStats=[];
    $scope.radiusStats=[];
    $scope.connections=[];

    $http({
        method  : 'GET',
        url     : "/dyn/node/"+$routeParams.hostName+"/agent/getPeerStatus",
        timeout: requestTimeout
    }).success(function(data){
        $scope.connections=data;
    }).error(function(data, status, headers, config, statusText){
        // Shows inline error message
        niceAlert.error(data);
    });

    // Get diameter statistics
    $http({
        method  : 'GET',
        url     : "/dyn/node/"+$routeParams.hostName+"/agent/getDiameterStats",
        timeout: requestTimeout
    }).success(function(data){

        // Need to compose a tree like this
        /*
        {label: <first level label>, children:[
            {label: <second level label>, children:[...]}, ...
            ]
         */
        var originHost;
        var commandCode;
        var resultCode;
        var oH, cC, rC;

        var sReq={label: "Server Requests", children:[]};
        for(originHost in data.serverRequests) if(data.serverRequests.hasOwnProperty(originHost)){
            oH={label: originHost, children:[]};
            sReq.children.push(oH);
            for(commandCode in data.serverRequests[originHost]) if(data.serverRequests[originHost].hasOwnProperty(commandCode)){
                cC={label: commandCode+" "+data.serverRequests[originHost][commandCode]};
                oH.children.push(cC);
            }
        }

        var sRes={label: "Server Responses", children:[]};
        for(originHost in data.serverResponses) if(data.serverResponses.hasOwnProperty(originHost)){
            oH={label: originHost, children:[]};
            sRes.children.push(oH);
            for(commandCode in data.serverResponses[originHost]) if(data.serverResponses[originHost].hasOwnProperty(commandCode)){
                cC={label: commandCode, children:[]};
                oH.children.push(cC);
                for(resultCode in data.serverResponses[originHost][commandCode]) if(data.serverResponses[originHost][commandCode].hasOwnProperty(resultCode)){
                    rC={label: resultCode+" "+data.serverResponses[originHost][commandCode][resultCode]};
                    cC.children.push(rC);
                }
            }
        }

        var cReq={label: "Client Requests", children:[]};
        for(originHost in data.clientRequests) if(data.clientRequests.hasOwnProperty(originHost)){
            oH={label: originHost, children:[]};
            cReq.children.push(oH);
            for(commandCode in data.clientRequests[originHost]) if(data.clientRequests[originHost].hasOwnProperty(commandCode)){
                cC={label: commandCode+" "+data.clientRequests[originHost][commandCode]};
                oH.children.push(cC);
            }
        }

        var cRes={label: "Client Responses", children:[]};
        for(originHost in data.clientResponses) if(data.clientResponses.hasOwnProperty(originHost)){
            oH={label: originHost, children:[]};
            cRes.children.push(oH);
            for(commandCode in data.clientResponses[originHost]) if(data.clientResponses[originHost].hasOwnProperty(commandCode)){
                cC={label: commandCode, children:[]};
                oH.children.push(cC);
                for(resultCode in data.clientResponses[originHost][commandCode]) if(data.clientResponses[originHost][commandCode].hasOwnProperty(resultCode)){
                    rC={label: resultCode+" "+data.clientResponses[originHost][commandCode][resultCode]};
                    cC.children.push(rC);
                }
            }
        }

        var sErr={label: "Server Errors", children:[]};
        for(originHost in data.serverErrors) if(data.serverErrors.hasOwnProperty(originHost)){
            oH={label: originHost, children:[]};
            sErr.children.push(oH);
            for(commandCode in data.serverErrors[originHost]) if(data.serverErrors[originHost].hasOwnProperty(commandCode)){
                cC={label: commandCode+" "+data.serverErrors[originHost][commandCode]};
                oH.children.push(cC);
            }
        }

        var cErr={label: "Client Errors", children:[]};
        for(originHost in data.clientErrors) if(data.clientErrors.hasOwnProperty(originHost)){
            oH={label: originHost, children:[]};
            cErr.children.push(oH);
            for(commandCode in data.clientErrors[originHost]) if(data.clientErrors[originHost].hasOwnProperty(commandCode)){
                cC={label: commandCode+" "+data.clientErrors[originHost][commandCode]};
                oH.children.push(cC);
            }
        }

        $scope.diameterStats.push(sReq);
        $scope.diameterStats.push(sRes);
        $scope.diameterStats.push(cReq);
        $scope.diameterStats.push(cRes);
        $scope.diameterStats.push(sErr);
        $scope.diameterStats.push(cErr);

    }).error(function(data, status, headers, config, statusText){
        // Shows inline error message
        niceAlert.error(data);
    });

    // Get radius statistics
    $http({
        method  : 'GET',
        url     : "/dyn/node/"+$routeParams.hostName+"/agent/getRadiusStats",
        timeout: requestTimeout
    }).success(function(data){

        // Need to compose a tree like this
        /*
         {label: <first level label>, children:[
         {label: <second level label>, children:[...]}, ...
         ]
         */
        var clientName;
        var ipAddress;

        var sAccessRequests={label: "Server Access Requests", children:[]};
        for(clientName in data.serverAccessRequests) if(data.serverAccessRequests.hasOwnProperty(clientName)){
            sAccessRequests.children.push({label: clientName+" "+data.serverAccessRequests[clientName]});
        }

        var sAccessAccepts={label: "Server Access Accepts", children:[]};
        for(clientName in data.serverAccessAccepts) if(data.serverAccessAccepts.hasOwnProperty(clientName)){
            sAccessAccepts.children.push({label: clientName+" "+data.serverAccessAccepts[clientName]});
        }

        var sAccessRejects={label: "Server Access Rejects", children:[]};
        for(clientName in data.serverAccessRejects) if(data.serverAccessRejects.hasOwnProperty(clientName)){
            sAccessRejects.children.push({label: clientName+" "+data.serverAccessRejects[clientName]});
        }

        var sAccountingRequests={label: "Server Accounting Requests", children:[]};
        for(clientName in data.serverAccountingRequests) if(data.serverAccountingRequests.hasOwnProperty(clientName)){
            sAccountingRequests.children.push({label: clientName+" "+data.serverAccountingRequests[clientName]});
        }

        var sAccountingResponses={label: "Server Accounting Responses", children:[]};
        for(clientName in data.serverAccountingResponses) if(data.serverAccountingResponses.hasOwnProperty(clientName)){
            sAccountingResponses.children.push({label: clientName+" "+data.serverAccountingResponses[clientName]});
        }

        var cAccessRequests={label: "Client Access Requests", children:[]};
        for(ipAddress in data.clientAccessRequests) if(data.clientAccessRequests.hasOwnProperty(ipAddress)){
            cAccessRequests.children.push({label: ipAddress+" "+data.clientAccessRequests[ipAddress]});
        }

        var cAccessAccepts={label: "Client Access Accepts", children:[]};
        for(ipAddress in data.clientAccessAccepts) if(data.clientAccessAccepts.hasOwnProperty(ipAddress)){
            cAccessAccepts.children.push({label: ipAddress+" "+data.clientAccessAccepts[ipAddress]});
        }

        var cAccessRejects={label: "Client Access Rejects", children:[]};
        for(ipAddress in data.clientAccessRejects) if(data.clientAccessRejects.hasOwnProperty(ipAddress)){
            cAccessRejects.children.push({label: ipAddress+" "+data.clientAccessRejects[ipAddress]});
        }

        var cAccountingRequests={label: "Client Accounting Requests", children:[]};
        for(ipAddress in data.clientAccountingRequests) if(data.clientAccountingRequests.hasOwnProperty(ipAddress)){
            cAccountingRequests.children.push({label: ipAddress+" "+data.clientAccountingRequests[ipAddress]});
        }

        var cAccountingResponses={label: "Client Accounting Responses", children:[]};
        for(ipAddress in data.clientAccountingResponses) if(data.clientAccountingResponses.hasOwnProperty(ipAddress)){
            cAccountingResponses.children.push({label: ipAddress+" "+data.clientAccountingResponses[ipAddress]});
        }

        var cCoARequests={label: "Client CoA Requests", children:[]};
        for(ipAddress in data.clientCoARequests) if(data.clientCoARequests.hasOwnProperty(ipAddress)){
            cCoARequests.children.push({label: ipAddress+" "+data.clientCoARequests[ipAddress]});
        }

        var cCoAAccepts={label: "Client CoA Accepts", children:[]};
        for(ipAddress in data.clientCoAAccepts) if(data.clientCoAAccepts.hasOwnProperty(ipAddress)){
            cCoAAccepts.children.push({label: ipAddress+" "+data.clientCoAAccepts[ipAddress]});
        }

        var cCoARejects={label: "Client CoA Rejects", children:[]};
        for(ipAddress in data.clientCoARejects) if(data.clientCoARejects.hasOwnProperty(ipAddress)){
            cCoARejects.children.push({label: ipAddress+" "+data.clientCoARejects[ipAddress]});
        }

        var sErrors={label: "Server Errors", children:[]};
        for(clientName in data.serverErrors) if(data.serverErrors.hasOwnProperty(clientName)){
            sErrors.children.push({label: clientName+" "+data.serverErrors[clientName]});
        }

        var cErrors={label: "Client errors", children:[]};
        for(ipAddress in data.clientErrors) if(data.clientErrors.hasOwnProperty(ipAddress)){
            cErrors.children.push({label: ipAddress+" "+data.clientErrors[ipAddress]});
        }

        $scope.radiusStats.push(sAccessRequests);
        $scope.radiusStats.push(sAccessAccepts);
        $scope.radiusStats.push(sAccessRejects);
        $scope.radiusStats.push(sAccountingRequests);
        $scope.radiusStats.push(sAccountingResponses);
        $scope.radiusStats.push(cAccessRequests);
        $scope.radiusStats.push(cAccessAccepts);
        $scope.radiusStats.push(cAccessRejects);
        $scope.radiusStats.push(cAccountingRequests);
        $scope.radiusStats.push(cAccountingResponses);
        $scope.radiusStats.push(cCoARequests);
        $scope.radiusStats.push(cCoAAccepts);
        $scope.radiusStats.push(cCoARejects);
        $scope.radiusStats.push(sErrors);
        $scope.radiusStats.push(cErrors);


    }).error(function(data, status, headers, config, statusText){
        // Shows inline error message
        niceAlert.error(data);
    });
}]);

managerControllers.controller('ClientController', ['$scope', '$http', 'niceAlert', function($scope, $http, niceAlert){

    // Initialize objects
    $scope.clientData={};
    $scope.searchData={phone: "999999994"};

    $scope.getFullClientContext=function(){
        $http({
            method  : 'POST',
            url : '/dyn/clients/getFullClientData',
            data    : $scope.searchData,
            timeout: requestTimeout
        }).success(function(data){
            if(!data.client) niceAlert.info("Client not found");
            else{
                $scope.client=data.client;
                $scope.pointsOfUsage=data.pointsOfUsage;
                $scope.plan=data.plan;

                // Iterate through services in the plan
            }
        }).error(function(data, status, headers, config, statusText){
            // Shows error message
            niceAlert.error(data);
        });
    };

    $scope.updateClient=function(){
        $scope.client.provision["_version"]++;
        $http({
            method  : 'POST',
            url : '/dyn/clients/updateClientProvisionData',
            data    : $scope.client,
            timeout: requestTimeout
        }).success(function(data){
            niceAlert.info("Client updated.");
        }).error(function(data, status, headers, config, statusText){
            // Shows error message
            niceAlert.error(data);
        });
    };

    $scope.addPoU=function(pou){

        $http({
            method  : 'POST',
            url : '/dyn/clients/addPoU',
            data    : {pouType: $scope.pouType, pouValue: $scope.pouValue, clientId: $scope.client._id},
            timeout: requestTimeout
        }).success(function(data){
            niceAlert.info("Point of usage Added.");
            // TODO: Refresh page
        }).error(function(data, status, headers, config, statusText){
            // Shows error message
            niceAlert.error(data);
        });
    };

    $scope.getServiceCredit=function(serviceName){

    };

}]);