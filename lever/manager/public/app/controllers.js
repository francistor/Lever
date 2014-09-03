var dmanagerControllers=angular.module('dmanagerControllers', []);

// Basic Diameter configuration
dmanagerControllers.controller("BasicConfigController", ['$scope', '$http', function($scope, $http){
		
		var diameterConfig;
		$http.get("/dyn/get/diameterConfiguration").success(function(data){
			$scope.diameterConfig=data;
		}).error(function(data){
			alert("Error: "+data);
		});
		
		$scope.diameterConfig=diameterConfig;
	}]);
	
// Peers configuration
dmanagerControllers.controller("PeersConfigController", ['$scope', '$http', function($scope, $http){

		$scope.diameterConfig={};
		
		$http.get("/dyn/get/diameterConfiguration").success(function(data){
			$scope.diameterConfig=data;
		}).error(function(data){
			alert("Error: "+data);
		});
		
		// Deletes the peer with the specified originHost
		$scope.deletePeer=function(name){
			var peers=$scope.diameterConfig.peers;
			if(!peers) return;
			
			var i;
			for(i=0; i<peers.length; i++){
				if(peers[i].name===name){
					peers.splice(i, 1);
					break;
				}
			}
		}
		
		// Adds a new, empty peer
		$scope.addPeer=function(){
			var peers=$scope.diameterConfig.peers;
			if(peers) peers.push({"name":"New peer", "originHost":"-"});
		}
		
		$scope.showJSON=function(){
			alert(JSON.stringify(diameterConfig, undefined, 2));
		}
	}]);
	