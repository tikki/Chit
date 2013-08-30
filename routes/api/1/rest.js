var crud = require('./crud.js').crud;

// wrapper for the CRUD API to offer a RESTful API via Node.js/Express

exports.newChat = function (req, res) {
	res.type('json');
	crud.create(function (reply) { res.json(reply); }, req.body.key);
};

exports.chatData = function (req, res) {
	res.type('json');
	crud.read(function (reply) { res.json(reply); }, req.params.id, req.query.key);
};

exports.appendChatData = function (req, res) {
	res.type('json');
	crud.update(function (reply) { res.json(reply); }, req.params.id, req.body.key, req.body.msg);
};

exports.deleteChat = function (req, res) {
	res.type('json');
	crud.delete(function (reply) { res.json(reply); }, req.params.id, req.body.secret);
};
