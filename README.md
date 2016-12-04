# webflight-gamepad

This is a plugin for the browser-based AR.Drone ground control station
[webflight](http://eschnou.github.io/ardrone-webflight/) that lets you
fly your drone with a joystick or gamepad.

## How it works
The plugin uses the <del>still-pretty-alpha</del> [Gamepad
API](https://dvcs.w3.org/hg/gamepad/raw-file/default/gamepad.html) for
web browsers.
Current Firefox & Chromium/Chrome are supported.
You may test with a connected gamepad on [this site](http://html5gamepad.com/).

The first connected gamepad is used to control the drone. It gets activated, once a button on the pad is pressed.

Custom commands & controls may be configured in `ardone-webflight`'s `config.js` (see [below](#configuration)).

### default controls
these may be mapped differently depending on your device.
I recommend testing the button layout [here](http://html5gamepad.com/) first, and configuring your own button layout (see [below](#configuration)).

| control | function |
|---------|----------|
|LS|altitude & yaw|
|RS|pitch & roll|
|LB|takeoff|
|RB|land|
|Button 1 / A|switch cameras|
|Button 2 / B|hover / stop current motion|
|Button 3 / Y|flip (front)|
|Button 4 / X|flat trim|
|Button 9|disable emergency|

## Installing & activating the plugin
You will need the
[`ardrone-webflight`](https://github.com/eschnou/ardrone-webflight) and
`webflight-gamepad` repos:

```
git clone git://github.com/eschnou/ardrone-webflight.git
git clone git://github.com/noerw/webflight-gamepad.git
```

To install `adrone-webflight`, see the respective repo.

Link `webflight-gamepad` into webflight's `plugins` directory, or add it as a git submodule:

```
cd ardrone-webflight/plugins 
ln -s ../../webflight-gamepad gamepad
```

Add `pilot` and `gamepad` to the `plugins` array in `config.js`,
so it looks something like this:

```
plugins: [
  "video-stream"  // Display the video as a native h264 stream decoded in JS 
  , "hud"         // Display the artificial horizon, altimeter, compass, etc.
  , "pilot"       // Pilot the drone with the keyboard
  , "gamepad"     // Pilot the drone with a joystick/gamepad
]
```

## configuration

All controls may be remapped.
Also, custom commands (eg. for other plugins) may be added!

The default configuration looks like this, and is merged with the `config.gamepad` object in `ardrone-webflight/config.js`:

```js
{
  // hover when no input is given after delay seconds
  autoStabilize: { enabled: true, delay: 0.15 },
  // controller mapping
  controls: {
    yaw:      { axis: 0, invert: false, deadZone: 0.1, maxSpeed: 1 },
    altitude: { axis: 1, invert: false, deadZone: 0.1, maxSpeed: 1 },
    roll:     { axis: 2, invert: false, deadZone: 0.1, maxSpeed: 0.4 },
    pitch:    { axis: 3, invert: false, deadZone: 0.1, maxSpeed: 0.4 },
    recoverEmergency: 8,
    switchCams: 0,
    hover:      1,
    flip:       2,
    flatTrim:   3,
    takeoff:    6,
    land:       7
  },
  // add custom commands
  customCommands: []
}
```

### autoStabilize

The auto-stabilization feature is disabled by default.
When enabled in the config, the drone will automatically hover after the specified delay, once you don't touch any of the sticks!

### custom commands
To define a custom command, add an object with the following structure to the `gamepad.customCommands` array:

```js
{
  button: 7,
  command: { path: '/pilot/animate', payload: { action: 'flipBack' } }
}
```

This adds a backflip animation to button 7.
Any websocket message may be sent this way to the node server!

## License
Published under the [apache license 2.0](http://www.apache.org/licenses/LICENSE-2.0).

Originially written by [wiseman](https://github.com/wiseman/webflight-gamepad), updated & extended by [noerw](https://github.com/noerw/webflight-gamepad)
