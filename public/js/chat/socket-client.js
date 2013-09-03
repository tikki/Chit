define(
	['underscore', 'socketio'],
	function (_, io) {

__socket = null;
// https://github.com/LearnBoost/socket.io/wiki/Exposed-events
return {
	connect: function (url) {
		if (this.isConnected() || !_.isString(url)) {
			return;
		}
		// connect
		__socket = io.connect(url);
		// hook up events
		var self = this;
		function makeEventListener(eventName) {
			return function (data) {
				var socket = this;
				if (_.isFunction(self.events[eventName])) {
					self.events[eventName].call(socket, data);
				}
			}
		}
		__socket.on('connect', makeEventListener('connect'));
		__socket.on('disconnect', makeEventListener('disconnect'));
		__socket.on('chat/msg', makeEventListener('message'));
		__socket.on('chat/msg:reply', makeEventListener('message_reply'));
		__socket.on('chat/join', makeEventListener('join'));
		__socket.on('chat/join:reply', makeEventListener('join_reply'));
		__socket.on('chat/part', makeEventListener('part'));
		__socket.on('chat/part:reply', makeEventListener('part_reply'));
		__socket.on('chat/names:reply', makeEventListener('names_reply'));
	},
	isConnected: function () {
		return !_.isNull(__socket) && __socket.socket.connected;
	},
	disconnect: function () {
		if (!this.isConnected()) {
			return;
		}
		__socket.disconnect();
		__socket = null;
	},
	msg: function (chatId, message) {
		__socket.emit('chat/msg', {
			id: chatId,
			msg: message
		});
	},
	join: function (chatId, serverKey, nickname, signature) {
		if (!this.isConnected()) {
			return;
		}
		__socket.emit('chat/join', {
			id: chatId,
			ky: serverKey,
			us: nickname,
			sg: signature
		});
	},
	part: function (chatId) {
		if (!this.isConnected()) {
			return;
		}
		__socket.emit('chat/part', {
			id: chatId
		});
	},
	names: function (chatId) {
		if (!this.isConnected()) {
			return;
		}
		__socket.emit('chat/names', {
			id: chatId
		});
	},
	events: {
		connect: function () {
			console.log('connected');
		},
		disconnect: function () {
			console.log('disconnected');
		},
		message: function () {
			console.log('message');
		},
		message_reply: function () {
			console.log('message_reply');
		},
		join: function () {
			console.log('join');
		},
		join_reply: function () {
			console.log('join_reply');
		},
		part: function () {
			console.log('part');
		},
		part_reply: function () {
			console.log('part_reply');
		},
		names_reply: function () {
			console.log('names_reply');
		},
		error: function (err) {
			console.log('error:', err);
		}
	}
};

});
