var express = require('express');
var mongo = require("mongodb");

var router = express.Router();


function findAllFriends(collection, id) {
    var error = false;
    var allFriends = {};
    collection.findOne({"_id": id}, {"fields": {"name": 1, "icon": 1, "friends": 1}}, (err, docs) => {
        if (err !== null) {
            error = true;
            return;
        }
        user.name = docs.name;
        user.icon = docs.icon;
        user.friends = null;
        var nameToLastMsgId = user.friends.reduce((obj, x) => {
            obj[x.name] = x.lastMsgId;
        }, {});
        collection.find({
            "$elemMatch": {
                name: {
                    "$in": Object.keys(nameToLastMsgId)
                }
            }
        }, {fields: {name: 1, _id: 1}}, (err, docs) => {
            if (err !== null) {
                error = true;
                return;
            }
            allFriends = docs.reduce((obj, x) => {
                obj[x._id] = {
                    "name": x.name,
                    "lastMsgId": nameToLastMsgId[x.name]
                }
            });
        });
    });
    return {
        "error": error,
        "allFriends": allFriends
    };
}



router.post("/login", (req, res) => {
    var error = false;
    var collection = req.db.get("userList");
    var user = {}
    console.log(req.body);
    collection.findOne(req.body, {"_id": 1}, (err, docs) => {
        if (err !== null || docs === null) {
            console.log("Cannot find anything");
            error = true;
            return;
        }
        console.log(docs);
        req.session.userId = docs._id;
        collection.update({"_id": docs["_id"]}, {"$set": {"status": "online"}});
        var friends = findAllFriends(collection, docs._id);
        if (friends.error) {
            error = true;
            return;
        }
        user["name"] = docs.name;
        user["icons"] = docs.icons;
        user["friends"] = friends.allFriends;
    });
    res.send({
        "error": error,
        "user": user
    });
});


router.get("/load", (req, res) => {
    if (!req.session.userId) {
        res.send("");
        return;
    }
    var user = null;
    var collection = req.db.get("userList");
    collection.find({_id: new mongo.ObjectId(req.session.userId)}, 
                    {fields: {name: 1, icon: 1, friends: 1}}, 
                    (err, docs) => {
        if (err !== null) {
            res.send({msg: err});
            return;
        }
        user = docs;
    });
    if (user === null) {
        return;
    }
    var nameToFriends = user.friends.reduce((obj, x) => {
        obj[x.name].lastMsgId = x.lastMsgId;
    }, {});
    collection.find({
        "$elemMatch": {
            name: {
                "$in": Object.keys(nameToFriends)
            }
        }
    }, {fields: {name: 1, _id: 1}}, (err, docs) => {
        if (err !== null) {
            res.send()
        }
        docs.forEach((x) => {
            nameToFriends[x.name]._id = x._id.valueof();
        });
    });
    res.send(user);
    console.log(user);
});

module.exports = router;