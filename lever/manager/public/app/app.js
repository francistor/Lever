var managerApp=angular.module("managerApp", ['ngRoute', 'managerControllers', 'angularBootstrapNavTree', 'xeditable']);

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
      }).when('/clients', {
         templateUrl: 'partials/client.html',
         controller: 'ClientController'
      }).otherwise({
         redirectTo: '/dashboard'
      });
  }]);

// xeditable initialization
managerApp.run(function(editableOptions) {
    editableOptions.theme = 'bs3'; // bootstrap3 theme. Can be also 'bs2', 'default'
});


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
                    label: "Error",
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

managerApp.filter('formatResource',function(){
    return function(value, units){
        if(!value) return "-";
        if(units=="GB") return Math.round(value/(1024*1024*1024))+"GB";
        if(units=="MB") return Math.round(value/(1024*1024))+"GB";
        if(units=="H") return Math.round(value/(3600))+" Hours";
        if(units=="H") return Math.round(value/(86400))+" Days";
        else return value;
    }
});

