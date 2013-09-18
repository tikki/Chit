var _ = require('underscore');

var Chat = require('../../../models/chat.js').Chat;

var transformSignature = require('./shared.js').transformSignature;
var crud = require('./crud.js').crud;

function cleanString(s) {
	return _.isString(s) ? s.trim() : '';
}

exports.api = function (sockets, socket) {
	// chat crud interface
	socket.on('chat/create', newChat);
	socket.on('chat/read', chatData);
	socket.on('chat/msg', _.partial(appendChatData, sockets));
	socket.on('chat/delete', deleteChat);
	// presence interface
	socket.on('chat/join', _.partial(joinChat, sockets));
	socket.on('chat/part', _.partial(leaveChat, sockets));
	socket.on('chat/names', _.partial(listUsers, sockets));
	//
	socket.on('disconnect', _.partial(removeUser, sockets));
};

// wrapper for the CRUD API to offer a RESTful API via Node.js/Express/Socket.IO(/WebSockets)

function newChat(data) {
	data = data || {};
	var socket = this;
	crud.create(function (reply) { socket.emit(reply); }, data.key);
}

function chatData(data) {
	data = data || {};
	var socket = this;
	crud.read(function (reply) { socket.emit(reply); }, data.id, data.key);
}

function appendChatData(sockets, data) {
	data = data || {};
	var socket = this;
	var chatId = data.id;
	var userId = socket.id;
	if (!isUserInChat(sockets, userId, chatId)) {
		socket.emit('chat/msg:reply', {error: 'not in channel.'});
	} else {
		Chat.chatFromId(chatId, function (chat) {
			crud.update(function (reply) {
				socket.emit('chat/msg:reply', reply);
			}, chatId, chat.key, data.msg);
		});
	}
}

function deleteChat(data) {
	data = data || {};
	var socket = this;
	crud.delete(function (reply) { socket.emit(reply); }, data.id, data.secret);
}

// presence
/** @private */
var __chat_prefix = 'chat:';
var __user_db = {
	set: function (userId, chatId, data) {
		this._db[this._key(userId, chatId)] = data;
	},
	get: function (userId, chatId) {
		return this._db[this._key(userId, chatId)];
	},
	del: function (userId, chatId) {
		if (!_.isUndefined(chatId)) {
			delete this._db[this._key(userId, chatId)];
		} else {
			// delete *all* data for userId (for all channels)
			userId += ':'; // add the userId postfix (otherwise "UserA" would also match "UserA*")
			var killlist = [];
			_.each(this._db, function (val, key) {
				if (key.substr(0, userId.length) === userId) {
					killlist.push(key);
				}
			});
			_.each(killlist, function (key) {
				delete this._db[key];
			});
		}
	},
	_db: {},
	_key: function (userId, chatId) {
		return userId + ':' + chatId;
	}
};

function chatIdsForUser(sockets, userId) {
	var chatIds = [];
	var joinedRooms = sockets.manager.roomClients[userId];
	_.each(joinedRooms, function (val, key) {
		var id = RegExp('^/' + __chat_prefix + '(.+)').exec(key);
		if (id) {
			chatIds.push(id[1]);
		}
	});
	return chatIds;
}

function userIdsForChat(sockets, chatId) {
	return _.pluck(sockets.clients(__chat_prefix + chatId), 'id');
}

function isUserInChat(sockets, userId, chatId) {
	var userIds = userIdsForChat(sockets, chatId);
	return _.indexOf(userIds, userId) !== -1;
}

function joinChat(sockets, data) {
	data = data || {};
	var socket = this;
	// to go live, we need a chat-id, server-key and nickname
	var nick = cleanString(data.us);
	if (!nick.length) {
		return socket.emit('chat/join:reply', {error: 'invalid nickname.'});
	}
	new Chat({
		id: data.id,
		key: data.ky
	}).checkKey(function (success, err) {
		if (!success) {
			return socket.emit('chat/join:reply', {error: err});
		}
		var chatId = data.id;
		var userId = socket.id;
		// transform signature
		var sig = transformSignature(cleanString(data.sg) || null) || undefined; // using undefined, we can skip sending the null signature; every byte counts!
		// join room & tell everybody
		var roomName = __chat_prefix + chatId;
		var userdata = {nick: nick, sig: sig};
		socket.join(roomName);
		socket.broadcast.to(roomName).emit('chat/join', userdata);
		socket.emit('chat/join:reply', {success: true, sig: sig});
		// add update hook
		/** @todo: this seems like a bad way to do it, creating a callback for each and every chat per joined user */
		userdata.updateCallback = function (data) {
			if (data.id === chatId) {
				// explicitly state what to broadcast
				var bData = {
					id: data.id,
					// time: data.time, // not needed, there's already a ts in msg
					msg: data.msg
				};
				socket.emit('chat/msg', bData);
			}
		}
		crud.on('update', userdata.updateCallback);
		// store userdata for later reference
		__user_db.set(userId, chatId, userdata);
	});
}

function leaveChat(sockets, data) {
	data = data || {};
	var socket = this;
	var chatId = data.id;
	var userId = socket.id;
	var reply = {error: 'unknown'};
	if (!isUserInChat(sockets, userId, chatId)) {
		reply = {error: 'not in channel.'};
	} else {
		var userdata = __user_db.get(userId, chatId);
		if (userdata) {
			var roomName = __chat_prefix + chatId;
			// explicitly state what to broadcast
			var bData = {
				nick: userdata.nick,
				sig: userdata.sig
			};
			socket.broadcast.to(roomName).emit('chat/part', bData);
			// remove update hook
			// if (userdata.updateCallback) {
				crud.removeListener('update', userdata.updateCallback);
			// }
			socket.leave(roomName);
			__user_db.del(userId, chatId);
			reply = {success: true};
		}
	}
	socket.emit('chat/part:reply', reply);
}

function listUsers(sockets, data) {
	data = data || {};
	var socket = this;
	var chatId = data.id;
	var userId = socket.id;
	var reply = {error: 'unknown'};
	if (!isUserInChat(sockets, userId, chatId)) {
		reply = {error: 'not in channel.'};
	} else {
		var userinfos = [];
		_.each(userIdsForChat(sockets, chatId), function (userId) {
			var userdata = __user_db.get(userId, chatId);
			// explicitly state what to send
			var bData = {
				nick: userdata.nick,
				sig: userdata.sig
			};
			userinfos.push(bData);
		});
		reply = {id: chatId, infos: userinfos};
	}
	socket.emit('chat/names:reply', reply);
}

function removeUser(sockets, data) {
	data = data || {};
	var socket = this;
	var userId = socket.id;
	// inform all other users that shared channels with the disconnected user
	_.each(chatIdsForUser(sockets, userId), function (chatId) {
		leaveChat.call(socket, sockets, {id: chatId});
	});
	__user_db.del(userId);
}
