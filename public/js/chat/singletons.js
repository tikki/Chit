"use strict";
define(
	['chat/ui-userlist', 'chat/ui-logger', 'chat/chat'],
	function (Userlist, Logger, Chat) {
return {
	userlist: new Userlist(),
	logger: new Logger(),
	chat: new Chat()
};
});