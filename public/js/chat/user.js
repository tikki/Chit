"use strict";
define(['sjcl', 'chat/crypto'], function (sjcl, Crypto) {

/**
 * Represents a user.
 * Automatically calculates the other when setting either nick or nickCipher.
 * @constructor
 */
function User(params) {
	params = params || {};
	// private:
	this._crypto = new Crypto(params.secretKey);
	this._nick = null; // managed as property
	this._nickCipher = null; // managed as property
	// nick/cipher properties
	Object.defineProperty(this, 'nick', {
		get: function () {
			return this._nick;
		},
		set: function (newNick) {
			if (_.isString(newNick)) {
				this._nick = newNick;
				this._nickCipher = JSON.stringify(this._crypto.encryptedObjFromString(newNick));
			}
		}
	});
	Object.defineProperty(this, 'nickCipher', {
		get: function () {
			return this._nickCipher;
		},
		set: function (newNickCipher) {
			if (_.isString(newNickCipher)) {
				this._nickCipher = newNickCipher;
				this._nick = this._crypto.decryptedStringFromObj(JSON.parse(newNickCipher));
			}
		}
	});
	// set public ivars
	this.nick = params.nick || null;
	this.nickCipher = params.nickCipher || null;
	this.uid = params.uid || null; // unique (signature) id
	this.chatId = params.chatId || null;
}

/**
 * Generates a unique secure signature for the user.
 * Needs uid, nick and chatId to be set.
 */
User.prototype.signature = function () {
	if (this.uid && this.nick && this.chatId) {
		var signature = this.chatId + '!' + this.nick + '!' + this.uid;
		return sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(signature), 1);
	}
};

return User;

});
