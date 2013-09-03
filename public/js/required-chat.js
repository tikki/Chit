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

		// load history
		logger.log('Loading chat history…');
		chat.loadHistory(function (plainObjs, error) {
			if (error) {
				logger.error('Could not load chat history. (' + error + ')');
			} else {
				logger.log('--- History start ---');
				_.each(plainObjs, function (msgObj) {
					logger.log(msgObj);
				});
				logger.log('--- History end ---');
			}
			logger.scrollToLatest();
		});
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
				userlist.add(new User(user));
			});
		}
	};

});

		
});
