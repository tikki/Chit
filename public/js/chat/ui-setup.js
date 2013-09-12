"use strict";
define(
	['jquery', 'sjcl', 'chat/password', 'chat/cryptoParams', 'chat/singletons'],
	function ($, sjcl,  password,        cryptoParams,        singletons) {

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
	var minPasswordLength = 20;
	var generatePasswd = $('#generate-password');
	var passwordInput = $('#password');
	generatePasswd.click(function () {
		passwordInput.val(password.english(4, minPasswordLength)).change();
	});
	// Check password strength.
	function checkPassword() {
		/** @todo make this a proper check, looking at the key space & everything, not just length */
		var text = passwordInput.val().trim();
		if (text.length && text.length < minPasswordLength) {
			$('.password-strength-warning').show();
		} else {
			$('.password-strength-warning').hide();
		}
	}
	passwordInput
		.keyup(checkPassword)
		.change(checkPassword);
	//
	$('#okay').click(function () {
		var chat = singletons.chat;
		var active = toggles.filter('.active').attr('data-toggle');
		if (active === 'new-chat') {
			var password = passwordInput.val().trim();
			if (!password.length) {
				chat.chatKey = null; // force generation of a new key
			} else {
				chat.chatKey = chatKeyFromPassword(password);
			}
			chat.new(function (error) {
				if (!error) {
					location.hash = chat.id + '/' + asBase64(chat.chatKey, 1);
				}
			});
			console.log(chat.chatKey);
		} else if (active === 'existing-chat') {
			var chatId = $('#chat-id').val().trim();
			if (!chatId.length) {
				return;
			}
			var chatKey = $('#chat-key').val().trim();
			if (!chatKey.length) {
				return;
			}
			var base64Marker = 'b64:';
			if (startsWith(chatKey, base64Marker)) {
				chatKey = chatKey.slice(base64Marker.length)
			} else {
				chatKey = chatKeyFromPassword(chatKey);
			}
			// update chat
			chat.id = chatId;
			chat.chatKey = chatKey;
			// update location
			location.hash = chat.id + '/' + asBase64(chat.chatKey, 1);
		}
	});
});

});
