var _ = require('underscore');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Chat = require('../../../models/chat.js').Chat;

var transformSignature = require('./shared.js').transformSignature;

function CRUD () {}
util.inherits(CRUD, EventEmitter);

console.log('module CRUD was run');

/*
All functions return an Object.
The object either contains the requested data or a key `error`.
*/

/**
 * gives {id: new-unique-chat-id, secret: chat-administration-secret}
 */
CRUD.prototype.create = function (callback, key) {
	var self = this;
	new Chat({
		key: key
	}, function (chat) {
		var result;
		if (_.isString(chat)) {
			result = {error: chat};
		} else {
			result = {id: chat.id, secret: chat.secret};
			self.emit('create', {id: chat.id, time: chat.created});
		}
		callback(result);
	});
};

/**
 * gives {messages: cipher-messages, options: {…}}
 *
 * messages is an array of cipher messages.
 * options is optional.
 */
CRUD.prototype.read = function (callback, id, key) {
	var self = this;
	new Chat({
		id: id,
		key: key
	}).loadMessages(function (chat) {
		var result;
		if (_.isString(chat)) {
			result = {error: chat};
		} else {
			result = {messages: chat.messages};
			self.emit('read', {id: id, time: chat.touched});
		}
		callback(result);
	});
};

/**
 * gives {time: utc-timestamp}
 */
CRUD.prototype.update = function (callback, id, key, msg) {
	var self = this;
// 		- (impl. prop.:) a valid message has the format: encrypt_chat-key(message-counter,message-length,timestamp,message)
// 	- (impl. prop.:) server adds new-chat-message-cipher to end of data blob, removes options:maxLineLength bytes at top
// 	- server sends {'time': modified-timestamp, 'msg': new-chat-message-cipher} to all other connected clients
// 		- if other clients are connected, server sets read-timestamp to modified-timestamp
	// do some message processing
	try {
		// unpack.
		var cipherObj = JSON.parse(msg); // isn't this kinda potentially dangerous for arbitrary sized input? :f
		// extract & check wanted elements
		cipherObj = _.pick(cipherObj, 'ct', 'iv', 'sg');
		if (!_.isString(cipherObj.ct) || !cipherObj.ct.length) {
			throw "missing or invalid ct";
		}
		if (!_.isString(cipherObj.iv) || !cipherObj.iv.length) {
			throw "missing or invalid iv";
		}
		if (_.has(cipherObj, 'sg')) {
			if (!_.isString(cipherObj.sg) || !cipherObj.sg.length) {
				throw "invalid sg";
			}
			// transform signature
			cipherObj.sg = transformSignature(cipherObj.sg);
		}
		// add timestamp
		cipherObj.ts = parseInt(Date.now() / 1000);
		// repackage.
		msg = JSON.stringify(cipherObj);
	} catch (err) {
		res.type('json');
		if (_.isEmpty(err)) {
			err = "invalid message";
		}
		res.json({error: err});
		return;
	}
	//
	new Chat({
		id: id,
		key: key
	}).addMessage(msg, function (chat) {
		var result;
		if (_.isString(chat)) {
			result = {error: chat};
		} else {
			result = {time: chat.modified};
			self.emit('update', {id: id, time: chat.modified, msg: msg});
		}
		callback(result);
	});
};

/**
 * gives {}
 */
CRUD.prototype.delete = function (callback, id, secret) {
	var self = this;
	new Chat({
		id: id,
		secret: secret
	}).delete(function (chat) {
		var result;
		if (_.isString(chat)) {
			result = {error: chat};
		} else {
			result = {};
			self.emit('delete', {id: id});
		}
		callback(result);
	});
};

exports.crud = new CRUD();
