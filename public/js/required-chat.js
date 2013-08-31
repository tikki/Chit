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
	['jquery', 'chat/chat', 'chat/logger', 'chat/user', 'socketio', 'chat/socket-client'], 
	function ($, Chat, Logger, User, io, socketapi) {

// website interaction

$(function () {
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

	// show chat parameters view
	function showArgs() {
		argsPane.show();
		chatPane.hide();
	}

	// set up chat parameters view
	(function () {
		var save    = $('#set-args');
		var create  = $('#create-new-chat')
		var chatId  = $('#chat-id');
		var chatKey = $('#chat-key');

		save.click(function () {
			location.hash = chatId.val() + '/' + chatKey.val();
		});

		create.click(function () {
			chat.updateWithConfig({chatKey: chat.newChatKey()});
			chat.new(function (error) {
				if (!error) {
					chatId.val(chat.id);
					chatKey.val(chat.chatKeyB64);
					save.click();
				}
			});
		});
	})();

	// show main chat view
	function showChat(id, chatKey) {
		argsPane.hide();
		chatPane.show();

		chat.updateWithConfig({id: id, chatKey: chatKey});
		// console.log(chat);

		// focus on input
		var input = $('#input');
		input.focus();

		// load history
		chat.loadHistory(function (plainObjs, error) {
			if (error) {
				logger.error('Could not load chat history. (' + error + ')');
			} else {
				_.each(plainObjs, function (msgObj) {
					logger.log(msgObj);
				});
			}
			logger.scrollToLatest();
		});
	}

	// set up main chat view
	var logger = new Logger($('#message-history'));
	(function () {
		// set references
		var nickInput = $('#nickname-input');
		var sigInput  = $('#signature-input');

		// create user instance
		// var user = new User();

		nickInput.change(function () {
			chat.user.nick = $(this).val();
		});

		sigInput.change(function () {
			chat.user.uid = $(this).val();
		});

		// return user;
	})();
	var chat = (function () {
		// set references
		var textInput = $('#message-input');
		var sendBtn   = $('#send-message');

		var KEY_RETURN = 13;

		// create a new chat instance
		var chat = new Chat();

		// set up textInput
		textInput.keypress(function (key) {
			if (!key.ctrlKey && key.which === KEY_RETURN) {
				sendBtn.click();
			}
		});

		// set up send
		sendBtn.click(function () {
			// get message text
			var text = textInput.val().trim();
			textInput.val('');
			// check text
			if (!text.length) {
				return;
			}
			// build plain-message object
			var plainObj = {
				text: text,
				from: chat.user.nick || undefined,
				signature: chat.user.signature(),
				tags: 'unconfirmed'
			}
			// send message
			if (socketapi.isConnected()) {
				var message = chat.messager.cipherMessageFromPlainObj(plainObj);
				socketapi.msg(chat.id, message);
			} else {
				// log message
				var msgId = logger.log(plainObj);
				logger.scrollToLatest();
				chat.post(plainObj, function (error) {
					if (error) {
						logger.addTags(msgId, 'error');
					} else {
						logger.removeTags(msgId, 'unconfirmed');
					}
				});
			}
		});

		// done.
		return chat;
	})();

	// start doing stuff.

	loadFromHash();

	// wire up socket-api
	socketapi.events.connect = function (data) {
		socketapi.join(
			chat.id,
			chat.serverKeyB64,
			chat.user.nickCipher,
			chat.user.signature()
		);
	};
	socketapi.events.join = function (data) {
		var user = new User({secretKey: chat.chatKey, nickCipher: data.nick});
		$('<li>')
			.text(user.nick)
			.data('sig', data.sig)
			.appendTo($('#user-list'));
	};
	socketapi.events.part = function (data) {
		var user = new User({secretKey: chat.chatKey, nickCipher: data.nick});
		$('#user-list li').filter(function () {
			return $(this).text() === user.nick && $(this).data('sig') === data.sig;
		}).remove();
	};
	socketapi.events.message = function (data) {
		var message = chat.messager.plainObjFromCipherMessage(data.msg);
		if (!message.isGenuine()) {
			logger.error('discarded a desynchronized message.');
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
			console.log('chat/join error:', data.error);
		} else {
			console.log('joined.');
			socketapi.names(chat.id);
		}
	};
	socketapi.events.names_reply = function (data) {
		console.log('list of live users:', data);
		var user = new User({secretKey: chat.chatKey});
		$('#user-list').empty();
		_.each(data.infos, function (info) {
			var signature = info.sig;
			user.nickCipher = info.nick;
			$('<li>')
				.text(user.nick)
				.data('sig', signature)
				.appendTo($('#user-list'));
		});
	};

	$('#join').click(function () {
		if (socketapi.isConnected()) {
			socketapi.events.connect();
		} else {
			socketapi.connect('http://localhost:3000');
		}
	});


});

		
});
