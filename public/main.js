const socket = io();

// 獲取頁面上的 DOM 元素
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

let currentUser = null; // 用來儲存當前登入者的資訊

// --- Google 登入回呼函數 ---
// 當使用者成功登入後，Google 的函式庫會自動呼叫此函數
function handleCredentialResponse(response) {
    // 將從 Google 取得的 ID Token 傳送給我們的後端伺服器進行驗證
    socket.emit('login-with-google', response.credential);
}

// 監聽來自伺服器的 'login-success' 事件
socket.on('login-success', (user) => {
    currentUser = user; // 儲存使用者資訊
    // 登入成功，切換畫面
    loginScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
});

// 監聽來自伺服器的 'login-failed' 事件
socket.on('login-failed', () => {
    alert('Google 登入驗證失敗，請清除快取後重試。');
});


// 監聽表單的提交事件
form.addEventListener('submit', function(e) {
    e.preventDefault(); // 防止表單提交導致頁面重新整理
    if (input.value && currentUser) {
        socket.emit('chat message', input.value);
        input.value = ''; // 清空輸入框
    }
});

// --- 新的訊息顯示邏輯 ---
function displayMessage(data) {
    const { user, message } = data;
    
    const wrapper = document.createElement('li');
    wrapper.classList.add('message-wrapper');
    
    const container = document.createElement('div');
    container.classList.add('message-container');

    const avatar = document.createElement('img');
    avatar.src = user.picture; // 使用 Google 頭像 URL
    avatar.classList.add('avatar');
    
    const content = document.createElement('div');
    content.classList.add('message-content');
    
    const userName = document.createElement('div');
    userName.textContent = user.name; // 使用 Google 名稱
    userName.classList.add('user-name');
    
    const bubble = document.createElement('div');
    bubble.textContent = message;
    bubble.classList.add('message-bubble');

    // 透過 socket.id 判斷訊息是否為自己發送的
    if (user.socketId === socket.id) {
        wrapper.classList.add('self');
    } else {
        wrapper.classList.add('other');
    }
    
    content.appendChild(userName);
    content.appendChild(bubble);
    container.appendChild(avatar);
    container.appendChild(content);
    wrapper.appendChild(container);

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight; // 自動捲動到最下方
}


// 監聽從伺服器傳來的 'chat message' 事件
socket.on('chat message', displayMessage);

// 監聽系統訊息
socket.on('system message', function(msg) {
    const item = document.createElement('li');
    item.classList.add('system-message');
    item.textContent = msg;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
});

