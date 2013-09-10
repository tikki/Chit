"use strict";
define(['sjcl', 'chat/crypto'], function (sjcl, Crypto) {
/**
 * @exports User
 */

/**
 * getters and setters used to manage User properties
 */
function _getNick() {
	if (_.isNull(this._nick) && !_.isNull(this._nickCipher)) {
		this._nick = this._crypto.decryptedStringFromObj(JSON.parse(this._nickCipher));
	}
	return this._nick;
}
function _setNick(newNick) {
	if (_.isString(newNick)) {
		this._nick = newNick;
		this._nickCipher = null;
	}
}
function _getNickCipher() {
	if (_.isNull(this._nickCipher) && !_.isNull(this._nick)) {
		this._nickCipher = JSON.stringify(this._crypto.encryptedObjFromString(this._nick));
	}
	return this._nickCipher;
}
function _setNickCipher(newNickCipher) {
	if (_.isString(newNickCipher)) {
		this._nickCipher = newNickCipher;
		this._nick = null;
	}
}
function _getSignature() {
	if (_.isNull(this._signature)) {
		this._signature = this.calculatedSignature();
	}
	return this._signature;
}
function _setSignature(newSignature) {
	this._signature = newSignature;
}
function _getColor() {
	if (_.isNull(this._color)) {
		this._color = this.calculatedColor();
	}
	return this._color;
}
function _setColor(newColor) {
	this._color = newColor;
}

/**
 * Represents a user.
 * Automatically calculates the other when setting either nick or nickCipher.
 * @constructor
 * @param {Object|User} [params] - User or User-like Object for configuration.
 * @param {sjcl.bitArray} params.secretKey
 * @param {String} [params.nick]
 * @param {String} [params.nickCipher]
 * @param {String} [params.signature]
 * @param {String} [params.uid]
 * @param {String} [params.chatId]
 * @param {String} [params.color]
 */
function User(params) {
	params = params || {};
	/** @private */
	this._crypto = (params.secretKey ? new Crypto(params.secretKey) : params._crypto || null);
	this._nick = null; // managed as property
	this._nickCipher = null; // managed as property
	this._signature = null; // managed as property
	this._color = null; // managed as property
	/** @public properties */
	Object.defineProperty(this, 'nick', {
		get: _getNick,
		set: _setNick
	});
	Object.defineProperty(this, 'nickCipher', {
		get: _getNickCipher,
		set: _setNickCipher
	});
	Object.defineProperty(this, 'signature', {
		get: _getSignature,
		set: _setSignature
	});
	Object.defineProperty(this, 'color', {
		get: _getColor,
		set: _setColor
	});
	/** @public */
	this.nick = params.nick || null;
	this.nickCipher = params.nickCipher || null;
	this.signature = params.signature || null;
	this.uid = params.uid || null; // unique (signature) id
	this.chatId = params.chatId || null;
	this.color = params.color || null;
}

/**
 * Calculates a unique secure signature for the user.
 * Needs uid, nick and chatId to be set.
 * @returns {String|null} the generated signature as a String, otherwise null.
 */
User.prototype.calculatedSignature = function () {
	var signature = null;
	if (this.uid && this.nick && this.chatId) {
		signature = this.chatId + '!' + this.nick + '!' + this.uid;
		signature = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(signature), 1);
	}
	return signature;
};

User.prototype.equalTo = function(other) {
	// ducktyping ftw
	return this.nick === other.nick && this.signature === other.signature;
}

/**
 * A broken'ish CRC hash implementation factory.
 * Do NOT use for anything important.
 */
// var crc32 = crcMaker(32, 0x04C11DB7);
var _crc24 = _crcMaker(24, 0x232323);
function _crcMaker(size, mask) {
	return function (s) {
		var h = 0, max = ((1 << size) - 1), size1 = size - 1;
		for (var i = 0; i < s.length; ++i) {
			for (var j = 0, c = s.charCodeAt(i); c >> j; ++j) {
				if ((h >> size1) !== ((c >> j) & 1)) {
					h = ((h << 1) ^ mask) & max;
				} else {
					h = (h << 1) & max;
				}
			}
		}
		return h;
	}
}

User.calculateColor = function(nick, signature) {
	nick = nick || '';
	signature = signature || '';
	var c = _crc24(nick + '!' + signature) % 0xffffff;
	c = (100 + (c >> 16) % 100) << 16 | (100 + (c >> 8) % 100) << 8 | (100 + c % 100);
	return '#' + c.toString(16);
}
User.prototype.calculatedColor = function() {
	return User.calculateColor(this.nick, this.signature);
}

return User;

});
