var _ = require('underscore');

var Chat = require('../../../models/chat.js').Chat;

var transformSignature = require('./shared.js').transformSignature;

// CRUD interface

/*
All functions return an Object.
The object either contains the requested data or a key `error`.
*/

/**
 * gives {id: new-unique-chat-id, secret: chat-administration-secret}
 */
exports.create = function (callback, key) {
	new Chat({
		key: key
	}, function (chat) {
		var result = _.isString(chat)
			? {error: chat}
			: {id: chat.id, secret: chat.secret};
		callback(result);
	});
};

/**
 * gives {messages: cipher-messages, options: {…}}
 *
 * messages is an array of cipher messages.
 * options is optional.
 */
exports.read = function (callback, id, key) {
	new Chat({
		id: id,
		key: key
	}).loadMessages(function (chat) {
		var result = _.isString(chat)
			? ({error: chat})
			: ({messages: chat.messages});
		callback(result);
	});
};

/**
 * gives {time: utc-timestamp}
 */
exports.update = function (callback, id, key, msg) {
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
		var result = _.isString(chat)
			? {error: chat}
			: {time: chat.modified};
		callback(result);
	});
};

/**
 * gives {}
 */
exports.delete = function (callback, id, secret) {
	new Chat({
		id: id,
		secret: secret
	}).delete(function (chat) {
		var result = _.isString(chat)
			? {error: chat}
			: {};
		callback(result);
	});
};
