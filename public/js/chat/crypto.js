"use strict";
define(["sjcl", "chat/cryptoParams"], function (sjcl, cryptoParams) {
/**
 * @module chat/crypto
 * @exports Crypto
 */

/**
 * Offers methods to encrypt and decrypt using the configured standard parameters.
 * @constructor
 * @param {sjcl.bitArray} secretKey - The key used for encryption and decryption.
 */
function Crypto(secretKey) {
	// private:
	this._prp = new sjcl.cipher[cryptoParams.cipher](secretKey);
}

/**
 * Encrypts a String and returns a cipher-object.
 * @param {String} plaintext
 * @returns {Object} An Object holding the ciphertext and the IV.
 */
Crypto.prototype.encryptedObjFromString = function (plaintext) {
	plaintext = sjcl.codec.utf8String.toBits(plaintext);
	var iv = sjcl.random.randomWords(4, 0);
	var ct = sjcl.mode[cryptoParams.mode].encrypt(this._prp, plaintext, iv, cryptoParams.adata, cryptoParams.tagSize);
	return {
		iv: sjcl.codec.base64.fromBits(iv, 1),
		ct: sjcl.codec.base64.fromBits(ct, 1)
	};
};

/**
 * Decrypts a cipher-object to a String.
 * @param {Object} cipherObj - An Object holding the ciphertext and the IV.
 * @returns {String} plaintext
 */
Crypto.prototype.decryptedStringFromObj = function (cipherObj) {
	var iv = sjcl.codec.base64.toBits(cipherObj.iv);
	var ct = sjcl.codec.base64.toBits(cipherObj.ct);
	var plaintext = sjcl.mode[cryptoParams.mode].decrypt(this._prp, ct, iv, cryptoParams.adata, cryptoParams.tagSize);
	return sjcl.codec.utf8String.fromBits(plaintext);
};

return Crypto;

});
