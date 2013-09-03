"use strict";
define(
	['underscore', 'jquery', 'chat/singletons', 'chat/socket-client'],
	function (_,    $,        singletons,        socketapi) {

var commands = {
	help: {
		help: '',
		func: function (commandName) {
			if (commandName) {
				if (!commands[commandName]) {
					return 'No such command.';
				}
				return '/' + commandName + ' ' + commands[commandName].help;
			}
			singletons.logger.log('Available commands: ' + _.sortBy(_.keys(commands), _.identity).join(', '));
			singletons.logger.log('Type /help <command> for details on the command.');
		}
	},
	nick: {
		help: '<nickname>: Changes your current display name to <nickname>.',
		func: function (newNick) {
			newNick = newNick.trim();
			singletons.chat.user.nick = newNick;
			singletons.chat.user.signature = null; // reset signature
			singletons.logger.log('New nickname: ' + newNick);
		}
	},
	sig: {
		help: '<signature>: Changes your current signature to <signature>.',
		func: function (newSignature) {
			newSignature = newSignature.trim();
			singletons.chat.user.uid = newSignature;
			singletons.chat.user.signature = null; // reset signature
			singletons.logger.log('New signature set.');
		}
	},
	connect: {
		help: ': Connects to the server.',
		func: function () {
			singletons.logger.log('Connecting…');
			if (socketapi.isConnected()) {
				socketapi.events.connect();
			} else {
				socketapi.connect(location.origin); /** @todo might be exploited, change to config */
			}
		}
	},
	disconnect: {
		help: ': Disconnects from the server.',
		func: function () {
			singletons.logger.log('Disconnecting…');
			socketapi.disconnect();
		}
	}
};

/**
 * Parses text for commands.
 * @returns {Boolean} true if text is a command, otherwise false.
 */
function parseInput(text) {
	if (text.slice(0, 1) === '/') {
		var params = text.slice(1).split(' ');
		var command = params.slice(0, 1)[0].toLowerCase();
		params = params.slice(1);
		if (!commands[command]) {
			return command + ': unknown command.';
		}
		return commands[command].func.apply(this, params) || true;
	}
	return false;
}

var sentMessageBuffer = {
	init: function (size) {
		this._buf = new Array(size);
		this._ptr = 0;
	},
	add: function (msg) {
		// store msg
		this._buf[this._ptr] = msg;
		// update pointer
		this._ptr = (this._ptr + 1) % this._buf.length;
	},
	get: function (i) {
		i = Math.min(this._buf.length - 1, i);
		i = this._ptr - 1 - i;
		i = (i + this._buf.length) % this._buf.length;
		return this._buf[i];
	},
	index: 0
};
sentMessageBuffer.init(20);

$(function () {
	// var msgBufferIndex = 0;
	var logger = singletons.logger;
	var chat = singletons.chat;
	var msgInput = $('#message-input');
	// auto-focus on msg input when typing on the page
	$('html').keypress(function () {
		msgInput.focus();
	});
	// add functionality to msg input (text sending & history access)
	msgInput.keypress(function (event) {
		if (event.keyCode == 13) { // 13 = return
			// get message text
			var text = msgInput.val().trim();
			msgInput.val('');
			// check text
			if (!text.length) {
				return;
			}
			// add current message to buffer & reset index
			sentMessageBuffer.add(text);
			sentMessageBuffer.index = 0;
			// check if text is a command
			var parsed = parseInput(text);
			if (parsed !== false) {
				event.preventDefault();
				if (_.isString(parsed)) {
					logger.log(parsed);
				}
				logger.scrollToLatest();
			} else {
				// build plain-message object
				var message = {
					text: text,
					from: chat.user.nick || undefined,
					signature: chat.user.signature,
					tags: 'unconfirmed'
				}
				// log message
				var msgId = logger.log(message);
				logger.scrollToLatest();
				// send message
				chat.post(message, function (error) {
					if (error === 'HACK--sent-via-socket') {
						// this is a hack. :|
						// if something was sent via socket, there's no immediate feedback we could wait for.
						// so we just assume it's okay and we delete the message and hope for the answer to come.
						logger.removeMessage(msgId);
					} else if (error) {
						logger.addTags(msgId, 'error');
					} else {
						logger.removeTags(msgId, 'unconfirmed');
					}
				});
			}
		};
	}).keydown(function (event) {
		if (event.keyCode == 38) { // cursor-up
			event.preventDefault();
			// load next message from buffer into input
			msgInput.val(sentMessageBuffer.get(sentMessageBuffer.index++));
		} else if (event.keyCode == 40) { // cursor-down
			event.preventDefault();
			if (sentMessageBuffer.index > 0) {
				// reset index
				sentMessageBuffer.index = 0;
			} else {
				// add current message to buffer (without sending)
				var msg = msgInput.val();
				if (msg.length) {
					sentMessageBuffer.add(msg);
				}
			}
			// clear message input
			msgInput.val('');
		}
	});
	_.delay(function () { logger.log('Type /help for a list of commands.') }, 100); /** @todo relying on a delay is bad. */
});

});
