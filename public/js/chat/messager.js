"use strict";
define(["underscore", "chat/crypto"], function (_, Crypto) {
/**
 * @module chat/messager
 * @exports Messager
 */

/**
 * Messager handles creation and parsing of spec-compliant message strings,
 * to be sent to and from the chat server.
 * @constructor
 * @param {sjcl.bitArray|Crypto} secretKey - The key used for encryption and decryption or a Crypto instance.
 *
 * @example
 * var messager = new Messager('mysecret');
 * var plainObj = {text: "Hello, World!", from: "meee", signature: "~kekeke"}
 * var cipherMessage = messager.cipherMessageFromPlainObj(plainObj);
 * assert(plainObj == messager.plainObjFromCipherMessage(cipherMessage));
 */
function Messager(secretKey) {
	/** @private */
	this._crypto = secretKey instanceof Crypto ? secretKey : new Crypto(secretKey);
}

/**
 * Constructs a message from given parameters.
 * @param {Object|Message} params - A Message or Message-like Object, can also include a `signature` (a unique sender ID)
 * @returns {String} JSON serialized cipher message.
 */
Messager.prototype.cipherMessageFromPlainObj = function (params) {
	var plainMessage = new Message(params).asPlainMessage();
	var cipherObj = this._crypto.encryptedObjFromString(plainMessage);
	// add signature
	if (_.isString(params.signature)) {
		cipherObj.sg = params.signature;//hash(salted?UserSignature);
	}
	// return as json string.
	return JSON.stringify(cipherObj);
};

/**
 * Inverse function for cipherMessageFromPlainObj.
 * @param {String} JSON serialized cipher message.
 * @returns {Message} a new Message including the signature and server-timestamp.
 */
Messager.prototype.plainObjFromCipherMessage = function (cipherMessage) {
	var cipherObj = JSON.parse(cipherMessage);
	var message = new Message(JSON.parse(this._crypto.decryptedStringFromObj(cipherObj)));
	// add signature and server-timestamp.
	message.signature = cipherObj.sg;
	message.serverTimestamp = cipherObj.ts;
	return message;
};

/**
 * Creates a datastructure representing a plain message as used by the Messager.
 * @constructur
 * @param {Object|Message} params - Data to create a new message from.
 * @param {String} params.text
 * @param {String} [params.pt] - alias for text
 * @param {String} [params.from]
 * @param {String} [params.us] - alias for from
 * @param {Number} [params.timestamp]
 * @param {Number} [params.ts] - alias for timestamp
 * @param {String} [params.msgId]
 * @param {String[]|String} [params.tags] - Array or `.`-separated list of tags.
 * @param {String} [params.signature]
 * @param {Number} [params.serverTimestamp]
 */
function Message(params) {
	params = params || {};
	/** @public The text to be sent. */
	this.text = params.text || params.pt || null;
	/** @public The name of the sender. */
	this.from = params.from || params.us || null;
	/** @public UTC timestamp (seconds since 1970-01-01 00:00:00 UTC). */
	this.timestamp = params.timestamp || params.ts || parseInt(Date.now() / 1000); // Date.now() returns a UTC timestamp in ms
	this.msgId = params.msgId || params.msgId || null;
	this.tags = params.tags || params.msgId || null;
	this.signature = params.signature || params.signature || null;
	this.serverTimestamp = params.serverTimestamp || params.serverTimestamp || null;
}

/**
 * Returns a normalized message as to be sent over the wire.
 * @returns {String} JSON serialized Message using the plain-message format.
 */
Message.prototype.asPlainMessage = function () {
	return JSON.stringify({
		pt: this.text,
		ts: this.timestamp,
		us: this.from
	});
};

/**
 * Compares the timestamp to the server-timestamp to check if a message is plausibly genuine.
 * @param {Number} [tolerance=3] - Seconds the timestamps are allowed to differ to be considered equal.
 * @returns {Boolean}
 */
Message.prototype.isGenuine = function (tolerance) {
	var d = Math.abs(this.timestamp - this.serverTimestamp);
	var e = tolerance || 3;
	return _.isFinite(d) && d < e;
};

Messager.prototype.Message = Message;


return Messager;

});
