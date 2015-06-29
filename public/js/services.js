/* global angular, purl, Q */
angular.module("FriendMe")

.factory("user", function ($http) {
    var user = {},
        userPromise;
    user.info = undefined;
    user.getUser = function() {
        if (userPromise) {
            return userPromise;
        } else {
            userPromise = $http.get("/api/v1/user")
            .success(function (data) {
                if (data.user_id) {
                    user.info = data;
                }
                else {
                    user.info = false;
                }
            }).error(function() {
                user.info = false;
            }).then(function () {
                var visitorName = (user.info) ? user.info.email : "";
                user.ibmer = visitorName.match(/\.ibm\.com$/i) !== null;
            }).then(function() {
                userPromise = undefined;
            }).catch(function () {
                userPromise = undefined;
            });
            return userPromise;
        }
    };
    return user;
})
.factory("comparisons", function ($http) {
    var comparisons = {},
        comparisonsPromise;
    comparisons.info = undefined;
    comparisons.get = function() {
        if (comparisonsPromise) {
            return comparisonsPromise;
        } else {
            comparisonsPromise = $http.get("/api/v1/compare")
            .success(function (data) {
                if (!data.error) {
                    comparisons.info = data;
                }
                else {
                    comparisons.info = false;
                }
            }).error(function() {
                comparisons.info = false;
            }).then(function() {
                comparisonsPromise = undefined;
            }).catch(function () {
                comparisonsPromise = undefined;
            });
            return comparisonsPromise;
        }
    };
    return comparisons;
})
.factory("spaces", function ($http) {
    var orgs = {},
        orgsPromise;
    orgs.info = undefined;
    orgs.get = function() {
        if (orgsPromise) {
            return orgsPromise;
        } else {
            orgsPromise = $http.get("/api/v1/spaces")
            .success(function (data) {
                if (data.total_results) {
                    orgs.info = data;
                }
                else {
                    orgs.info = false;
                }
            }).error(function() {
                orgs.info = false;
            }).then(function() {
                orgsPromise = undefined;
            }).catch(function () {
                orgsPromise = undefined;
            });
            return orgsPromise;
        }
    };
    return orgs;
});
