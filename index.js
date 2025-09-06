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
const client = new OAuth2Client();

// --- 聊天紀錄功能 ---
const messageHistory = [];
const HISTORY_LIMIT = 50;
// --------------------

async function verifyGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return { name: payload.name, picture: payload.picture, email: payload.email };
    } catch (error) {
        console.error("Google Token 驗證失敗:", error.message);
        return null;
    }
}

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('一位使用者連線了');

    socket.on('login-with-google', async (token) => {
        try {
            const userData = await verifyGoogleToken(token);
            if (userData) {
                socket.user = userData;
                socket.user.socketId = socket.id;
                
                // *** 關鍵修改：登入成功後，才傳送歷史紀錄 ***
                // 1. 先通知使用者登入成功 (這會讓前端切換畫面)
                socket.emit('login-success', socket.user);

                // 2. 接著，只把歷史紀錄傳給這位剛登入的使用者
                socket.emit('load history', messageHistory);
                
                // 3. 最後，才廣播給所有人，通知有人加入了
                io.emit('system message', `[系統] "${socket.user.name}" 加入了聊天室`);
                
            } else {
                socket.emit('login-failed');
            }
        } catch (error) {
            console.error('登入處理過程中發生嚴重錯誤:', error);
            socket.emit('login-failed');
        }
    });

    socket.on('chat message', (msg) => {
        if (socket.user) {
            const messagePackage = {
                user: socket.user,
                message: msg
            };

            messageHistory.push(messagePackage);
            if (messageHistory.length > HISTORY_LIMIT) {
                messageHistory.shift();
            }

            io.emit('chat message', messagePackage);
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

