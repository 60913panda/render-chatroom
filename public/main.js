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
// 建立一個陣列來儲存歷史訊息
const messageHistory = [];
// 設定歷史紀錄的上限，防止記憶體溢出
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

    // --- **新功能**：傳送歷史紀錄給新連線的使用者 ---
    // 我們使用 socket.emit 而不是 io.emit，這樣只會傳給「剛連進來」的那個人
    socket.emit('load history', messageHistory);
    // ---------------------------------------------

    socket.on('login-with-google', async (token) => {
        try {
            const userData = await verifyGoogleToken(token);
            if (userData) {
                socket.user = userData;
                socket.user.socketId = socket.id;
                io.emit('system message', `[系統] "${socket.user.name}" 加入了聊天室`);
                socket.emit('login-success', socket.user);
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

            // **新功能**：將新訊息存入歷史紀錄
            messageHistory.push(messagePackage);
            // 如果歷史紀錄超過上限，就移除最舊的一筆
            if (messageHistory.length > HISTORY_LIMIT) {
                messageHistory.shift();
            }
            // ---------------------------------

            // 正常廣播新訊息給所有人
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

