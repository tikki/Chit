define(
	['underscore', 'socketio', 'eventemitter'],
	function (_,    io,         EventEmitter) {

/**
 * This module exists to keep Socket.IO away from the rest of the code.
 * Maybe someday we won't be using Socket.IO anymore…
 * @exports new SocketClient()
 */

/**
 * @constructor
 */
function SocketClient() {
	this._socket = null;
}
SocketClient.prototype = Object.create(EventEmitter.prototype);

SocketClient.prototype.connect = function (url) {
	if (this.isConnected() || !_.isString(url)) {
		return;
	}
	// connect
	this._socket = io.connect(url);
	// hook up events
	var self = this;
	var events = ['connect', 'disconnect', 'chat/msg', 'chat/msg:reply', 'chat/join', 'chat/join:reply', 'chat/part', 'chat/part:reply', 'chat/names:reply'];
	_.each(events, function (eventName) {
		self._socket.on(eventName, function(data) {
			var socket = this;
			self.emitEvent(eventName, [data]);
		});
	});
};

SocketClient.prototype.isConnected = function () {
	return !_.isNull(this._socket) && this._socket.socket.connected;
};

SocketClient.prototype.disconnect = function () {
	if (!this.isConnected()) {
		return;
	}
	this._socket.disconnect();
	this._socket = null;
	this._socket.removeAllListeners();
};

SocketClient.prototype.msg = function (chatId, message) {
	this._socket.emit('chat/msg', {
		id: chatId,
		msg: message
	});
};

SocketClient.prototype.join = function (chatId, serverKey, nickname, signature) {
	if (!this.isConnected()) {
		return;
	}
	this._socket.emit('chat/join', {
		id: chatId,
		ky: serverKey,
		us: nickname,
		sg: signature
	});
};

SocketClient.prototype.part = function (chatId) {
	if (!this.isConnected()) {
		return;
	}
	this._socket.emit('chat/part', {
		id: chatId
	});
};

SocketClient.prototype.names = function (chatId) {
	if (!this.isConnected()) {
		return;
	}
	this._socket.emit('chat/names', {
		id: chatId
	});
};

return new SocketClient();

});
