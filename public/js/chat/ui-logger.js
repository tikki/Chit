"use strict";
define(['jquery', 'underscore', 'chat/user', 'chat/url'], function ($, _, User, url) {

/**
 * @exports Logger
 */

/**
 * @returns a String in format HH:mm:ss (local time) from a a UTC timestamp (seconds since 1970)
 */
function prettyTime(timestamp) {
	var time = new Date(timestamp * 1000);
	time = [time.getHours(), time.getMinutes(), time.getSeconds()]
	return _.map(time, function (e) {
		return e < 10 ? "0" + e : e;
	}).join(":");
}

/**
 * @constructor
 * @param {HTML-Entity} ul - The ul where to log to.
 */
function Logger(ul) {
	this.ul = $(ul);
	this._buffer = [];
	this._bufferWatchTimer = null;
	this._newMessageId();
}

/**
 * @private
 * @returns {String} a new unique message ID.
 */
Logger.prototype._newMessageId = function () {
	// We're using random to obscure how many messages have been sent.
	// It's probably a silly feature, but it doesn't cost much, so why not.
	var stepSize = 1000; // stepSize is equal to the amount of fuzziness in determining the amount of sent messages.
	if (!_.isFinite(this._messageId)) {
		// Start with a random offset so we have some kind of plausible deniability.
		this._messageId = _.random(_.random(stepSize, 2 * stepSize), stepSize * stepSize);
	}
	var newId = this._messageId + _.random(1, stepSize);
	this._messageId = newId + _.random(1, stepSize); // Do another step so the newId isn't stored permanently.
	return newId.toString();
};

/**
 * Adds a tag (HTML class) to a message.
 * @param {String} msgId - The message's unique ID.
 * @param {Array|String} tags - Array or `.`-separated list of tags.
 */
Logger.prototype.addTags = function (msgId, tags) {
	if (_.isString(tags)) {
		tags = tags.split(".");
	}
	var msg = this.msgElement(msgId);
	_.each(tags, function (tag) {
		msg.addClass(tag);
	});
};

/**
 * Removes a tag (HTML class) from a message.
 * @param {String} msgId - The message's unique ID.
 * @param {String[]|String} tags - Array or `.`-separated list of tags.
 */
Logger.prototype.removeTags = function (msgId, tags) {
	if (_.isString(tags)) {
		tags = tags.split(".");
	}
	var msg = this.msgElement(msgId);
	_.each(tags, function (tag) {
		msg.removeClass(tag);
	});
};

/**
 * @returns {Boolean} true if the buffer was successfully emptied, otherwise false.
 */
Logger.prototype._dumpBuffer = function () {
	var list = this.ul, buffer = this._buffer;
	if (buffer.length) {
		if (!list.length) {
			return false;
		} else {
			_.each(buffer, function (newLine) {
				list.append(newLine);
			});
			this._buffer = [];
		}
	}
	return true;
};

/**
 * Keeps a timer running, checking that the line buffer is emptied as soon as possible.
 */
Logger.prototype._watchBuffer = function () {
	if (_.isNull(this._bufferWatchTimer) && !this._dumpBuffer()) {
		this._bufferWatchTimer = setTimeout(_.bind(function () {
			this._bufferWatchTimer = null;
			this._watchBuffer();
		}, this), 100);
	}
};

/**
 * Add a new message to the log.
 * Automatically scrolls to the latest message unless told not to do so.
 * @param {Object|Messager.Message|String} message - Messager.Message compatible Object or text.
 * @param {Boolean} [dontScroll] - Set to true if you're logging a huge amount of messages at once.
 * @returns {String} the new message's id.
 */
Logger.prototype.log = function (message, dontScroll) {
	if (_.isString(message)) {
		message = {text: message};
	}
	// check for User
	if (message.from instanceof User) {
		var user = message.from;
		message.from = user.nick;
		message.signature = user.signature;
		message.color = user.color;
	}
	// create new line
	var msgId = message.msgId || this._newMessageId();
	var newLine = $("<li>", {
		"class": "message",
		id: "msg-" + msgId
	});
	// Attach the new line to the DOM or buffer it if no ul is set.
	if (!this.ul.length) {
		this._buffer.push(newLine);
		this._watchBuffer();
	} else {
		// Push out buffered lines first.
		this._dumpBuffer();
		this.ul.append(newLine);
	}
	// add line content
	var params = [
		["timestamp", prettyTime(message.timestamp || parseInt(Date.now() / 1000))],
		["from", message.from],
		["text", message.text]
	];
	_.each(params, function (e) {
		var name = e[0], value = e[1];
		if (value) {
			$("<span>", {"class": name})
				.text(value)
				.appendTo(newLine);
		}
	});
	// create text links
	var textElement = newLine.children('.text');
	textElement.html(url.replaceUrlsWithHtmlLinks(textElement.html()));
	// add nick color
	message.color = message.color || User.calculateColor(message.from, message.signature);
	if (message.color) {
		newLine.children('.from').css('color', message.color);
	}
	// add tags
	this.addTags(msgId, message.tags);
	//
	if (!dontScroll) {
		this.scrollToLatest();
	}
	// done.
	return msgId;
};

Logger.prototype.removeMessage = function (msgId) {
	this.msgElement(msgId).remove();
}

Logger.prototype.msgElement = function(msgId) {
	return $("#msg-" + msgId);
}

/**
 * Shorthand to log an error message.
 * @param {String} error - An error message to be logged.
 * @returns {String} the new message's id.
 */
Logger.prototype.error = function (error) {
	return this.log({text: error, tags: 'error'});
};

/**
 * Scrolls the Logger's ul so the latest log message is visible.
 */
Logger.prototype.scrollToLatest = function () {
	if (this.ul.length) {
		this.ul.scrollTop(this.ul[0].scrollHeight);
	}
};

return Logger;

});
