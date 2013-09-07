"use strict";
/**
 * Wrapper around W3C & WebKit notifications.
 */
define({
	granted: 'granted',
	unknown: 'default',
	denied: 'denied',
	permission: function () {
		if (window.Notification && Notification.permission) {
			return Notification.permission;
		}
		if (window.webkitNotifications) {
			var permission = null;
			switch (webkitNotifications.checkPermission()) {
				case 0: permission = this.granted; break;
				case 1: permission = this.unknown; break;
				case 2: permission = this.denied; break;
			}
			Notification.permission = permission;
			return permission;
		}
	},
	notify: function (message, timeout) {
		if (this.permission() === this.granted) {
			var n = new Notification('Chit', {
				body: message,
				tag: 'ChitNotification'
			});
			if (typeof timeout === 'undefined') {
				timeout = 3000;
			}
			n.onshow = function () {
				// Mustn't call n.close() with arguments in Chrome, so we wrap it.
				setTimeout(function () {
					n.close();
				}, timeout);
			}
		}
	},
	requestPermission: function () {
		Notification.requestPermission(function (status) {
			// This allows to use Notification.permission with Chrome/Safari
			if (Notification.permission !== status) {
				Notification.permission = status;
			}
		});
	}
});
