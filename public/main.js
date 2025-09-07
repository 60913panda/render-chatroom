// --- 初始化 Socket.IO ---
const socket = io();

// --- DOM 元素 ---
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const messages = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');

// --- 本地變數 ---
let currentUser = null; // 儲存當前登入者的資訊

// --- Google 登入回呼函式 (必須為全域函式) ---
function handleCredentialResponse(response) {
    console.log("Google 登入成功，正在傳送 Token 到後端驗證...");
    socket.emit('login-with-google', response.credential);
}

// --- 監聽來自後端的事件 ---

// 1. 登入成功
socket.on('login-success', (user) => {
    console.log("後端驗證成功:", user);
    currentUser = user; // 儲存自己的使用者資料
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
});

// 2. 登入失敗
socket.on('login-failed', () => {
    alert('Google 登入失敗，請稍後再試。');
});

// 3. 載入歷史訊息
socket.on('load-history', (history) => {
    messages.innerHTML = ''; // 清空舊訊息
    history.forEach(appendMessage); // 顯示每一條歷史訊息
    appendSystemMessage('--- 已載入最近的對話紀錄 ---');
});

// 4. 收到新的聊天訊息
socket.on('chat-message', (data) => {
    appendMessage(data);
});

// 5. 收到系統訊息
socket.on('system-message', (msg) => {
    appendSystemMessage(msg);
});

// --- 前端事件處理 ---

// 處理訊息發送
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value && currentUser) {
        socket.emit('chat-message', input.value);
        input.value = '';
    }
});

// --- 輔助函式 ---

// 函式：在畫面上新增一條聊天訊息
function appendMessage(data) {
    const { user, message } = data;
    const wrapper = document.createElement('li');
    wrapper.classList.add('message-wrapper');
    
    // [修正] 改用 user.email 判斷訊息歸屬，確保歷史訊息也能正確顯示
    // 因為 socketId 在每次重新連線時都會改變，而 email 是固定不變的
    if (currentUser && user.email === currentUser.email) {
        wrapper.classList.add('self');
    } else {
        wrapper.classList.add('other');
    }

    // 產生訊息的 HTML 結構
    // 增加一個簡易的訊息清理，防止 HTML 注入
    const sanitizedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    wrapper.innerHTML = `
        <div class="message-container">
            <img src="${user.picture}" alt="${user.name}" class="avatar">
            <div class="message-content">
                <div class="user-name">${user.name}</div>
                <div class="message-bubble">${sanitizedMessage}</div>
            </div>
        </div>
    `;
    messages.appendChild(wrapper);
    scrollToBottom();
}

// 函式：在畫面上新增一條系統訊息
function appendSystemMessage(msg) {
    const item = document.createElement('li');
    item.classList.add('system-message');
    item.textContent = msg;
    messages.appendChild(item);
    scrollToBottom();
}

// 函式：自動捲動到訊息底部
function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
}
