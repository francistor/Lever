var managerControllers=angular.module('managerControllers', []);

var requestTimeout=2000;

var genericShowError=function(st){
    if(!st) st="Error: No response from server";
    console.error(st);
    bootbox.alert(st);
}

// List of modes
managerControllers.controller("NodeListController", ['$scope', '$http', function($scope, $http){

    $scope.nodes=[];

    // Populate list of nodes
    $http.get("/dyn/config/nodeList", {timeout: requestTimeout})
        .success(function(data){
            $scope.nodes=data;
        }).error(function(data, status, headers, config, statusText){
            genericShowError(statusText);
        })
}]);
	
// Diameter configuration
managerControllers.controller("DiameterConfigController", ['$scope', '$http', '$routeParams', function($scope, $http, $routeParams){

		$scope.diameterConfig={};
        $scope.isDisabled=false;

        // Get diameterConfig
		$http.get("/dyn/config/diameterConfiguration/"+$routeParams.serverName, {timeout: requestTimeout})
            .success(function(data){
			$scope.diameterConfig=data;
		}).error(function(data, status, headers, config, statusText){
            genericShowError(statusText);
		});
		
		// Deletes the peer with the specified originHost
		$scope.deletePeer=function(name){
			var peers=$scope.diameterConfig["peers"];
			if(!peers) return;
			
			var i;
			for(i=0; i<peers.length; i++){
				if(peers[i].name===name){
					peers.splice(i, 1);
					break;
				}
			}
		};
		
		// Adds a new, empty peer
		$scope.addPeer=function(){
			var peers=$scope.diameterConfig["peers"];
			if(peers) peers.push({"name":"New peer", "originHost":"-"});
		};

        // Saves the diameterConfiguration
        $scope.updateDiameterConfig=function(){
            if(!$scope.diameterConfig) return;
            $scope.isDisabled=true;

            // Update version of diameter config
            $scope.diameterConfig["_version"]++;
            // Post update
            $http.post("/dyn/config/diameterConfiguration", $scope.diameterConfig, {timeout: requestTimeout})
                .success(function(data){
                    if(data.error){
                        console.error(data);
                        bootbox.alert(data);
                    }
                    else bootbox.alert("Configuration updated.");

                    $scope.isDisabled=false;
                })
                .error(function(data, status, headers, config, statusText){
                    genericShowError(statusText);
                    $scope.isDisabled=false;
                });
        };
		
		$scope.showJSON=function(){
			alert(JSON.stringify($scope.diameterConfig, undefined, 2));
		}
	}]);

// Diameter Dictionary
managerControllers.controller("DiameterDictionaryController", ['$scope', '$http', function($scope, $http){

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

    $http.get("/dyn/config/diameterDictionary", {timeout: requestTimeout})
        .success(function(data){
            for (vendor in data.vendor) {
                if (data.vendor.hasOwnProperty(vendor)) $scope.vendors.push(vendor);
            }
            $scope.diameterDictionary = data;
        })
        .error(function(data, status, headers, config, statusText){
            genericShowError(statusText);
        });
}]);