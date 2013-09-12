"use strict";
define(['sjcl', 'chat/password-corpora'], function (sjcl, corpora) {

/**
 * Password generators.
 */

/**
 * @private
 * Produces a password by combining words from a corpus.
 * The current english corpus has 2284 words, which is about 11.16 bits.
 * The current german corpus has 2445 words, which is about 11.26 bits.
 *
 * @example
 * A password of size 4 would have an entropy of about 44 to bits.
 * Combined with a minimum length of 10 (about 47 bits entropy for the
 * english corpus, and a bit more for the german corpus) this makes for a
 * remarkably more secure password than most user chosen passwords.
 * 
 * By analyzing the character frequency in the corpora and resulting
 * password lengths the entropy of the password is effectively reduced;
 * though still staying well above that of a generic user chosen one.
 *
 * @param {Number} size - Amount of words to use.
 * @param {Number} minLength - Minimum length of the resulting password.
 * @param {Array} corpus - The list of words to chose from.
 */
function _combination(size, minLength, corpus) {
	var result = '';
	var cMax   = corpus.length - 1;
	for (var i = 0; i < size || result.length < minLength + 1; ++i) {
		result += ' ' + corpus[_randInt(0, cMax)];
	}
	return result.trim();
}

function english(size, minLength) {
	return _combination(size, minLength, corpora.english);
}

function german(size, minLength) {
	return _combination(size, minLength, corpora.german);
}

var _alphalow = 'abcdefghijklmnopqrstuvwxyz';
var _alphahi  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var _digit    = '0123456789';
var _special  = '!§$%&/()=?><,.-;:_*+';
function generate(length, alphabet) {
	if (!alphabet) {
		alphabet = _alphalow + _alphahi + _digit + _special;
	}
	var result = '';
	var aMax   = alphabet.length - 1;
	for (var i = 0; i < length; ++i) {
		result += alphabet[_randInt(0, aMax)];
	}
	return result;
}

/**
 * A slow but proper working (I hope/think :F) PRNG mapper built on sjcl.random.
 * @returns {Number} a random number in range [min, max].
 */
function _randInt(min, max) {
	var range = max - min + 1;
	// Assuming the range is < 2**31 makes the random word handling easy.
	// We could fix this, but it'd be complex and probably rarely ever needed.
	var maxRange = Math.pow(2, 31) - 1; // = 0x7fffffff; that's a good value because it cuts away the MSB from a 32 bit integer, which means we won't have to worry about negative numbers.
	if (range > maxRange) {
		throw RangeError('Range between min and max is too large.');
	}
	var maxMultiple = Math.floor(maxRange / range) * range;
	while (true) {
		// We'll run until a random value is found not falling in between
		// the maximum multiple of the range and the maximum random number.
		// This ensures we won't change the random distribution when using modulo.
		var rand = sjcl.random.randomWords(1)[0] & maxRange;
		if (rand < maxMultiple) {
			return min + (rand % range);
		}
	}
}
// buckets={};for(i=0;i<100000;i++){var r=_randInt(0,5);buckets[r]=(buckets[r]||0)+1};buckets

/**
 * Counts how many times a Regular Expression matches a given string.
 */
function _count(regex, s) {
	if (!regex.global) return;
	for (var c = 0; regex.exec(s) !== null; c++);
	return c;
}

/**
 * @returns {Number} a score between 0 and 100, 0 being the worst.
 */
function score(password) {
	/**
	 * @todo invest more time into a properly balanced scoring system, with
	 * requirements and positive and negative cases.
	 * Positives:
	 * - length
	 * - diversity (chars from more than one group)
	 * Negatives:
	 * - any kind of patterns
	 *   - repeated chars
	 *   - 12345
	 *   - qwert[yz]
	 *   etc.
	 */
	var score = 0;
	score += password.length * (100 / 50); // we consider 50 chars to be 100% safe no matter what :/
	// add 8% bonus for every group used, adding up to 40%
	if (_count(/[a-z]/g, password)) score += 8;
	if (_count(/[A-Z]/g, password)) score += 8;
	if (_count(/[0-9]/g, password)) score += 8;
	if (_count(/[^\w\s]/g, password)) score += 8;
	if (_count(/\s/g, password)) score += 8;
	return Math.min(parseInt(score), 100);
}

return {
	english: english,
	german: german,
	generate: generate,
	score: score
};

});
