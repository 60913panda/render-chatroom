const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { OAuth2Client } = require('google-auth-library');
const redis = require('redis');
const { google } = require('googleapis');
const path = require('path');

// --- 基本設定 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// --- Google Sheets API 設定 ---
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const sheets = google.sheets('v4');

// [修改處] 判斷執行環境，指向正確的憑證路徑
// 在 Render 上，Secret File 會被放在 /etc/secrets/
// 在本地開發時，我們則讀取根目錄的檔案
const keyFilePath = process.env.NODE_ENV === 'production'
    ? '/etc/secrets/credentials.json'
    : path.join(__dirname, 'credentials.json');

const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// --- Redis 資料庫設定 ---
const REDIS_URL = process.env.REDIS_URL;
const HISTORY_KEY = "chatroom_history";
const HISTORY_LIMIT = 50;
let redisClient;

(async () => {
    // 只有在提供了 REDIS_URL 的情況下才嘗試連接
    if (REDIS_URL) {
        try {
            redisClient = redis.createClient({ url: REDIS_URL });
            redisClient.on('error', (err) => console.log('Redis Client Error', err));
            await redisClient.connect();
            console.log('已成功連接到 Redis 資料庫');
        } catch (err) {
            console.error('無法連接到 Redis:', err);
        }
    } else {
        console.log('未設定 REDIS_URL，將跳過 Redis 連接。');
    }
})();

// --- Google 登入設定 ---
const GOOGLE_CLIENT_ID = "308930641338-05gogl8ivqvrsj92p4bm1n135ts8hgtm.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        return { name: payload.name, picture: payload.picture, email: payload.email };
    } catch (error) {
        console.error("Google Token 驗證失敗:", error.message);
        return null;
    }
}

app.use(express.static('public'));

io.on('connection', async (socket) => {
    console.log(`一位使用者連線成功，ID: ${socket.id}`);

    socket.on('login-with-google', async (token) => {
        try {
            const userData = await verifyGoogleToken(token);
            if (userData) {
                socket.user = { ...userData, socketId: socket.id };
                socket.emit('login-success', socket.user);

                if (redisClient && redisClient.isReady) {
                    const history = await redisClient.lRange(HISTORY_KEY, 0, -1);
                    const messageHistory = history.map(item => JSON.parse(item)).reverse();
                    socket.emit('load-history', messageHistory);
                }

                io.emit('system-message', `[系統] "${socket.user.name}" 加入了聊天室。`);
            } else {
                socket.emit('login-failed');
            }
        } catch (error) {
            console.error('登入流程發生嚴重錯誤:', error);
            socket.emit('login-failed');
        }
    });

    socket.on('chat-message', async (msg) => {
        if (socket.user && socket.user.name) {
            const timestamp = new Date();
            const messagePackage = { user: socket.user, message: msg, timestamp: timestamp };
            
            io.emit('chat-message', messagePackage);

            if (redisClient && redisClient.isReady) {
                redisClient.lPush(HISTORY_KEY, JSON.stringify(messagePackage))
                    .then(() => redisClient.lTrim(HISTORY_KEY, 0, HISTORY_LIMIT - 1))
                    .catch(err => console.error("寫入 Redis 失敗:", err));
            }
            
            try {
                const formattedTime = timestamp.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
                const values = [[socket.user.name, msg, formattedTime]];
                
                await sheets.spreadsheets.values.append({
                    auth,
                    spreadsheetId: GOOGLE_SHEET_ID,
                    range: '工作表1!A:C',
                    valueInputOption: 'USER_ENTERED',
                    resource: { values },
                });
            } catch (err) {
                console.error('寫入 Google Sheet 失敗:', err.message || err);
            }
        }
    });

    socket.on('disconnect', () => {
        if (socket.user && socket.user.name) {
            console.log(`"${socket.user.name}" 離開了。`);
            io.emit('system-message', `[系統] "${socket.user.name}" 離開了聊天室。`);
        } else {
            console.log(`一位未登入的使用者(ID: ${socket.id})已斷線。`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`伺服器已在 http://localhost:${PORT} 啟動`);
});
