define(['underscore'], function (_) {

/**
 * a basic URL matcher
 */

var url = {
	allUrls: function (s) {
		var urls = [];
		var regex = /(\(.*?)?\b((?:(?:http|ftp)s?:\/\/|[wW]{3}.)[-a-zA-Z0-9$_.+!*'(),%;:@&=#\/?~|]*[-a-zA-Z0-9$_+*'()%@&=#\/~|])/g;
		while (1) {
			var result = regex.exec(s);
			if (!result) {
				break;
			}
			// check url (all proper internet URLs contain a .)
			var url = result[2];
			if (url.indexOf('.') !== -1) {
				// remove trailing ) if there's a (
				if (url.slice(-1) === ')' && result[1]) {
					url = url.slice(0, -1);
				}
				// result.index is where result[0] starts, not result[2]
				var offset = result.index + result[0].length - result[2].length;
				urls.push({url: url, index: offset});
			}
		}
		return urls;
	},
	replaceUrlsWithHtmlLinks: function (s) {
		var offset = 0;
		_.each(this.allUrls(s), function (url) {
			var urlText = url.url;
			var index = url.index + offset;
			var pre = s.slice(0, index);
			var post = s.slice(index + urlText.length);
			// add http:// to www links
			var link = urlText;
			if (link.slice(0, 4).toLowerCase() === 'www.') {
				link = 'http://' + link;
			}
			var insert = '<a href="' + link + '" class="auto-link">' + urlText + '</a>';
			// update offset
			offset += insert.length - urlText.length;
			// update string
			s = pre + insert + post;
		});
		return s;
	}
};

// test cases
// function testAllUrls(s, should) {
// 	if (typeof should === 'string') {
// 		should = [should];
// 	}
// 	var urls = url.allUrls(s);
// 	var fail = false;
// 	for (var i = 0; i < urls.length; i++) {
// 		fail = should[i] !== urls[i].url;
// 		if (fail) break;
// 	}
// 	if (fail) {
// 		console.log('fail: "' + s + '" got', urls);
// 	} else {
// 		console.log('success:', s);
// 	}
// }
// testAllUrls('www.example.com http://www.example.com/ http://www.example.com/foo_(bar)', ['www.example.com', 'http://www.example.com/', 'http://www.example.com/foo_(bar)']);
// testAllUrls('(www.example.com) (http://www.example.com/) (http://www.example.com/foo_(bar))', ['www.example.com', 'http://www.example.com/', 'http://www.example.com/foo_(bar)']);
// testAllUrls('(a www.example.com) (b http://www.example.com/) (c http://www.example.com/foo_(bar))', ['www.example.com', 'http://www.example.com/', 'http://www.example.com/foo_(bar)']);
// testAllUrls('www.example.com) http://www.example.com/) http://www.example.com/foo_(bar))', ['www.example.com)', 'http://www.example.com/)', 'http://www.example.com/foo_(bar))']);
// testAllUrls('(www.example.com) http://www.example.com/) http://www.example.com/foo_(bar))', ['www.example.com', 'http://www.example.com/)', 'http://www.example.com/foo_(bar))']);
// console.log(
// 	'a <a href="http://www.example.com" class="auto-link">www.example.com</a> b   (c <a href="http://www.as" class="auto-link">http://www.as</a><script>alert("fu")</script>) (c <a href="http://www.example.com/foo_(bar)" class="auto-link">http://www.example.com/foo_(bar)</a>) as (<a href="http://www.example.com/foo_(bar))d" class="auto-link">http://www.example.com/foo_(bar))d</a> as (<a href="http://www.example.com/foo_(bar)" class="auto-link">http://www.example.com/foo_(bar)</a>) d'
// 	===
// 	url.replaceUrlsWithHtmlLinks('a www.example.com b   (c http://www.as<script>alert("fu")</script>) (c http://www.example.com/foo_(bar)) as (http://www.example.com/foo_(bar))d as (http://www.example.com/foo_(bar)) d')
// );

return url;

});
