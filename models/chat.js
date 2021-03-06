var _ = require('underscore');
var redis = require('redis');
var crypto = require('crypto');
var util = require('util');

var config = require('../config.json');

var db = redis.createClient();

function now() {
	return parseInt(Date.now() / 1000);
}

/*
	Chat can be called with either an object, a function, both (obj, func), or none.
	If an object is supplied, it will be used to initialize the Chat's attributes.
	If a function is supplied, it will be called once the initialisation is done.
	ONLY if no id is supplied (via object), a new id will be generated and stored in the database.
*/
function Chat() {
	var obj = {},
		callback = null;
	// parse arguments (accepts: (obj), (func), (obj, func))
	if (arguments.length) {
		var arg0 = arguments[0];
		if (_.isFunction(arg0)) {
			callback = arg0;
		} else if (_.isObject(arg0)) {
			obj = arg0;
			var arg1 = arguments[1];
			if (_.isFunction(arg1)) {
				callback = arg1;
			}
		}
	}
	// initialize Chat
	var ima = now();
	this.id = obj.id || null; // unique id string
	this.secret = obj.secret || null; // secret used to administer the chat (delete, change options, ...)
	this.messages = obj.messages || []; // chronologically sorted list of messages
	this.key = obj.key || null; // key used for authentification
	this.created = obj.created || ima; // timestamp
	this.modified = obj.modified || ima; // timestamp
	this.touched = obj.touched || ima; // timestamp
	// create new db entry if no id was supplied
	if (_.isNull(this.id)) {
		this.new(callback);
	} else if (_.isFunction(callback)) {
		callback(this);
	}
}
exports.Chat = Chat;

/**
 * Creates a new Chat instance and fills in all data from database, except `messages`.
 * Use with caution! This object will contain the plaintext `key` and `secret`.
 * Calling this function does not change the `touched` timestamp.
 * @param {Function} callback - function(Chat)
 * @static
 */
Chat.chatFromId = function (id, callback) {
	var chat = new Chat({id: id});
	var keys = ['secret', 'key', 'created', 'modified', 'touched'];
	var dbKey = util.format('chat:%s:', id);
	var terminator = _.last(keys);
	_.each(keys, function (key) {
		db.get(dbKey + key, function (err, value) {
			if (!err) {
				chat[key] = value;
			}
			if (key === terminator) {
				callback(chat);
			}
		});
	});
}

Chat.prototype.checkKey = function (callback) {
	var self = this;
	if (!_.isString(self.id)) {
		callback(false, 'invalid id.');
	} else {
		var dbKey = util.format('chat:%s:key', self.id);
		db.get(dbKey, function (err, key) {
			if (err) {
				callback(false, err);
			} else {
				callback(self.key === key, 'key does not match.');
			}
		});
	}
};

/**
 * Updates the timestamps of database entries for the passed keys.
 * Also updates the TTL of all the Chat's db entries.
 * @param {...String} key - One or more of 'created', 'modified', and 'touched'.
 */
Chat.prototype._updateTimestamps = function () {
	var self = this;
	// turn [arg1, arg2, …] into {arg1: 1, arg2: 1, …}
	var args = _.chain(arguments)
		.map(function (e) { return [e, 1]; }).object()
		.pick('created', 'modified', 'touched').value();
	// ttl order: created > modified > touched
	var ttl = args.created ? config.ttl.created
		: (args.modified ? config.ttl.modified
		: (args.touched ? config.ttl.touched
		: null));
	if (ttl) {
		var multi = db.multi();
		var dbKey = util.format('chat:%s:', self.id);
		// update timestamp values
		var ima = now();
		_.each(args, function (value, key) {
			self[key] = ima;
			multi.set(dbKey + key, ima);
		});
		// update ttl
		multi.ttl(dbKey + 'secret', function (err, value) { // we're checking secret here because that's the one key that *always* exists
			// we need to re-set ttl for the updated timestamps
			var keys = value < ttl ? ['secret', 'messages', 'key', 'created', 'modified', 'touched'] : _.keys(args);
			ttl = Math.max(value, ttl);
			var multi = db.multi();
			_.each(keys, function (key) {
				multi.expire(dbKey + key, ttl);
			});
			multi.exec();
		});
		multi.exec();
	}
};

/**
 * A dummy function used when no callback is supplied.
 * Keeps us from having to check every time wether callback is a function.
 */
function _noop() {}

Chat.prototype.new = function (callback) {
	var self = this;
	if (!_.isFunction(callback)) callback = _noop;
	crypto.randomBytes(config.secretLength, function (err, randomBuffer) { // when encoding Base64, use a len %3
		if (err) return callback(err);
		db.incr('chatCounter', function (err, chatCounter) {
			if (err) return callback(err);
			self.id = chatCounter.toString();
			self.secret = randomBuffer.toString('base64');
			// update key, secret & timestamps
			var dbKey = util.format('chat:%s:', self.id);
			if (_.isString(self.key) && config.minKeyLength <= self.key.length && self.key.length <= config.maxKeyLength) {
				// NOTE: node_redis seems to break binary data somehow
				//       so self.key better be encoded in base64 or something,
				//       otherwise this will probably end in a key mismatch.
				db.set(dbKey + 'key', self.key);
			}
			db.set(dbKey + 'secret', self.secret);
			self._updateTimestamps('touched', 'modified', 'created');
			// call back
			callback(self);
		});
	});
};

Chat.prototype.loadMessages = function (callback) {
	var self = this;
	if (!_.isFunction(callback)) callback = _noop;
	self.checkKey(function (success, err) {
		if (!success) {
			return callback(err);
		}
		var dbKey = util.format('chat:%s:', self.id);
		db.lrange(dbKey + 'messages', -config.message.count, -1, function (err, messages) {
			if (err) return callback(err);
			self.messages = messages;
			self._updateTimestamps('touched');
			// call back
			callback(self);
		});
	});
};

Chat.prototype.addMessage = function (msg, callback) {
	var self = this;
	if (!_.isFunction(callback)) callback = _noop;
	// check message length
	if (msg.length > config.message.length) {
		return callback('message too long.');
	}
	self.checkKey(function (success, err) {
		if (!success) {
			return callback(err);
		}
		var dbKey = util.format('chat:%s:', self.id);
		db.rpush(dbKey + 'messages', msg, function (err, count) {
			if (err) return callback(err);
			// remove surplus messages from db & local buffer
			db.ltrim(dbKey + 'messages', -config.message.count, -1); // ltrim is [start, end]
			self.messages = self.messages.slice(-config.message.count + 1); // slice is [start, end); we want to slice away one more than allowed so we have space to push the new message
			// add message to local buffer
			self.messages.push(msg);
			self._updateTimestamps('touched', 'modified');
			// call back
			callback(self);
		});
	});
};

Chat.prototype.delete = function (callback) {
	var self = this;
	if (!_.isFunction(callback)) callback = _noop;
	if (!_.isString(self.id)) {
		return callback('invalid id.');
	}
	var dbKey = util.format('chat:%s:', self.id);
	db.get(dbKey + 'secret', function (err, secret) {
		if (err) return callback(err);
		if (self.secret !== secret) {
			return callback('secret does not match.');
		}
		db.multi()
			.del(dbKey + 'secret')
			.del(dbKey + 'messages')
			.del(dbKey + 'key')
			.del(dbKey + 'created')
			.del(dbKey + 'modified')
			.del(dbKey + 'touched')
			.exec();
		// call back
		callback(self);
	});
};
