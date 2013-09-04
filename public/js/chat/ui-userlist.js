"use strict";
define(
	['underscore', 'jquery'],
	function (_, $) {

/**
 * @exports Userlist
 */

function Userlist(ul) {
	this.ul = $(ul);
	this._users = [];
}

function _userSort(user) {
	return user.user.nick;
}

Userlist.prototype.add = function(user) {
	/** @todo this looks terribly inefficient… */
	// create dom element
	var li = $('<li>')
		.text(user.nick)
		.css('color', user.color);
	// add new user
	this._users.push({user: user, li: li[0]});
	// rebuild sorted user view
	var users = _.sortBy(this._users, _userSort);
	this.removeAll();
	this._users = users;
	// render
	var self = this;
	_.each(users, function (user) {
		self.ul.append(user.li);
	});
	return li;
};

Userlist.prototype.remove = function(userToRemove) {
	// remove user from internal user-list
	var users = [];
	var lisToRemoved = [];
	_.each(this._users, function (e) {
		if (!userToRemove.equalTo(e.user)) {
			users.push(e);
		} else {
			lisToRemoved.push(e.li);
		}
	});
	this._users = users;
	// remove user from ul
	$(lisToRemoved).remove();
};

Userlist.prototype.removeAll = function() {
	this.ul.empty();
	this._users = [];
};

return Userlist;

});
