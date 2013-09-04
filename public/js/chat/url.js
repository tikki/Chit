define(function () {

/**
 * a basic URL matcher
 */

function _wrapAsLink(match, offset, string) {
	// We'll just assume that two closing parenthesis means only one belongs to the url.
	// We'll do no counting or such non-sense.
	var post = '';
	if (match.slice(-2) === '))') {
		match = match.slice(0, -1);
		post  = ')';
	}
	if (match.indexOf('.') === -1) {
		return match;
	}
	return '<a href="' + match + '" class="auto-link">' + match + '</a>' + post;
}

return {
	allUrls: function (s) {
		var urls = [];
		var regex = /\b(?:http|ftp)s?:\/\/[-a-zA-Z0-9$_.+!*'(),%;:@&=#\/?~|]*[-a-zA-Z0-9$_+*'()%@&=#\/~|]/g;
		while (1) {
			var url = regex.exec();
			if (!url) {
				break;
			}
			if (url.indexOf('.') !== -1) {
				urls.push(url);
			}
		}
		return urls;
	},
	replaceUrlsWithHtmlLinks: function (s) {
		// full urls
		regex = /\b(?:http|ftp)s?:\/\/[-a-zA-Z0-9$_.+!*'(),%;:@&=#\/?~|]*[-a-zA-Z0-9$_+*'()%@&=#\/~|]/g;
		s = s.replace(regex, _wrapAsLink);

		// incomplete http-www urls
		regex = /(?:^|[^\/])([wW]{3}.[-a-zA-Z0-9$_.+!*'(),%;:@&=#\/?~|]*[-a-zA-Z0-9$_+*'()%@&=#\/~|])/g;
		s = s.replace(regex, '<a href="http://$1" class="auto-link">$1</a>');

		// mail addresses // these are problematic and can break stuff (ftp://user@example.com)
		// regex = /\b([-a-zA-Z0-9._]+@[-a-zA-Z0-9._]+.[a-zA-Z]{2,6})/g;
		// s = s.replace(regex, '<a href="mailto://$1" class="auto-link">$1</a>');

		return s;
	}
};

});
