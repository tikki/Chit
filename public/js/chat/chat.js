define(
	['jquery', 'underscore', 'sjcl', 'chat/messager', 'chat/cryptoParams', 'chat/user', 'chat/rest-client', 'chat/socket-client'],
	function ($, _,           sjcl,   Messager,        cryptoParams,        User,        restapi,            socketapi) {

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
 * @param {sjcl.bitArray|String|null} chatKey - A bitArray or BASE64 encoded String, or `null` to generate a new random key.
 */
function _setChatKey(chatKey) {
	this._serverKey = null; // reset serverKey
	// handle new chatKey
	if (_.isNull(chatKey)) {
		// generate a new chat key
		if (sjcl.random.isReady()) {
			this._chatKey = sjcl.random.randomWords(cryptoParams.keySize / 32); // word = 32 bit
		}
	} else if (_.isArray(chatKey)) {
		if (cryptoParams.keySize !== sjcl.bitArray.bitLength(chatKey)) {
			throw Error('Wrong chat key size.');
		}
		this._chatKey = chatKey;
	} else {
		this._chatKey = fromBase64(chatKey, 1);
	}
	// update messager & user
	this.messager = new Messager(this._chatKey);
	this.user = new User(_.extend(this.user || {}, {secretKey: this._chatKey}));
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
 * id
 * secret
 * messager
 * user
 * chatKey
 * serverKey
 */
function Chat(config) {
	config = config || {};
	/** @private */
	this._id = null; // managed as property
	this._chatKey = null; // managed as property
	this._serverKey = null; // managed as property
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
	this.secret = config.secret || null; // secret used to administer the chat (delete, change options, ...)
	this.messager = config.messager || null;
	this.user = config.user || null;
	/** we're setting `id` *after* `user`, because id updates user */
	this.id = config.id || null; // unique id
	/** we're setting `chatKey` after `user` and `messager` because both are updated */
	this.chatKey = config.chatKey || null; // secret key used for encryption & derivation (MUST NOT be transmitted)
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
		socketapi.msg(self.id, cipherMessage);
		callback.call(self, 'HACK--sent-via-socket'); // let's inform the caller that it was sent via socket; it's the best we can do. :|
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

return Chat;
	
});
