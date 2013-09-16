"use strict";
define(
	['underscore', 'jquery'],
	function (_, $) {

/**
 * @exports Userlist
 */

/**
 * Userlist manages a ul, adding to & removing users from the list.
 * @constructor
 * @param {HTMLEntity} ul
 */
function Userlist(ul) {
	/** @public */
	this.ul = $(ul);
	/** @private */
	this._db = [];
}

function _userNick(dbEntry) {
	return dbEntry.user.nick;
}

function _makeUserFilter(user) {
	return function (e) {
		return user.equalTo(e.user);
	};
}

function _updateLiWithEntry(dbEntry) {
	$(dbEntry.li).attr('title', dbEntry.count + ' connection' + (dbEntry.count > 1 ? 's' : ''));
}

/**
 * Add a user.
 * @param {User} user
 */
Userlist.prototype.add = function(user) {
	/** @todo this looks terribly inefficient… */
	// check if the user was already connected
	var dbEntry = _.find(this._db, _makeUserFilter(user));
	if (dbEntry) {
		dbEntry.count++;
		_updateLiWithEntry(dbEntry);
		return $(dbEntry.li);
	}
	// create dom element
	var li = $('<li>')
		.text(user.nick)
		.css('color', user.color);
	// add new user
	this._db.push({user: user, li: li[0], count: 1});
	// rebuild sorted user view
	var db = _.sortBy(this._db, _userNick);
	this.removeAll();
	this._db = db;
	// render
	var self = this;
	_.each(db, function (dbEntry) {
		self.ul.append(dbEntry.li);
		_updateLiWithEntry(dbEntry);
	});
	return li;
};

/**
 * Remove a user.
 * @param {User} user
 */
Userlist.prototype.remove = function(user) {
	var userFilter = _makeUserFilter(user);
	var dbEntry = _.find(this._db, userFilter);
	if (dbEntry && --dbEntry.count === 0) {
		$(dbEntry.li).remove();
		this._db = _.reject(this._db, userFilter);
	} else {
		_updateLiWithEntry(dbEntry);
	}
};

/**
 * Clear the ul & internal db.
 */
Userlist.prototype.removeAll = function() {
	this.ul.empty();
	this._db = [];
};

return Userlist;

});
