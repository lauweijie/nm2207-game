var Game = (function() {

  // Module aliases.
  var Engine = Matter.Engine,
      Render = Matter.Render,
      World = Matter.World,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Bodies = Matter.Bodies,
      Events = Matter.Events;


  /**
   * @constructor
   * @param {Object} element Element to render to.
   * @param {Number} width Width of game.
   * @param {Number} height Height of game.
   * @param {Object} controllerCallbacks Controller callbacks.
   */
  var Game = function(element, width, height, controllerCallbacks) {
    this.started = false;
    this.isInit = false;
    this.width = width;
    this.height = height;
    this.controllerCallbacks = controllerCallbacks;

    // Create game engine.
    this.engine = Engine.create();

    // Create renderer.
    this.render = Render.create({
        element: element,
        engine: this.engine,
        options: {
          width: this.width,
          height: this.height,
          wireframes: false,
          hasBounds: true,
          background: '/img/game_bg.png',
        },
    });

    // Load audio.
    this.bgAudio = new Howl({
      src: ['/audio/bg.mp3'],
      loop: true,
    });
    this.bounceSfx = new Howl({
      src: ['/audio/sfx-bounce.mp3'],
    });
    this.dingSfx = new Howl({
      src: ['/audio/sfx-ding.mp3'],
    });
    this.crashSfx = new Howl({
      src: ['/audio/sfx-crash.mp3'],
    });

    // Add game loop.
    Events.on(this.engine, 'tick', this.gameLoop_.bind(this));

    // Add event handler for collisions.
    Events.on(this.engine, 'collisionStart',
        this.collisionEventHandler_.bind(this));
  };


  /** @const */
  Game.COLOR_1 = '#F1433F';

  /** @const */
  Game.COLOR_2 = '#ECBE13';

  /** @const */
  Game.COLOR_3 = '#A9CF54';

  /** @const */
  Game.COLOR_4 = '#70B7BA';

  /** @const */
  Game.COLLISION_CATEGORY_1 = 0x0002;

  /** @const */
  Game.COLLISION_CATEGORY_2 = 0x0004;

  /** @const */
  Game.COLLISION_CATEGORY_3 = 0x0008;

  /** @const */
  Game.COLLISION_CATEGORY_4 = 0x0010;

  /** @const */
  Game.BALL_SIZE = 15;

  /** @const */
  Game.WALL_WIDTH = 30;

  /** @const */
  Game.WALL_COLOR = '#555';


  /**
   * Initializes the game.
   */
  Game.prototype.init = function() {
    this.isInit = true;

    // Reset world.
    World.clear(this.engine.world);

    // Stop runner.
    if (this.runner) Matter.Runner.stop(this.runner);

    // Resets score.
    this.score = 0;

    // Reset view bounds.
    this.viewBound = 0;

    // Reset position of last challenge.
    this.lastChallengePosition = 0;

    // Reset challenge counter.
    this.challengeCount = 0;

    // Initialize array to keep track of challenges in view.
    this.challenges = [];

    // Initialize first challenge.
    this.addChallenge_(this.height - 600);

    // Initialize next few challenges within view.
    while (this.lastChallengePosition > this.viewBound) {
      this.addChallenge_(
          this.lastChallengePosition - this.getRandomInt_(300, 400));
    }

    // Reset gravity.
    this.engine.world.gravity.x = 0;

    // Create ball.
    this.ball = Bodies.circle(this.width / 2, this.height - 100,
        Game.BALL_SIZE, {restitution: 1});
    World.add(this.engine.world, this.ball);

    // Initialize ball color.
    this.setBallColor_(Game.COLOR_1, Game.COLLISION_CATEGORY_1);

    // Create floor.
    this.floor = Bodies.rectangle(this.width / 2, this.height, this.width,
        Game.WALL_WIDTH, {
      isStatic: true,
      render: {
        fillStyle: Game.WALL_COLOR,
        lineWidth: 0.01,
      },
    });
    World.add(this.engine.world, this.floor);

    // Create left and right walls.
    this.leftWall = Bodies.rectangle(0, this.height / 2, Game.WALL_WIDTH,
        this.height, {
          isStatic: true,
          render: {
            fillStyle: Game.WALL_COLOR,
            lineWidth: 0.01,
          },
        });
    this.rightWall = Bodies.rectangle(this.width, this.height / 2,
        Game.WALL_WIDTH, this.height, {
          isStatic: true,
          render: {
            fillStyle: Game.WALL_COLOR,
            lineWidth: 0.01,
          },
        });
    World.add(this.engine.world, [this.leftWall, this.rightWall]);

    // Run the engine.
    this.runner = Engine.run(this.engine);

    // Run the renderer.
    Render.run(this.render);
  };


  /**
   * Starts the game.
   */
  Game.prototype.start = function() {
    this.started = true;
    if (!this.isInit) this.init();
    this.controllerCallbacks.gameStarted();
    // Start background music.
    this.bgAudio.play();
  };


  /**
   * Game over.
   */
  Game.prototype.gameOver = function() {
    this.end();
    this.controllerCallbacks.gameOver(this.score);
  };


  /**
   * Ends the game.
   */
  Game.prototype.end = function() {
    this.started = false;
    this.isInit = false;

    // Stop game.
    if (this.runner) Matter.Runner.stop(this.runner);
    Render.stop(this.render);

    // Stop background music.
    this.bgAudio.stop();
  };


  /**
   * Makes the ball jump.
   */
  Game.prototype.jump = function() {
    if (!this.started) return;
    this.bounceSfx.play();
    Body.setVelocity(this.ball, {x: 0, y: -5.5});
  };


  /**
   * Change the horizontal gravity of the game.
   * @param {Number} gravity Horizontal gravity.
   */
  Game.prototype.setGravityX = function(gravity) {
    if (!this.started) return;
    this.engine.world.gravity.x = gravity;
  };


  /**
   * Main game loop.
   * @private
   */
  Game.prototype.gameLoop_ = function() {
    if (!this.started) return;

    // Move view bounds up.
    this.viewBound = Math.min(
          this.viewBound, this.ball.position.y - this.height / 2);
    this.render.bounds.min.y = this.viewBound;
    this.render.bounds.max.y = this.viewBound + this.height;

    // Check if ball is out of viewport.
    if (this.ball.position.y - Game.BALL_SIZE > this.render.bounds.max.y) {
      this.gameOver();
      this.crashSfx.play();
    }

    // Produce more challenges.
    if (this.lastChallengePosition > this.viewBound) {
      this.addChallenge_(
          this.lastChallengePosition - this.getRandomInt_(300, 400));
    }

    // Iterate through challenges.
    this.challenges.forEach(function(challenge) {
      if (challenge.eventLoop_)
        challenge.eventLoop_();
    });

    // Move left and right walls along with viewport.
    Body.setPosition(this.leftWall, {
      x: this.leftWall.position.x,
      y: this.viewBound + this.height / 2
    });
    Body.setPosition(this.rightWall, {
      x: this.rightWall.position.x,
      y: this.viewBound + this.height / 2
    });
  };


  /**
   * Event handler for collisions.
   * @private
   */
  Game.prototype.collisionEventHandler_ = function(event) {
    var pairs = event.pairs;
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      if ((pair.bodyA == this.ball || pair.bodyB == this.ball)) {
        var body = pair.bodyA == this.ball ? pair.bodyB : pair.bodyA;
        if (body.isChallenge_) {
          // Game over.
          this.gameOver();
          this.crashSfx.play();
        } else if (body.isJewel_) {
          // Remove jewel.
          World.remove(this.engine.world, body);
          // Set ball color.
          this.setBallColor_(body.jewelColor_, body.jewelCollisionCategory_);
          // Play audio.
          this.dingSfx.play();
          // Increase score.
          this.score += 1;
          this.controllerCallbacks.scoreChange(this.score);
        }
      }
    }
  };


  /**
   * Add challenge to the world.
   * @param {Number} yy Y-position for the challenge.
   * @private
   */
  Game.prototype.addChallenge_ = function(yy) {
    this.challengeCount++;
    // Alternate between line and square.
    switch (this.challengeCount % 2) {
      case 0:
        this.makeLineChallenge_(yy);
        break;
      case 1:
        this.makeSquareChallenge_(yy);
        break;
    }
  };


  /**
   * Makes a jewel.
   * @param {Number} yy Y-position for the jewel.
   * @private
   */
  Game.prototype.makeJewel_ = function(yy, color) {
    var xx = this.width / 2;

    var jewelColor, jewelCollisionCategory;
    switch (color) {
      case 1:
        jewelColor = Game.COLOR_1;
        jewelCollisionCategory = Game.COLLISION_CATEGORY_1;
        break;
      case 2:
        jewelColor = Game.COLOR_2;
        jewelCollisionCategory = Game.COLLISION_CATEGORY_2;
        break;
      case 3:
        jewelColor = Game.COLOR_3;
        jewelCollisionCategory = Game.COLLISION_CATEGORY_3;
        break;
      case 4:
        jewelColor = Game.COLOR_4;
        jewelCollisionCategory = Game.COLLISION_CATEGORY_4;
        break;
    }
    var jewel = Bodies.polygon(xx, yy, 6, 20, {
      isStatic: true,
      isSensor: true,
      render: {
        fillStyle: jewelColor,
        lineWidth: 0.01,
      }
    });
    jewel.isJewel_ = true;
    jewel.jewelColor_ = jewelColor;
    jewel.jewelCollisionCategory_ = jewelCollisionCategory;
    World.add(this.engine.world, jewel);
    return jewel;
  };


  /**
   * Makes a square challenge.
   * @param {Number} yy Y-position for the challenge.
   * @private
   */
  Game.prototype.makeSquareChallenge_ = function(yy) {
    var xx = this.width / 2;
    var jewel = this.makeJewel_(yy, this.getRandomInt_(1,4));
    var challenge = this.makeSquareComposite_(xx, yy,
        this.getRandomInt_(300, 325), this.getRandomInt_(5,20));
    var rotationSpeed = .01  * (Math.random() > 0.5 ? -1 : 1);
    challenge.eventLoop_ = function() {
      Composite.rotate(challenge, rotationSpeed, {x: xx, y: yy});
      if (this.viewBound + this.height + 500 < yy) {
        var index = this.challenges.indexOf(challenge);
        if (index != -1) this.challenges.splice(index, 1);
        World.remove(this.engine.world, challenge);
        World.remove(this.engine.world, jewel);
      }
    }.bind(this);

    this.challenges.push(challenge);
    this.lastChallengePosition = yy;
    World.add(this.engine.world, challenge);
  };


  /**
   * Makes a line challenge.
   * @param {Number} yy Y-position for the challenge.
   * @private
   */
  Game.prototype.makeLineChallenge_ = function(yy) {
    var challenge = this.makeLineComposite_(yy, this.getRandomInt_(5,25));
    challenge.eventLoop_ = function() {
      if (this.viewBound + this.height + 500 < yy) {
        var index = this.challenges.indexOf(challenge);
        if (index != -1) this.challenges.splice(index, 1);
        World.remove(this.engine.world, challenge);
      }
    }.bind(this);

    this.challenges.push(challenge);
    this.lastChallengePosition = yy;
    World.add(this.engine.world, challenge);
  };


  /**
   * Set ball color.
   * @param {string} color Hex color code.
   * @param {number} colisionCategory Category for collision detection.
   * @private
   */
  Game.prototype.setBallColor_ = function(color, collisionCategory) {
    this.ball.render.fillStyle = color;
    this.ball.render.strokeStyle = color;
    this.ball.collisionFilter.category = collisionCategory;
    this.controllerCallbacks.colorChange(color);
  };


  /**
   * Gets random integer between min and max inclusive.
   * @private
   * @param {Number} min Minimum number.
   * @param {Number} max Maximum number.
   * @return {Number} Random number.
   */
  Game.prototype.getRandomInt_ = function(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
  };


  /**
   * Shuffles array in place.
   * @param {Array} a items The array containing the items.
   */
  Game.prototype.shuffle_ = function(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
      j = Math.floor(Math.random() * i);
      x = a[i - 1];
      a[i - 1] = a[j];
      a[j] = x;
    }
  };


  /**
   * Makes a square composite.
   * @param {Number} xx X-position of the composite.
   * @param {Number} xx Y-position of the composite.
   * @param {Number} size Size of the composite.
   * @param {Number} thickness Thickness of the composite.
   * @private
   */
  Game.prototype.makeSquareComposite_ = function(xx, yy, size, thickness) {
    var square = Composite.create({label: 'Square'});

    var offset = (thickness - size) / 2;

    var top = Bodies.rectangle(xx, yy + offset, size, thickness, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_2 |
              Game.COLLISION_CATEGORY_3 |
              Game.COLLISION_CATEGORY_4,
      },
      render: {
        fillStyle: Game.COLOR_1,
        lineWidth: 0.01,
      },
    });
    var left = Bodies.rectangle(xx + offset, yy, thickness, size, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_1 |
              Game.COLLISION_CATEGORY_3 |
              Game.COLLISION_CATEGORY_4,
      },
      render: {
        fillStyle: Game.COLOR_2,
        lineWidth: 0.01,
      },
    });
    var bottom = Bodies.rectangle(xx, yy - offset, size, thickness, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_1 |
              Game.COLLISION_CATEGORY_2 |
              Game.COLLISION_CATEGORY_4,
      },
      render: {
        fillStyle: Game.COLOR_3,
        lineWidth: 0.01,
      },
    });
    var right = Bodies.rectangle(xx - offset, yy, thickness, size, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_1 |
              Game.COLLISION_CATEGORY_2 |
              Game.COLLISION_CATEGORY_3,
      },
      render: {
        fillStyle: Game.COLOR_4,
        lineWidth: 0.01,
      },
    });

    top.isChallenge_ = true;
    left.isChallenge_ = true;
    bottom.isChallenge_ = true;
    right.isChallenge_ = true;

    Composite.addBody(square, top);
    Composite.addBody(square, left);
    Composite.addBody(square, bottom);
    Composite.addBody(square, right);
    return square;
  };


  /**
   * Makes a line composite.
   * @param {Number} xx Y-position of the composite.
   * @param {Number} thickness Thickness of the composite.
   * @private
   */
  Game.prototype.makeLineComposite_ = function(yy, thickness) {
    var line = Composite.create({label: 'Line'});
    var width = this.width - Game.WALL_WIDTH * 2;
    var positions = [
      Game.WALL_WIDTH + width / 8,
      Game.WALL_WIDTH + width * 3 / 8,
      Game.WALL_WIDTH + width * 5 / 8,
      Game.WALL_WIDTH + width * 7 / 8
    ];
    // Randomize colors.
    this.shuffle_(positions);
    var line1 = Bodies.rectangle(positions[0], yy, width / 4, thickness, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_2 |
              Game.COLLISION_CATEGORY_3 |
              Game.COLLISION_CATEGORY_4,
      },
      render: {
        fillStyle: Game.COLOR_1,
        lineWidth: 0.01,
      },
    });
    var line2 = Bodies.rectangle(positions[1], yy, width / 4, thickness, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_1 |
              Game.COLLISION_CATEGORY_3 |
              Game.COLLISION_CATEGORY_4,
      },
      render: {
        fillStyle: Game.COLOR_2,
        lineWidth: 0.01,
      },
    });
    var line3 = Bodies.rectangle(positions[2], yy, width / 4, thickness, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_1 |
              Game.COLLISION_CATEGORY_2 |
              Game.COLLISION_CATEGORY_4,
      },
      render: {
        fillStyle: Game.COLOR_3,
        lineWidth: 0.01,
      },
    });
    var line4 = Bodies.rectangle(positions[3], yy, width / 4, thickness, {
      isStatic: true,
      isSensor: true,
      collisionFilter: {
        mask: Game.COLLISION_CATEGORY_1 |
              Game.COLLISION_CATEGORY_2 |
              Game.COLLISION_CATEGORY_3,
      },
      render: {
        fillStyle: Game.COLOR_4,
        lineWidth: 0.01,
      },
    });

    line1.isChallenge_ = true;
    line2.isChallenge_ = true;
    line3.isChallenge_ = true;
    line4.isChallenge_ = true;

    Composite.addBody(line, line1);
    Composite.addBody(line, line2);
    Composite.addBody(line, line3);
    Composite.addBody(line, line4);
    return line;
  };



  return Game;

})();