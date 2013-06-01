webflight-gamepad
=================

This is a plugin for the browser-based AR.Drone ground control station
[webflight](http://eschnou.github.io/ardrone-webflight/) that lets you
fly your drone with a joystick or gamepad.

## How it works

The plugin uses the still-pretty-alpha [Gamepad
API](https://dvcs.w3.org/hg/gamepad/raw-file/default/gamepad.html) for
web browsers.

You can check whether your browser implements the Gamepad API with
[this test
page](http://www.html5rocks.com/en/tutorials/doodles/gamepad/gamepad-tester/tester.html).


## Running the software

You will need the
[ardrone-webflight](https://github.com/eschnou/ardrone-webflight) and
webflight-traffic repos:

```
git clone git://github.com/eschnou/ardrone-webflight.git
git clone git://github.com/wiseman/webflight-gamepad.git
```

Run `npm install` for each:

```
(cd ardrone-webflight && npm install)
(cd webflight-gamepad && npm install)
```

Link `webflight-gamepad` into webflight's `plugins` directory:

```
(cd ardrone-webflight/plugins && ln -s ../../webflight-gamepad gamepad)
```

Copy ardrone-webflight's `config.js.example` to `config.js`:

```
(cd ardrone-webflight && cp config.js.example config.js)
```

Add `"gamepad"` and `"public"` to the `plugins` array in `config.js`,
so it looks something like this:

```
var config = {
    plugins: [
      "video-stream"  // Display the video as a native h264 stream decoded in JS 
      , "hud"         // Display the artificial horizon, altimeter, compass, etc.
      , "pilot"       // Pilot the drone with the keyboard
      , "gamepad"     // Pilot the drone with a joystick/gamepad
    ]
};

module.exports = config;
```


### Start the server

Now you can start the webflight server:

```
(cd ardrone-webflight && node app.js)
```

Plugin your gamepad, point your browser at http://localhost:3000/ and
then press a button on your gamepad to activate the plugin.

If you have a Logitech Extreme 3D Pro joystick, you should now be able
to control the drone's roll/pitch/yaw with the joystick and
climb/descent rate with the throttle.

If you have a device that doesn't work with the existing code you may
have to change the code to use different control axes.  Open an issue
and let me know.
