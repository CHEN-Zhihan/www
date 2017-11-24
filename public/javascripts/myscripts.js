
var app = angular.module("ChatterBox", []); 
DEBUG = true;


function getDateTime() {
    var now = new Date();
    var date = now.toDateString();
    var time = now.toTimeString().split(' ')[0];
    return {
        "date": date,
        "time": time
    };
}

function template(msg, res, callback) {
    if (res.data.error) {
        alert(msg + " Server Error");
        return;
    }
    callback();
}

function catchError(msg, err) {
    alert(msg + " Client Error");
    console.log(err);
}

function load($scope, $http) {
    var errorMessage = "Load";
    $http.get("/load", {})
    .then((res) =>  {
            if (res.data.error) {
                $scope.app.page = "logIn";
            } else {
                if (DEBUG) {
                    console.log(res.data);
                }
                $scope.app.page = "main";
                $scope.user.friends = res.data.friends;
                $scope.user.const.icon = res.data.icon;
                $scope.user.const.name = res.data.name;
            }
    }).catch((err) => catchError(errorMessage, err));
}


function logIn($scope, $http) {
    if (typeof $scope.user.const.name === "undefined") {
        alert("Please enter a valid username");
        return;
    }
    if (typeof $scope.user.const.password === "undefined") {
        alert("Please enter a valid password");
        return;
    }
    var errorMessage = "Log in";
    $http.post("/login", {
        "name": $scope.user.const.name,
        "password": $scope.user.const.password
    }).then((res) => template(errorMessage, res, () => {
            if (res.data.incorrect) {
                alert("Incorrect password or username");
                return;
            }
            $scope.app.page = "main";
            $scope.user.const.icon = res.data.icon;
            $scope.user.friends = res.data.friends;
        })
    ).catch((err) => catchError(errorMessage, err));
}


function logOut($scope, $http) {
    var errorMessage = "Log out"
    $http.get("/logout", {})
    .then((res) => template(errorMessage, res, () => {
            $scope.app.page = "logIn";
            $scope.app.partialPage = "empty";
        })
    ).catch((err) => catchError(errorMessage, err));
}

function getUserInfo($scope, $http) {
    var errorMessage = "Get User Information";
    if ($scope.user.mutable !== {}) {
        $http.get("/getuserinfo", {})
        .then((res) => template(errorMessage, res, () => {
                if (DEBUG) {
                    console.log("getuserinfo received data: ");
                    console.log(res.data);
                }
                $scope.user.mutable = res.data;
                Object.assign($scope.tmp, $scope.user.mutable);
                console.log($scope.tmp);
            })
        ).catch((err) => catchError(errorMessage, err));
    }
}

function saveUserInfo($scope, $http) {
    var data = Object.keys($scope.tmp).reduce((result, x) => {
        if ($scope.tmp[x] !== $scope.user.mutable[x]) {
            result[x] = $scope.tmp[x];
        };
        return result;
    }, {});
    console.log(Object.keys(data).length);
    if (Object.keys(data).length === 0) {
        return;
    }
    var errorMessage = "Save User Information";
    $http.put("/saveuserinfo", data).then((res) => 
        template(errorMessage, res, () => {
            delete data.error;
            Object.assign($scope.user.mutable, data);
            $scope.app.partialPage = "empty";
        })
    ).catch((err) => catchError(errorMessage));
}

function getConversation($scope, $http) {
    var errorMessage = "Get Conversation";
    $http.get("/getconversation/" + $scope.chat.receiverId)
    .then((res) => template(errorMessage, res, () => {
        if (DEBUG) {
            console.log("get conversation successfully");
            console.log(res.data);
        }
        $scope.chat.conversation = res.data.conversation;
    })
    ).catch((err) => catchError(errorMessage, err));
}

function sendMessage($scope, $http) {
    if (typeof $scope.chat.message !== "undefined" && $scope.chat.message !== null) {
        var data = {
            "message": $scope.chat.message,
        };
        Object.assign(data, getDateTime());
        var errorMessage = "Send message";
        $http.post("/postmessage/" + $scope.chat.receiverId, data)
        .then((res) => template(errorMessage, res, () => {
            if (DEBUG) {
                console.log("sent message successfully: ");
                console.log(res.data);
            }
            data._id = res.data._id;
            data.isSender = true;
            $scope.chat.conversation.push(data);
            $scope.chat.message = null;
        })
        ).catch((err) => catchError(errorMessage, err));
    };
}

function deleteMessage(index, $scope, $http) {
    if (!$scope.chat.conversation[index].isSender || !confirm("Delete the message?")) {
        return;
    }
    var errorMessage = "Delete message";
    $http.delete("/deletemessage/" + $scope.chat.conversation[index]._id, {})
    .then((res) => template(errorMessage, res, () => {
        $scope.chat.conversation.splice(index, 1);
    })
    ).catch((err) => catchError(errorMessage, err));
}

function getNewMessage($scope, $http) {
    var errorMessage = "Get new message";
    $http.get("/getnewmessages/" + $scope.chat.receiverId)
    .then((res) => template(errorMessage, res, () => {
        if (res.data.conversation.length !== 0) {
            Array.prototype.push.apply($scope.chat.conversation, res.data.conversation);
        }
    })).catch((err) => catchError(errorMessage, err));
}

function getNewMessageNum($scope, $http) {
    $scope.user.friends.forEach((x) => {
        if (x._id !== $scope.chat.receiverId) {
            var errorMessage = "Get new message number for " + x.name;
            $http.get("/getnewmsgnum/" + x._id)
            .then((res) => template(errorMessage, res, () => {
                $scope.user.friends.unreadNo = res.unreadNo;
            }))
        }
    })
}

function init($scope) {
    $scope.app = {
        "page": "logIn",
        "partialPage": "empty"
    };

    $scope.user = {
        "mutable": {
            "address": "",
            "mobileNumber": "",
            "homeNumber": "",
        },
        "const": {
            "password": "",
            "name": "",
            "icon": ""
        },
        "friends": ""
    };

    $scope.chat = {
        "receiverId": "",
        "conversation": "",
        "message": ""
    };
}


app.controller("ChatterBox", ($scope, $http, $interval) => {

    $scope.init = () => {
        init($scope)
        load($scope, $http);
        $scope.interval = $interval(() => {
            if ($scope.chat.receiverId !== "") {
                console.log("getting new message");
                getNewMessage($scope, $http);
            }
            getNewMessageNum($scope, $http);            
        }, 5000);
    }
    $scope.tmp = {};
    $scope.logOut = () => {
        logOut($scope, $http);
        $interval.cancel($scope.interval);
    }
    $scope.logIn = () => logIn($scope, $http)
    $scope.getUserInfo = () => {
        $scope.app.partialPage = "info";
        $scope.chat.receiverId = "";
        getUserInfo($scope, $http);
    }
    $scope.startChat = (userID) => {
        if ($scope.chat.receiverId !== userID) {
            $scope.chat.receiverId = userID;
            getConversation($scope, $http);
        }
        $scope.app.partialPage = "chat";
    }
    $scope.save = () => saveUserInfo($scope, $http);
    $scope.send = () => sendMessage($scope, $http);
    $scope.deleteMessage = (index) => deleteMessage(index, $scope, $http);
});
