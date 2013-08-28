"use strict";
define(["underscore", "chat/crypto"], function (_, Crypto) {

/* 
Terminology:

Text, a String containing user data.
Message, a stringified Object containing Text and other parameters.
*/

/**
 * Messager handles creation and parsing of spec-compliant message strings,
 * to be sent to and from the chat server.
 *
 * Example usage:
 * var messager = new Messager('mysecret');
 * var plainObj = {text: "Hello, World!", from: "meee", signature: "~kekeke"}
 * var cipherMessage = messager.cipherMessageFromPlainObj(plainObj);
 * assert(plainObj == messager.plainObjFromCipherMessage(cipherMessage));
 *
 * secretKey must bit of type sjcl.bitArray.
 */
function Messager(secretKey) {
	// private:
	// this._prp = new sjcl.cipher[cryptoParams.cipher](secretKey);
	this._crypto = new Crypto(secretKey);
}

/**
 * Constructs a message from given parameters.
 *
 * params: an Object containing any or all of the following keys:
 *         - text
 *         - timestamp: UTC timestamp (seconds since 1970-01-01 00:00:00 UTC)
 *         - from: the name of the sender
 *         - signature: a unique sender ID, will(/should) be crypted by the server
 */
Messager.prototype.cipherMessageFromPlainObj = function (params) {
	var plainJson = JSON.stringify({
		pt: params.text,
		ts: params.timestamp || parseInt(Date.now() / 1000), // Date.now() returns a UTC timestamp in ms
		us: params.from
	});
	var cipherObj = this._crypto.encryptedObjFromString(plainJson);
	// add signature
	if (_.isString(params.signature)) {
		cipherObj.sg = params.signature;//hash(salted?UserSignature);
	}
	// return as json string.
	return JSON.stringify(cipherObj);
};

/**
 * Inverse function for cipherMessageFromPlainObj.
 */
Messager.prototype.plainObjFromCipherMessage = function (cipherMessage) {
	var cipherObj = JSON.parse(cipherMessage);
	var plainObj = JSON.parse(this._crypto.decryptedStringFromObj(cipherObj))
	// return a cleaned up object.
	return {
		text: plainObj.pt,
		timestamp: plainObj.ts,
		from: plainObj.us,
		signature: cipherObj.sg,
		server_timestamp: cipherObj.ts
	};
};

return Messager;

});
