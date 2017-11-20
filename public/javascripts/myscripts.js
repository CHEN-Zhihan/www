
var app = angular.module("ChatterBox", []); 


app.factory("userPage", () => {
    return {
        "user": "",
        "page": "",
        "partialPage": ""
    };
})

function loadMain($scope, res) {
    $scope.userPage.user = res.data.user;
    $scope.userPage.page = "main";
    $scope.userPage.partialPage = "empty";
}

app.controller("viewControl", ($scope, $http, userPage) => {
    $scope.userPage = userPage;
    console.log("send GET to /load");
    $http.get("/load", {})
    .then((res) => {
        if (res.data.error) {
            console.log("load error");
            $scope.userPage.page = "login";
        } else {
            console.log("load success");
            console.log(res.data);
            loadMain($scope, res);
        }
    });
});

app.controller("logIn", function($scope, $http, userPage) {
    $scope.logIn = () => {
        if (typeof $scope.username === "undefined") {
            alert("Please enter a valid username");
            return;
        }
        if (typeof $scope.password === "undefined") {
            alert("Please enter a valid password");
            return;
        }
        console.log("send POST to /login");
        $http.post("/login", {
            "name": $scope.username,
            "password": $scope.password
        }).then((res) => {
            console.log("login returns");
            console.log(res.data);
            loadMain($scope, res);
        })
    }
});

app.controller("main", ($scope, $http, userPage) => {
    $scope.userPage = userPage;
    $scope.logOut = () => {
        $http.get("/logout", {})
        .then((res) => {
            console.log("logout returns");
            $scope.userPage.page = "login";
        }).catch((err) => {
            console.log("logout failed");
            console.log(err);
        })
    };
    $scope.getUserInfo = () => {
        $scope.userPage.partialPage = "info";
    }
    $scope.userPage.partialPage = "empty";
});

app.controller("info", ($scope, $http, userPage) => {
    $scope.userPage = userPage;
    $http.get("/getuserinfo", {})
    .then((res) => {
        console.log("getuserinfo returns");
        if (res.error) {
            console.log("getuserinfo remote error");
            return;
        }
        console.log(res.data);
        $scope.data = res.data;
        delete $scope.data["error"];
    }).catch((err) => {
        console.log("getuserinfo local error");
        console.log(err);
    });

    $scope.save = () => {
        console.log($scope.data);
        $http.put("/saveuserinfo", $scope.data).then((res) => {
            if (res.error) {
                alert("Error update userinfo");
                return;
            }
            console.log("update userinfo successfully");
            $scope.userPage.partialPage = "empty";
        }).catch((err) => {
            console.log("saveuserinfo local error");
            console.log(err);
        })
    }
})
