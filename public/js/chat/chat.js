define(
	["jquery", "underscore", "sjcl", "chat/messager", "chat/cryptoParams", "chat/user"],
	function ($, _, sjcl, Messager, cryptoParams, User) {

var apiBaseUrl = "api/1/chat";

function Chat(config) {
	this.updateWithConfig(config);
}

Chat.prototype.updateWithConfig = function (config) {
	config = config || {};
	// ivars
	this.id = config.id || this.id || null; // unique id
	this.secret = config.secret || this.secret || null; // secret used to administer the chat (delete, change options, ...)
	this.messager = config.messager || this.messager || null;
	this.user = config.user || this.user || null;
	// this.messages = config.messages || this.messages || null; // chronologically sorted list of messages
	this.setChatKey(config.chatKey || this.chatKey || this.newChatKey()); // secret key used for encryption & derivation (MUST NOT be transmitted)
	this.updateServerKey(); // key used for authentification by the server
	// update url & user.id
	this.url = apiBaseUrl + "/" + this.id;
	this.user.chatId = this.id;
};

Chat.prototype.setChatKey = function (chatKey) {
	if (_.isArray(chatKey)) {
		this.chatKey = chatKey;
		this.chatKeyB64 = sjcl.codec.base64.fromBits(chatKey, 1, 1);
	} else {
		this.chatKey = sjcl.codec.base64.toBits(chatKey, 1);
		this.chatKeyB64 = chatKey;
	}
	// update messager & user
	this.messager = new Messager(this.chatKey);
	this.user = new User(_.extend(this.user || {}, {secretKey: this.chatKey}));
}

Chat.prototype.newChatKey = function () {
	return sjcl.random.randomWords(cryptoParams.keySize / 32); // word = 32 bit
};

Chat.prototype.updateServerKey = function () {
	this.serverKey = sjcl.hash.sha256.hash(this.chatKey); // cannot easily add + this.id here, b/c id is not yet available when creating a new chat. :/
	this.serverKeyB64 = sjcl.codec.base64.fromBits(this.serverKey, 1);
};

// CRUD

Chat.prototype.new = function (callback) {
	var self = this;
	var error = false;
	$.ajax({
		type: "POST",
		url: apiBaseUrl,
		data: {key: self.serverKeyB64},
		success: function (data) {
			if (data.error) {
				error = data.error || true;
			} else {
				console.log("Chat: created.");
				// self.id = data.id;
				// self.secret = data.secret;
				self.updateWithConfig({id: data.id, secret: data.secret});
			}
		},
		complete: function (xhr, status) {
			if (_.isFunction(callback)) {
				error = error || status !== 'success';
				callback.call(self, error);
			}
		},
		dataType: "json"
	});
};

Chat.prototype.loadHistory = function (callback) {
	var self = this;
	var error = false;
	var plainObjs = [];
	$.ajax({
		type: "GET",
		url: self.url,
		data: {key: self.serverKeyB64},
		success: function (data) {
			if (data.error) {
				error = data.error || true;
			} else {
				_.each(data.messages, function (cipherMessage) {
					try {
						var plainObj = self.messager.plainObjFromCipherMessage(cipherMessage);
						plainObjs.push(plainObj);
					} catch (err) {
						plainObjs.push({
							tags: ['error'],
							text: err.message
						});
					}
				});
				console.log("Chat: loadHistory.");
				// self.messages = data;
			}
		},
		complete: function (xhr, status) {
			if (_.isFunction(callback)) {
				error = error || status !== 'success';
				callback.call(self, plainObjs, error);
			}
		},
		dataType: "json"
	});
};

Chat.prototype.post = function (plainObj, callback) {
	var self = this;
	var error = false;
	// build cipher message
	var ciphertext = self.messager.cipherMessageFromPlainObj(plainObj);
	// send cipher message
	$.ajax({
		type: "PUT",
		url: self.url,
		data: {
			key: self.serverKeyB64,
			msg: ciphertext
		},
		success: function (data) {
			if (data.error) {
				error = data.error || true;
			} else {
				console.log("Chat: posted.", data.time);
			}
		},
		complete: function (xhr, status) {
			if (_.isFunction(callback)) {
				error = error || status !== 'success';
				callback.call(self, error);
			}
		},
		dataType: "json"
	});
};

Chat.prototype.delete = function (callback) {
	var self = this;
	var error = false;
	$.ajax({
		type: "DELETE",
		url: self.url,
		data: {
			secret: self.secret
		},
		success: function (data) {
			if (data.error) {
				error = data.error || true;
			} else {
				console.log("Chat: deleted.");
			}
		},
		complete: function (xhr, status) {
			if (_.isFunction(callback)) {
				error = error || status !== 'success';
				callback.call(self, error);
			}
		},
		dataType: "json"
	});
};

return Chat;
	
});
