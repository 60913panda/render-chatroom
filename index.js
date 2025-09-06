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
const client = new OAuth2Client();

// --- 聊天紀錄設定 ---
const messageHistory = [];
const HISTORY_LIMIT = 50;

// --- 後端函式：驗證 Google Token ---
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

// 告訴 Express 靜態檔案的位置
app.use(express.static('public'));

// --- Socket.IO 核心邏輯 ---
io.on('connection', (socket) => {
    console.log(`一位使用者連線成功，ID: ${socket.id}`);

    // 監聽來自前端的登入請求
    socket.on('login-with-google', async (token) => {
        try {
            const userData = await verifyGoogleToken(token);
            if (userData) {
                // 將使用者資訊附加到 socket 連線上
                socket.user = { ...userData, socketId: socket.id };

                // 1. 回傳登入成功訊息給該使用者
                socket.emit('login-success', socket.user);

                // 2. 傳送歷史訊息給該使用者
                socket.emit('load-history', messageHistory);

                // 3. 廣播給所有人，通知新成員加入
                io.emit('system-message', `[系統] "${socket.user.name}" 加入了聊天室。`);
            } else {
                // Token 驗證失敗
                socket.emit('login-failed');
            }
        } catch (error) {
            console.error('登入流程發生未知錯誤:', error);
            socket.emit('login-failed');
        }
    });

    // 監聽聊天訊息
    socket.on('chat-message', (msg) => {
        if (socket.user) {
            const messagePackage = {
                user: socket.user,
                message: msg,
                timestamp: new Date()
            };

            // 儲存訊息到歷史紀錄
            messageHistory.push(messagePackage);
            if (messageHistory.length > HISTORY_LIMIT) {
                messageHistory.shift();
            }

            // 廣播訊息給所有人
            io.emit('chat-message', messagePackage);
        }
    });

    // 監聽斷線事件
    socket.on('disconnect', () => {
        if (socket.user) {
            console.log(`"${socket.user.name}" 離開了。`);
            io.emit('system-message', `[系統] "${socket.user.name}" 離開了聊天室。`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`伺服器已在 http://localhost:${PORT} 啟動`);
});

