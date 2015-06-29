/* global angular */

var underscore = angular.module('underscore', []);
underscore.factory('_', function() {
  return window._; // assumes underscore has already been loaded on the page
});

angular.module("FriendMe", ["underscore"]);

angular.element(document).ready(function () {
    angular.bootstrap(document, ["FriendMe"]);
});
