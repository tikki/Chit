"use strict";
define(
	['underscore', 'jquery', 'chat/singletons', 'chat/ringbuffer'],
	function (_,    $,        singletons,        RingBuffer) {

var commands = {
	help: {
		help: '',
		func: function (commandName) {
			if (commandName) {
				if (!commands[commandName]) {
					return singletons.logger.error('No such command.');
				}
				return singletons.logger.info('/' + commandName + ' ' + commands[commandName].help);
			}
			singletons.logger.info('Available commands: ' + _.keys(commands).sort().join(', '));
			singletons.logger.info('Type /help <command> for details on the command.');
		}
	},
	nick: {
		help: '<nickname>: Changes your current display name to <nickname>.',
		func: function (newNick) {
			if (!newNick) {
				return commands.help.func('nick');
			}
			newNick = newNick.trim();
			singletons.userlist.remove(singletons.chat.user);
			singletons.chat.changeUser({nick: newNick}, function (error) {
				// this will only be executed if we had joined before.
				// if that's the case, no matter if changing the nick worked or not, we want the user to be added back to the user list.
				singletons.userlist.add(singletons.chat.newUser(singletons.chat.user)).addClass('highlight');
			});
			singletons.logger.info('Set nickname: ' + newNick);
			// automatically connect
			if (!singletons.chat.isConnected()) {
				commands.connect.func();
			}
		}
	},
	sig: {
		help: '<signature>: Changes your current signature to <signature>.',
		func: function (newSignature) {
			if (!newSignature) {
				return commands.help.func('sig');
			}
			newSignature = newSignature.trim();
			singletons.userlist.remove(singletons.chat.user);
			singletons.chat.changeUser({signature: newSignature}, function (error, serverSignature) {
				singletons.userlist.add(singletons.chat.newUser(singletons.chat.user)).addClass('highlight');
			});
			singletons.logger.info('New signature set.');
		}
	},
	connect: {
		help: ': Connects to the server.',
		func: function () {
			if (singletons.chat.isConnected()) {
				return singletons.logger.error('Already connected.');
			}
			if (!singletons.chat.user.nick) {
				return singletons.logger.error('Please use /nick to set a nickname first.');
			}
			singletons.logger.info('Connecting…');
			singletons.chat.connect();
		}
	},
	// disconnect: {
	// 	help: ': Disconnects from the server.',
	// 	func: function () {
	// 		singletons.logger.info('Disconnecting…');
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
			singletons.logger.error(command + ': unknown command.');
		} else {
			commands[command].func.apply(this, params);
		}
		return true;
	}
	return false;
}

function popInputValue(inputElement) {
	var val = inputElement.val();
	inputElement.val('');
	return val;
}

$(function () {
	// references
	var logger = singletons.logger;
	var chat = singletons.chat;
	var completor = singletons.completor;
	var msgInput = $('#message-input');
	var inputHistory = new RingBuffer(20, true);
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
			var text = popInputValue(msgInput).trim();
			// check text
			if (!text.length) {
				return;
			}
			// add current message to buffer & reset index
			inputHistory.add(text);
			// check if text is a command
			var parsed = parseInput(text);
			if (parsed === false) {
				// enforce socket connection
				if (!chat.isConnected()) {
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
				// send message
				chat.post(message, function (error) {
					if (error) {
						logger.addTags(msgId, 'error');
					} else {
						if (chat.isConnected()) {
							// if the message was sent via socket, the server will send us the message back soon (like any other message).
							logger.removeMessage(msgId);
						} else {
							logger.removeTags(msgId, 'unconfirmed');
						}
					}
				});
			}
		};
	}).keydown(function (event) {
		if (event.keyCode === 38) { // 38: cursor-up
			event.preventDefault();
			// load next message from buffer into input
			msgInput.val(inputHistory.prev());
		} else if (event.keyCode === 40) { // 40: cursor-down
			event.preventDefault();
			inputHistory.resetPrev();
			var msg = popInputValue(msgInput).trim();
			if (msg.length) {
				inputHistory.add(msg);
			}
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
	logger.info('Type /help for a list of commands.');
	logger.info('Type /nick <nickname> to set a nickname and connect.');
});

});
