const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
  socket.on('join chat', (username) => {
    socket.username = username;
    socket.broadcast.emit('system message', `${username} 加入了聊天室`);
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', { user: socket.username, message: msg });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('system message', `${socket.username} 離開了聊天室`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
