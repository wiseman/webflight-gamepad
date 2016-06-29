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
      autoStabilize: { enabled: false, delay: 0.7 },
      controls: {
        altitude: { axis: 0, invert: false, deadZone: 0.1 },
        yaw:      { axis: 1, invert: false, deadZone: 0.1 },
        pitch:    { axis: 2, invert: false, deadZone: 0.1 },
        roll:     { axis: 3, invert: false, deadZone: 0.1 },
        disableEmergency: 11,
        takeoff: 9,
        land:   10,
        hover:   3,
        flip:    4,
      },
      customCommands: []
    };

    this.cockpit.socket.on('/gamepad-config', this.onConfigUpdate.bind(this));

    var gamepadSupportAvailable = (
        navigator.getGamepads ||
        !! navigator.webkitGetGamepads ||
        !! navigator.webkitGamepads ||
        (navigator.userAgent.indexOf('Firefox/') != -1));

    if (!gamepadSupportAvailable) {
      console.log('Gamepad not supported.');
      $.notifyBar({
        cssClass: "warn",
        html: 'Browser has no gamepad support! Please use latest Firefox or Chromium'
      });
    } else {
      console.log('Gamepad supported.')

      if (navigator.userAgent.indexOf('Firefox/') != -1) {
        window.addEventListener('gamepadconnected', this.onGamepadConnect.bind(this), false);
        window.addEventListener('gamepaddisconnected', this.onGamepadDisconnect.bind(this), false);
      } else {
        // If connection events are not supported just start polling immediately
        this.startPolling();
      }
    }
  };

  Gamepad.prototype.onConfigUpdate = function(config) {
    // recieve config on connection from webflight config.js
    console.log('recieved gamepad config.');   
    $.extend(this.config, config);
  };

  Gamepad.prototype.sendCommands = function(pitch, roll, yaw, altitude) {
    var cfg = this.config;

    // autoStabilize if all movementcontrols are zero
    if (cfg.autoStabilize.enabled &&  // feature enabled?
      allCtrlsZero() &&               // no new movement controls?
      this.droneIsMoving &&           // are we move currently moving?
      !this.autoStabilizeTimout) {    // are we already stabilizing?

      this.autoStabilizeTimout = setTimeout(function() {
        this.droneIsMoving = false;
        this.cockpit.socket.emit('/pilot/move', { action: 'stop' });
      }.bind(this), cfg.autoStabilize.delay * 1000);
    }

    else if (!allCtrlsZero()) {
      if (this.autoStabilizeTimout) {
        clearTimeout(this.autoStabilizeTimout);
        this.autoStabilizeTimout = null;
      }
      this.droneIsMoving = true;

      this.emitMove(pitch, 'back', 'front', cfg.controls.pitch.deadZone);
      this.emitMove(roll, 'right', 'left',  cfg.controls.roll.deadZone);
      this.emitMove(yaw, 'clockwise', 'counterClockwise', cfg.controls.yaw.deadZone);
      this.emitMove(altitude, 'down', 'up', cfg.controls.altitude.deadZone);
    }

    function allCtrlsZero() {
      return Math.abs(pitch) <= cfg.controls.pitch.deadZone &&
        Math.abs(roll) <= cfg.controls.roll.deadZone &&
        Math.abs(yaw) <= cfg.controls.yaw.deadZone &&
        Math.abs(altitude) <= cfg.controls.altitude.deadZone;
    }
  };

  Gamepad.prototype.emitMove = function(speed, posAction, negAction, deadZone) {
    var action = speed > 0 ? posAction : negAction;
    var absSpeed = Math.abs(speed);
    absSpeed = absSpeed >= deadZone ? absSpeed : 0.0;
    this.cockpit.socket.emit('/pilot/move', {
      action: action,
      speed: absSpeed/3
    });
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
      if (this.gamepads[i].index == event.gamepad.index) {
        this.gamepads.splice(i, 1);
        break;
      }
    }
    if (this.gamepads.length == 0) {
      this.stopPolling();
    }
  };

  Gamepad.prototype.startPolling = function() {
    console.log('started gamepad eventpolling.');
    if (!this.ticking) {
      this.ticking = true;
      this.tick();
    }
  };

  Gamepad.prototype.stopPolling = function() {
    this.ticking = false;
  };

  Gamepad.prototype.tick = function() {
    this.pollStatus();
    this.scheduleNextTick(); // works
  };

  Gamepad.prototype.scheduleNextTick = function() {
    if (this.ticking) {
      requestAnimationFrame(this.tick.bind(this));
    }
  };

  Gamepad.prototype.pollStatus = function() {
    this.pollGamepads();
    for (var i in this.gamepads) {
      var gamepad = this.gamepads[i];
      if (gamepad.timestamp && (gamepad.timestamp == this.prevTimestamps[i])) {
        continue;
      }
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
        if (rawGamepads[i]) {
          this.gamepads.push(rawGamepads[i]);
        }
      }
      if (gamepadsChanged) {
      }
    }
  };
  
  Gamepad.prototype.updateDisplay = function(gamepadId) {
    var gamepad = this.gamepads[gamepadId],
        cfg = this.config.controls,
        socket = this.cockpit.socket;

    var pitch = gamepad.axes[cfg.pitch.axis],
        roll  = gamepad.axes[cfg.roll.axis],
        yaw   = gamepad.axes[cfg.yaw.axis],
        altitude = gamepad.axes[cfg.altitude.axis];

    this.sendCommands(
      cfg.pitch.invert    ? -1 * pitch : pitch,
      cfg.roll.invert     ? -1 * roll : roll,
      cfg.yaw.invert      ? -1 * yaw : yaw,
      cfg.altitude.invert ? -1 * altitude : altitude
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
      socket.emit('/pilot/move', { action: 'stop' });
    }

    // custom commands from config
    for (var cmd of this.config.customCommands) {
      if(gamepad.buttons[cmd.button].pressed)
        socket.emit(cmd.command.path, cmd.command.payload);
    }
  };

  window.Cockpit.plugins.push(Gamepad);

}(window, document, jQuery));