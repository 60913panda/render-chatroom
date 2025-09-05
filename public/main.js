const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

let username = prompt("請輸入您的暱稱");
if (!username || username.trim() === "") {
    username = "匿名使用者" + Math.floor(Math.random() * 1000);
}
socket.emit('join chat', username);

form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (input.value) {
        socket.emit('chat message', input.value);
        input.value = '';
    }
});

socket.on('chat message', function(data) {
    const item = document.createElement('li');
    item.textContent = `${data.user}: ${data.message}`;
    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});

socket.on('system message', function(msg) {
    const item = document.createElement('li');
    item.textContent = msg;
    item.classList.add('system-message');
    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});
