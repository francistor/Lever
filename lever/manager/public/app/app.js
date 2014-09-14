var managerApp=angular.module("managerApp", ['ngRoute', 'managerControllers']);

managerApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/configDiameterBasic', {
        templateUrl: 'partials/configDiameterBasic.html',
        controller: 'DiameterConfigController'
      }).when('/configDiameterPeers', {
        templateUrl: 'partials/configDiameterPeers.html',
        controller: 'DiameterConfigController'
      }).when('/dashboard', {
        templateUrl: 'partials/dashboard.html'
      }).otherwise({
		redirectTo: '/dashboard'
      });
  }]);
