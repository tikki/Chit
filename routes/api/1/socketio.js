var _ = require('underscore');

var Chat = require('../../../models/chat.js').Chat;

var transformSignature = require('./shared.js').transformSignature;

function cleanString(s) {
	return _.isString(s) ? s.trim() : '';
}

exports.api = function (socket) {
	var sockets = this;
	// chat crud interface
	socket.on('chat/create', newChat);
	socket.on('chat/read', chatData);
	socket.on('chat/update', appendChatData);
	socket.on('chat/delete', deleteChat);
	// presence interface
	socket.on('chat/join', joinChat);
	socket.on('chat/names', _.partial(listUsers, sockets));
	//
	socket.on('disconnect', removeUser);
};

// wrapper for the CRUD API to offer a RESTful API via Node.js/Express/Socket.IO(/WebSockets)

function newChat(data) {
	var socket = this;
	crud.create(function (reply) { socket.emit(reply); }, data.key);
}

function chatData(data) {
	var socket = this;
	crud.create(function (reply) { socket.emit(reply); }, data.id, data.key);
}

function appendChatData(data) {
	var socket = this;
	crud.create(function (reply) { socket.emit(reply); }, data.id, data.key, data.msg);
}

function deleteChat(data) {
	var socket = this;
	crud.create(function (reply) { socket.emit(reply); }, data.id, data.secret);
}

// presence
var __chat_prefix = 'chat:';
var __chat_nicks = {};

function joinChat(data) {
	var socket = this;
	// to go live, we need a chat-id, server-key and nickname
	var nick = cleanString(data.us);
	if (!nick.length) {
		return socket.emit('chat/join/reply', {error: 'invalid nickname.', where: 'chat/live'});
	}
	new Chat({
		id: data.id,
		key: data.key
	}).checkKey(function (success, err) {
		if (!success) {
			socket.emit('chat/join/reply', {error: err, where: 'chat/join'});
		} else {
			// transform signature
			var sig = transformSignature(cleanString(data.sg) || undefined);
			var userinfo = {nick: nick, sig: sig};
			// join room & tell everybody
			var roomName = __chat_prefix + data.id;
			socket.join(roomName);
			socket.broadcast.to(roomName).emit('chat/join', userinfo);
			socket.emit('chat/join/reply', {success: true});
			// store info for later reference
			if (!_.has(__chat_nicks, socket.id)) {
				__chat_nicks[socket.id] = {};
			}
			__chat_nicks[socket.id][data.id] = userinfo;
		}
	});
}

function listUsers(sockets, data) {
	var socket = this;
	// get a list of all channels the user is in.
	var chats = [];
	var joinedRooms = sockets.manager.roomClients[socket.id];
	_.each(joinedRooms, function (val, key) {
		var id = RegExp('^/' + __chat_prefix + '(.+)').exec(key);
		if (id) {
			chats.push(id[1]);
		}
	});
	// send a list of all names of other users in the same channel(s).
	console.log(chats);
	if (chats.length == 1) {
		var chatId = chats[0];
		var userinfos = [];
		_.each(sockets.clients(__chat_prefix + chatId), function (socket) {
			userinfos.push(__chat_nicks[socket.id][chatId]);
		});
		socket.emit('chat/names', {id: chatId, infos: userinfos});
	}
}

function removeUser(data) {
	var socket = this;
	__chat_nicks[socket.id] = undefined;
}
