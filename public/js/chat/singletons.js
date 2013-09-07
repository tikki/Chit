"use strict";
define(
	['chat/ui-userlist', 'chat/ui-logger', 'chat/chat', 'chat/completor'],
	function (Userlist, Logger, Chat, Completor) {
return {
	userlist: new Userlist(),
	logger: new Logger(),
	chat: new Chat(),
	completor: new Completor()
};
});