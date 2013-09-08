"use strict";
define(function () {
/**
 * A constant sized ring buffer.
 * Works like a stack with new elements pushing out old ones.
 * 
 * @example
 * var buffer = new RingBuffer(2);
 * buffer.add(1);
 * buffer.get(0) === buffer.get(1); // => true
 * buffer.add(2).add(3); // buffer._buf => [3, 2]
 * buffer.get(5); // => 2
 * 
 * @constructor
 * @param {Number|Array} size - The size of the ring buffer or an Array to use as buffer.
 * @param {Boolean} [unique=false] - When adding a duplicate value, put it on top of the stack and remove the old one. (Warning: Destroys item order!)
 */
function RingBuffer(size, unique) {
	if (Array.isArray(size)) {
		this._buf  = size;
		this._size = size.length; // Number of elements currently stored in _buf.
	} else {
		this._buf  = new Array(size);
		this._size = 0; // Number of elements currently stored in _buf.
	}
	this._unique = unique || false;
	this._ptr  = -1; // Index of the last used slot in _buf.
	this._next = 0; // Counter used by RingBuffer.next().
}

/**
 * Push a new element into the Ring.
 * @param something - The new element.
 */
RingBuffer.prototype.add = function(something) {
	var addsNewElement = true;
	if (this._unique) {
		var dupePtr = this._buf.indexOf(something);
		if (dupePtr !== -1) {
			// Pull the duplicate value to the top of the stack/current position.
			// To maintain order, we'd have to shift all elements. That's too costly.
			// So we'll just switch the current top element for the duplicate one.
			this._buf[dupePtr] = this._buf[this._ptr];
			addsNewElement = false;
		}
	}
	if (addsNewElement) {
		this._ptr  = (this._ptr + 1) % this._buf.length;
		this._size = Math.min(this._buf.length, this._size + 1);
	}
	this._next = 0; // reset next-cycle
	this._buf[this._ptr] = something;
	return this;
};

/**
 * @param {Number} [index] - The index of the element to return, where 0 is the newest.
 * @returns the specified element.
 */
RingBuffer.prototype.get = function(index) {
	if (!index) index = 0;
	var size = this._size;
	index = (((this._ptr - index) % size) + size) % size; // Necessary(?) to properly project negative values into our modulo space.
	return this._buf[index];
};

/**
 * Cycles through the buffered elements when called repeatedly.
 * @returns the next element, or undefined once a full cycle is finished.
 */
RingBuffer.prototype.next = function() {
	var index = this._next++;
	if (index >= this._size) {
		this._next = 0;
		return;
	}
	return this.get(index);
};

/**
 * Resets the internal next-index.
 */
RingBuffer.prototype.resetNext = function() {
	this._next = 0;
	return this;
};

return RingBuffer;

});
