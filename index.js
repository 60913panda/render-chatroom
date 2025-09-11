const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { OAuth2Client } = require('google-auth-library');
const redis = require('redis'); // 引入 redis 套件

// --- 基本設定 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// --- Redis 資料庫設定 ---
const REDIS_URL = process.env.REDIS_URL; // 從環境變數讀取 Redis URL
const HISTORY_KEY = "chatroom_history"; // Redis 中儲存歷史紀錄的 Key
const HISTORY_LIMIT = 50;
let redisClient;

(async () => {
    try {
        redisClient = redis.createClient({ url: REDIS_URL });
        redisClient.on('error', (err) => console.log('Redis Client Error', err));
        await redisClient.connect();
        console.log('已成功連接到 Redis 資料庫');
    } catch (err) {
        console.error('無法連接到 Redis:', err);
    }
})();


// --- Google 登入設定 ---
const GOOGLE_CLIENT_ID = "308930641338-05gogl8ivqvrsj92p4bm1n135ts8hgtm.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

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

io.on('connection', async (socket) => {
    console.log(`一位使用者連線成功，ID: ${socket.id}`);

    socket.on('login-with-google', async (token) => {
        try {
            const userData = await verifyGoogleToken(token);
            if (userData) {
                socket.user = { ...userData, socketId: socket.id };
                socket.emit('login-success', socket.user);

                // [修改] 從 Redis 讀取歷史紀錄
                const history = await redisClient.lRange(HISTORY_KEY, 0, HISTORY_LIMIT - 1);
                const messageHistory = history.map(item => JSON.parse(item));
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

    socket.on('chat-message', async (msg) => {
        if (socket.user && socket.user.name) {
            const messagePackage = {
                user: socket.user,
                message: msg,
                timestamp: new Date()
            };
            
            // [修改] 將新訊息存入 Redis
            await redisClient.lPush(HISTORY_KEY, JSON.stringify(messagePackage));
            // [修改] 保持列表只有最新的 50 條訊息
            await redisClient.lTrim(HISTORY_KEY, 0, HISTORY_LIMIT - 1);

            io.emit('chat-message', messagePackage);
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
