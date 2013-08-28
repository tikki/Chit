
/**
 * Module dependencies.
 */

var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , path = require('path');

var config = require('./config.json');

// configure socket.io
io.set('transports', ['websocket']);

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// set middle ware
app.use(express.logger('dev'));
app.use(express.favicon());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser(config.cookiesecret));
app.use(express.session());
app.use(app.router);
app.use(require('less-middleware')({ src: path.join(__dirname, 'public') }));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
} else {
	// production mode
	io.set('log level', 1); // 0 = error; 1 = warn; 2 = info; 3 = debug
	io.set('browser client minification', true);
	io.set('browser client etag', true);
	io.set('browser client gzip', true);
}

// web routes
var web = require('./routes/web');
app.get('/', web.index);
app.get('/chat', web.chat)

// REST API routes
var restapi = require('./routes/api/1/rest');
app.get('/api/1', web.api)
app.post('/api/1/chat', restapi.newChat);
app.get('/api/1/chat/:id', restapi.chatData);
app.put('/api/1/chat/:id', restapi.appendChatData);
app.delete('/api/1/chat/:id', restapi.deleteChat);

// socket.io API
var socketapi = require('./routes/api/1/socketio').api;
io.sockets.on('connection', socketapi);

// start server
server.listen(app.get('port'), function () {
	console.log('Express + Socket.IO server listening on port ' + app.get('port'));
});
