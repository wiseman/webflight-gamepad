function gamepad(name, deps) {
  // send config to the browser upon connection
  deps.io.on('connection', function(socket) {
    socket.emit('/gamepad/config', deps.config.gamepad);
  });
};

module.exports = gamepad;
