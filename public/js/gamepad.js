/**
 * Copyright 2012 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
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

    console.log("Loading gamepad plugin.");
    this.cockpit = cockpit;
    this.ticking = false;
    this.gamepads = [];
    this.prevRawGamepadTypes = [];
    this.prevTimestamps = [];
    this.config = {
      altitude: { axis: 0, invert: false },
      yaw:      { axis: 1, invert: false },
      pitch:    { axis: 2, invert: false },
      roll:     { axis: 3, invert: false },
      takeoff: 9,
      land:   10,
      hover:   3,
      flip:    4,
    };

    this.cockpit.socket.on('/gamepad-config', this.updateConfig.bind(this));

    var gamepadSupportAvailable = (
        navigator.getGamepads ||
        !! navigator.webkitGetGamepads ||
        !! navigator.webkitGamepads ||
        (navigator.userAgent.indexOf('Firefox/') != -1));

    if (!gamepadSupportAvailable) {
      console.log('Gamepad not supported.');
    } else {
      console.log('Gamepad supported.')
      window.addEventListener('MozGamepadConnected',
                              this.onGamepadConnect.bind(this),
                              false);
      window.addEventListener('MozGamepadDisconnected',
                              this.onGamepadDisconnect.bind(this),
                              false);
      if (gamepadSupportAvailable) {
        this.startPolling();
      }
    }
  };

  Gamepad.prototype.updateConfig = function(config) {
    // recieve config on connection from webflight config.js
    console.log('recieved gamepad config.');   
    $.extend(this.config, config);
    console.log(this.config);
  };

  Gamepad.prototype.sendCommands = function(pitch, roll, yaw, altitude) {
    // console.log("yaw (direction): " + " , altitude " + altitude);
    this.emitMove(pitch, 'back', 'front');
    this.emitMove(roll, 'right', 'left');
    this.emitMove(yaw, 'clockwise', 'counterClockwise');
    this.emitMove(altitude, 'down', 'up');
  };

  Gamepad.prototype.emitMove = function(speed, posAction, negAction, deadZone) {
    deadZone = deadZone || 0.1;
    var action = speed > 0 ? posAction : negAction;
    var absSpeed = Math.abs(speed);
    absSpeed = absSpeed >= deadZone ? absSpeed : 0.0;
    this.cockpit.socket.emit('/pilot/move', {
      action: action,
      speed: Math.abs(absSpeed/3)
    });
  };

  Gamepad.prototype.onGamepadConnect = function(event) {
    console.log("Gamepad connect: " + event);
    this.gamepads.push(event.gamepad);
    this.startPolling();
  };

  Gamepad.prototype.onGamepadDisconnect = function(event) {
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
        cfg = this.config,
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
      socket.emit('/pilot/animate', { action: "flipAhead" });
   
    if(gamepad.buttons[cfg.takeoff].pressed)
      socket.emit('/pilot/move', { action: "takeoff" });

    if(gamepad.buttons[cfg.land].pressed)
      socket.emit('/pilot/move', { action: "land" });
    
    if(gamepad.buttons[cfg.disableEmergency].pressed)
      socket.emit('/pilot/move', { action: "disableEmergency" });

    if(gamepad.buttons[cfg.hover].pressed)
      socket.emit('/pilot/move', { action: "stop" });
  };


  window.Cockpit.plugins.push(Gamepad);

}(window, document, jQuery));