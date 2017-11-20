
var app = angular.module("ChatterBox", []); 


app.factory("userPage", () => {
    return {
        "user": "",
        "page": "",
        "partialPage": ""
    };
})

app.factory("chat", () => {
    return {
        "receiverId": ""
    };
})

function loadMain($scope, res) {
    $scope.userPage.user = res.data.user;
    $scope.userPage.page = "main";
    $scope.userPage.partialPage = "empty";
}

function getDateTime() {
    var now = new Date();
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
    var day = days[now.getDay()];
    var month = months[ now.getMonth() ];
    var date = now.getDate();
    var year = now.getFullYear();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var second = now.getSeconds();
    var date = [day, month, date, year].join(' ');
    var time = [hour, minute, second].join(':');
    return {
        "date": date,
        "time": time
    };
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

app.controller("main", ($scope, $http, userPage, chat) => {
    $scope.userPage = userPage;
    $scope.c = chat;
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

    $scope.chat = (userID) => {
        $scope.c.receiverId = userID;
        $scope.userPage.partialPage = "chat";
    }

});

app.controller("info", ($scope, $http, userPage) => {
    $scope.userPage = userPage;
    $http.get("/getuserinfo", {})
    .then((res) => {
        if (res.error) {
            alert("getuserinfo remote error");
            return;
        }
        console.log("getuserinfo received data: ");
        console.log(res.data);
        $scope.data = res.data;
        delete $scope.data["error"];
    }).catch((err) => {
        console.log("getuserinfo local error: ");
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
            console.log("saveuserinfo local error: ");
            console.log(err);
        })
    }
})

app.controller("chat", ($scope, $http, chat) => {
    $scope.chat = chat;
    $http.get("/getconversation/" + chat.receiverId, {})
    .then((res) => {
        if (res.error) {
            alert("Error get conversation");
            return;
        }
        console.log("get conversation successfully");
        console.log(res.data);
        $scope.conversation = res.data;
    }).catch((err) => {
        console.log("get conversation local error: ");
        console.log(err);
    });

    $scope.send = () => {
        var dateTime = getDateTime();
        var data = {
            "message": $scope.message,
        };
        Object.assign(data, dateTime);
        $http.post("/postmessage/" + chat.receiverId, data)
        .then((doc) => {
            if (doc.error) {
                alert("send message server error");
                return;
            }
            console.log("sent message successfully: ");
            console.log(doc);
            $scope.conversation.push(doc);
        }).catch((err) => {
            console.log("send message local error");
            console.log(err);
        });
    };
})
