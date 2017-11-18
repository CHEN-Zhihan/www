
var express = require('express');
var mongo = require("mongodb");

var router = express.Router();


function getAllFriends(collection, nameToLastMsgId) {
    console.log(nameToLastMsgId);
    return collection.find({
            name: {
                "$in": Object.keys(nameToLastMsgId)
            }
        }, {fields: {name: 1, _id: 1}}
    ).then((friendsNameId) => {
        return friendsNameId.reduce((result, x) => (
            result[x._id] = {
                "name": x.name,
                "lastMsgId": nameToLastMsgId[x.name]
            }
        , result), {});
    });
}

router.post("/login", (req, res) => {
    var collection = req.db.get("userList");
    console.log(req.body);
    var getUser = collection.findOneAndUpdate(req.body, 
                                              {"$set": {"status": "online"}}, 
                                             {"fields": {
                                                 "name": 1, "icon": 1, "friends": 1
                                             }})
    .then((doc) => {
        if (doc === null) {
            throw err;
        }
        req.session.userId = doc._id;
        var user = {};
        user.id = doc._id;
        user.icon = doc.icon;
        user.name = doc.name;
        user.friends = doc.friends.reduce((result, friend) => (result[friend.name] = friend.lastMsgId, result), {});
        return user;
    });
    var getFriends = getUser.then((user) => getAllFriends(collection, user.friends));
    Promise.all([getUser, getFriends]).then((userFriends) => {
        user = userFriends[0];
        user.friends = userFriends[1];
        res.send({
            "user": user,
            "error": false
        });
    }).catch((err) => {
        console.log(err);
        res.send({
            "user": {},
            "error": true
        });
    });
});

module.exports = router;
