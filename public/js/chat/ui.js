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
					return singletons.logger.log('No such command.');
				}
				return singletons.logger.log('/' + commandName + ' ' + commands[commandName].help);
			}
			singletons.logger.log('Available commands: ' + _.keys(commands).sort().join(', '));
			singletons.logger.log('Type /help <command> for details on the command.');
		}
	},
	nick: {
		help: '<nickname>: Changes your current display name to <nickname>.',
		func: function (newNick) {
			if (!newNick) {
				return commands.help.func('nick');
			}
			if (socketapi.isConnected()) {
				return singletons.logger.log('[known bug] Cannot change nick while connected. (sorry :/)');
			}
			newNick = newNick.trim();
			singletons.chat.user.nick = newNick;
			singletons.chat.user.signature = null; // reset signature
			singletons.logger.log('New nickname: ' + newNick);
			// automatically connect
			commands.connect.func();
		}
	},
	sig: {
		help: '<signature>: Changes your current signature to <signature>.',
		func: function (newSignature) {
			if (!newSignature) {
				return commands.help.func('sig');
			}
			newSignature = newSignature.trim();
			singletons.chat.user.uid = newSignature;
			singletons.chat.user.signature = null; // reset signature
			singletons.logger.log('New signature set.');
		}
	},
	connect: {
		help: ': Connects to the server.',
		func: function () {
			if (!singletons.chat.user.nick) {
				return singletons.logger.log('Please use /nick to set a nickname first.');
			}
			singletons.logger.log('Connecting…');
			if (socketapi.isConnected()) {
				socketapi.events.connect();
			} else {
				socketapi.connect(location.origin); /** @todo might be exploited, change to config */
			}
		}
	},
	// disconnect: {
	// 	help: ': Disconnects from the server.',
	// 	func: function () {
	// 		singletons.logger.log('Disconnecting…');
	// 		socketapi.disconnect();
	// 	}
	// }
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
			singletons.logger.log(command + ': unknown command.');
		} else {
			commands[command].func.apply(this, params);
		}
		return true;
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
	// references
	var logger = singletons.logger;
	var chat = singletons.chat;
	var completor = singletons.completor;
	var msgInput = $('#message-input');
	// add commands to auto-completer
	_.each(commands, function (value, key) {
		completor.add('/' + key);
	});
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
			logger.scrollToLatest();
			if (parsed === false) {
				// enforce socket connection
				if (!socketapi.isConnected()) {
					commands.connect.func();
					return;
				}
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
		if (event.keyCode === 38) { // 38: cursor-up
			event.preventDefault();
			// load next message from buffer into input
			msgInput.val(sentMessageBuffer.get(sentMessageBuffer.index++));
		} else if (event.keyCode === 40) { // 40: cursor-down
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
		} else if (event.keyCode === 9) { // 9: tab
			event.preventDefault();
			var msgElement = msgInput[0];
			var pos  = msgElement.selectionStart;
			var text = msgInput.val();
			// set completion text & cursor position
			var compl = completor.next(text, pos)
			msgInput.val(compl.text);
			msgElement.selectionStart = msgElement.selectionEnd = compl.pos;
		}
	});
	logger.log('Type /help for a list of commands.');
	logger.log('Type /nick <nickname> to set a nickname and connect.');
});

});
