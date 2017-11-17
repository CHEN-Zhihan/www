var app = angular.module("ChatterBox", []);
app.controller("signIn", function($scope, $http) {
    $scope.signIn = () => {
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
