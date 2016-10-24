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
    Events.on(this.engine, 'collisionStart', this.collisionEventHandler_.bind(this));
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

    // Initialize array to keep track of challenges in view.
    this.challenges = [];

    // Initialize first challenge.
    this.addChallenge_(this.height - 600);

    // Reset gravity.
    this.engine.world.gravity.x = 0;

    // Create ball.
    this.ball = Bodies.circle(this.width / 2, this.height - 100,
        Game.BALL_SIZE, {restitution: 1});
    World.add(this.engine.world, this.ball);

    // Initialize ball color.
    this.setBallColor_(Game.COLOR_1, Game.COLLISION_CATEGORY_1);

    // Create floor.
    this.floor = Bodies.rectangle(this.width / 2, this.height, this.width, 30, {
      isStatic: true,
      render: {
        fillStyle: '#555',
        lineWidth: 0.01,
      },
    });
    World.add(this.engine.world, this.floor);

    // Create left and right walls.
    this.leftWall = Bodies.rectangle(0, this.height / 2, 30, this.height, {
      isStatic: true,
      render: {
        fillStyle: '#555',
        lineWidth: 0.01,
      },
    });
    this.rightWall = Bodies.rectangle(this.width, this.height / 2, 30,
        this.height, {
          isStatic: true,
          render: {
            fillStyle: '#555',
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

    this.controllerCallbacks.gameEnded(this.score);
  };


  /**
   * Makes the ball jump.
   */
  Game.prototype.jump = function() {
    if (!this.started) return;
    this.bounceSfx.play();
    Body.setVelocity(this.ball, {x: 0, y: -5});
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
      this.end();
      this.crashSfx.play();
    }

    // Produce more challenges.
    if (this.lastChallengePosition > this.viewBound) {
      this.addChallenge_(this.lastChallengePosition - this.getRandomInt_(400, 600));
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
          // End game.
          this.end();
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
    var xx = this.width / 2;

    var jewelColor, jewelCollisionCategory;
    switch (this.getRandomInt_(1, 4)) {
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

    var challenge = this.makeSquareComposite_(xx, yy, this.getRandomInt_(200, 315), this.getRandomInt_(5,25));
    var rotationSpeed = .01 * this.getRandomInt_(1, 3) * (Math.random() > 0.5 ? -1 : 1);
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



  return Game;

})();