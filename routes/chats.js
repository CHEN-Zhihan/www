
var express = require('express');
var mongo = require("mongodb");
var monk = require("monk");
var router = express.Router();

DEBUG = true;
NOT_A_LAST_MESSAGE = "Not a last message";
USER_NOT_FOUND = "User Not Found";

function catchError(err, res) {
    console.log(err);
    res.send({
        "error": true
    });
}

/**
 * load:: userId -> (userIcon, userName, friendName, unread)
 * login:: userName -> userPassword -> (userIcon, userName, friendName, unread)
 * logout:: userId -> None
 * getUserInfo:: userId -> (userNo, homeNo, address)
 * saveUserInfo (userNo, homeNo, address) -> userId -> None
 * deleteMessage:: userId -> msgId -> None // senderId msgId -> update lastMsgId
 * getConversation:: userId -> friendId -> (friendIcon, friendStatus, messages) //sender receiverId -> set lastMsgId
 * postMessage:: userId -> friendId -> (new messageId)
 * 
 * getNewMessage:: userId -> receiverId -> (messages) // sender receiverId -> update latestMsgId
 * getNewMessageNum:: userId -> receiverId -> (unread)
 */

function getLatestMsgId(messageList, sender, receiver) {
    var query = {
        "senderId": sender,
        "receiverId": receiver,
    };
    var options = {
        "sort": {
            "_id": -1
        },
        "limit": 1,
        "fields": {
            "_id": 1
        }
    };
    return messageList.find(query, options);
}

function getFriendsUnReadNo(userList, messageList, nameToLastMsgId, userId, friends) {
    return friends.then((iterables) => {
        var friends = iterables;
        var idCondition = friends.map((x) => {
            var result = {
                "senderId": x._id.toString(),
            }
            if (nameToLastMsgId[x.name] !== '0') {
                result["_id"] = {
                    "$gt": new mongo.ObjectID(nameToLastMsgId[x.name])
                };
            }
            return result;
        });
        var query = {"$or": idCondition, 
                     "receiverId": userId.toString()
                };
        console.log("This is query");    
        console.log(query);
        return messageList.find(query).then((doc) => {
            var nameToUnreads = Object.keys(nameToLastMsgId).reduce((result, x) => {
                result[x] = 0;
                return result;
            }, {});
            var idToName = friends.reduce((result, x) => {
                result[x._id.valueOf()] = x.name;
                return result;
            }, {});
            doc.forEach((x) => {
                ++nameToUnreads[idToName[x.senderId]];
            });
            return nameToUnreads;
        });
    });
}



/**
 * 
 *          {
 *      "_id": "",
 *      "name": "",
 *      "icon",
 *      "friends": [
 *                  {
 *                  "name": "",
 *                  "_id": "",
 *                  "unreadNo": "",
 *              }
 *          ]
 *     }
 * 
 */
function onload(userList, messageList, query, logIn) {
    var options = {
        "fields": {
            "name": 1,
            "friends": 1,
            "icon": 1
        }
    }
    var user = null;
    if (logIn) {
        user = userList.findOneAndUpdate(query, {"$set": {"status": "online"}}, options);
    } else {
        user = userList.findOne(query, options);
    }
    var friends = user.then((doc) => {
        if (doc === null) {
            throw USER_NOT_FOUND;
        }
        var query = {
            "name": {
                "$in": doc.friends.map((x) => x.name)
            }
        };
        var options = {
            "fields": {
                "name": 1,
            }
        };
        return userList.find(query, options);
    })
    var unreadNos = user.then((doc) => {
        var nameToLastMsgId = doc.friends.reduce((result, x) => {
            result[x.name] = x.lastMsgId;
            return result;
        }, {})
        return getFriendsUnReadNo(userList, messageList, nameToLastMsgId, doc._id, friends);
    })
    return Promise.all([user, friends, unreadNos]).then((iterables) => {
        var user = iterables[0];
        var friends = iterables[1];
        var unreadNos = iterables[2];
        var nameToId = friends.reduce((result, x) => {
            result[x.name] = x._id.valueOf();
            return result;
        }, {});
        user.friends.forEach((x) => {
            x["unreadNo"] = unreadNos[x.name];
            x["_id"] = nameToId[x.name];
            delete x.lastMsgId;
        });
        console.log(user.friends);
        return user;
    })
}

function getAllFriends(collection, nameToLastMsgId) {
    return collection.find({
            name: {
                "$in": Object.keys(nameToLastMsgId)
            }
        }, {fields: {name: 1, _id: 1}}
    ).then((friendsNameId) => {
        return friendsNameId.reduce((result, x) => {
            result[x._id] = {
                "name": x.name,
                "lastMsgId": nameToLastMsgId[x.name],
                "msgNotReceived": 0
            }
            return result;
        }, {});
    });
}

function getFriend(db, id, fields) {
    var collection = db.get("userList");
    var query = {
        "_id": new mongo.ObjectID(id)
    }
    var options = {
        "fields": fields
    };
    return collection.findOne(query, options)
    .then((doc) => {
        if (DEBUG) {
            console.log("friend found successfully");
            console.log(doc);
        }
        return doc;
    });
}

function getFriendLastMsgIdById(userList, sender, receiver) {
    var query = {
        "_id": new mongo.ObjectID(sender)
    };
    var friendName = userList.findOne(query, {"fields": {"name": 1}});
    return friendName.then((doc) => {
        return getFriendLastMsgIdByName(userList, doc.name, receiver)
    })
}

function getFriendLastMsgIdByName(userList, senderName, receiver) {
    var query = {
        "_id": new mongo.ObjectID(receiver),
    };
    var options = {
        "friends": {
            "$elemMatch": {
                "name": senderName
            }
        }
    };
    return userList.findOne(query, options);
}


function updateLastMsgId(userList, senderName, receiverId, senderLastMsgId)  {
    console.log("updating lastMsgId for " + senderName + " to " + senderLastMsgId);
    var query = {
        "_id": new mongo.ObjectID(receiverId),
        "friends.name": senderName
    }
    var updates = {
        "$set": {
            "friends.$.lastMsgId": senderLastMsgId
        }
    };
    return userList.update(query, updates);
}


function updateLastMsgIdAfterDelete(db, id) {
    var userList = db.get("userList");
    var messageList = db.get("messageList");
    var query = {
        "friends": {
            "$elemMatch": {
                "lastMsgId": id
            }
        }
    };
    var fields = {
        "fields": {
            "_id": 1,
            "friends.name": 1
        }
    }
    var receiverSender = userList.findOne(query, fields);
    var senderId = receiverSender.then((doc) => {
        if (doc === null) {
            throw NOT_A_LAST_MESSAGE;
        }
        return userList.find({"name": doc.friends[0].name}, {"fields": {"_id": 1}})
    });
    var lastMsg = Promise.all([receiverSender, senderId])
    .then((docs) => {
        var receiverSender = docs[0];
        var senderId = docs[1];
        return messageList.find({
            "senderId": senderId._id,
            "receiverId": receiverSender._id,
            "_id": {
                "$lt": new mongo.ObjectID(id)
            }}, {
                "sort": {
                    "_id": -1
                }
            });
    });
    return Promise.all([receiverSender, lastMsg])
    .then((doc) => {
        var receiverSender = doc[0];
        var lastMsg = doc[1];
        var lastMsgId = null;
        if (lastMsg.length === 0) {
            lastMsgId = '0';
        } else {
            lastMsgId = lastMsg[0]._id.valueOf();
        }
        return updateLastMsgId(userList, receiverSender.friends[0].name, receiverSender._id, lastMsgId);
    });
}

function login(req, res) {
    var userList = req.db.get("userList");
    var messageList = req.db.get("messageList");
    onload(userList, messageList, req.body, true)
    .then((doc) => {
        req.session.userId = doc._id;
        res.send(doc);
    }).catch((err) => {
        console.log(err);
        if (err === USER_NOT_FOUND) {
            res.send({"error": false, "incorrect": true});
            return;
        }
        res.send({"error": true});
    });
}

function load(req, res) {
    var userList = req.db.get("userList");
    var messageList = req.db.get("messageList");
    var query = {
        "_id": new mongo.ObjectID(req.session.userId)
    };
    onload(userList, messageList, query, false)
    .then((doc) => {
        doc["error"] = false;
        res.send(doc);
    }).catch((err) => catchError(err, res));
}

function logout(req, res) {
    var query = {
        "_id": new mongo.ObjectID(req.session.userId)
    };
    var userList = req.db.get("userList");
    userList.update(query, {"$set": {"status": "offline"}})
    .then((doc) => {
        if (DEBUG) {
            console.log("User logout successfully");
            console.log(doc);
        }
        req.session.userId = null;
        res.send({"error": false});
    }).catch((err) => catchError(err, res));
}

function getuserinfo(req, res) {
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
    collection.findOne(query, fields)
    .then((doc) => {
        doc.error = false;
        res.send(doc);
    }).catch((err) => catchError(err, res));
}

function saveuserinfo(req, res) {
    var query = {
        "_id": new mongo.ObjectID(req.session.userId)
    };
    var userList = req.db.get("userList");
    userList.update(query, {"$set": req.body})
    .then((doc) => {
        res.send({"error": false});
    }).catch((err) => catchError(err, res));
}

function postmessage(req, res) {
    var data = {
        "senderId": req.session.userId,
        "receiverId": req.params.friendid,
    };
    Object.assign(data, req.body);
    var messageList = req.db.get("messageList");
    messageList.insert(data)
    .then((doc) => {
        res.send({
            "error": false,
            "_id": doc._id
        });
    }).catch((err) => catchError(err, res));
}

function deletemessage(req, res) {
    var messageList = req.db.get("messageList");
    var query = {
        "_id": new mongo.ObjectID(req.params.msgid)
    };
    messageList.remove(query)
    .then((doc) => {
        return updateLastMsgIdAfterDelete(req.db, req.params.msgid);
    }).then((doc) => {
        res.send({"error": false});
    }).catch((err) => {
        if (err === NOT_A_LAST_MESSAGE) {
            res.send({"error": false});
            return;
        }
        console.log(err);
        res.send({"error": true});
    });
}

function getnewmessages(req, res) {
    var messageList = req.db.get("messageList");
    var nameLastMsgId =getFriendLastMsgIdById(req.db.get("userList"), req.params.friendid, req.session.userId);
    var newMessage = nameLastMsgId
    .then((doc) => {
        if (DEBUG) {
            console.log("nameLastMsgId");
            console.log(doc);
        }
        var query = {
            "senderId": req.params.friendid,
            "receiverId": req.session.userId
        };
        var options = {
            "sort": {
                "_id": 1
            },
        }
        if (doc.friends[0].lastMsgId !== '0') {
            query["_id"] = {
                "$gt": new mongo.ObjectID(doc.friends[0].lastMsgId)
            };
        }
        return messageList.find(query, options)
    });
    var updateMsg = Promise.all([nameLastMsgId, newMessage])
    .then((doc) => {
        var nameLastMsgId = doc[0];
        var newMessage = doc[1];
        if (newMessage.length !== 0) {
            return updateLastMsgId(req.db.get("userList"), 
                                    nameLastMsgId.friends[0].name,
                                    req.session.userId, newMessage[newMessage.length - 1]._id.valueOf())
        }
        return null;
    })
    Promise.all([newMessage, updateMsg])
    .then((doc) => {
        var newMessage = doc[0];
        newMessage.forEach((x) => {
            x["isSender"] = x.senderId === req.session.userId;
            delete x.senderId;
            delete x.receiverId;
        });
        res.send({"conversation": newMessage, "error": false});
    }).catch((err) => catchError(err, res));
}

function getconversation(req, res) {
    var messageList = req.db.get("messageList");
    var query = {"$or": [
        {"senderId": req.session.userId,
        "receiverId": req.params.friendid,
    }, {
        "senderId": req.params.friendid,
        "receiverId": req.session.userId
    }]};
    var fields = {
        "name": 1,
        "icon": 1,
        "status": 1,
        "_id": 0
    }
    var friend = getFriend(req.db, req.params.friendid, fields);
    var conversation = messageList.find(query, {"sort": {"_id": 1}});
    Promise.all([friend, conversation]).then((friendConversation) => {
        var friend = friendConversation[0];
        var conversation = friendConversation[1];
        conversation.forEach((doc) => {
            doc["isSender"] = doc.senderId === req.session.userId;
            delete doc.senderId;
            delete doc.receiverId;
        });
        if (DEBUG) {
            console.log("get friend conversation succesfully");
            console.log(friendConversation);
        }
        var lastMsgId = '0';
        for (var i = conversation.length - 1; i !== -1; --i) {
            if (!conversation[i].isSender) {
                lastMsgId = conversation[i]._id;
                break;
            }
        }
        return updateLastMsgId(req.db.get("userList"), friend.name, req.session.userId, lastMsgId)
        .then((doc) => {
            delete friend.name;
            res.send({
                "friend": friend,
                "conversation": conversation,
                "error": false
            });
        });
    }).catch((err) => catchError(err, res));
}

function getNewMessageNum(req, res) {
    var userList = req.db.get("userList");
    var messageList = req.db.get("messageList");
    var friendNameLastMsgId = getFriend(req.db, req.params.friendid, {"name": 1})
    .then((doc) => {
        return [doc]
    });
    var nameToLastMsgId = friendNameLastMsgId.then((doc) => {
        return getFriendLastMsgIdByName(userList, doc[0].name, req.session.userId).then((doc) => {
            var result = {};
            result[doc.friends[0]["name"]] = doc.friends[0]["lastMsgId"];
            return result;
        })
    })
    nameToLastMsgId.then((doc) => {
        var unreadNos = dgetFriendsUnReadNo(userList, messageList, doc, req.session.userId, friendNameLastMsgId);
        unreadNos.then((doc) => {
            var unreadNo = Object.values(doc)[0];
            res.send({
                "unreadNo": unreadNo,
                "error": false
            });
        })
    }).catch((err) => catchError(err, res));

}

router.post("/login", login);
router.get("/load", load);
router.get("/logout", logout);
router.get("/getuserinfo", getuserinfo);
router.put("/saveuserinfo", saveuserinfo);
router.post("/postmessage/:friendid", postmessage);
router.delete("/deletemessage/:msgid", deletemessage);
router.get("/getnewmessages/:friendid", getnewmessages);
router.get("/getconversation/:friendid", getconversation);
router.get("/getnewmsgnum/:friendid", getNewMessageNum);
module.exports = router;
