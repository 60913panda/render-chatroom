const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { OAuth2Client } = require('google-auth-library');

// --- 基本設定 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// --- Google 登入設定 ---
const GOOGLE_CLIENT_ID = "308930641338-05gogl8ivqvrsj92p4bm1n135ts8hgtm.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- 聊天紀錄設定 ---
const messageHistory = [];
const HISTORY_LIMIT = 50; 

// --- 後端函式：安全地驗證 Google Token ---
async function verifyGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return {
            name: payload.name,
            picture: payload.picture,
            email: payload.email,
        };
    } catch (error) {
        console.error("Google Token 驗證失敗:", error.message);
        return null;
    }
}

// 設定靜態檔案資料夾為 'public'
app.use(express.static('public'));

// --- Socket.IO 核心邏輯 ---
io.on('connection', (socket) => {
    console.log(`一位使用者連線成功，ID: ${socket.id}`);

    // 監聽來自前端的 'login-with-google' 登入請求
    socket.on('login-with-google', async (token) => {
        try {
            const userData = await verifyGoogleToken(token);
            if (userData) {
                socket.user = { ...userData, socketId: socket.id };
                socket.emit('login-success', socket.user);
                socket.emit('load-history', messageHistory);
                io.emit('system-message', `[系統] "${socket.user.name}" 加入了聊天室。`);
            } else {
                socket.emit('login-failed');
            }
        } catch (error) {
            console.error('登入流程發生嚴重錯誤:', error);
            socket.emit('login-failed');
        }
    });

    // 監聽 'chat-message' 事件
    socket.on('chat-message', (msg) => {
        if (socket.user && socket.user.name) { // 同樣可以加上更嚴格的檢查
            const messagePackage = {
                user: socket.user,
                message: msg,
                timestamp: new Date()
            };
            messageHistory.push(messagePackage);
            if (messageHistory.length > HISTORY_LIMIT) {
                messageHistory.shift();
            }
            io.emit('chat-message', messagePackage);
        }
    });

    // 監聽 'disconnect' 斷線事件
    socket.on('disconnect', () => {
        // [修改處] 增加對 socket.user.name 的檢查，確保使用者有名字才廣播
        if (socket.user && socket.user.name) {
            console.log(`"${socket.user.name}" 離開了。`);
            io.emit('system-message', `[系統] "${socket.user.name}" 離開了聊天室。`);
        } else {
            // 對於未登入就離開的使用者，只在後台記錄，不發送系統訊息
            console.log(`一位未登入的使用者(ID: ${socket.id})已斷線。`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`伺服器已在 http://localhost:${PORT} 啟動`);
});
