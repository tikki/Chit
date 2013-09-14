"use strict";
define(
	['underscore', 'chat/ringbuffer'],
	function (_, RingBuffer) {
/**
 * @param {String} a - The string to search in.
 * @param {String} a - The string to look for.
 * @returns {Boolean} true if a starts with b, otherwise false.
 */
function startsWith(a, b) {
	return a.slice(0, b.length) === b;
}

/**
 * Completor completes a word inside a string using a database.
 * 
 * @example
 * var completor = new Completor(),
 *     input     = $('input[type=text]');
 * completor.add('foo').add('bar');
 * while (confirm('Show another completion?')) {
 *     var r = completor.next(input.val(), input[0].selectionStart);
 *     input.val(r.text);
 *     input[0].selectionStart = input[0].selectionEnd = r.pos;
 * }
 * 
 * @constructor
 */
function Completor() {
	/** @private */
	this._db     = [];
	this._compls = null;
	this._bounds = {start: 0, end: 0};
	this._pos    = null;
	this._text   = null;
	this._complText = null;
}

/** @private */
Completor.prototype._init = function (text, pos) {
	if (!_.isNull(this._compls) && text === this._complText && pos === this._pos) {
		return;
	}
	this._text = text;
	this._pos  = pos;
	// Find the boundaries for the word at `pos`.
	this._bounds.start = _.lastIndexOf(text, ' ', pos) + 1;
	this._bounds.end   = _.indexOf(text, ' ', this._bounds.start);
	if (this._bounds.end === -1) this._bounds.end = text.length;
	// Search the database for completions.
	var word = text.slice(this._bounds.start, this._bounds.end);
	this._compls = new RingBuffer(_.filter(this._db, function (completion) {
		return startsWith(completion, word);
	}));
};

/**
 * Repeatedly calling `next` with the same text parameter and the returned
 * position will cycle through all possible completions.
 *
 * @param {String} text - The text containing the word to be completed.
 * @param {Number} pos - The position of the word to be completed.
 * @returns {text: String, pos: Number} the completed text and the new position.
 */
Completor.prototype.next = function (text, pos) {
	this._init(text, pos);
	var newWord = this._compls.prev();
	if (!newWord) {
		this._complText = this._text;
		this._pos = this._bounds.end;
	} else {
		this._complText = this._text.slice(0, this._bounds.start) + newWord;
		this._pos = this._complText.length; // Set the new pos to the end of the completed word.
		this._complText += this._text.slice(this._bounds.end);
	}
	return {text: this._complText, pos: this._pos};
};

/**
 * Adds a word to the database of completion words.
 */
Completor.prototype.add = function (word) {
	this._db.push(word);
	this._compls = null;
	return this;
};

/**
 * Removes a word from the database of completion words.
 */
Completor.prototype.remove = function (word) {
	this._db = _.without(this._db, word);
	this._compls = null;
	return this;
};

/**
 * Clears the database of completion words.
 */
Completor.prototype.removeAll = function () {
	this._db = [];
	this._compls = null;
	return this;
};

return Completor;

});
