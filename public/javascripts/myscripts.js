
var app = angular.module("ChatterBox", []);
app.controller("logIn", function($scope, $http) {
    $scope.logIn = () => {
        if (typeof $scope.username === "undefined") {
            alert("Please enter a valid username");
            return;
        }
        if (typeof $scope.password === "undefined") {
            alert("Please enter a valid password");
            return;
        }
        $http.post("/login", {
            "name": $scope.username,
            "password": $scope.password
        }).then((res) => {
            console.log(res.data);
        })
    }
});
