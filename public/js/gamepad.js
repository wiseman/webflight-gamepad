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

(function(window, document){

    /**
     * Initialize support for Gamepad API.
     */
    var Gamepad = function(cockpit){

        console.log('Loading gamepad plugin');

        this.cockpit = cockpit;
        this.ticking = false;
        this.gamepads = [];
        this.prevRawGamepadTypes = [];
        this.prevTimestamps = [];

        var gamepadSupportAvailable = navigator.getGamepads ||
            !!navigator.webkitGetGamepads ||
            !!navigator.webkitGamepads;

        if (!gamepadSupportAvailable) {

            console.log('Gamepad not supported !');

        } else {

            console.log('Gamepad supported');

            if ('ongamepadconnected' in window) {
                window.addEventListener('gamepadconnected', this.onGamepadConnect.bind(this), false);
                window.addEventListener('gamepaddisconnected', this.onGamepadDisconnect.bind(this), false);
            } else {
                // If connection events are not supported just start polling
                this.startPolling();
            }
        }

    };// ./gamepad

    Gamepad.prototype.sendCommands = function(pitch, roll, yaw, altitude){

        this.emitMove(pitch, 'back', 'front');
        this.emitMove(roll, 'right', 'left');
        this.emitMove(yaw, 'clockwise', 'counterClockwise');
        this.emitMove(altitude, 'down', 'up');

    };

    Gamepad.prototype.emitMove = function(speed, posAction, negAction, deadZone) {

        var action, absSpeed;

        deadZone = deadZone || 0.1;
        action = speed > 0 ? posAction : negAction;
        absSpeed = Math.abs(speed);
        absSpeed = absSpeed >= deadZone ? absSpeed : 0.0;

        // move the drone..
        this.cockpit.socket.emit('/pilot/move', {
            action: action,
            speed: Math.abs(absSpeed)
        });

    };

    /**
     * React to the gamepad being connected.
     */
    Gamepad.prototype.onGamepadConnect = function(event){

        console.log(event);

        this.gamepads.push(event.gamepad);
        this.startPolling();
    };

    /**
     * React to the gamepad being disconnected.
     */
    Gamepad.prototype.onGamepadDisconnect = function(event){

        // Remove the gamepad from the list of gamepads to monitor.
        for (var i in this.gamepads) {
            if (this.gamepads[i].index == event.gamepad.index) {
                this.gamepads.splice(i, 1);
                break;
            }
        }

        // If no gamepads are left, stop the polling loop.
        if (this.gamepads.length == 0) {
            this.stopPolling();
        }

    };

    /**
     * Starts a polling loop to check for gamepad state.
     */
    Gamepad.prototype.startPolling = function(){

        if(!this.ticking){
            this.ticking = true;
            this.tick();
        }

    };

    /**
     * Stops a polling loop by setting a flag which will prevent the next
     * requestAnimationFrame() from being scheduled.
     */
    Gamepad.prototype.stopPolling = function(){

        this.ticking = false;

    };

    /**
     * A function called with each requestAnimationFrame(). Polls the gamepad
     * status and schedules another poll.
     */
    Gamepad.prototype.tick = function(){

        this.pollStatus();
        this.scheduleNextTick();

    };

    Gamepad.prototype.scheduleNextTick = function(){

        if (this.ticking) {
            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(this.tick.bind(this));
            } else if (window.mozRequestAnimationFrame) {
                window.mozRequestAnimationFrame(this.tick.bind(this));
            } else if (window.webkitRequestAnimationFrame) {
                window.webkitRequestAnimationFrame(this.tick.bind(this));
            }
          // Note lack of setTimeout since all the browsers that support
          // Gamepad API are already supporting requestAnimationFrame().
        }

    }

    /**
     * Checks for the gamepad status. Monitors the necessary data and notices
     * the differences from previous state (buttons for Chrome/Firefox,
     * new connects/disconnects for Chrome). If differences are noticed, asks
     * to update the display accordingly. Should run as close to 60 frames per
     * second as possible.
     */
    Gamepad.prototype.pollStatus = function(){

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

   /**
    * This function is called only on Chrome, which does not yet support
    * connection/disconnection events, but requires you to monitor
    * an array for changes.
    */
    Gamepad.prototype.pollGamepads = function(){

        var rawGamepads =
        (navigator.getGamepads && navigator.getGamepads()) ||
        (navigator.webkitGetGamepads && navigator.webkitGetGamepads());

        if (rawGamepads) {
          // We donâ€™t want to use rawGamepads coming straight from the browser,
          // since it can have â€œholesâ€ (e.g. if you plug two gamepads, and then
          // unplug the first one, the remaining one will be at index [1]).
            this.gamepads = [];

          // We only refresh the display when we detect some gamepads are new
          // or removed; we do it by comparing raw gamepad table entries to
          // â€œundefined.â€
            var gamepadsChanged = false;

            for (var i = 0; i < rawGamepads.length; i++) {
                if (typeof rawGamepads[i] != this.prevRawGamepadTypes[i]) {
                    gamepadsChanged = true;
                    this.prevRawGamepadTypes[i] = typeof rawGamepads[i];
                }

                if (rawGamepads[i]) {
                    this.gamepads.push(rawGamepads[i]);
                }
            }
        }
    };

    Gamepad.prototype.updateDisplay = function(gamepadId) {
      var gamepad = this.gamepads[gamepadId];
      var roll = gamepad.axes[0];
      var pitch = gamepad.axes[1];
      var yaw = gamepad.axes[5];
      var altitude = gamepad.axes[6];
      this.sendCommands(pitch, roll, yaw, altitude);
  };


  window.Cockpit.plugins.push(Gamepad);

}(window, document));
