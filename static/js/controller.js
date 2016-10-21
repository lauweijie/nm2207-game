(function() {

  var gameId = document.querySelector('body').getAttribute('data-game-id');
  var connected = false;

  // Initialize Socket.io.
  var socket = io();

  // Send message to join game.
  socket.on('connect', function() {
    socket.emit('join', {
      gameId: gameId,
    });
  });

  // References to elements on the page.
  var connectedEl = document.getElementById('connected');
  var disconnectedEl = document.getElementById('disconnected');
  var messageEl = document.getElementById('message');

  // Listen for response to join game.
  socket.on('join-success', function(data) {
    connected = true;
    connectedEl.style.display = 'block';

    gyro.frequency = 100;
    gyro.startTracking(function(o) {
      socket.emit('message', {type: 'direction', message: {x: o.x, y: o.y}});
    });
    document.querySelector('body').addEventListener('touchstart', function() {
      fullScreen();
      socket.emit('message', {type: 'touch'});
    });

  });

  // Handle connection closing.
  socket.on('disconnect-controller', function(data) {
    connected = false;
    messageEl.innerText = data.message;
    connectedEl.style.display = 'none';
    disconnectedEl.style.display = 'block';
    socket.disconnect();
  });

  // Handle game messages.
  socket.on('message', function(data) {
    switch (data.type) {
      case 'color-change':
        document.getElementById('connected').style.background = data.message;
        break;
      case 'score-change':
        window.navigator.vibrate(200);
        document.getElementById('score-text').innerText = data.message;
        break;
      case 'game-started':
        document.getElementById('start-text').style.display = 'none';
        document.getElementById('score-text').style.display = 'block';
        document.getElementById('score-text').innerText = 0;
        break;
      case 'game-ended':
        window.navigator.vibrate(1500);
        document.getElementById('score-text').style.display = 'none';
        document.getElementById('start-text').style.display = 'block';
        break;
    }
  });


  function fullScreen() {
    var docEl = window.document.documentElement;
    var requestFullScreen =
        docEl.requestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.webkitRequestFullScreen ||
        docEl.msRequestFullscreen;
    requestFullScreen.call(docEl);
  }

})();