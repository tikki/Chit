"use strict";
define(
	['underscore', 'jquery', 'sjcl', 'chat/password', 'chat/cryptoParams', 'chat/singletons'],
	function (_,    $,        sjcl,   password,        cryptoParams,        singletons) {

function asBase64(bitarray, forUrl) {
	return sjcl.codec.base64.fromBits(bitarray, 1, forUrl);
}

function startsWith(a, b) {
	return a.slice(0, b.length) === b;
}

function chatKeyFromPassword(password) {
	return sjcl.misc.pbkdf2(password, cryptoParams.pbkdf2.salt, cryptoParams.pbkdf2.iterations, cryptoParams.keySize, sjcl.misc.hmac); // hmac defaults to sha256-mac
}

$(function () {
	// pull singletons into local namespace
	var chat = singletons.chat;

	// set references
	var chatPane = $('#chat');
	var setupPane = $('#setup');
	var chatLink = $('#current-chat-link');

	// The chat link should only be used copy the chat URL.
	chatLink.click(function (e) {e.preventDefault()});

	// Use the URL fragment identifier to decide which view to load.
	function loadFromFragmentId() {
		// Extract and remove chat data from location bar.
		var args = /^#?(\d+)\/(.*)/.exec(location.hash);
		location.replace("#");
		history.replaceState(null, '', location.href.slice(0, -1));
		if (_.isNull(args)) {
			setupPane.show();
		} else {
			switchToChatPane(args[1], args[2]);
		}
	}
	loadFromFragmentId();

	function switchToChatPane(chatId, chatKey) {
		setupPane.hide();
		chatPane.show();
		// set chat parameters
		chat.id = chatId;
		chat.chatKey = chatKey;
		// set chat link href
		var url = location.origin + location.pathname + '#' + chat.id + '/' + asBase64(chat.chatKey, 1);
		chatLink
			.attr('href', url)
			.show();
	}

	/**
	 * Switches between the "create a new chat" and "join an existing chat" views.
	 */
	function toggle() {
		// Hide everything, remove all input data & set in-active.
		toggleElements.hide();
		toggleElements.find('input').val('').change();
		toggles.removeClass('active');
		// Activate & show current items.
		var toggleClass = $(this)
			.addClass('active')
			.attr('data-toggle');
		$('.' + toggleClass).show();
	}

	// Make a list of all toggle-able elements.
	var toggles = $('.toggle');
	var toggleClasses = [];
	toggles.each(function () {
		toggleClasses.push($(this).attr('data-toggle'));
	}).click(toggle);//.mouseover(toggle);
	var toggleElements = $('.' + toggleClasses.join(',.'));

	// Hide all toggle elements by default.
	toggleElements.hide();

	// Wire up the password generator.
	var minPasswordLength = 22;
	var generatePasswd = $('#generate-password');
	var passwordInput = $('#password');
	generatePasswd.click(function () {
		passwordInput.val(password.english(4, minPasswordLength)).change();
	});

	// Check password strength.
	function checkPassword() {
		var passwd = passwordInput.val().trim();
		if (passwd.length && password.score(passwd) < 60) {
			$('.password-strength-warning').show();
		} else {
			$('.password-strength-warning').hide();
		}
	}
	passwordInput
		.keyup(checkPassword)
		.change(checkPassword);

	// Wire up the join chat button.
	$('#join-chat').click(function () {
		switchToChatPane(chat.id, chat.chatKey);
	});

	// Wire up the okay button.
	$('#okay').click(function () {
		var base64Marker = 'b64:';
		var active = toggles.filter('.active').attr('data-toggle');
		if (active === 'new-chat') {
			var password = passwordInput.val().trim();
			if (!password.length) {
				chat.chatKey = Chat.newChatKey();
			} else {
				chat.chatKey = chatKeyFromPassword(password);
			}
			// Disable all interactive elements.
			var inputs = $('#setup input, #setup button').not('#join-chat');
			inputs.attr('disabled', 'disabled');
			// create the new chat
			chat.new(function (error) {
				if (error) {
					inputs.removeAttr('disabled');
				} else {
					// show/hide the creation message parts & fill in values
					var newChatInfo = $('#new-chat-created');
					newChatInfo
						.show()
						.find('.chat-id-field')
							.text(chat.id);
					if (password.length) {
						newChatInfo.find('p.chat-key').hide();
					} else {
						newChatInfo.find('p.password').hide();
						newChatInfo
							.find('.chat-key-field')
								.text(base64Marker + asBase64(chat.chatKey));
					}
				}
			});
		} else if (active === 'existing-chat') {
			var chatId = $('#chat-id').val().trim();
			if (!chatId.length) {
				return;
			}
			var chatKey = $('#chat-key').val().trim();
			if (!chatKey.length) {
				return;
			}
			if (startsWith(chatKey, base64Marker)) {
				chatKey = chatKey.slice(base64Marker.length)
			} else {
				chatKey = chatKeyFromPassword(chatKey);
			}
			switchToChatPane(chatId, chatKey);
		}
	});
});

});
