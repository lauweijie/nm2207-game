(function() {

  /**
   * Get absolute URL from path.
   * @param {string} path Relative path.
   * @return {string} Absolute URL.
   */
  var getAbsoluteUrl = function(path) {
    var a = document.createElement('a');
    a.href = path;
    return a.href;
  };

  // Generate random game ID.
  var gameId = Math.random().toString(36).slice(-5).toUpperCase();

  // High score for current session.
  var highScore = 0;

  // Flag for whether the post-game dialog is showing.
  var postGameDialogShowing = false;
  var postGameDialogDismissable = false;


  // Construct URL to join game.
  var gameUrl = getAbsoluteUrl('join/' + gameId);

  // Generate QR code.
  var qr = new QRious({
    element: document.querySelector('#qr canvas'),
    background: 'transparent',
    size: 180,
    value: gameUrl,
  });

  // Display game URL.
  document.getElementById('url').innerHTML = gameUrl;

  // References to elements on the page.
  var disconnectedEl = document.getElementById('disconnected');
  var connectedEl = document.getElementById('connected');

  // Connect to Socket.io.
  var socket = io();
  socket.on('connect', function() {
    socket.emit('host', {
      gameId: gameId,
    });
  });

  socket.on('controller-connected', function() {
    disconnectedEl.style.display = 'none';
    connectedEl.style.display = 'block';
    game.init();
  });

  socket.on('controller-disconnected', function() {
    disconnectedEl.style.display = 'block';
    connectedEl.style.display = 'none';
  });

  // Handle game messages.
  socket.on('message', function(data) {
    switch (data.type) {
      case 'direction':
        game.setGravityX(data.message.x * -0.3);
        break;
      case 'touch':
        if (postGameDialogShowing) {
          if (postGameDialogDismissable) {
            postGameDialogShowing = false;
            document.getElementById('game-overlay').style.display = 'none';
            game.start();
          }
        } else if (game.started) {
          game.jump();
        }
        else {
          game.start();
        }
        break;
    }
  });

  var canvas = document.getElementById('game-canvas');

  var controllerCallbacks = {

    colorChange: function(color) {
      socket.emit('message', {
        type: 'color-change',
        message: color,
      });
    },

    scoreChange: function(score) {
      socket.emit('message', {
        type: 'score-change',
        message: score,
      });
    },

    gameStarted: function() {
      socket.emit('message', {
        type: 'game-started',
      });
    },

    gameEnded: function(score) {
      socket.emit('message', {
        type: 'game-ended',
      });
      highScore = Math.max(highScore, score);
      document.getElementById('game-overlay').style.display = 'block';
      document.getElementById('game-score').innerText = score;
      document.getElementById('record-score').innerText = highScore;
      postGameDialogShowing = true;
      postGameDialogDismissable = false;
      setTimeout(function() {
        postGameDialogDismissable = true;
      }, 1000);
    },

  };

  var game = new Game(canvas, 550, window.innerHeight, controllerCallbacks);



})();