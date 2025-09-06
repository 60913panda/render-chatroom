const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { OAuth2Client } = require('google-auth-library');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// --- Google Auth 設定 ---
const GOOGLE_CLIENT_ID = "308930641338-05gogl8ivqvrsj92p4bm1n135ts8hgtm.apps.googleusercontent.com";
// *** 關鍵修改 1: 簡化 client 初始化 ***
const client = new OAuth2Client();

async function verifyGoogleToken(token) {
    // 這裡的 try...catch 專門處理 Google API 的錯誤
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
        // 如果 token 無效或過期，Google 會在這裡拋出錯誤
        console.error("Google Token 驗證失敗:", error.message);
        return null;
    }
}
// -------------------------

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('一位使用者連線了');

    socket.on('login-with-google', async (token) => {
        // *** 關鍵修改 2: 增加頂層 try...catch 防止伺服器崩潰 ***
        try {
            const userData = await verifyGoogleToken(token);
            
            if (userData) {
                socket.user = userData;
                socket.user.socketId = socket.id;

                io.emit('system message', `[系統] "${socket.user.name}" 加入了聊天室`);
                socket.emit('login-success', socket.user);
            } else {
                // verifyGoogleToken 回傳 null，代表 token 無效
                socket.emit('login-failed');
            }
        } catch (error) {
            // 如果在整個流程中發生任何未預期的錯誤，這個 catch 會接住它
            console.error('登入處理過程中發生嚴重錯誤:', error);
            // 通知使用者失敗，但伺服器不會崩潰
            socket.emit('login-failed');
        }
    });

    socket.on('chat message', (msg) => {
        if (socket.user) {
            io.emit('chat message', {
                user: socket.user,
                message: msg
            });
        }
    });

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

