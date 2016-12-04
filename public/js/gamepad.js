/**
 * Copyright 2012 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author mwichary@google.com (Marcin Wichary)
 * @ported wade@bluu.co.nz (Wade Wildbore)
 * @link - http://www.html5rocks.com/en/tutorials/doodles/gamepad/
 */
(function(window, document, $) {
  var Gamepad = function(cockpit) {

    console.log('Loading gamepad plugin.');
    this.cockpit = cockpit;
    this.ticking = false;
    this.gamepads = [];
    this.prevRawGamepadTypes = [];
    this.prevTimestamps = [];
    this.droneIsMoving = false;
    this.autoStabilizeTimout = null;

    // default config
    this.config = {
      autoStabilize: { enabled: true, delay: 0.15 },
      controls: {
        yaw:      { axis: 0, invert: false, deadZone: 0.1, maxSpeed: 1 },
        altitude: { axis: 1, invert: false, deadZone: 0.1, maxSpeed: 1 },
        roll:     { axis: 2, invert: false, deadZone: 0.1, maxSpeed: 0.4 },
        pitch:    { axis: 3, invert: false, deadZone: 0.1, maxSpeed: 0.4 },
        switchCams: 0,
        hover:      1,
        flip:       2,
        flatTrim:   3,
        takeoff:    6,
        land:       7,
        disableEmergency: 8
      },
      customCommands: []
    };

    this.cockpit.socket.on('/gamepad/config', this.onConfigUpdate.bind(this));

    var gamepadSupportAvailable = (
        navigator.getGamepads ||
        !! navigator.webkitGetGamepads ||
        !! navigator.webkitGamepads ||
        (navigator.userAgent.indexOf('Firefox/') != -1));

    if (!gamepadSupportAvailable) {
      $.notifyBar({
        cssClass: "warn",
        html: 'Browser has no gamepad support! Please use latest Firefox or Chromium'
      });
    } else {
      if (navigator.userAgent.indexOf('Firefox/') != -1) {
        window.addEventListener('gamepadconnected', this.onGamepadConnect.bind(this), false);
        window.addEventListener('gamepaddisconnected', this.onGamepadDisconnect.bind(this), false);
      } else {
        // If connection events are not supported just start polling immediately
        this.startPolling();
      }
    }
  };

  // recieve config on connection from webflight config.js
  Gamepad.prototype.onConfigUpdate = function(config) {
    console.log('recieved gamepad config.');
    $.extend(this.config, config);
  };

  Gamepad.prototype.sendCommands = function(pitch, roll, yaw, altitude) {
    var cfg = this.config.controls;
        allCtrlsZero = (Math.abs(pitch) + Math.abs(roll) + Math.abs(yaw) + Math.abs(altitude) === 0);

    // autoStabilize if all movementcontrols are zero
    if (this.config.autoStabilize.enabled && // feature enabled?
      allCtrlsZero &&                        // no new movement controls?
      this.droneIsMoving &&                  // are we currently moving?
      !this.autoStabilizeTimout) {           // are we already stabilizing?

      this.autoStabilizeTimout = setTimeout(function() {
        this.droneIsMoving = false;
        this.cockpit.socket.emit('/pilot/drone', { action: 'stop' });
      }.bind(this), this.config.autoStabilize.delay * 1000);
    }

    else if (!allCtrlsZero) {
      if (this.autoStabilizeTimout) {
        clearTimeout(this.autoStabilizeTimout);
        this.autoStabilizeTimout = null;
      }

      this.droneIsMoving = true;
      emitMove(pitch, 'back', cfg.pitch);
      emitMove(roll, 'right', cfg.roll);
      emitMove(yaw, 'clockwise', cfg.yaw);
      emitMove(altitude, 'down', cfg.altitude);
    }

    function emitMove(speed, action, axisConf) {
      // normalize speed from deadZone
      var s = (speed - (speed > 0 ? axisConf.deadZone : -axisConf.deadZone)) * 1 / (1-axisConf.deadZone);
      if (Math.abs(speed) < axisConf.deadZone) s = 0.0;
      if (axisConf.invert) s *= -1;
      this.cockpit.socket.emit('/pilot/move', {
        action: action,
        speed: s * axisConf.maxSpeed
      });
    }
  };

  Gamepad.prototype.onGamepadConnect = function(event) {
    console.log('Gamepad connect: ' + event.gamepad.id);
    $.notifyBar({ cssClass: "success", html: 'Gamepad connected: ' + event.gamepad.id });
    this.gamepads.push(event.gamepad);
    this.startPolling();
  };

  Gamepad.prototype.onGamepadDisconnect = function(event) {
    $.notifyBar({ cssClass: "warning", html: 'Gamepad disconnected: ' + event.gamepad.id });

    for (var i in this.gamepads) {
      if (this.gamepads[i].index === event.gamepad.index) {
        this.gamepads.splice(i, 1);
        break;
      }
    }
    if (this.gamepads.length === 0)
      this.stopPolling();
  };

  Gamepad.prototype.startPolling = function() {
    if (this.ticking) return;
    console.log('started gamepad eventpolling.');
    this.ticking = true;
    this.tick();
  };

  Gamepad.prototype.stopPolling = function() {
    this.ticking = false;
  };

  Gamepad.prototype.tick = function() {
    this.pollStatus();
    this.scheduleNextTick(); // works
  };

  Gamepad.prototype.scheduleNextTick = function() {
    if (this.ticking)
      requestAnimationFrame(this.tick.bind(this));
  };

  Gamepad.prototype.pollStatus = function() {
    this.pollGamepads();
    for (var i in this.gamepads) {
      var gamepad = this.gamepads[i];
      if (gamepad.timestamp && (gamepad.timestamp == this.prevTimestamps[i]))
        continue;
      this.prevTimestamps[i] = gamepad.timestamp;
      this.updateDisplay(i);
    }
  };

  Gamepad.prototype.pollGamepads = function() {
    var rawGamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    if (rawGamepads) {
      this.gamepads = [];
      var gamepadsChanged = false;
      for (var i = 0; i < rawGamepads.length; i++) {
        if (rawGamepads[i] != this.prevRawGamepadTypes[i]) {
          gamepadsChanged = true;
          this.prevRawGamepadTypes[i] = rawGamepads[i];
        }
        if (rawGamepads[i])
          this.gamepads.push(rawGamepads[i]);
      }
      if (gamepadsChanged) {}
    }
  };

  Gamepad.prototype.updateDisplay = function(gamepadId) {
    var gamepad = this.gamepads[gamepadId],
        cfg = this.config.controls,
        socket = this.cockpit.socket;

    this.sendCommands(
      gamepad.axes[cfg.pitch.axis], gamepad.axes[cfg.roll.axis],
      gamepad.axes[cfg.yaw.axis],   gamepad.axes[cfg.altitude.axis]
    );

    if(gamepad.buttons[cfg.flip].pressed)
      socket.emit('/pilot/animate', { action: 'flipAhead' });

    if(gamepad.buttons[cfg.takeoff].pressed)
      socket.emit('/pilot/move', { action: 'takeoff' });

    if(gamepad.buttons[cfg.land].pressed) {
      this.droneIsMoving = false;
      socket.emit('/pilot/move', { action: 'land' });
    }

    if(gamepad.buttons[cfg.disableEmergency].pressed)
      socket.emit('/pilot/move', { action: 'disableEmergency' });

    if(gamepad.buttons[cfg.hover].pressed) {
      this.droneIsMoving = false;
      socket.emit('/pilot/drone', { action: 'stop' });
    }

    if(gamepad.buttons[cfg.flatTrim].pressed && !this.droneIsMoving)
      socket.emit('/pilot/ftrim');

    if(gamepad.buttons[cfg.switchCams].pressed)
      socket.emit('/pilot/channel');

    // custom commands from config
    for (var cmd of this.config.customCommands) {
      if(gamepad.buttons[cmd.button].pressed)
        socket.emit(cmd.command.path, cmd.command.payload);
    }
  };

  window.Cockpit.plugins.push(Gamepad);

}(window, document, jQuery));
