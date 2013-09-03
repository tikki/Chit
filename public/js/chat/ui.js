"use strict";
define(
	['underscore', 'jquery', 'chat/singletons', 'chat/socket-client'],
	function (_,    $,        singletons,        socketapi) {

var commands = {
	help: function () {
		singletons.logger.log('Available commands: ' + _.sortBy(_.keys(commands), _.identity).join(', '));
	},
	nick: function (newNick) {
		newNick = newNick[0].trim();
		singletons.chat.user.nick = newNick;
		singletons.chat.user.signature = null; // reset signature
		singletons.logger.log('New nickname: ' + newNick);
	},
	sig: function (newSignature) {
		newSignature = newSignature[0].trim();
		singletons.chat.user.uid = newSignature;
		singletons.chat.user.signature = null; // reset signature
		singletons.logger.log('New signature set.');
	},
	connect: function () {
		singletons.logger.log('Connecting…');
		if (socketapi.isConnected()) {
			socketapi.events.connect();
		} else {
			socketapi.connect(location.origin); /** @todo might be exploited, change to config */
		}
	},
	disconnect: function () {
		singletons.logger.log('Disconnecting…');
		socketapi.disconnect();
	}
};

/**
 * Parses text for commands.
 * @returns {Boolean} true if text is a command, otherwise false.
 */
function parseInput(text) {
	if (text.slice(0, 1) === '/') {
		var params = text.slice(1).split(' ');
		var command = params.slice(0, 1);
		params = params.slice(1);
		if (commands[command]) {
			return commands[command](params) || true;
		}
	}
	return false;
}

$(function () {
	var lastMsg = '';
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
			// store text
			lastMsg = text;
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
			// load last message into input
			msgInput.val(lastMsg);
		} else if (event.keyCode == 40) { // cursor-down
			event.preventDefault();
			// store current message away
			lastMsg = msgInput.val();
			msgInput.val('');
		}
	});
	_.delay(function () { logger.log('Type /help for a list of commands.') }, 100); /** @todo relying on a delay is bad. */
});

});
