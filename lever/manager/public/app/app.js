var dmanagerApp=angular.module("dmanagerApp", ['ngRoute', 'dmanagerControllers']);

dmanagerApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/configBasic', {
        templateUrl: 'partials/configBasic.html',
        controller: 'BasicConfigController'
      }).when('/configPeers', {
        templateUrl: 'partials/configPeers.html',
        controller: 'PeersConfigController'
      }).when('/dashboard', {
        templateUrl: 'partials/dashboard.html'
      }).otherwise({
		redirectTo: '/dashboard'
      });
  }]);
