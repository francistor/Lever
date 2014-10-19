var managerApp=angular.module("managerApp", ['ngRoute', 'managerControllers']);

managerApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/node/:serverName', {
        templateUrl: 'partials/node.html',
        controller: 'DiameterConfigController'
      }).when('/diameterDictionary', {
        templateUrl: 'partials/diameterDictionary.html',
        controller: 'DiameterDictionaryController'
      }).when('/radiusDictionary', {
        templateUrl: 'partials/radiusDictionary.html',
        controller: 'RadiusDictionaryController'
      }).when('/dashboard', {
        templateUrl: 'partials/dashboard.html'
      }).otherwise({
		redirectTo: '/dashboard'
      });
  }]);
