var managerControllers=angular.module('managerControllers', []);

var requestTimeout=2000;

var genericShowError=function(st){
    if(!st) st="Error: No response from server";
    console.error(st);
    bootbox.alert(st);
}

// List of modes
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
        $scope.isDisabled=false;

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
            $scope.isDisabled=true;

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

    $scope.stats=[];
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

    $http({
        method  : 'GET',
        url     : "/dyn/node/"+$routeParams.hostName+"/agent/getDiameterStats",
        timeout: requestTimeout
    }).success(function(data){

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

        $scope.stats.push(sReq);
        $scope.stats.push(sRes);
        $scope.stats.push(cReq);
        $scope.stats.push(cRes);
        $scope.stats.push(sErr);
        $scope.stats.push(cErr);

    }).error(function(data, status, headers, config, statusText){
        // Shows inline error message
        niceAlert.error(data);
    });
}]);