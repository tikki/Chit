define(
	['jquery', 'underscore'],
	function ($, _) {

var _apiBaseUrl = 'api/1/chat';

function _makeCallback(reply, callback) {
	return function (xhr, status) {
		if (_.isFunction(callback)) {
			if (_.isEmpty(reply)) {
				reply.error = status !== 'success';
			}
			callback(reply);
		}
	};
}

return {
	create: function (serverKey, callback) {
		var reply = {};
		$.ajax({
			type: "POST",
			url: _apiBaseUrl,
			data: {key: serverKey},
			success: function (data) {
				// clean up incoming data
				_.extend(reply, {
					error: data.error, // should be undefined if there's no error
					id: data.id,
					secret: data.secret
				});
			},
			complete: _makeCallback(reply, callback),
			dataType: "json"
		});
	},
	read: function (chatId, serverKey, messager, callback) {
		var reply = {};
		$.ajax({
			type: "GET",
			url: _apiBaseUrl + '/' + chatId,
			data: {key: serverKey},
			success: function (data) {
				// clean up incoming data
				if (data.error) {
					reply.error = data.error;
				} else {
					var plainObjs = reply.messages = [];
					_.each(data.messages, function (cipherMessage) {
						try {
							var plainObj = messager.plainObjFromCipherMessage(cipherMessage);
							plainObjs.push(plainObj);
						} catch (err) {
							plainObjs.push({
								tags: 'error',
								text: err.message
							});
						}
					});
				}
			},
			complete: _makeCallback(reply, callback),
			dataType: "json"
		});
	},
	update: function (chatId, serverKey, cipherMessage, callback) {
		var reply = {};
		$.ajax({
			type: "PUT",
			url: _apiBaseUrl + '/' + chatId,
			data: {
				key: serverKey,
				msg: cipherMessage
			},
			success: function (data) {
				// clean up incoming data
				_.extend(reply, {
					error: data.error, // should be undefined if there's no error
					time: data.time
				});
			},
			complete: _makeCallback(reply, callback),
			dataType: "json"
		});
	},
	delete: function (chatId, secret, callback) {
		var reply = {};
		$.ajax({
			type: "DELETE",
			url: _apiBaseUrl + '/' + chatId,
			data: {
				secret: secret
			},
			success: function (data) {
				// clean up incoming data
				reply.error = data.error; // should be undefined if there's no error
			},
			complete: _makeCallback(reply, callback),
			dataType: "json"
		});
	}
};


});
