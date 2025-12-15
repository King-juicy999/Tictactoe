const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const { getRTCConfiguration } = require('./webrtc-config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

const DATA_PATH = path.join(__dirname, 'data.json');

function ensureDb() {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({ 
            players: {}, 
            sessions: [],
            ai: {
                wins: 0,
                losses: 0,
                draws: 0,
                totalGames: 0,
                moveHistory: [],
                learnedPatterns: {},
                blockedWinPatterns: new Set(),
                adaptationLevel: 0
            }
        }, null, 2));
    }
}

function readDb() {
    ensureDb();
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
}

function writeDb(db) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

function resolvePlayerKey(players, nameInput) {
    if (!nameInput) return null;
    // Exact first
    if (players[nameInput]) return nameInput;
    const trimmed = String(nameInput).trim();
    if (players[trimmed]) return trimmed;
    // Case-insensitive match on trimmed keys
    const lower = trimmed.toLowerCase();
    for (const key of Object.keys(players)) {
        if (key.trim().toLowerCase() === lower) return key;
    }
    return null;
}

app.use(cors());
app.use(express.json());

// Serve the static frontend from project root
app.use(express.static(path.join(__dirname, '..')));

// Friendly admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

app.get('/api/stats', (req, res) => {
    const db = readDb();
    res.json({ players: db.players, sessions: db.sessions });
});

app.get('/api/ai/stats', (req, res) => {
    const db = readDb();
    const aiStats = db.ai || {
        wins: 0,
        losses: 0,
        draws: 0,
        totalGames: 0,
        winRate: 0,
        adaptationLevel: 0,
        learnedPatterns: 0,
        blockedPatterns: 0,
        moveHistory: []
    };
    
    // Calculate win rate
    const totalGames = aiStats.totalGames || (aiStats.wins + aiStats.losses + aiStats.draws);
    const winRate = totalGames > 0 ? (aiStats.wins / totalGames) * 100 : 0;
    
    res.json({
        ok: true,
        stats: {
            wins: aiStats.wins || 0,
            losses: aiStats.losses || 0,
            draws: aiStats.draws || 0,
            totalGames: totalGames,
            winRate: winRate,
            adaptationLevel: aiStats.adaptationLevel || 0,
            learnedPatterns: Object.keys(aiStats.learnedPatterns || {}).length,
            blockedPatterns: (aiStats.blockedWinPatterns || []).length,
            recentMoves: (aiStats.moveHistory || []).slice(-10)
        }
    });
});

app.get('/api/player/:name', (req, res) => {
    const db = readDb();
    const key = resolvePlayerKey(db.players, req.params.name || '');
    if (!key) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true, name: key, info: db.players[key] });
});

// Fallback control endpoint (mirrors socket broadcast)
app.post('/api/control', (req, res) => {
    const { type, value } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type required' });
    const payload = { type, value };
    io.emit('control', payload);
    res.json({ ok: true });
});

app.post('/api/session/start', (req, res) => {
    const { name, matricNumber, life } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const db = readDb();

    if (!db.players[name]) {
        db.players[name] = { losses: 0, wins: 0, plays: 0, lastActive: Date.now(), matricNumber: matricNumber || '', life: life || '' };
    }
    db.players[name].plays += 1;
    db.players[name].lastActive = Date.now();
    db.players[name].matricNumber = matricNumber || db.players[name].matricNumber;
    db.players[name].life = life || db.players[name].life;

    db.sessions.push({ type: 'start', name, time: Date.now() });
    writeDb(db);

    io.emit('session-start', { name, time: Date.now() });
    res.json({ ok: true });
});

app.post('/api/loss', (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const db = readDb();

    if (!db.players[name]) {
        db.players[name] = { losses: 0, wins: 0, plays: 0, lastActive: Date.now(), matricNumber: '', life: '' };
    }
    db.players[name].losses += 1;
    db.players[name].lastActive = Date.now();

    db.sessions.push({ type: 'loss', name, time: Date.now() });
    writeDb(db);

    io.emit('loss', { name, losses: db.players[name].losses, time: Date.now() });
    res.json({ ok: true, losses: db.players[name].losses });
});

app.post('/api/win', (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const db = readDb();

    if (!db.players[name]) {
        db.players[name] = { losses: 0, wins: 0, plays: 0, lastActive: Date.now(), matricNumber: '', life: '' };
    }
    db.players[name].wins = (db.players[name].wins || 0) + 1;
    db.players[name].lastActive = Date.now();

    db.sessions.push({ type: 'win', name, time: Date.now() });
    writeDb(db);

    io.emit('win', { name, wins: db.players[name].wins, time: Date.now() });
    res.json({ ok: true, wins: db.players[name].wins });
});

// Delete player (POST alternative for proxy compatibility)
app.post('/api/player/delete', (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const db = readDb();
    const key = resolvePlayerKey(db.players, name);
    if (!key) {
        return res.status(404).json({ error: 'not found' });
    }
    delete db.players[key];
    db.sessions = (db.sessions || []).filter(s => s.name !== key);
    writeDb(db);
    io.emit('player-deleted', { name: key, time: Date.now() });
    res.json({ ok: true });
});

// Delete player
app.delete('/api/player/:name', (req, res) => {
    const rawName = req.params.name || '';
    const name = decodeURIComponent(rawName);
    const db = readDb();
    const key = resolvePlayerKey(db.players, name);
    if (!key) {
        return res.status(404).json({ error: 'not found' });
    }
    delete db.players[key];
    db.sessions = (db.sessions || []).filter(s => s.name !== key);
    writeDb(db);
    io.emit('player-deleted', { name: key, time: Date.now() });
    res.json({ ok: true });
});

// Track presence (socket -> name)
const socketIdToName = new Map();
// Track WebRTC connections: playerName -> { socketId, peerConnection }
const webrtcConnections = new Map();
// Track admin connections
const adminConnections = new Set();

io.on('connection', (socket) => {
    socket.emit('hello', { message: 'connected' });
    
    // WebRTC Signaling for video streaming
    socket.on('webrtc-offer', async (data) => {
        const { offer, playerName } = data;
        if (!offer || !playerName) {
            console.error('Invalid WebRTC offer data:', data);
            return;
        }
        
        console.log(`WebRTC offer received from player: ${playerName}, Socket ID: ${socket.id}`);
        
        // Store player's WebRTC connection
        webrtcConnections.set(playerName, {
            socketId: socket.id,
            playerName: playerName,
            createdAt: Date.now()
        });
        
        // Forward offer to all admin connections
        if (adminConnections.size === 0) {
            console.log('WARNING: No admin connections registered. Offer will not be forwarded.');
        }
        
        adminConnections.forEach(adminSocketId => {
            console.log(`Forwarding offer to admin: ${adminSocketId}`);
            io.to(adminSocketId).emit('webrtc-offer', {
                offer: offer,
                playerName: playerName,
                socketId: socket.id
            });
        });
        
        console.log(`WebRTC offer forwarded to ${adminConnections.size} admin(s)`);
    });
    
    socket.on('webrtc-answer', (data) => {
        const { answer, playerSocketId } = data;
        if (!answer || !playerSocketId) return;
        
        // Forward answer back to player
        io.to(playerSocketId).emit('webrtc-answer', { answer });
        console.log(`WebRTC answer sent to player: ${playerSocketId}`);
    });
    
    socket.on('webrtc-ice-candidate', (data) => {
        const { candidate, targetSocketId, playerName } = data;
        if (!candidate) return;
        
        if (targetSocketId) {
            // Forward ICE candidate to specific target
            io.to(targetSocketId).emit('webrtc-ice-candidate', {
                candidate: candidate,
                playerName: playerName
            });
        } else {
            // Broadcast to all admins if no specific target
            adminConnections.forEach(adminSocketId => {
                io.to(adminSocketId).emit('webrtc-ice-candidate', {
                    candidate: candidate,
                    playerName: playerName
                });
            });
        }
    });
    
    // Admin registration for WebRTC
    socket.on('admin-register', () => {
        adminConnections.add(socket.id);
        console.log(`Admin registered: ${socket.id}`);
        console.log(`Total admin connections: ${adminConnections.size}`);
        
        // Send list of active player streams
        const activeStreams = Array.from(webrtcConnections.entries()).map(([name, conn]) => ({
            playerName: name,
            socketId: conn.socketId
        }));
        socket.emit('active-streams', activeStreams);
        console.log(`Sent ${activeStreams.length} active streams to admin`);
    });
    
    // Request to watch a specific player's stream
    socket.on('request-player-stream', (data) => {
        const { playerName } = data;
        if (!playerName) return;
        
        const connection = webrtcConnections.get(playerName);
        if (connection) {
            socket.emit('player-stream-available', {
                playerName: playerName,
                socketId: connection.socketId
            });
        } else {
            socket.emit('player-stream-unavailable', { playerName });
        }
    });

    // Admin control passthrough
    socket.on('admin-control', (payload) => {
        io.emit('control', payload);
    });

    // Spectate: rebroadcast board snapshots
    socket.on('board-update', (payload) => {
        io.emit('spectate', payload);
        // Also broadcast to admins with full details
        adminConnections.forEach(adminSocketId => {
            io.to(adminSocketId).emit('board-update', payload);
        });
    });
    
    // Interactive mode events - notify admins
    socket.on('interactive-mode-start', (payload) => {
        console.log(`Interactive mode started for ${payload.name} (${payload.losses} losses)`);
        adminConnections.forEach(adminSocketId => {
            io.to(adminSocketId).emit('interactive-mode-start', payload);
        });
    });
    
    socket.on('interactive-mode-end', (payload) => {
        console.log(`Interactive mode ended for ${payload.name}`);
        adminConnections.forEach(adminSocketId => {
            io.to(adminSocketId).emit('interactive-mode-end', payload);
        });
    });
    
    socket.on('interactive-mode-choice', (payload) => {
        console.log(`${payload.name} chose ${payload.choice} in interactive mode`);
        adminConnections.forEach(adminSocketId => {
            io.to(adminSocketId).emit('interactive-mode-choice', payload);
        });
    });

    // Spectate: rebroadcast jumpscare notifications from clients
    socket.on('client-jumpscare', (payload) => {
        io.emit('spectate-jumpscare', payload);
    });

    // Camera feed streaming
    socket.on('camera-feed', (payload) => {
        io.emit('camera-feed', payload);
    });

    // Live camera feed streaming (30 FPS)
    socket.on('live-camera-feed', (payload) => {
        io.emit('live-camera-feed', payload);
    });

    // Camera status updates
    socket.on('camera-status', (payload) => {
        io.emit('camera-status', payload);
    });

    // Test message handler
    socket.on('test-message', (payload) => {
        io.emit('test-message', payload);
    });

    // Behavior analysis data handler
    socket.on('behavior-data', (payload) => {
        // Forward to Django backend via HTTP or store directly
        // For now, log it (in production, send to Django API)
        console.log('Behavior data received:', payload.playerName, payload.result);
        
        // Store in database (if using Node.js DB) or forward to Django
        // In production: POST to Django /api/behavior/record-game
    });
    
    // AI move recording
    socket.on('ai-move', (payload) => {
        const db = readDb();
        if (!db.ai) {
            db.ai = {
                wins: 0,
                losses: 0,
                draws: 0,
                totalGames: 0,
                moveHistory: [],
                learnedPatterns: {},
                blockedWinPatterns: [],
                adaptationLevel: 0
            };
        }
        
        // Store move
        db.ai.moveHistory.push({
            ...payload,
            timestamp: Date.now()
        });
        
        // Keep only last 1000 moves
        if (db.ai.moveHistory.length > 1000) {
            db.ai.moveHistory.shift();
        }
        
        writeDb(db);
        
        // Broadcast to admins
        io.emit('ai-move', payload);
    });
    
    // AI stats update
    socket.on('ai-stats-update', (payload) => {
        const db = readDb();
        if (!db.ai) {
            db.ai = {
                wins: 0,
                losses: 0,
                draws: 0,
                totalGames: 0,
                moveHistory: [],
                learnedPatterns: {},
                blockedWinPatterns: [],
                adaptationLevel: 0
            };
        }
        
        // Update AI stats
        db.ai.wins = payload.wins || db.ai.wins;
        db.ai.losses = payload.losses || db.ai.losses;
        db.ai.draws = payload.draws || db.ai.draws;
        db.ai.totalGames = payload.totalGames || db.ai.totalGames;
        db.ai.adaptationLevel = payload.adaptationLevel || db.ai.adaptationLevel;
        db.ai.learnedPatterns = payload.learnedPatterns || db.ai.learnedPatterns;
        
        writeDb(db);
        
        // Broadcast to admins
        io.emit('ai-stats-update', payload);
    });

    // Player start via socket (real-time)
    socket.on('player-start', ({ name, matricNumber, life } = {}) => {
        if (!name) return;
        socketIdToName.set(socket.id, name);
        const db = readDb();
        if (!db.players[name]) {
            db.players[name] = { losses: 0, wins: 0, plays: 0, lastActive: Date.now(), matricNumber: matricNumber || '', life: life || '' };
        }
        db.players[name].plays += 1;
        db.players[name].lastActive = Date.now();
        db.players[name].matricNumber = matricNumber || db.players[name].matricNumber;
        db.players[name].life = life || db.players[name].life;
        db.sessions.push({ type: 'start', name, time: Date.now() });
        writeDb(db);
        io.emit('session-start', { name, time: Date.now() });
    });

    socket.on('disconnect', () => {
        socketIdToName.delete(socket.id);
        adminConnections.delete(socket.id);
        
        // Clean up WebRTC connections
        for (const [playerName, conn] of webrtcConnections.entries()) {
            if (conn.socketId === socket.id) {
                webrtcConnections.delete(playerName);
                // Notify admins that stream ended
                adminConnections.forEach(adminSocketId => {
                    io.to(adminSocketId).emit('player-stream-ended', { playerName });
                });
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
}); 