const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// ----------------------------------------------------
// 1. فرنٹ اینڈ ایچ ٹی ایم ایل کوڈ (HTML Inside Node.js)
// ----------------------------------------------------
const htmlContent = `
<!DOCTYPE html>
<html lang="ur">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Heartbeat Monitor - Sync</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-main: #f8fafc;
            --primary: #3b82f6;
            --success: #10b981;
            --danger: #ef4444;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: var(--card-bg);
            border-radius: 16px;
            padding: 30px;
            width: 100%;
            max-width: 450px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            text-align: center;
        }
        h2 { margin-bottom: 25px; font-weight: 600; color: #fff; }
        .form-group { margin-bottom: 20px; text-align: left; }
        label { display: block; margin-bottom: 8px; color: #94a3b8; font-size: 14px; }
        input, select {
            width: 100%;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #334155;
            background: #0f172a;
            color: #fff;
            font-size: 16px;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 14px;
            background: var(--primary);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.3s;
        }
        button:hover { background: #2563eb; }
        .status-box {
            margin-top: 25px;
            padding: 15px;
            border-radius: 8px;
            background: #0f172a;
            border-left: 5px solid #64748b;
            display: none;
            text-align: left;
        }
        .status-online { border-left-color: var(--success); }
        .status-offline { border-left-color: var(--danger); }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            float: right;
        }
        .badge-online { background: rgba(16, 185, 129, 0.2); color: var(--success); }
        .badge-offline { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
        .log-container {
            margin-top: 20px;
            max-height: 120px;
            overflow-y: auto;
            background: #020617;
            padding: 10px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            text-align: left;
            color: #38bdf8;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>Device Sync Monitor</h2>
    
    <div id="setup-form">
        <div class="form-group">
            <label>ریموٹ ایڈریس / یونیک آئی ڈی (دونوں میں سیم رکھیں):</label>
            <input type="text" id="deviceId" placeholder="مثال: my-private-sync-123">
        </div>
        <div class="form-group">
            <label>یہ کون سی ڈیوائس ہے؟</label>
            <select id="deviceType">
                <option value="laptop">Laptop (لیپ ٹاپ)</option>
                <option value="mobile">Mobile (موبائل)</option>
            </select>
        </div>
        <button onclick="connectDevice()">آپس میں کنکٹ کریں</button>
    </div>

    <div id="monitor-box" class="status-box">
        <span id="peerBadge" class="badge badge-offline">Offline</span>
        <strong id="peerTitle">دوسری ڈیوائس کا اسٹیٹس:</strong>
        <p id="statusMessage" style="margin: 10px 0 0 0; color: #94a3b8; font-size: 14px;">کنکشن کا انتظار ہے...</p>
    </div>

    <div class="log-container" id="logs">سستم لاگز یہاں نظر آئیں گے...</div>
</div>

<script>
    let socket;
    let audioCtx;

    function playAlertSound(type) {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'danger') {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else {
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        }
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    function showNotification(title, body) {
        if (Notification.permission === "granted") {
            new Notification(title, { body: body });
        }
    }

    function log(message) {
        const logBox = document.getElementById('logs');
        const time = new Date().toLocaleTimeString();
        logBox.innerHTML += '<div>[' + time + '] ' + message + '</div>';
        logBox.scrollTop = logBox.scrollHeight;
    }

    function connectDevice() {
        const deviceId = document.getElementById('deviceId').value.trim();
        const deviceType = document.getElementById('deviceType').value;

        if (!deviceId) {
            alert("براہ کرم ریموٹ ایڈریس درج کریں!");
            return;
        }

        socket = io();

        socket.on('connect', () => {
            log("سرور کے ساتھ کنکشن قائم ہو گیا ہے۔");
            socket.emit('register-device', { deviceId, deviceType });
            
            document.getElementById('setup-form').style.display = 'none';
            document.getElementById('monitor-box').style.display = 'block';
            
            const peerType = deviceType === 'laptop' ? 'Mobile' : 'Laptop';
            document.getElementById('peerTitle').innerText = peerType + " کا اسٹیٹس:";
        });

        socket.on('peer-status', (data) => {
            const monitorBox = document.getElementById('monitor-box');
            const badge = document.getElementById('peerBadge');
            const msg = document.getElementById('statusMessage');

            if (data.status === 'online') {
                monitorBox.className = "status-box status-online";
                badge.className = "badge badge-online";
                badge.innerText = "Online";
                msg.innerText = "آپ کا " + data.peerType + " آن لائن ہو گیا ہے اور انٹرنیٹ سے منسلک ہے۔";
                log(data.peerType + " آن لائن ہو گیا۔");
                showNotification("ڈیوائس سنک الرٹ", data.peerType + " کامیابی سے کنکٹ ہو گیا ہے۔");
                playAlertSound('success');
            } else if (data.status === 'offline') {
                monitorBox.className = "status-box status-offline";
                badge.className = "badge badge-offline";
                badge.innerText = "Offline";
                msg.innerText = "الرٹ: آپ کا " + data.peerType + " بند ہو گیا ہے یا اس کی پاور کٹ/انٹرنیٹ بند ہو گیا ہے!";
                log("خطرہ: " + data.peerType + " ڈسکنیٹ ہو گیا!");
                showNotification("پاور کٹ / ڈسکشن الرٹ!", "آپ کا " + data.peerType + " اب نارملی بند ہو گیا ہے۔");
                playAlertSound('danger');
            }
        });

        socket.on('disconnect', () => {
            log("سرور سے رابطہ ٹوٹ گیا۔ انٹرنیٹ چیک کریں۔");
        });
    }
</script>
</body>
</html>
`;

// ----------------------------------------------------
// 2. بیک اینڈ نوڈ جے ایس کوڈ (Backend Node.js logic)
// ----------------------------------------------------
app.get('/', (req, res) => {
    res.send(htmlContent); // یہاں ایچ ٹی ایم ایل سکرین پر بھیج دی جائے گی
});

let devices = {};

io.on('connection', (socket) => {
    socket.on('register-device', ({ deviceId, deviceType }) => {
        socket.deviceId = deviceId;
        socket.deviceType = deviceType;
        
        if (!devices[deviceId]) {
            devices[deviceId] = {};
        }
        
        devices[deviceId][deviceType] = socket.id;
        
        if (devices[deviceId]['laptop'] && devices[deviceId]['mobile']) {
            io.to(devices[deviceId]['laptop']).emit('peer-status', { status: 'online', peerType: 'mobile' });
            io.to(devices[deviceId]['mobile']).emit('peer-status', { status: 'online', peerType: 'laptop' });
        }
    });

    socket.on('disconnect', () => {
        const { deviceId, deviceType } = socket;
        if (deviceId && devices[deviceId]) {
            const peerType = deviceType === 'laptop' ? 'mobile' : 'laptop';
            const peerSocketId = devices[deviceId][peerType];
            
            if (peerSocketId) {
                io.to(peerSocketId).emit('peer-status', { status: 'offline', peerType: deviceType });
            }
            
            delete devices[deviceId][deviceType];
            if (Object.keys(devices[deviceId]).length === 0) {
                delete devices[deviceId];
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`سرور کامیابی سے چل رہا ہے: http://localhost:${PORT}`);
});