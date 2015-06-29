/* global angular */

angular.module("FriendMe")

.controller("DisplayController", function ($scope) {
    $scope.component = "analyze";

    $scope.setComponent = function(val)
    {
        $scope.component = val;
    }
})
.controller("HistoryController", function ($scope, comparisons) {
    $scope.comparisons = comparisons;

    comparisons.get();
})
.controller("AnalyzeController", function ($scope, $http, _) {

    $scope.user1 = undefined;
    $scope.user2 = undefined;

    $scope.submitted = false;
    $scope.finished = false;
    $scope.error = false;

    $scope.reset = function() {
        $scope.error = false;
        $scope.submitted = false;
        $scope.finished = false;

        $scope.user1 = undefined;
        $scope.user2 = undefined;

        $scope.submitButtonText = "Compare!";
    };

    $scope.compare = function() {
        //TODO validate form

        $scope.submitted = true;
        $scope.submitButtonText = "Comparing...";

        $http.get("/api/v1/compare/" + $scope.user1 + "/" + $scope.user2).
        success(function(data, status, headers, config) {
            console.log(data);
            $scope.inCommonTraits = data.inCommonTraits;
            $scope.user1Traits = data.user1Traits;
            $scope.user2Traits = data.user2Traits;
            $scope.finished = true;
        }).
        error(function(data, status, headers, config) {
            $scope.finished = true;
            $scope.error = true;
            $scope.errorMessage = data.message;
        });
    };
});
