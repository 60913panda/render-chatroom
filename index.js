const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
// 引入 Google 官方驗證函式庫
const { OAuth2Client } = require('google-auth-library');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// --- Google Auth 設定 ---
// 您的 Google OAuth Client ID
const GOOGLE_CLIENT_ID = "308930641338-05gogl8ivqvrsj92p4bm1n135ts8hgtm.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// 建立一個函式專門用來驗證從前端傳來的 Google ID Token
async function verifyGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        // 驗證成功，回傳使用者資料
        return {
            name: payload.name,
            picture: payload.picture,
            email: payload.email,
        };
    } catch (error) {
        console.error("Google Token 驗證失敗:", error);
        return null; // 驗證失敗
    }
}
// -------------------------

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('一位使用者連線了');

    // 新的登入邏輯：監聽 'login-with-google' 事件
    socket.on('login-with-google', async (token) => {
        const userData = await verifyGoogleToken(token);
        
        if (userData) {
            // 驗證成功後，將使用者資料存到 socket 連線中
            socket.user = userData;
            // 為了方便前端判斷訊息是否為自己發送的，我們將 socket.id 也存入
            socket.user.socketId = socket.id;

            // 通知所有人有新使用者加入
            io.emit('system message', `[系統] "${socket.user.name}" 加入了聊天室`);
            // 單獨通知該使用者登入成功
            socket.emit('login-success', socket.user);
        } else {
            // 驗證失敗，通知該使用者
            socket.emit('login-failed');
        }
    });

    // 修改訊息傳送邏輯
    socket.on('chat message', (msg) => {
        // 只有在使用者成功登入後 (socket.user 存在)，才能發送訊息
        if (socket.user) {
            io.emit('chat message', {
                user: socket.user, // 傳送整個 user 物件 (包含 name, picture, socketId)
                message: msg
            });
        }
    });

    // 修改斷線邏輯
    socket.on('disconnect', () => {
        if (socket.user) {
            console.log(`"${socket.user.name}" 離開了`);
            io.emit('system message', `[系統] "${socket.user.name}" 離開了聊天室`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`伺服器成功啟動，正在監聽 http://localhost:${PORT}`);
});

