var managerControllers=angular.module('managerControllers', []);

var requestTimeout=2000;
	
// Peers configuration
managerControllers.controller("DiameterConfigController", ['$scope', '$http', function($scope, $http){

		$scope.diameterConfig={};

        // Get diameterConfig
		$http.get("/dyn/config/diameterConfiguration", {timeout: requestTimeout})
            .success(function(data){
			$scope.diameterConfig=data;
		}).error(function(data){
			alert("Error: "+data);
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
            $http.post("/dyn/config/diameterConfiguration", $scope.diameterConfig, {timeout: requestTimeout})
                .success(function(data){
                    if(data.error) alert(data.error);
                })
                .error(function(data){
                    alert("No response from server");
                });
        };
		
		$scope.showJSON=function(){
			alert(JSON.stringify($scope.diameterConfig, undefined, 2));
		}
	}]);
	