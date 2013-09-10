"use strict";
define(['sjcl', 'chat/cryptoParams'], function (sjcl, cryptoParams) {
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
 * @param {Object} [options] - Options to overwrite the global settings.
 * @returns {Object} An Object holding the ciphertext and the IV.
 */
Crypto.prototype.encryptedObjFromString = function (plaintext, options) {
	if (typeof plaintext !== 'string') {
		throw TypeError('plaintext must be a string.');
	}
	options = _.extend(_.clone(cryptoParams), options);
	plaintext = sjcl.codec.utf8String.toBits(plaintext);
	var iv = sjcl.random.randomWords(4, 0);
	var ct = sjcl.mode[options.mode].encrypt(this._prp, plaintext, iv, options.adata, options.tagSize);
	return {
		iv: sjcl.codec.base64.fromBits(iv, 1),
		ct: sjcl.codec.base64.fromBits(ct, 1)
	};
};

/**
 * Decrypts a cipher-object to a String.
 * @param {Object} cipherObj - An Object holding the ciphertext and the IV.
 * @param {Object} [options] - Options to overwrite the global settings.
 * @returns {String} plaintext
 */
Crypto.prototype.decryptedStringFromObj = function (cipherObj, options) {
	options = _.extend(_.clone(cryptoParams), options);
	var iv = sjcl.codec.base64.toBits(cipherObj.iv);
	var ct = sjcl.codec.base64.toBits(cipherObj.ct);
	var plaintext = sjcl.mode[options.mode].decrypt(this._prp, ct, iv, options.adata, options.tagSize);
	return sjcl.codec.utf8String.fromBits(plaintext);
};

return Crypto;

});
