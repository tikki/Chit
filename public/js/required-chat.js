'use strict';

require.config({
	baseUrl: 'js/lib',
	paths: {
		jquery: 'jquery-2.0.3.min',
		sjcl: 'sjcl/sjcl',
		underscore: 'underscore-min',
		eventemitter: 'EventEmitter/EventEmitter.min',
		chat: '../chat',
		socketio: '/socket.io/socket.io'
	},
	shim: {
		'underscore': {
			exports: '_'
		},
		'sjcl': {
			exports: 'sjcl'
		},
		'socketio': {
			exports: 'io'
		}
	}
});

require(
	['underscore', 'jquery', 'sjcl', 'chat/user', 'chat/singletons', 'chat/notifications', 'chat/cryptoParams', 'chat/ui', 'chat/ui-setup'],
	function (_,    $,        sjcl,   User,        singletons,        notifications,        cryptoParams) {

// website interaction
$(document).on('click', 'a.auto-link', function (event) {
	var url = $(this).attr('href');
	// if (!confirm('You are about to open this URL:\n' + url)) {
		event.preventDefault();
	// } else {
		window.open(url, '_blank'); // force to open in new tab
	// }
});

var _logMessageHighlightRegex = null; //new RegExp('\\b' + chat.user.nick + '\\b', 'i');
function prepareLogMessage(message, notifyOnHighlight) {
	// check for highlight
	var text = message.text;
	if (_logMessageHighlightRegex && _logMessageHighlightRegex.test(text)) {
		message.tags = 'highlight';
		if (notifyOnHighlight) {
			// Cut the text for the notification.
			if (text.length > 100) {
				text = text.slice(0, 100) + '…';
			}
			notifications.notify('<' + message.from + '> ' + text);
		}
	}
	// If we want to alter the name we need to calculate the message color beforehand.
	if (_.isString(message.from)) {
		message.color = User.calculateColor(message.from, message.signature);
		message.from = '<' + message.from + '>';
	}
	return message;
}

$(function () {
	// pull singletons into local namespace and connect to DOM elements
	var userlist = singletons.userlist;
	userlist.ul = $('#user-list');
	var logger = singletons.logger;
	logger.ul = $('#message-history');
	var chat = singletons.chat;
	var completor = singletons.completor;

	// set references
	var footer   = $('footer');
	var content  = $('#content');

	// set up notifications
	if (notifications.permission() === notifications.unknown) {
		setFooterHeight('2.5em'); // show footer; contains the question on wether to enable notifications.
	}
	$('#notification-yes').click(function () {
		setFooterHeight(0);
		notifications.requestPermission();
	});
	$('#notification-no').click(function () {
		setFooterHeight(0);
	});
	function setFooterHeight(height) {
		content.animate({
			'bottom': height
		});
		footer.animate({
			'height': height
		});
	}

	// Show gradient overlays when appropriate.
	var msgHistory = $('#message-history');
	var gradientTop = $('#gradient-overlay-top');
	var gradientBottom = $('#gradient-overlay-bottom');
	msgHistory.scroll(function (event) {
		// top gradient
		if (msgHistory.scrollTop()) {
			gradientTop.show();
		} else {
			gradientTop.hide();
		}
		// bottom gradient
		var lastChild = msgHistory.children(':last');
		var lastChildBottom = lastChild.position().top + lastChild.height() - 1; // add a pixel for tolerance
		if (lastChildBottom > msgHistory.height()) {
			gradientBottom.show();
		} else {
			gradientBottom.hide();
		}
	});

	// Define some chat event callbacks.
	function handleJoinReply(error) {
		if (error) {
			// chat.disconnect();
			return logger.error('Error joining: ' + error);
		}
		logger.info('Joined chat#' + chat.id + '.');
		// load history
		logger.info('Loading chat history…');
		chat.loadHistory(function (plainObjs, error) {
			if (error) {
				logger.error('Could not load chat history. (' + error + ')');
			} else {
				logger.info('--- History start ---');
				_.each(plainObjs, function (message) {
					// Add the names of all former users to the completor.
					if (message.from !== chat.user.nick) {
						completor.add(message.from);
					}
					logger.log(prepareLogMessage(message), true);
				});
				logger.info('--- History end ---');
			}
		});
		// load list of other connected users
		logger.info('Requesting names…');
		chat.names(handleNamesReply);
	}
	function handleNamesReply(error, data) {
		if (error) {
			return logger.error('Could not get names: ' + error);
		}
		logger.info('Got a list of connected users.');
		userlist.removeAll();
		_.each(data, function (info) {
			var user = chat.newUser({
				serverSignature: info.sig || null,
				nickCipher: info.nick || null
			});
			var li = userlist.add(user);
			if (user.equalTo(chat.user)) {
				li.addClass('highlight');
			} else { // we don't want to add outselves to the autocomplete
				completor.add(user.nick);
			}
		});
	}
	// Listen for chat events.
	chat.on('connected', function (data) {
		logger.info('Connected.');
		// set highlight regex
		_logMessageHighlightRegex = new RegExp('\\b' + chat.user.nick + '\\b', 'i'); /** @todo globally => bad! */
		logger.info('Joining chat…');
		chat.join(handleJoinReply);
	});
	chat.on('disconnected', function (data) {
		logger.info('Disconnected.');
	});
	chat.on('joined', function (data) {
		var user = chat.newUser({nickCipher: data.nick, serverSignature: data.sig});
		userlist.add(user);
		completor.add(user.nick);
		logger.log({from: user, text: 'joined.', tags: 'info'});
	});
	chat.on('parted', function (data) {
		var user = chat.newUser({nickCipher: data.nick, serverSignature: data.sig});
		userlist.remove(user);
		logger.log({from: user, text: 'quit.', tags: 'info'});
	});
	chat.on('messaged', function (data) {
		var message = chat.messager.plainObjFromCipherMessage(data.msg);
		logger.log(prepareLogMessage(message, true));
	});
	chat.on('userChange', function (data) {
		if (!data.error) {
			_logMessageHighlightRegex = new RegExp('\\b' + chat.user.nick + '\\b', 'i'); /** @todo globally => bad! */
		}
	});
}); // $()
}); // require()
