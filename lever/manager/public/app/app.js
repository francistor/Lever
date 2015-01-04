var managerApp=angular.module("managerApp", ['ngRoute', 'managerControllers', 'angularBootstrapNavTree']);

managerApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/node/:hostName', {
        templateUrl: 'partials/node.html',
        controller: 'NodeConfigController'
      }).when('/nodeStats/:hostName', {
          templateUrl: 'partials/nodeStats.html',
          controller: 'NodeStatsController'
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


/**
 * Helper function to show bootbox alerts.
 *
 * The factory returns an object and will
 * be instantiated only once in application life
 */
managerApp.factory("niceAlert", function(){
    var infoOptions={
            title: "Completed",
            buttons: {
                success: {
                    label: "OK",
                    className: "btn-success"
                }
            }
        },
        errorOptions={
            title: "Error",
            buttons: {
                failure: {
                    label: "OK",
                    className: "btn-danger"
                }
            }
        };

    return {
        info: function(msg){
            if(msg) infoOptions.message=msg; else infoOptions.message="Done!";
            bootbox.dialog(infoOptions);
        },
        error: function(msg){
            if(msg) errorOptions.message=msg; else errorOptions.message="Error!";
            bootbox.dialog(errorOptions);
        }
    }
});

