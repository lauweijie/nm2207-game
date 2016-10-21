var config = require('./config');
var express = require('express');

var app = express();

// Set up Socket.io server.
var server = require('http').Server(app);
var io = require('socket.io')(server);

// Set view engine to EJS.
app.set('view engine', 'ejs');

// Load static content and Bower components.
app.use(express.static(__dirname + '/static'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));

// Index page.
app.get('/', function(req, res) {
  res.render('index', {config: config});
});

// Controller page.
app.get('/join/:gameId', function(req, res) {
  res.render('controller', {gameId: req.params.gameId});
});

// Initialize games.
var games = {};

// Listen for socket connections.
io.on('connection', function(socket) {
  var game;

  // Host a game.
  socket.on('host', function(data) {
    game = {gameId: data.gameId, host: socket};
    games[data.gameId] = game;
  });

  // Join a game.
  socket.on('join', function(data) {
    if (!games[data.gameId]) {
      socket.emit('disconnect-controller', {
        message: 'The game ID is invalid.',
      });
      return;
    }
    if (games[data.gameId].controller) {
      socket.emit('disconnect-controller', {
        message: 'Another controller is connected.',
      });
      return;
    }
    game = games[data.gameId];
    game.controller = socket;
    socket.emit('join-success');
    game.host.emit('controller-connected');
  });

  // Route game message.
  socket.on('message', function(data) {
    if (!game || !game.controller) return;
    if (game.host == socket)
      game.controller.emit('message', data);
    else
      game.host.emit('message', data);
  });

  // Handle disconnection.
  socket.on('disconnect', function() {
    if (!game) return;
    if (game.host == socket && game.controller) {
      game.controller.emit('disconnect-controller', {
        message: 'The game host has disconnected.',
      });
      delete games[game.gameId];
    }
    else {
      game.host.emit('controller-disconnected');
      game.controller = null;
    }
  });

});

// Start server.
server.listen(config.port, function () {
  console.log('Express listening on port ' + config.port + '.');
});