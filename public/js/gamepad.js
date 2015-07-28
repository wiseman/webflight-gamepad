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
(function(window, document) {
  var Gamepad = function(cockpit) {
    console.log("Loading gamepad plugin.");
    this.cockpit = cockpit;
    this.ticking = false;
    this.gamepads = [];
    this.prevRawGamepadTypes = [];
    this.prevTimestamps = [];

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
  
  /* 
    axe[0] = LS +1 right/ -1 left
    axe[1] = LS +1 back/ -1 forward
    axe[2] = RS +1 right/ -1 left
    axe[3] = RS +1 down/ -1 up
    */
 
  Gamepad.prototype.updateDisplay = function(gamepadId) {
    var gamepad = this.gamepads[gamepadId];
    var FlyButton = gamepad.buttons[9]; // Start, use this to fly
    var LandButton = gamepad.buttons[8]; // Select,  use this to land, check by .press
    var StopButton = gamepad.buttons[7]; // RT, use it to stop in place
    var StopButton2 = gamepad.buttons[6]; // LT, use it to stop in place
    var EmergancyButton = gamepad.buttons[10]; // LS, use it to turn off emergancy 
    var roll = gamepad.axes[0];
    var pitch = gamepad.axes[1];
    var yaw = gamepad.axes[2];
    var altitude = gamepad.axes[3];
    var flipAhead = gamepad.buttons[3]; // Y, use it to flip 	

    this.sendCommands(pitch, roll, yaw, altitude);
  
  	if(flipAhead.pressed) { 
	  this.cockpit.socket.emit('/pilot/animate', {
      	action: "flipAhead"});
   
  	}

    if(FlyButton.pressed) {
      this.cockpit.socket.emit('/pilot/move', {
      	action: "takeoff"});
    }

    if(LandButton.pressed) {
      this.cockpit.socket.emit('/pilot/move', {
      	action: "land"});
    }

    
    if(EmergancyButton.pressed) {
      this.cockpit.socket.emit('/pilot/move', {
      	action: "disableEmergency"});
    }

    if(StopButton.pressed || StopButton2.pressed) {
      this.cockpit.socket.emit('/pilot/move', {
      	action: "stop"});
    }
  };


  window.Cockpit.plugins.push(Gamepad);

}(window, document));