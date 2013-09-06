'use strict';

require.config({
	baseUrl: 'js/lib',
	paths: {
		jquery: 'jquery-2.0.3.min',
		sjcl: 'sjcl/sjcl',
		underscore: 'underscore-min',
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
	['jquery', 'sjcl', 'chat/user', 'chat/socket-client', 'chat/singletons', 'chat/ui'], 
	function ($, sjcl,  User,        socketapi,            singletons) {

function asBase64(bitarray, forUrl) {
	return sjcl.codec.base64.fromBits(bitarray, 1, forUrl);
}

// website interaction
$(document).on('click', 'a.auto-link', function (event) {
	var url = $(this).attr('href');
	// if (!confirm('You are about to open this URL:\n' + url)) {
		event.preventDefault();
	// } else {
		window.open(url, '_blank'); // force to open in new tab
	// }
});


$(function () {
	// pull singletons into local namespace and connect to DOM elements
	var userlist = singletons.userlist;
	userlist.ul = $('#user-list');
	var logger = singletons.logger;
	logger.ul = $('#message-history');
	var chat = singletons.chat;

	// set references
	var chatPane = $('#chat');
	var argsPane = $('#args');
	var footer   = $('footer');
	var content  = $('#content');

	// watch location hash
	function loadFromHash() {
		var args = /^#?(\d+)\/(.*)/.exec(location.hash);
		if (!_.isNull(args)) {
			args = {id: args[1], key: args[2]};
			showChat(args.id, args.key);
		} else {
			showArgs();
		}
	}

	$(window).on('hashchange', function() {
		loadFromHash();
	});
	loadFromHash();

	// set up notifications
	if ((window.webkitNotifications && webkitNotifications.checkPermission() === 1) // webkit; 0: allowed, 1: not allowed, 2: denied
		|| (window.Notification && Notification.permission === 'default')) { // granted, default, denied
		setFooterHeight(33);
	}
	try { // set Notification.permission for Webkit (it doesn't implement this yet)
		Notification.permission = webkitNotifications.checkPermission() === 0 ? 'granted' : 'default';
	} catch (err) {}
	function notify(message) {
		if (Notification.permission === 'granted') {
			var n = new Notification('Chit', {
				body: message,
				tag: 'ChitNotification'
			});
			n.onshow = function () {
				setTimeout(function () { n.close(); }, 3000); // need to wrap this for current Chrome to work.
			}
		}
	}
	$('#notification-yes').click(function () {
		setFooterHeight(0);
		Notification.requestPermission(function (status) {
			// This allows to use Notification.permission with Chrome/Safari
			if (Notification.permission !== status) {
				Notification.permission = status;
			}
		});
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

	// show gradient-overlay when we're not scrolled all the way to the bottom
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

	// show chat parameters view
	function showArgs() {
		argsPane.show();
		chatPane.hide();
	}

	// set up chat parameters view
	(function () {
		var create  = $('#create-new-chat')

		create.click(function () {
			chat.chatKey = null; // force generation of a new key
			chat.new(function (error) {
				if (!error) {
					location.hash = chat.id + '/' + asBase64(chat.chatKey, 1);
				}
			});
		});
	})();

	// show main chat view
	function showChat(id, chatKey) {
		argsPane.hide();
		chatPane.show();

		chat.id = id;
		chat.chatKey = chatKey;
	}

	// wire up socket-api
	socketapi.events.connect = function (data) {
		logger.log('Connected.')
		logger.log('Joining chat…')
		logger.scrollToLatest();
		socketapi.join(
			chat.id,
			asBase64(chat.serverKey),
			chat.user.nickCipher,
			chat.user.signature
		);
	};
	socketapi.events.disconnect = function (data) {
		logger.log('Disconnected.');
		logger.scrollToLatest();
	}
	socketapi.events.join = function (data) {
		var user = new User({secretKey: chat.chatKey, nickCipher: data.nick, signature: data.sig});
		userlist.add(user);
		logger.log({from: user, text: 'joined.'});
		logger.scrollToLatest();
	};
	socketapi.events.part = function (data) {
		var user = new User({secretKey: chat.chatKey, nickCipher: data.nick, signature: data.sig});
		userlist.remove(user);
		logger.log({from: user, text: 'quit.'});
		logger.scrollToLatest();
	};
	socketapi.events.message = function (data) {
		var message = chat.messager.plainObjFromCipherMessage(data.msg);
		if (!message.isGenuine()) {
			logger.error('Discarded a desynchronized message.');
		} else {
			var text = message.text;
			if (new RegExp('\\b' + chat.user.nick + '\\b', 'i').test(text)) {
				message.tags = 'highlight';
				if (text.length > 100) {
					text = text.slice(0, 100) + '…';
				}
				notify('<' + message.from + '> ' + text);
			}
			logger.log(message);
		}
		logger.scrollToLatest();
	};
	socketapi.events.message_reply = function (data) {
		if (data.error) {
			// var msgId = …;
			// logger.addTags(msgId, 'error');
			logger.error(data.error);
			// data.time
		}
	};
	socketapi.events.join_reply = function (data) {
		if (_.has(data, 'error')) {
			logger.error('Error joining: ' + data.error);
			// socketapi.disconnect();
		} else {
			logger.log('Joined chat#' + chat.id + '.');
			// load history
			logger.log('Loading chat history…');
			chat.loadHistory(function (plainObjs, error) {
				if (error) {
					logger.error('Could not load chat history. (' + error + ')');
				} else {
					logger.log('--- History start ---');
					var regex = new RegExp('\\b' + chat.user.nick + '\\b', 'i');
					_.each(plainObjs, function (msgObj) {
						if (regex.test(msgObj.text)) {
							msgObj.tags = 'highlight';
						}
						logger.log(msgObj);
					});
					logger.log('--- History end ---');
				}
				logger.scrollToLatest();
			});
			// load list of other connected users
			logger.log('Requesting names…');
			socketapi.names(chat.id);
		}
		logger.scrollToLatest();
	};
	socketapi.events.names_reply = function (data) {
		if (data.error) {
			logger.error('Could not get names: ' + data.error);
		} else {
			logger.log('Got the list of connected names.');
			var user = new User({secretKey: chat.chatKey});
			userlist.removeAll();
			_.each(data.infos, function (info) {
				user.signature = info.sig;
				user.nickCipher = info.nick;
				user.color = null; // reset color
				var li = userlist.add(new User(user));
				if (user.nick === chat.user.nick) {
					li.addClass('highlight');
				}
			});
		}
	};

});

		
});
