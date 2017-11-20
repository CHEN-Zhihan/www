
var express = require('express');
var mongo = require("mongodb");
var monk = require("monk");
var router = express.Router();


function getAllFriends(collection, nameToLastMsgId) {
    return collection.find({
            name: {
                "$in": Object.keys(nameToLastMsgId)
            }
        }, {fields: {name: 1, _id: 1}}
    ).then((friendsNameId) => {
        return friendsNameId.reduce((result, x) => (
            result[x._id] = {
                "name": x.name,
                // "lastMsgId": nameToLastMsgId[x.name]
                "msgNotReceived": 0
            }
        , result), {});
    });
}

function getFriend(db, id) {
    var collection = db.get("userList");
    var query = {
        "_id": new mongo.ObjectID(id)
    }
    var fields = {
        "fields": {
            "name": 1,
            "icon": 1,
            "status": 1,
            "_id": 0
        }
    };
    return collection.findOne(query, fields)
    .then((doc) => {
        console.log("friend found successfully");
        console.log(doc);
        return doc;
    });
}

function getUser(promise) {
    return promise.then((doc) => {
        if (doc === null) {
            throw "No such user";
        }
        var user = {};
        user.id = doc._id;
        user.icon = doc.icon;
        user.name = doc.name;
        console.log(doc);
        user.friends = doc.friends.reduce((result, friend) => (result[friend.name] = friend.lastMsgId, result), {});
        return user;
    });
}

function getOnloadData(promise, collection) {
    var user = getUser(promise);
    var friends = user.then((u) => getAllFriends(collection, u.friends));
    return Promise.all([user, friends]).then((userFriends) => {
        u = userFriends[0];
        u.friends = userFriends[1];
        return {
            "user": u,
            "error": false
        };
    });
}

router.post("/login", (req, res) => {
    var collection = req.db.get("userList");
    console.log(req.body);
    var promise = collection.findOneAndUpdate(req.body, {"$set": {"status": "online"}}, 
                                                {"fields": {
                                                    "name": 1, 
                                                    "icon": 1, 
                                                    "friends": 1}});
    getOnloadData(promise, collection)
    .then((doc) => {
        req.session.userId = doc.user.id;
        res.send(doc);
    }).catch((err) => {
        console.log(err);
        res.send({
            "user": {},
            "error": true
        });
    })
});

router.get("/load", (req, res) => {
    if (req.session.userId) {
        console.log(req.session.userId + " in session");
        var collection = req.db.get("userList");
        var query = {
            "_id": new mongo.ObjectID(req.session.userId)
        };
        var fields = {
            "fields": {
                "name": 1,
                "icon": 1,
                "friends": 1,
                "_id": 0
            }
        };
        var promise = collection.findOne(query, fields);
        getOnloadData(promise, collection)
        .then((doc) => {
            res.send(doc);
        }).catch((err) => {
            console.log(err);
            res.send({
                "user": {},
                "error": true
            });
        })
    } else {
        console.log("userID not in session");
        res.send({
            "user": {},
            "error": true
        });
    }
});

router.get("/logout", (req, res) => {
    if (req.session.userId) {
        var query = {
            "_id": new mongo.ObjectID(req.session.userId)
        };
        var collection = req.db.get("userList");
        console.log(query);
        collection.update(query, {"$set": {"status": "offline"}})
        .then((doc) => {
            console.log("User logout successfully");
            console.log(doc);
            req.session.userId = null;
            res.send({"error": false});
        }).catch((err) => {
            console.log(err);
            res.send({"error": true});
        })
    } else {
        console.log("Not logged in @ logout");
        res.send({"error": true});
    }

});

router.get("/getuserinfo", (req, res) => {
    if (req.session.userId) {
        var query = {
            "_id": new mongo.ObjectID(req.session.userId)
        };
        var collection = req.db.get("userList");
        var fields = {
            "fields": {
                "mobileNumber": 1,
                "homeNumber": 1,
                "address": 1,
                "_id": 0
            }
        };
        collection.findOne({query}, fields)
        .then((doc) => {
            console.log("getuserinfo successfully");
            console.log(doc);
            doc.error = false;
            res.send(doc);
        }).catch((err) => {
            console.log(err);
            res.send({"error": true});
        });
    } else {
        console.log("Not logged in @ logout");
        res.send({"error": true});
    }
})

router.put("/saveuserinfo", (req, res) => {
    console.log("receive saveinfo request");
    console.log(req.body);
    if (req.session.userId) {
        var query = {
            "_id": new mongo.ObjectID(req.session.userId)
        };
        console.log(query)
        var collection = req.db.get("userList");
        collection.update(query, {"$set": req.body})
        .then((doc) => {
            console.log(doc);
            console.log("saveuserinfo successfully");
            res.send({"error": false});
        }).catch((err) => {
            console.log(err);
            res.send({"error": true});
        })
    } else {
        console.log("User not logged in");
        res.send({"error": true});
    }
})

router.get("/getconversation/:friendid", (req, res) => {
    console.log("receive getconversation request");
    console.log(req.body);
    if (req.session.userId && req.params.friendid) {
        var friend = getFriend(req.db, req.params.friendid);
        var query = {"$or": [
            {"senderId": new mongo.ObjectID(req.session.userId),
            "receiverId": new mongo.ObjectID(req.params.friendid),
        }, {
            "receiverId": new mongo.ObjectID(req.params.friendid),
            "senderId": new mongo.ObjectID(req.session.userId)
        }]};
        var collection = req.db.get("messageList");
        var conversation = collection.find(query)
        .then((docs) => {
            console.log("find conversation successfully");
            docs.forEach((x) => {
                x[isSender] = x.senderId === req.session.userId;
                delete x[senderId];
                delete x[receiverId];
            });
            console.log(docs);
            return docs;
        });
        Promise.all([friend, conversation]).then((friendConversation) => {
            var friend = friendConversation[0];
            var conversation = friendConversation[1];
            console.log("get friend conversation succesfully");
            console.log(friendConversation);
            console.log(friend);
            console.log(conversation);
            res.send({
                "friend": friend,
                "conversation": conversation,
                "error": false
            });
        }).catch((err) => {
            console.log(err);
            res.send({
                "error": true
            });
        });
    } else {
        console.log("User not logged in");
        res.send({"error": true});
    }
});

router.post("/postmessage/:friendid", (req, res) => {
    console.log("receive postmessage request");
    console.log(req.body);
    console.log(req.params.friendid);
    if (req.session.userId && req.params.friendid) {
        var data = {
            "senderId": req.session.userId,
            "receiverId": req.params.friendid,
        };
        Object.assign(data, req.body);
        var collection = req.db.get("messageList");
        collection.insert(data)
        .then((doc) => {
            console.log("insert successfully");
            console.log(doc);
            res.send({
                "error": false,
                "id": doc._id
            });
        }).catch((err) => {
            console.log(err);
            res.send({
                "error": true
            });
        })
    } else {
        console.log("User not logged in");
        res.send({"error": true});
    }
})

module.exports = router;
