var _ = require('underscore');
var crypto = require('crypto');

var config = require('../../../config.json');

exports.transformSignature = function (signature) {
	if (_.isString(signature)) {
		var hmac = crypto.createHmac(config.api_1.signature.algorithm, config.api_1.signature.key);
		hmac.update(signature);
		return hmac.digest('base64');
	}
}

