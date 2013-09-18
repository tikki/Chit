define(
	['jquery', 'underscore', 'sjcl', 'chat/messager', 'chat/cryptoParams', 'chat/user', 'chat/rest-client', 'chat/socket-client', 'chat/crypto', 'eventemitter'],
	function ($, _,           sjcl,   Messager,        cryptoParams,        User,        restapi,            socketapi,            Crypto,        EventEmitter) {

function asBase64(bitarray, forUrl) {
	return sjcl.codec.base64.fromBits(bitarray, 1, forUrl);
}

function fromBase64(base64, fromUrl) {
	return sjcl.codec.base64.toBits(base64, fromUrl);
}

/**
 * getters and setters used to manage Chat properties
 */
function _getId() {
	return this._id;
}
/**
 * Updates id and user.chatId.
 */
function _setId(id) {
	this._id = id;
	if (this.user) {
		this.user.chatId = id;
	}
}
function _getChatKey() {
	return this._chatKey;
}
/**
 * Updates chatKey, serverKey, messager, and user.
 * @param {sjcl.bitArray|String} chatKey - A bitArray or BASE64 encoded String.
 */
function _setChatKey(chatKey) {
	this._chatKey = null; // reset chatKey
	this._serverKey = null; // reset serverKey
	// handle new chatKey
	if (_.isArray(chatKey)) {
		if (cryptoParams.keySize !== sjcl.bitArray.bitLength(chatKey)) {
			throw Error('Wrong chat key size.');
		}
		this._chatKey = chatKey;
	} else if (_.isString(chatKey)) {
		// try standard base64 encoding
		try {
			this._chatKey = fromBase64(chatKey, 0);
		} catch (err) {
			// try url-friendly base64 encoding
			this._chatKey = fromBase64(chatKey, 1);
		}
	}
	// update messager & user
	if (_.isNull(this._chatKey)) {
		this._crypto = null;
		this.messager = null;
		this.user = null;
	} else {
		this._crypto = new Crypto({
			secretKey: this._chatKey,
			options: {adata: this._id}
		});
		this.messager = new Messager(this._crypto);
		this.user = new User(_.extend(this.user || {}, {secretKey: this._crypto, chatId: this._id}));
	}
}
function _getServerKey() {
	if (_.isNull(this._serverKey)) {
		this._serverKey = sjcl.hash.sha256.hash(this._chatKey); // cannot easily add + this.id here, b/c id is not yet available when creating a new chat. :/
	}
	return this._serverKey;
}
function _setServerKey() {
	throw new Error('serverKey is immutable.');
}

/**
 * @constructor
 * @param {Chat|Object} [params]
 * @param {String} [params.id]
 * @param {String} [params.secret]
 * @param {Messager} [params.messager]
 * @param {User} [params.user]
 * @param {sjcl.bitArray|String} [params.chatKey]
 */
function Chat(params) {
	params = params || {};
	/** @private */
	this._crypto = params._crypto || null;
	this._joined = params._joined || false;
	this._id = params._id || null; // managed as property
	this._chatKey = params._chatKey || null; // managed as property
	this._serverKey = params._serverKey || null; // managed as property
	/** @public properties */
	Object.defineProperty(this, 'id', {
		get: _getId,
		set: _setId
	});
	Object.defineProperty(this, 'chatKey', {
		get: _getChatKey,
		set: _setChatKey
	});
	Object.defineProperty(this, 'serverKey', {
		get: _getServerKey,
		set: _setServerKey
	});
	/** @public */
	this.secret = params.secret || null; // secret used to administer the chat (delete, change options, ...)
	this.messager = params.messager || null;
	this.user = params.user || null;
	if (!(params instanceof Chat)) {
		/** we're setting `id` *after* `user`, because id updates user */
		this.id = params.id || null; // unique id
		/** we're setting `chatKey` after `user` and `messager` because both are updated */
		this.chatKey = params.chatKey || null; // secret key used for encryption & derivation (MUST NOT be transmitted)
	}
	// Map selected socket-api events to chat events.
	// All event names are verbs:
	// - If a verb is active, the event was triggered by calling a function on Chat.
	// - If a verb is passive (ends on 'ed'), the event was triggered because a remote action took place.
	var events = {
		// chatEvent: socketEvent
		connected: 'connect',
		disconnected: 'disconnect',
		messaged: 'chat/msg',
		joined: 'chat/join',
		parted: 'chat/part'
	};
	var self = this;
	_.each(events, function (socketEventName, chatEventName) {
		socketapi.on(socketEventName, function (data) { self.emitEvent(chatEventName, [data]); });
	})
}
Chat.prototype = Object.create(EventEmitter.prototype);

/**
 * @returns {sjcl.bitArray} a new randomly generated chat key.
 */
Chat.newChatKey = function () {
	return sjcl.random.randomWords(cryptoParams.keySize / 32); // word = 32 bit
}

/**
 * @param [params] - As defined by User's constructor.
 * @returns {User} a new User with the Chat's id and cipher set.
 */
Chat.prototype.newUser = function (params) {
	// We can't use _.defaults({secretKey: …}, params) because that wouldn't return a User instance if params is of type User.
	var user = new User(params);
	// We're directly modifying a User's private ivar here, because otherwide we'd have to create a clone of params first, then extend that with secretKey and then create a new User from that…
	user._crypto = this._crypto; /** @todo find a way to do this without setting a private ivar */
	user.chatId = this.id;
	return user;
}

// CRUD

Chat.prototype.new = function (callback) {
	var self = this;
	restapi.create(asBase64(self.serverKey), function (reply) {
		if (!reply.error) {
			console.log("Chat: created.");
			self.id = reply.id;
			self.secret = reply.secret;
		}
		if (_.isFunction(callback)) {
			callback.call(self, reply.error || false);
		}
	});
};

Chat.prototype.loadHistory = function (callback) {
	var self = this;
	restapi.read(self.id, asBase64(self.serverKey), self.messager, function (reply) {
		if (!reply.error) {
			console.log("Chat: read.");
		}
		if (_.isFunction(callback)) {
			callback.call(self, reply.messages || [], reply.error || false);
		}
	});
};

/**
 * @callback Chat~chatCallback
 * @param {Chat} chat - This chat.
 * @param {String|false} error - false or an error message.
 */

/**
 * @param {Object|Messager.Message} message - Message or Message-like object.
 * @param {Chat~chatCallback} callback
 */
Chat.prototype.post = function (message, callback) {
	var self = this;
	var cipherMessage = self.messager.cipherMessageFromPlainObj(message);
	if (socketapi.isConnected()) {
		if (_.isFunction(callback)) {
			/** @todo this will break when, e.g. we send 2 messages 'at once' & the first one fails => both eventhandlers will be triggered by the first fail, even if the second succeeds; we need to be able do itendify messages */
			socketapi.once('chat/msg:reply', function (reply) {
				callback.call(self, reply.error || false);
			});
		}
		socketapi.msg(self.id, cipherMessage);
	} else {
		restapi.update(self.id, asBase64(self.serverKey), cipherMessage, function (reply) {
			if (!reply.error) {
				console.log("Chat: updated.");
			}
			if (_.isFunction(callback)) {
				callback.call(self, reply.error || false);
			}
		});
	}
};

Chat.prototype.delete = function (callback) {
	var self = this;
	restapi.delete(self.id, self.secret, function (reply) {
		if (!reply.error) {
			console.log("Chat: deleted.");
		}
		if (_.isFunction(callback)) {
			callback.call(self, reply.error || false);
		}
	});
};

// socket only functionality
/** @todo this *WILL* break at some point with multiple Chat instances, because the replies don't contain any ids */

Chat.prototype.isConnected = function () {
	return socketapi.isConnected();
};

Chat.prototype.connect = function () {
	socketapi.connect(location.origin); /** @todo might be exploited, change to config */
};

Chat.prototype.isJoined = function () {
	return this._joined;
};

Chat.prototype.join = function (callback) {
	var self = this;
	if (!socketapi.isConnected() || self._joined) {
		return;
	}
	if (_.isFunction(callback)) {
		socketapi.once('chat/join:reply', function (reply) {
			if (!reply.error) {
				self._joined = true;
				self.user.serverSignature = reply.sig || null;
			}
			callback.call(self, reply.error || false, reply.sig);
		});
	}
	socketapi.join(
		self.id,
		asBase64(self.serverKey),
		self.user.nickCipher,
		self.user.signature
	);
};

Chat.prototype.part = function (callback) {
	var self = this;
	if (!socketapi.isConnected() || !self._joined) {
		return;
	}
	if (_.isFunction(callback)) {
		socketapi.once('chat/part:reply', function (reply) {
			if (!reply.error) {
				self._joined = false;
			}
			callback.call(self, reply.error || false);
		});
	}
	socketapi.part(self.id);
};

Chat.prototype.names = function (callback) {
	var self = this;
	if (!socketapi.isConnected() || !self._joined) {
		return;
	}
	if (_.isFunction(callback)) {
		socketapi.once('chat/names:reply', function (reply) {
			callback.call(self, reply.error || false, reply.infos);
		});
		socketapi.names(self.id);
	}
};

Chat.prototype.changeUser = function (params, callback) {
	var self = this;
	if (self.user && (params.nick || params.signature)) {
		if (params.nick) self.user.nick = params.nick;
		if (params.signature) self.user.uid = params.signature;
		self.user.signature = null; // reset signature
		if (self._joined) {
			// cycle (part + join) to update nick & sig
			self.part(function (partError) {
				self.join(function (joinError, serverSignature) {
					self.emitEvent('userChange', [{error: partError || joinError, serverSignature: serverSignature}]);
					if (_.isFunction(callback)) callback.call(self, partError || joinError, serverSignature);
				});
			});
		}
	}
}

return Chat;
	
});
