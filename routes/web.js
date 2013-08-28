
/*
 * GET home page.
 */

exports.index = function (req, res) {
	res.render('index', {
		title: 'Chit',
		join: 'chat'
	});
};

exports.chat = function (req, res) {
	res.render('chat', {required: "chat"});
};

exports.api = function (req, res) {
	res.send('api help');
};
