"use strict";
define(['sjcl', 'chat/cryptoParams'], function (sjcl, cryptoParams) {
/**
 * @module chat/crypto
 * @exports Crypto
 */

/**
 * Offers methods to encrypt and decrypt using the configured standard parameters.
 * @constructor
 * @param {Object} params
 * @param {sjcl.bitArray} params.secretKey - The key used for encryption and decryption.
 * @param {Object} [params.options] - Parameters to overwrite the global crypto parameters.
 */
function Crypto(params) {
	// private:
	this._options = _.extend(_.clone(cryptoParams), params.options);
	this._prp = new sjcl.cipher[this._options.cipher](params.secretKey);
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
	options = _.extend(_.clone(this._options), options);
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
	options = _.extend(_.clone(this._options), options);
	var iv = sjcl.codec.base64.toBits(cipherObj.iv);
	var ct = sjcl.codec.base64.toBits(cipherObj.ct);
	var plaintext = sjcl.mode[options.mode].decrypt(this._prp, ct, iv, options.adata, options.tagSize);
	return sjcl.codec.utf8String.fromBits(plaintext);
};

return Crypto;

});
