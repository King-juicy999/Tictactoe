// Global error handler to prevent crashes
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error, event.filename, event.lineno);
    // Don't let errors crash the game
    try {
        const msgBox = document.getElementById('message');
        if (msgBox && gameState && gameState.gameActive) {
            msgBox.textContent = "An error occurred, but the game continues...";
            setTimeout(() => {
                if (msgBox && gameState && gameState.gameActive) {
                    msgBox.textContent = "Game continues...";
                }
            }, 2000);
        }
    } catch (e) {
        console.error('Error in error handler:', e);
    }
    return true; // Prevent default error handling
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevent default handling
});

// Game state
const gameState = {
    currentPlayer: 'X',
    board: Array(9).fill(''),
    losses: 0, // Player losses
    aiLosses: 0, // AI losses (when player wins)
    wins: 0,
    playerName: '',
    isKingWilliam: false,
    gameActive: true,
    inTsukuyomi: false,
    tsukuyomiBoard: Array(9).fill(''),
    pendingCheatMoveIndex: null,
    cameraEnabled: false,
    cameraStream: null,
    behaviorAnalyzer: null,
    currentGameId: null,
    aiLearningSystem: null,
    playerMoveHistory: [], // Track player moves for pattern learning
    inInteractiveMode: false, // Track if in AI mock interactive mode
    playerGoesFirst: true, // Track who goes first - alternates each game
    playerJustWon: false, // Track if player won last game - AI will think longer
    aiThinkingDelay: 500, // Base AI thinking delay (increased after player wins)
    // AI Chat tracking
    gameStartTimes: [], // Track when each game started
    lossTimes: [], // Track when each loss occurred
    gameDurations: [], // Track duration of each game before loss
    totalMoves: [], // Track total moves in each game
    aiChatActive: false, // Track if AI chat is currently open
    performanceMetrics: {
        averageGameDuration: 0,
        averageMovesPerGame: 0,
        fastestLoss: Infinity,
        slowestLoss: 0,
        lossPattern: 'unknown' // 'fast', 'slow', 'mixed'
    }
};

// Network helpers to report to server (if running)
async function safePost(url, body, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                console.log(`Successfully posted to ${url}:`, data);
                return data;
            } else {
                console.warn(`Failed to post to ${url}, status: ${response.status}, attempt ${i + 1}/${retries}`);
            }
        } catch (e) {
            console.warn(`Error posting to ${url}, attempt ${i + 1}/${retries}:`, e);
            if (i < retries - 1) {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }
    console.error(`Failed to post to ${url} after ${retries} attempts`);
    return null;
}

function reportSessionStart() {
    if (!gameState.playerName) return;
    safePost('/api/session/start', {
        name: gameState.playerName
    });
}

function reportLoss() {
    if (!gameState.playerName) return;
    console.log('Reporting loss for:', gameState.playerName);
    safePost('/api/loss', { name: gameState.playerName }).then(result => {
        if (result && result.losses !== undefined) {
            console.log('Loss reported successfully. Total losses:', result.losses);
        }
    });
}

function reportWin() {
    if (!gameState.playerName) return;
    console.log('Reporting win for:', gameState.playerName);
    safePost('/api/win', { name: gameState.playerName }).then(result => {
        if (result && result.wins !== undefined) {
            console.log('Win reported successfully. Total wins:', result.wins);
        }
    });
}

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const startBtn = document.getElementById('start-btn');
const cells = document.querySelectorAll('.cell');
const messageBox = document.getElementById('message-box');
const displayName = document.getElementById('display-name');
const lossesDisplay = document.getElementById('losses');
const resetBtn = document.getElementById('reset-btn');
const clickSound = document.getElementById('click-sound');
const winSound = document.getElementById('win-sound');
const loseSound = document.getElementById('lose-sound');
const tsukuyomiOverlay = document.getElementById('tsukuyomi-overlay');
const tsukuyomiSound = document.getElementById('tsukuyomi-sound');
const demonOverlay = document.getElementById('demon-overlay');
const bgMusic = document.getElementById('bg-music');
const aiChatOverlay = document.getElementById('ai-chat-overlay');
const aiChatMessages = document.getElementById('ai-chat-messages');
const aiChatInput = document.getElementById('ai-chat-input');
const aiChatSendBtn = document.getElementById('ai-chat-send');
const aiChatCloseBtn = document.getElementById('ai-chat-close');
if (bgMusic) {
    try {
        bgMusic.preload = 'auto';
        bgMusic.addEventListener('error', (e) => console.log('Background music error:', e));
    } catch (e) {
        console.log('Could not initialize bgMusic attributes:', e);
    }
}
const mockMusic = document.getElementById('mock-music');
const mockMusic2Sec = document.getElementById('mock-music-2sec');
if (mockMusic) {
    try {
        mockMusic.preload = 'auto';
        mockMusic.addEventListener('error', (e) => console.log('Mock music error:', e));
    } catch (e) {
        console.log('Could not initialize mockMusic attributes:', e);
    }
}
if (mockMusic2Sec) {
    try {
        mockMusic2Sec.preload = 'auto';
        mockMusic2Sec.addEventListener('error', (e) => console.log('Mock 2s music error:', e));
    } catch (e) {
        console.log('Could not initialize mockMusic2Sec attributes:', e);
    }
}
const discoOverlay = document.getElementById('disco-overlay');
const aiMockOverlay = document.getElementById('ai-mock-overlay');
const aiMockText = document.getElementById('ai-mock-text');
const mockYesBtn = document.getElementById('mock-yes-btn');
const mockNoBtn = document.getElementById('mock-no-btn');

// Camera elements
const enableCameraBtn = document.getElementById('enable-camera-btn');
const cameraPreview = document.getElementById('camera-preview');
const cameraFeed = document.getElementById('camera-feed');
const cameraStatus = document.getElementById('camera-status');
const gameCameraStatus = document.getElementById('game-camera-status');

// Track wins for learning - AI learns from each win but doesn't prevent future wins
let playerWinCount = 0;

// Camera functionality
async function requestCameraAccess() {
    try {
        // Mobile-friendly camera constraints
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const videoConstraints = isMobile ? {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            facingMode: 'user',
            frameRate: { ideal: 30, max: 30 }
        } : {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
        };
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints,
            audio: false 
        });
        
        gameState.cameraStream = stream;
        gameState.cameraEnabled = true;
        
        // Display camera feed
        cameraFeed.srcObject = stream;
        cameraPreview.style.display = 'block';
        enableCameraBtn.textContent = 'Camera Enabled';
        enableCameraBtn.disabled = true;
        enableCameraBtn.style.background = '#4CAF50';
        
        // Update status
        cameraStatus.innerHTML = '<span class="camera-icon">üìπ</span><span class="camera-text">Camera access granted - Anti-cheat active</span>';
        
        // Enable start button
        updateStartButtonState();
        
        // Notify admin of camera status (only when player name is set)
        if (gameState.playerName) {
            try { 
                if (socket) socket.emit('camera-status', { 
                    name: gameState.playerName, 
                    connected: true 
                }); 
            } catch(_) {}
        }
        
        return true;
    } catch (error) {
        console.error('Camera access denied:', error);
        cameraStatus.innerHTML = '<span class="camera-icon">‚ùå</span><span class="camera-text">Camera access denied - Required to prevent cheating</span>';
        enableCameraBtn.textContent = 'Retry Camera Access';
        gameState.cameraEnabled = false;
        updateStartButtonState();
        
        // Notify admin of camera status
        try { 
            if (socket) socket.emit('camera-status', { 
                name: gameState.playerName, 
                connected: false 
            }); 
        } catch(_) {}
        
        return false;
    }
}

function updateStartButtonState() {
    const nameFilled = playerNameInput.value.trim();
    const cameraReady = gameState.cameraEnabled;
    
    if (nameFilled && cameraReady) {
        startBtn.disabled = false;
        startBtn.textContent = 'Enter In Peace';
    } else {
        startBtn.disabled = true;
        if (!cameraReady) {
            startBtn.textContent = 'Enable Camera First';
        } else {
            startBtn.textContent = 'Enter Your Name';
        }
    }
}

function stopCamera() {
    if (gameState.cameraStream) {
        gameState.cameraStream.getTracks().forEach(track => track.stop());
        gameState.cameraStream = null;
        gameState.cameraEnabled = false;
        
        // Stop camera streaming
        stopCameraStreaming();
        
        // Notify admin of camera status
        try { 
            if (socket) socket.emit('camera-status', { 
                name: gameState.playerName, 
                connected: false 
            }); 
        } catch(_) {}
    }
}

// Camera event listeners
enableCameraBtn.addEventListener('click', requestCameraAccess);

// Initialize button state on page load
updateStartButtonState();

// Monitor camera status during gameplay
function monitorCameraStatus() {
    if (gameState.cameraStream) {
        const tracks = gameState.cameraStream.getTracks();
        const activeTracks = tracks.filter(track => track.readyState === 'live');
        
        if (activeTracks.length === 0) {
            gameCameraStatus.textContent = 'Camera Disconnected';
            gameCameraStatus.style.color = '#ff4444';
            gameState.cameraEnabled = false;
            
            // Notify admin of camera disconnection
            try { 
                if (socket) socket.emit('camera-status', { 
                    name: gameState.playerName, 
                    connected: false 
                }); 
            } catch(_) {}
            
            // Could add additional logic here to pause game or show warning
        } else {
            gameCameraStatus.textContent = 'Monitoring';
            gameCameraStatus.style.color = '#4CAF50';
        }
    }
}

// Check camera status every 5 seconds during gameplay
setInterval(monitorCameraStatus, 5000);

// WebRTC Video Streaming (Like WhatsApp Video Call)
let peerConnection = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;

// STUN/TURN servers configuration
// Using multiple STUN servers for reliability
// For production, add TURN servers via environment variables or config
const rtcConfiguration = {
    iceServers: [
        // Google's free STUN servers (primary)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Additional free STUN servers (backup)
        { urls: 'stun:stun.stunprotocol.org:3478' },
        // Free TURN servers for mobile/ngrok compatibility
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        // For production, uncomment and configure TURN servers:
        // TURN servers are needed for users behind strict firewalls/NAT
        // Example: { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
    ],
    iceCandidatePoolSize: 10, // Pre-gather ICE candidates for faster connection
    bundlePolicy: 'max-bundle', // Bundle RTP and RTCP
    rtcpMuxPolicy: 'require', // Require RTCP muxing
    iceTransportPolicy: 'all' // Try both relay and non-relay candidates
};

let peerConnectionReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

function startCameraStreaming() {
    if (!gameState.cameraStream || !socket) {
        console.log('Cannot start camera streaming:', { 
            hasStream: !!gameState.cameraStream, 
            hasSocket: !!socket 
        });
        return;
    }
    
    console.log('Starting WebRTC camera streaming for:', gameState.playerName);
    
    // Close existing connection if any
    if (peerConnection) {
        try {
            peerConnection.close();
        } catch (e) {
            console.log('Error closing existing peer connection:', e);
        }
    }
    
    // Create WebRTC peer connection
    peerConnection = new RTCPeerConnection(rtcConfiguration);
    
    // Add camera stream tracks to peer connection
    gameState.cameraStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, gameState.cameraStream);
        console.log('Added track:', track.kind, track.id);
        
        // Handle track ended (camera disconnected)
        track.onended = () => {
            console.log('Camera track ended, attempting to reconnect...');
            if (peerConnectionReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                setTimeout(() => {
                    requestCameraAccess().then(() => {
                        if (gameState.cameraStream) {
                            startCameraStreaming();
                        }
                    });
                }, 2000);
                peerConnectionReconnectAttempts++;
            }
        };
    });
    
    // Handle ICE candidates (for NAT traversal)
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc-ice-candidate', {
                candidate: event.candidate,
                playerName: gameState.playerName
            });
        } else {
            console.log('ICE gathering complete');
        }
    };
    
    // Handle ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', peerConnection.iceGatheringState);
    };
    
    // Handle connection state changes with reconnection logic
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('WebRTC connection state:', state);
        
        if (state === 'connected') {
            peerConnectionReconnectAttempts = 0; // Reset on successful connection
            console.log('WebRTC connected successfully');
        } else if (state === 'failed' || state === 'disconnected') {
            console.error('WebRTC connection failed/disconnected. Attempting to restart...');
            if (peerConnectionReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                setTimeout(() => {
                    if (gameState.cameraStream && socket && socket.connected) {
                        console.log('Attempting to reconnect WebRTC...');
                        startCameraStreaming();
                        peerConnectionReconnectAttempts++;
                    }
                }, 3000);
            } else {
                console.error('Max reconnection attempts reached');
            }
        }
    };
    
    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        console.log('ICE connection state:', iceState);
        
        if (iceState === 'failed' || iceState === 'disconnected') {
            console.log('ICE connection failed, checking if we need to restart...');
            // Let the connection state handler deal with reconnection
        }
    };
    
    // Create and send offer to admin
    console.log('Creating WebRTC offer...');
    peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false  // Player is sending, not receiving
    })
    .then(offer => {
        console.log('Offer created:', offer.type);
        return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
        console.log('Local description set, sending offer to server...');
        // Wait a bit for ICE candidates to gather
        setTimeout(() => {
            // Send offer to server for forwarding to admin
            socket.emit('webrtc-offer', {
                offer: peerConnection.localDescription,
                playerName: gameState.playerName
            });
            console.log('WebRTC offer sent to server for player:', gameState.playerName);
        }, 1000); // Give time for ICE candidates
    })
    .catch(error => {
        console.error('Error creating WebRTC offer:', error);
        // Retry once
        if (peerConnectionReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(() => {
                startCameraStreaming();
                peerConnectionReconnectAttempts++;
            }, 2000);
        }
    });
                
    // Handle answer from admin (use once listener to avoid duplicates)
    const answerHandler = async (data) => {
        if (peerConnection && data.answer && peerConnection.signalingState !== 'stable') {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log('WebRTC answer received and set');
                socket.off('webrtc-answer', answerHandler); // Remove listener after handling
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        }
    };
    socket.on('webrtc-answer', answerHandler);
    
    // Handle ICE candidates from admin
    const iceCandidateHandler = async (data) => {
        if (peerConnection && data.candidate && peerConnection.remoteDescription) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('ICE candidate added successfully');
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    };
    socket.on('webrtc-ice-candidate', iceCandidateHandler);
    
    // Start video recording for storage/archive
    startVideoRecording();
}

function startVideoRecording() {
    if (!gameState.cameraStream) return;
    
    try {
        recordedChunks = [];
        recordingStartTime = Date.now();
        
        // Create MediaRecorder for video recording
        mediaRecorder = new MediaRecorder(gameState.cameraStream, {
            mimeType: 'video/webm;codecs=vp9'
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            
            // Send video to server for storage
            sendVideoToServer(blob);
        };
        
        mediaRecorder.start(1000); // Record in 1-second chunks
        console.log('Video recording started');
        
    } catch (error) {
        console.error('Error starting video recording:', error);
    }
}

function stopVideoRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log('Video recording stopped');
    }
}

function sendVideoToServer(blob) {
    const formData = new FormData();
    formData.append('video', blob, `${gameState.playerName}_${recordingStartTime}.webm`);
    formData.append('playerName', gameState.playerName);
    formData.append('startTime', recordingStartTime);
    formData.append('endTime', Date.now());
    
    fetch('/api/upload-video', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Video uploaded successfully:', data);
    })
    .catch(error => {
        console.error('Error uploading video:', error);
    });
}

function stopCameraStreaming() {
    // Close WebRTC connection
    if (peerConnection) {
        peerConnection.getSenders().forEach(sender => {
            if (sender.track) {
                sender.track.stop();
            }
        });
        peerConnection.close();
        peerConnection = null;
        console.log('WebRTC connection closed');
    }
    
    // Stop video recording
    stopVideoRecording();
}

// Socket.IO: receive admin controls
let socket;
try {
    // Will fail if server not running; guarded by try/catch pattern as with fetch
    // eslint-disable-next-line no-undef
    socket = io();
    socket.on('control', (payload) => {
        if (!payload || !payload.type) return;
        // If control targets a specific player name and it is not us, ignore
        if (payload.target && payload.target !== gameState.playerName) return;
        switch (payload.type) {
            case 'difficulty':
                if (payload.value === 'easy') {
                    gameState.isKingWilliam = true;
                    messageBox.textContent = "As the Lord commands: the weak shall taste victory.";
                } else if (payload.value === 'hard') {
                    gameState.isKingWilliam = false;
                    messageBox.textContent = "As the Lord commands: despair deepens.";
                }
                break;
            case 'jumpscare':
                try {
                    if (loseSound && typeof loseSound.play === 'function') {
                        // play may return a promise; ignore failures so jumpscare still runs
                        const p = loseSound.play();
                        if (p && typeof p.catch === 'function') p.catch(() => {});
                    }
                } catch (e) { /* ignore audio play errors */ }
                const cfg = typeof payload.value === 'object' && payload.value ? payload.value : { variant: 'both', duration: 3000, cheat: true };
                performJumpscare(cfg);
                break;
            case 'move-board':
                const boardEl = document.querySelector('.game-board');
                boardEl.classList.remove('move-left','move-right','move-up','move-down','move-center','shake-board');
                if (payload.value === 'shake') {
                    boardEl.classList.add('shake-board');
                    setTimeout(() => boardEl.classList.remove('shake-board'), 550);
                } else if (payload.value === 'left') {
                    boardEl.classList.add('move-left');
                } else if (payload.value === 'right') {
                    boardEl.classList.add('move-right');
                } else if (payload.value === 'up') {
                    boardEl.classList.add('move-up');
                } else if (payload.value === 'down') {
                    boardEl.classList.add('move-down');
                } else if (payload.value === 'center') {
                    boardEl.classList.add('move-center');
                }
                break;
            case 'shuffle-tiles':
                shuffleBoardContents();
                break;
            case 'pause':
                gameState.gameActive = false;
                messageBox.textContent = "Paused by Lord.";
                break;
            case 'resume':
                gameState.gameActive = true;
                messageBox.textContent = "As the Lord commands.";
                break;
            case 'hint':
                const hintIdx = chooseHardAIMove();
                if (hintIdx !== null && hintIdx !== undefined) {
                    messageBox.textContent = `Hint: try ${hintIdx+1}`;
                }
                break;
        }
    });

// Lobby / matchmaking client handlers
function showLobbyScreen() {
    // Emit join-lobby to server to get list
    try { if (socket) socket.emit('join-lobby'); } catch(_) {}

    const lobby = document.getElementById('lobby-screen');
    if (lobby) lobby.classList.remove('hidden');
    welcomeScreen.classList.remove('active');
    gameScreen.classList.remove('active');

    // Wire leave button
    const leaveBtn = document.getElementById('leave-lobby');
    if (leaveBtn) {
        leaveBtn.onclick = () => {
            try { if (socket) socket.emit('leave-lobby'); } catch(_) {}
            lobby.classList.add('hidden');
            welcomeScreen.classList.add('active');
            // keep camera enabled state
            updateStartButtonState();
        };
    }
}

// Update players list UI
if (socket) {
    socket.on('lobby-players', (players) => {
        const list = document.getElementById('players-list');
        if (!list) return;
        list.innerHTML = '';
        (players || []).forEach(p => {
            // don't show self
            if (p.name === gameState.playerName) return;
            const el = document.createElement('div');
            el.className = 'player-item';
            el.textContent = p.name;
            const inviteBtn = document.createElement('button');
            inviteBtn.textContent = 'Invite';
            inviteBtn.onclick = () => {
                try {
                    if (socket) socket.emit('invite', { targetName: p.name });
                    inviteBtn.disabled = true;
                    inviteBtn.textContent = 'Invited';
                } catch (e) { console.error(e); }
            };
            el.appendChild(inviteBtn);
            list.appendChild(el);
        });
    });

    // Incoming invite
    socket.on('invite', ({ from } = {}) => {
        const overlay = document.getElementById('invite-overlay');
        const text = document.getElementById('invite-text');
        if (overlay && text) {
            text.textContent = `${from} wants to play with you.`;
            overlay.classList.remove('hidden');
        }

        const acceptBtn = document.getElementById('invite-accept');
        const declineBtn = document.getElementById('invite-decline');
        if (acceptBtn) {
            acceptBtn.onclick = () => {
                try { socket.emit('invite-response', { toName: from, accepted: true }); } catch(_) {}
                overlay.classList.add('hidden');
            };
        }
        if (declineBtn) {
            declineBtn.onclick = () => {
                try { socket.emit('invite-response', { toName: from, accepted: false }); } catch(_) {}
                overlay.classList.add('hidden');
            };
        }
    });

    // Invite response received by inviter
    socket.on('invite-response', ({ from, accepted } = {}) => {
        if (!accepted) {
            messageBox.textContent = `${from} declined your invite.`;
            try { if (socket) socket.emit('join-lobby'); } catch(_) {}
            return;
        }
        messageBox.textContent = `${from} accepted! Starting PvP game...`;
    });

    // Start PvP session
    socket.on('start-pvp', ({ sessionId, opponent, role } = {}) => {
        try {
            // Enter game screen and configure for PvP
            welcomeScreen.classList.remove('active');
            const lobby = document.getElementById('lobby-screen');
            if (lobby) lobby.classList.add('hidden');
            gameScreen.classList.add('active');
            messageBox.textContent = `PvP Match vs ${opponent} - You are ${role}`;
            // Stop background music and ensure gameState configured
            if (bgMusic) { bgMusic.pause(); bgMusic.currentTime = 0; }
            gameState.gameActive = true;
            gameState.mode = 'pvp';
            gameState.pvpSessionId = sessionId;
            gameState.pvpRole = role; // 'X' or 'O'

            // Reset board for real-time play; moves must be synced via socket events (not implemented here yet)
            gameState.board = Array(9).fill('');
            cells.forEach(cell => cell.textContent = '');
            resetBtn.style.display = 'none';
            // TODO: implement real-time move sync via socket events (on next step)
        } catch (e) {
            console.error('Error starting PvP session:', e);
        }
    });
}
} catch (_) {}

function emitBoardUpdate() {
    try {
        if (!socket) return;
        socket.emit('board-update', {
            name: gameState.playerName,
            board: [...gameState.board],
            losses: gameState.losses,
            playerLosses: gameState.losses,
            aiLosses: gameState.aiLosses,
            wins: (gameState.wins || 0),
            active: gameState.gameActive && !gameState.inInteractiveMode, // Game is active only if not in interactive mode
            cameraEnabled: gameState.cameraEnabled,
            inInteractiveMode: gameState.inInteractiveMode, // Let admin know about interactive mode
            playerGoesFirst: gameState.playerGoesFirst,
            timestamp: Date.now()
        });
    } catch(_) {}
}

function shuffleBoardContents() {
    // Preserve counts to maintain a valid game state and current turn
    const xCount = gameState.board.filter(v => v === 'X').length;
    const oPositions = new Set();
    for (let i = 0; i < 9; i++) if (gameState.board[i] === 'O') oPositions.add(i);

    const perm = [0,1,2,3,4,5,6,7,8];
    if (gameState.inTsukuyomi) {
        // In Tsukuyomi keep existing behavior (pure shuffle)
        const flat = [...gameState.tsukuyomiBoard];
        const shuffled = Array(9).fill('');
        const order = perm.sort(() => Math.random() - 0.5);
        for (let i = 0; i < 9; i++) shuffled[i] = flat[order[i]];
        gameState.tsukuyomiBoard = shuffled;
        for (let i = 0; i < 9; i++) cells[i].textContent = gameState.tsukuyomiBoard[i];
    } else {
        // Only shuffle X positions while keeping all O positions intact
        const candidateSpots = perm.filter(i => !oPositions.has(i));
        let bestBoard = null;
        let bestScore = -Infinity;

        // Try multiple randomized placements of Xs and pick the one that favors AI without immediate wins
        for (let attempt = 0; attempt < 40; attempt++) {
            // Random subset of size xCount from candidateSpots
            const shuffledSpots = [...candidateSpots].sort(() => Math.random() - 0.5);
            const xSpots = shuffledSpots.slice(0, xCount);
            const trial = Array(9).fill('');
            // Place Os fixed
            oPositions.forEach(idx => { trial[idx] = 'O'; });
            // Place Xs in chosen spots
            xSpots.forEach(idx => { trial[idx] = 'X'; });

            // Skip terminal or blatantly winning states to keep subtlety
            const prevBoard = gameState.board;
            gameState.board = trial;
            const xWins = checkWin('X');
            const oWins = checkWin('O');
            const threatsO = countImmediateThreatsFor('O');
            const threatsX = countImmediateThreatsFor('X');
            // Prefer more threats for O and fewer for X; avoid immediate win states
            const centerBonus = (trial[4] === '' ? 1 : 0);
            const score = (oWins ? -100 : 0) + (xWins ? -100 : 0) + (threatsO * 10) - (threatsX * 8) + centerBonus + Math.random();
            gameState.board = prevBoard;

            if (!xWins && !oWins && score > bestScore) {
                bestScore = score;
                bestBoard = trial;
            }
        }

        // Fallback: if we couldn't find a non-terminal arrangement, just keep X-only random placement
        if (!bestBoard) {
            const shuffledSpots = [...candidateSpots].sort(() => Math.random() - 0.5);
            const xSpots = shuffledSpots.slice(0, xCount);
            bestBoard = Array(9).fill('');
            oPositions.forEach(idx => { bestBoard[idx] = 'O'; });
            xSpots.forEach(idx => { bestBoard[idx] = 'X'; });
        }

        gameState.board = bestBoard;
        for (let i = 0; i < 9; i++) cells[i].textContent = gameState.board[i];
        gameState.gameActive = true;
    }
}

function performJumpscare({ variant = 'both', duration = 3000, cheat = true } = {}) {
    const overlays = [];
    const make = (cls) => { const el = document.createElement('div'); el.className = cls; document.body.appendChild(el); overlays.push(el); };
    if (variant === 'left') make('blackout-overlay');
    else if (variant === 'right') make('blackout-overlay right');
    else if (variant === 'full') make('blackout-overlay full');
    else if (variant === 'demon') {
        if (!demonOverlay) {
            console.error('performJumpscare: demonOverlay element not found');
        } else {
            console.log('performJumpscare: showing demon overlay');
            demonOverlay.classList.remove('hidden');
        }
    }
    else { make('blackout-overlay'); make('blackout-overlay right'); }

    // Notify admin spectate that a jumpscare started
    try { if (socket) socket.emit('client-jumpscare', { name: gameState.playerName, variant, duration, cheat, ts: Date.now() }); } catch(_) {}

    if (cheat) {
        // First try a minimal, subtle tile flip to strengthen AI; if none, plan the next move
        const changed = performSubtleTileCheat();
        if (!changed) {
            try { ensureAIWinningPath(); } catch (_) {}
        } else if (checkWin('O')) {
            // Schedule a harmless normal move so the regular win path/loss count triggers naturally
            const emptySpot = gameState.board.findIndex(v => v === '');
            if (emptySpot !== -1) gameState.pendingCheatMoveIndex = emptySpot;
        }
    }

    setTimeout(() => {
        overlays.forEach(el => el.remove());
        if (variant === 'demon') {
            if (!demonOverlay) {
                console.error('performJumpscare: demonOverlay element missing on hide');
            } else {
                console.log('performJumpscare: hiding demon overlay');
                demonOverlay.classList.add('hidden');
            }
        }
        // Notify end (admin can rely on duration, but this helps if needed)
        try { if (socket) socket.emit('client-jumpscare-end', { name: gameState.playerName, ts: Date.now() }); } catch(_) {}
    }, Math.max(1000, duration));
}

function performSubtleTileCheat() {
    // Change at most one tile from X -> O in a strategic spot; keep it minimal
    // Baseline threats
    const baselineThreats = countImmediateThreatsFor('O');
    let bestIdx = null;
    let bestScore = -Infinity;

    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] !== 'X') continue;
        const prev = gameState.board[i];
        gameState.board[i] = 'O';
        const immediateWin = checkWin('O');
        const threats = countImmediateThreatsFor('O');
        // Simple heuristic: prioritize immediate win flips, else maximize threats over baseline
        const score = (immediateWin ? 100 : 0) + (threats - baselineThreats);
        gameState.board[i] = prev;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    if (bestIdx !== null && bestScore > 0) {
        // Apply the subtle change
        gameState.board[bestIdx] = 'O';
        cells[bestIdx].textContent = 'O';
        return true;
    }
    return false;
}

function ensureAIWinningPath() {
    // Compute, but do not place, the strongest AI move to be used on its next turn
    let idx = getImmediateWinMoveFor('O');
    if (idx === null) idx = findForkMoveFor('O');
    if (idx === null) idx = chooseHardAIMove();
    if (idx !== null && idx !== undefined) {
        gameState.pendingCheatMoveIndex = idx;
    }
}

// Add Shift (Left or Right) hold detection: hold for 2 seconds to enable mode
let shiftHoldTimeoutId = null;
const activeShiftKeys = new Set();
window.addEventListener('keydown', (event) => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        activeShiftKeys.add(event.code);
        if (shiftHoldTimeoutId === null) {
            shiftHoldTimeoutId = setTimeout(() => {
                gameState.isKingWilliam = true;
            }, 2000);
        }
    }
});
window.addEventListener('keyup', (event) => {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        activeShiftKeys.delete(event.code);
        if (activeShiftKeys.size === 0 && shiftHoldTimeoutId !== null) {
            clearTimeout(shiftHoldTimeoutId);
            shiftHoldTimeoutId = null;
        }
    }
});

// Winning combinations
const winningCombos = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// Taunting messages
const tauntMessages = [
    "Are you even trying?",
    "You play worse than a chicken!",
    "Pathetic! Is that all you've got?",
    "My grandmother plays better than you!",
    "Is this your first time playing?",
    "You're making this too easy!",
    "I told your dad I fucked you",
    "Even a toaster has better strategy.",
    "Your moves are a cry for help.",
    "I've seen rocks think faster than this.",
    "Was that a move or a misclick?",
    "You couldn't win with a map and a compass.",
    "This is bullying at this point.",
    "Are you lagging in real life?",
    "I'm winning with my eyes closed.",
    "I could beat you with an empty board.",
    "Try using your brain this time.",
    "You're feeding me free wins.",
    "Even random clicks would do better.",
    "If there was a worst move, you'd find it.",
    "Your strategy is just vibes.",
    "Keep going, I need the practice.",
    "I'm embarrassed for you.",
    "You make losing look effortless.",
    "Blink twice if you need help.",
    "This isn't a challenge, it's a tutorial.",
    "You couldn't beat a wet paper bag.",
    "Is your mouse asleep?",
    "You're speedrunning failure.",
    "Even luck gave up on you."
];

// After entering name & enabling camera, show mode selection (AI or Player)
startBtn.addEventListener('click', () => {
    gameState.playerName = playerNameInput.value.trim();

    if (!gameState.playerName) {
        messageBox.textContent = "Enter your name to proceed...";
        return;
    }

    if (!gameState.cameraEnabled) {
        messageBox.textContent = "Camera access is required to prevent cheating!";
        return;
    }

    // Hide welcome screen and show mode selection page
    const modeSelect = document.getElementById('mode-select');
    if (welcomeScreen) welcomeScreen.classList.remove('active');
    if (modeSelect) modeSelect.classList.remove('hidden');
    // Announce presence to server so other players see us in lobby immediately
    try {
        if (socket) socket.emit('player-start', { name: gameState.playerName });
    } catch (e) {
        console.log('Could not announce presence to server:', e);
    }
    // Try to "unlock" audio on first user gesture so later play() calls won't be blocked by browser autoplay policy
    try {
        (async function unlockAudio() {
            try {
                const audios = [bgMusic, mockMusic, mockMusic2Sec, clickSound, winSound, loseSound, tsukuyomiSound];
                for (const a of audios) {
                    if (!a) continue;
                    try {
                        // Attempt to play then immediately pause to allow future unprompted playback
                        await a.play().catch(() => Promise.resolve());
                        a.pause();
                        a.currentTime = 0;
                    } catch (err) {
                        // ignore per-audio errors
                    }
                }
                gameState.audioUnlocked = true;
                console.log('Audio unlock attempted');
            } catch (err) {
                console.log('Error during audio unlock:', err);
            }
        })();
    } catch (e) {
        console.log('Could not run audio unlock:', e);
    }
});

// Start game as AI (extract of previous start logic)
function startGameAsAI() {
    displayName.textContent = gameState.playerName;
    welcomeScreen.classList.remove('active');
    gameScreen.classList.add('active');

    messageBox.textContent = "Foolish mortal, prepare to suffer!";
    
    // Track game start time
    gameState.gameStartTimes.push(Date.now());
    
    // Start background music
    if (bgMusic) {
        bgMusic.volume = 0.3; // Set volume to 30%
        bgMusic.play().catch(e => console.log('Could not play background music:', e));
    }
    
    // Initialize behavior analyzer
    if (typeof BehaviorAnalyzer !== 'undefined') {
        gameState.behaviorAnalyzer = new BehaviorAnalyzer(gameState.playerName);
        gameState.currentGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        gameState.behaviorAnalyzer.startGame(gameState.currentGameId);
    }
    
    // Initialize AI learning system
    if (typeof AILearningSystem !== 'undefined') {
        if (!gameState.aiLearningSystem) {
            gameState.aiLearningSystem = new AILearningSystem();
        }
        gameState.aiLearningSystem.currentGameId = gameState.currentGameId;
        gameState.playerMoveHistory = []; // Reset for new game
    }

    // Start camera streaming for admin if camera is enabled
    if (gameState.cameraEnabled && gameState.cameraStream) {
        console.log('Starting camera streaming for game...');
        startCameraStreaming();
        
        // Notify admin of camera status
        try { 
            if (socket) socket.emit('camera-status', { 
                name: gameState.playerName, 
                connected: true 
            }); 
        } catch(_) {}
        
        // Test socket connection with a simple message
        try {
            if (socket) {
                socket.emit('test-message', { 
                    name: gameState.playerName, 
                    message: 'Camera streaming started',
                    timestamp: Date.now()
                });
                console.log('Test message sent to admin');
            }
        } catch(_) {}
    } else {
        console.log('Cannot start camera streaming:', {
            cameraEnabled: gameState.cameraEnabled,
            hasStream: !!gameState.cameraStream
        });
    }

    reportSessionStart();
    try { if (socket) socket.emit('player-start', { name: gameState.playerName }); } catch(_) {}
    emitBoardUpdate();
}

// Mode selection buttons
const modeAiBtn = document.getElementById('mode-ai');
const modePlayerBtn = document.getElementById('mode-player');
if (modeAiBtn) {
    modeAiBtn.addEventListener('click', () => {
        const modeSelect = document.getElementById('mode-select');
        if (modeSelect) modeSelect.classList.add('hidden');
        startGameAsAI();
    });
}

if (modePlayerBtn) {
    modePlayerBtn.addEventListener('click', () => {
        const modeSelect = document.getElementById('mode-select');
        if (modeSelect) modeSelect.classList.add('hidden');
        // Join lobby
        showLobbyScreen();
    });
}

// Update start button state when input fields change
playerNameInput.addEventListener('input', updateStartButtonState);

// Handle cell click
cells.forEach(cell => {
    cell.addEventListener('click', () => handleCellClick(cell));
});

function handleCellClick(cell) {
    try {
        if (!gameState.gameActive || gameState.inInteractiveMode) return; // Pause during interactive mode
    
    const index = cell.dataset.index;
    if (gameState.board[index] !== '') return;

    clickSound.play();
    gameState.board[index] = 'X';
    cell.textContent = 'X';

    // Track player move for AI learning
    gameState.playerMoveHistory.push(index);
    
    // Check for learned patterns BEFORE checking for win - block proactively (FASTER: check after 1 move)
    if (gameState.aiLearningSystem && gameState.playerMoveHistory.length >= 1 && !gameState.isKingWilliam) {
        const patternCheck = gameState.aiLearningSystem.shouldBlockPattern(
            gameState.board,
            gameState.playerMoveHistory
        );
        
        if (patternCheck.shouldBlock && patternCheck.nextExpectedMove !== null) {
            // AI recognizes this pattern - block it BEFORE player can win
            const blockMove = patternCheck.nextExpectedMove;
            if (gameState.board[blockMove] === '' && blockMove !== index) {
                // Block the pattern by placing O in the expected position
                gameState.board[blockMove] = 'O';
                cells[blockMove].textContent = 'O';
                clickSound.play();
                if (gameState.aiLearningSystem.blockedWinPatterns) {
                    gameState.aiLearningSystem.blockedWinPatterns.add(patternCheck.pattern);
                    gameState.aiLearningSystem.markPatternBlocked(patternCheck.pattern);
                }
                messageBox.textContent = "The AI is adapting...";
                emitBoardUpdate();
                
                // Check if AI won after blocking
                if (checkWin('O')) {
                    gameState.losses++;
                    lossesDisplay.textContent = gameState.losses;
                    if (gameState.aiLearningSystem && gameState.currentGameId) {
                        gameState.aiLearningSystem.recordGameResult('win', gameState.playerName);
                        if (socket) {
                            socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
                        }
                    }
                    endGame("AI Wins!\nThe AI blocked your pattern!");
                    emitBoardUpdate();
                    return;
                }
                
                // Continue game after blocking - AI made its move
                if (!gameState.board.includes('')) {
                    endGame("It's a draw!");
                    return;
                }
                return; // Don't let player continue with this pattern
            }
        }
    }
    
    // Record move for behavior analysis
    if (gameState.behaviorAnalyzer) {
        const isWinningMove = checkWin('X');
        const moveType = gameState.behaviorAnalyzer.classifyMoveType(
            index, 
            gameState.board, 
            isWinningMove
        );
        gameState.behaviorAnalyzer.recordMove(index, gameState.board, moveType);
    }

    // Check for win after pattern blocking
    if (checkWin('X') && !gameState.isKingWilliam) {
        // If no pattern blocking happened, allow normal win blocking only during distractions
        if (document.querySelector('.blackout-overlay') || gameState.pendingCheatMoveIndex !== null) {
            // During distraction, AI can cheat subtly
            const winningLine = winningCombos.find(combo => combo.every(i => gameState.board[i] === 'X'));
            if (winningLine) {
                const flipIdx = winningLine[Math.floor(Math.random() * winningLine.length)];
                gameState.board[flipIdx] = 'O';
                cells[flipIdx].textContent = 'O';
            }
        }
        // Otherwise, allow the win - AI will learn from it
    }
    
    if (checkWin('X')) {
        // Player wins - allow it and let AI learn from the pattern
        gameState.wins = (gameState.wins || 0) + 1;
        playerWinCount++;
        gameState.playerJustWon = true; // Mark that player won - AI will think longer next game
        gameState.aiThinkingDelay = 1500; // Increase thinking delay to 1.5 seconds
        
        // Update wins display
        const winsDisplay = document.getElementById('wins');
        if (winsDisplay) {
            winsDisplay.textContent = gameState.wins;
        }
        
        // Play win sound
        try {
            winSound.play();
        } catch (e) {
            console.error('Error playing win sound:', e);
        }
        
        // Report win to server
        try {
            reportWin();
        } catch (e) {
            console.error('Error reporting win:', e);
        }
        
        // End game (this will handle AI learning)
        try {
            endGame("You win... for now.");
        } catch (e) {
            console.error('Error in endGame:', e);
            // Fallback: just disable game
            gameState.gameActive = false;
            messageBox.textContent = "You win... for now.";
            resetBtn.style.display = 'block';
        }
        
        emitBoardUpdate();
        return;
    }

    if (!gameState.board.includes('')) {
        // Draw - record for both player and AI and learn from the game
        if (gameState.aiLearningSystem && gameState.currentGameId) {
            // AI learns from every game, including draws
            if (gameState.playerMoveHistory && gameState.playerMoveHistory.length > 0) {
                // Learn player's move pattern even from draws
                gameState.aiLearningSystem.learnWinPattern(
                    gameState.playerName,
                    gameState.playerMoveHistory,
                    [...gameState.board] // Include full board state for context
                );
            }
            
            gameState.aiLearningSystem.recordGameResult('draw', gameState.playerName);
            
            // Send AI stats update to server
            if (socket) {
                socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
            }
        }
        endGame("It's a draw!");
        return;
    }

    // AI thinking delay - longer if player just won
    const thinkingDelay = gameState.aiThinkingDelay || 500;
    messageBox.textContent = "AI is thinking...";
    setTimeout(() => {
        makeAIMove();
        // Reset thinking delay after move (but keep it slightly longer if player won)
        if (gameState.playerJustWon) {
            gameState.aiThinkingDelay = 800; // Keep it at 800ms for a few moves
        }
    }, thinkingDelay);
    emitBoardUpdate();
    } catch (e) {
        console.error('Critical error in handleCellClick:', e);
        // Try to recover
        if (messageBox) {
            messageBox.textContent = "An error occurred. Please try again.";
        }
    }
}

const originalHandleCellClick = handleCellClick;
handleCellClick = function(cell) {
    if (gameState.inInteractiveMode) return; // Pause during interactive mode
    if (gameState.inTsukuyomi) {
        const index = cell.dataset.index;
        if (gameState.tsukuyomiBoard[index] !== '') return;

        clickSound.play();
        gameState.tsukuyomiBoard[index] = 'X';
        cell.textContent = 'X';

        if (checkWinTsukuyomi('X')) {
            setTimeout(() => {
                winSound.play();
                messageBox.textContent = "Foolish little brother... You never stood a chance.";
                gameState.losses++;
                lossesDisplay.textContent = gameState.losses;
                reportLoss();
                
                setTimeout(() => {
                    gameState.tsukuyomiBoard = Array(9).fill('');
                    gameState.gameActive = true;
                    cells.forEach(cell => cell.textContent = '');
                }, 2000);
            }, 500);
            return;
        }

        setTimeout(() => {
            const availableSpots = gameState.tsukuyomiBoard
                .map((cell, i) => cell === '' ? i : null)
                .filter(i => i !== null);
            
            if (availableSpots.length > 0) {
                const aiIndex = availableSpots[Math.floor(Math.random() * availableSpots.length)];
                gameState.tsukuyomiBoard[aiIndex] = 'O';
                cells[aiIndex].textContent = 'O';
                clickSound.play();
            }
        }, 500);
    } else {
        originalHandleCellClick(cell);
    }
};

function makeAIMove() {
    try {
        if (!gameState.gameActive || gameState.inInteractiveMode) return; // Don't make moves during interactive mode

    let index;
    // If a subtle pending move was prepared during a blackout, use it if still valid
    if (gameState.pendingCheatMoveIndex !== null && gameState.board[gameState.pendingCheatMoveIndex] === '') {
        index = gameState.pendingCheatMoveIndex;
        gameState.pendingCheatMoveIndex = null;
    } else if (gameState.isKingWilliam) {
        const emptyIndices = gameState.board.map((cell, i) => cell === '' ? i : null).filter(i => i !== null);
        index = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    } else {
        index = chooseHardAIMove();
    }

    gameState.board[index] = 'O';
    cells[index].textContent = 'O';
    clickSound.play();
    emitBoardUpdate();

    if (checkWin('O')) {
        // AI wins - record it properly
        gameState.losses++;
        lossesDisplay.textContent = gameState.losses;
        
        // Track loss metrics
        const currentGameStartTime = gameState.gameStartTimes[gameState.gameStartTimes.length - 1] || Date.now();
        const gameDuration = Date.now() - currentGameStartTime;
        const totalMovesInGame = gameState.playerMoveHistory.length + (gameState.board.filter(c => c === 'O').length);
        
        gameState.lossTimes.push(Date.now());
        gameState.gameDurations.push(gameDuration);
        gameState.totalMoves.push(totalMovesInGame);
        
        // Update performance metrics
        updatePerformanceMetrics();
        
        // Record AI win in learning system
        if (gameState.aiLearningSystem && gameState.currentGameId) {
            gameState.aiLearningSystem.recordGameResult('win', gameState.playerName);
            
            // Send AI stats update to server
            if (socket) {
                socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
            }
        }
        
        // 3rd loss - trigger AI chat instead of interactive mock
        if (gameState.losses === 3 && !gameState.inTsukuyomi && !gameState.inInteractiveMode && !gameState.aiChatActive) {
            try {
                // Open AI chat interface
                openAIChat();
            } catch (e) {
                console.error('Error opening AI chat on loss #3:', e);
                // Fallback: activate interactive mock
                activateInteractiveAIMock();
            }
        } else if (gameState.losses === 7 && !gameState.inTsukuyomi && !gameState.inInteractiveMode) {
            // At 7 losses, capture video frame and use as background with teasing
            activateSeventhLossTeasing();
        } else if (gameState.losses % 6 === 0 && !gameState.inTsukuyomi && !gameState.inInteractiveMode) {
            // At 6 losses, trigger enhanced interactive sequence with demon jumpscare
            activateEnhancedInteractiveAIMock();
        } else if (gameState.losses > 3 && gameState.losses % 3 === 0 && !gameState.inInteractiveMode) {
            // At every 3 losses after the 3rd (6, 9, 12, etc.), trigger interactive AI mock sequence
            // 6+ losses - use enhanced version with demon jumpscare
            activateEnhancedInteractiveAIMock();
        } else {
            // For quick losses, still record but continue game
            endGame("AI Wins!\nThe AI has outplayed you this round, " + gameState.playerName + "!");
            setTimeout(() => {
                // Turn alternation already happened in endGame()
                
                gameState.board = Array(9).fill('');
                gameState.gameActive = true;
                gameState.playerMoveHistory = [];
                cells.forEach(cell => cell.textContent = '');
                resetBtn.style.display = 'none';
                messageBox.textContent = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
                
                // Start new game
                if (gameState.behaviorAnalyzer) {
                    gameState.currentGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    gameState.behaviorAnalyzer.startGame(gameState.currentGameId);
                }
                if (gameState.aiLearningSystem) {
                    gameState.aiLearningSystem.currentGameId = gameState.currentGameId;
                }
                
                // If AI goes first, make AI move immediately
                if (!gameState.playerGoesFirst) {
                    messageBox.textContent = "AI is thinking...";
                    setTimeout(() => {
                        messageBox.textContent = "AI goes first this round!";
                        makeAIMove();
                    }, 800);
                }
            }, 1000);
        }
        reportLoss();
        emitBoardUpdate();
        return;
    }

    if (!gameState.isKingWilliam) {
        messageBox.textContent = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
    }
    } catch (e) {
        console.error('Critical error in makeAIMove:', e);
        // Try to recover - just disable game
        gameState.gameActive = false;
        if (messageBox) {
            messageBox.textContent = "An error occurred. Please refresh the page.";
        }
    }
}

function chooseHardAIMove() {
    try {
        // ADAPTIVE AI: Gets smarter when losing, learns from patterns
        const moveOptions = [];
    
    // Calculate AI's current performance to adjust difficulty
    let aiWinRate = 0;
    let adaptationLevel = 0;
    if (gameState.aiLearningSystem) {
        const stats = gameState.aiLearningSystem.getStats();
        aiWinRate = stats.winRate || 0;
        adaptationLevel = stats.adaptationLevel || 0;
    }
    
    // Adaptive difficulty: Reduce randomness when AI is losing
    // If win rate < 50%, AI gets more aggressive and less random
    const isLosing = aiWinRate < 50;
    const baseChaosFactor = isLosing ? 0.02 : 0.05; // 2-5% chaos when losing, 5% when winning
    const randomMoveChance = isLosing ? 0.01 : 0.03; // 1-3% random moves
    
    // CHAOS MODE: Very rare random move (only when winning comfortably)
    if (!isLosing && Math.random() < randomMoveChance) {
        const emptyCells = gameState.board.map((cell, i) => cell === '' ? i : null).filter(i => i !== null);
        if (emptyCells.length > 0) {
            const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            console.log('AI CHAOS MODE: Random move selected (rare)');
            return randomIndex;
        }
    }
    
    // 0) PRIORITY: Block learned win patterns (highly reliable when losing)
    if (gameState.aiLearningSystem && gameState.playerMoveHistory.length > 0) {
        const patternCheck = gameState.aiLearningSystem.shouldBlockPattern(
            gameState.board, 
            gameState.playerMoveHistory
        );
        
        if (patternCheck.shouldBlock && patternCheck.nextExpectedMove !== null) {
            const blockMove = patternCheck.nextExpectedMove;
            if (gameState.board[blockMove] === '') {
                // 98% chance to block when losing, 95% when winning (AI learns and adapts!)
                const blockChance = isLosing ? 0.98 : 0.95;
                if (Math.random() < blockChance) {
                    moveOptions.push({
                        index: blockMove,
                        priority: isLosing ? 1100 : 100, // Higher priority when losing
                        type: 'pattern_block',
                        reasoning: `Blocking learned win pattern: ${patternCheck.pattern} (Adaptation: ${adaptationLevel}%)`
                    });
                    if (gameState.aiLearningSystem.blockedWinPatterns) {
                        gameState.aiLearningSystem.blockedWinPatterns.add(patternCheck.pattern);
                    }
                    console.log(`AI blocking pattern: ${patternCheck.pattern} (Win Rate: ${aiWinRate.toFixed(1)}%)`);
                }
            }
        }
        
        // Check for partial pattern matches (proactive blocking)
        for (const [patternKey, patternData] of Object.entries(gameState.aiLearningSystem.learnedPatterns)) {
            const patternMoves = patternKey.split('-').map(Number);
            if (gameState.playerMoveHistory.length >= 2 && 
                gameState.playerMoveHistory.length < patternMoves.length) {
                const matches = gameState.playerMoveHistory.every((move, idx) => 
                    idx < patternMoves.length && move === patternMoves[idx]
                );
                if (matches) {
                    const nextMove = patternMoves[gameState.playerMoveHistory.length];
                    if (nextMove !== undefined && gameState.board[nextMove] === '') {
                        // Higher chance to block early when losing
                        const earlyBlockChance = isLosing ? 0.95 : 0.90;
                        if (Math.random() < earlyBlockChance) {
                            moveOptions.push({
                                index: nextMove,
                                priority: isLosing ? 1050 : 95,
                                type: 'pattern_block',
                                reasoning: `Preventing known pattern early: ${patternKey}`
                            });
                        }
                    }
                }
            }
        }
    }
    
    // 1) Immediate win (always take it, but collect all winning moves)
    const winMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'O';
            if (checkWin('O')) {
                winMoves.push(i);
            }
            gameState.board[i] = '';
        }
    }
    if (winMoves.length > 0) {
        moveOptions.push({
            index: winMoves[Math.floor(Math.random() * winMoves.length)],
            priority: 1000,
            type: 'win',
            reasoning: 'Immediate winning move'
        });
    }

    // 2) Block opponent immediate win (collect all blocking moves)
    const blockMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'X';
            if (checkWin('X')) {
                blockMoves.push(i);
            }
            gameState.board[i] = '';
        }
    }
    if (blockMoves.length > 0) {
        // Sometimes block in unexpected position if multiple blocks exist
        const selectedBlock = blockMoves[Math.floor(Math.random() * blockMoves.length)];
        moveOptions.push({
            index: selectedBlock,
            priority: 900,
            type: 'block',
            reasoning: 'Blocking opponent win'
        });
    }

    // 3) Create forks (collect all fork moves)
    const forkMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'O';
            const threats = countImmediateThreatsFor('O');
            if (threats >= 2) {
                forkMoves.push(i);
            }
            gameState.board[i] = '';
        }
    }
    if (forkMoves.length > 0) {
        moveOptions.push({
            index: forkMoves[Math.floor(Math.random() * forkMoves.length)],
            priority: 800,
            type: 'fork',
            reasoning: 'Creating fork (multiple threats)'
        });
    }

    // 4) Block opponent's fork (collect all fork blocks)
    const forkBlockMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'X';
            const threats = countImmediateThreatsFor('X');
            if (threats >= 2) {
                forkBlockMoves.push(i);
            }
            gameState.board[i] = '';
        }
    }
    if (forkBlockMoves.length > 0) {
        moveOptions.push({
            index: forkBlockMoves[Math.floor(Math.random() * forkBlockMoves.length)],
            priority: 700,
            type: 'block_fork',
            reasoning: 'Blocking opponent fork'
        });
    }

    // 5) Strategic positions (center, corners, sides) - collect all options
    const strategicMoves = [];
    if (gameState.board[4] === '') {
        strategicMoves.push({ index: 4, priority: 600, type: 'center', reasoning: 'Taking center' });
    }
    
    const corners = [0, 2, 6, 8].filter(i => gameState.board[i] === '');
    if (corners.length > 0) {
    const oppCorner = getOppositeCornerIndex();
        if (oppCorner !== null && corners.includes(oppCorner)) {
            strategicMoves.push({ index: oppCorner, priority: 550, type: 'corner', reasoning: 'Opposite corner' });
        } else {
            strategicMoves.push({ 
                index: corners[Math.floor(Math.random() * corners.length)], 
                priority: 500, 
                type: 'corner', 
                reasoning: 'Empty corner' 
            });
        }
    }
    
    const sides = [1, 3, 5, 7].filter(i => gameState.board[i] === '');
    if (sides.length > 0) {
        strategicMoves.push({ 
            index: sides[Math.floor(Math.random() * sides.length)], 
            priority: 400, 
            type: 'side', 
            reasoning: 'Empty side' 
        });
    }
    
    strategicMoves.forEach(move => moveOptions.push(move));

    // 6) Fallback: Get all valid minimax moves and ALWAYS pick the best one
    const emptyIndices = gameState.board.map((cell, i) => cell === '' ? i : null).filter(i => i !== null);
    if (emptyIndices.length > 0) {
        const minimaxScores = [];
        emptyIndices.forEach(idx => {
            gameState.board[idx] = 'O';
            const score = minimax(gameState.board, 0, false);
            gameState.board[idx] = '';
            minimaxScores.push({ index: idx, score: score });
        });
        
        // Sort by score and ALWAYS pick the best move (no randomness)
        minimaxScores.sort((a, b) => b.score - a.score);
        const bestMove = minimaxScores[0];
        
        moveOptions.push({
            index: bestMove.index,
            priority: 300,
            type: 'minimax',
            reasoning: 'Minimax optimal move (best move selected)'
        });
    }

    // Select move with weighted randomness - higher priority moves more likely, but not guaranteed
    if (moveOptions.length === 0) {
        // Ultimate fallback - random empty cell
        const empty = gameState.board.map((cell, i) => cell === '' ? i : null).filter(i => i !== null);
        return empty[Math.floor(Math.random() * empty.length)];
    }

    // Sort by priority
    moveOptions.sort((a, b) => b.priority - a.priority);
    
    // ALWAYS pick the best move (highest priority) - no randomness
    const selected = moveOptions[0];
    const moveIndex = selected.index;
    const moveType = selected.type || 'unpredictable';
    const reasoning = selected.reasoning || 'Unpredictable move selection';

    // Record AI move
    if (gameState.aiLearningSystem && moveIndex !== null) {
        gameState.aiLearningSystem.recordAIMove(moveIndex, gameState.board, moveType, reasoning);
        
        // Send to server
        if (socket) {
            socket.emit('ai-move', {
                moveIndex: moveIndex,
                boardState: [...gameState.board],
                moveType: moveType,
                reasoning: reasoning,
                gameId: gameState.currentGameId
            });
        }
    }
    
    return moveIndex;
    } catch (e) {
        console.error('Critical error in chooseHardAIMove:', e);
        // Fallback to random move
        const empty = gameState.board.map((cell, i) => cell === '' ? i : null).filter(i => i !== null);
        if (empty.length > 0) {
            return empty[Math.floor(Math.random() * empty.length)];
        }
        return 0; // Ultimate fallback
    }
}

function getImmediateWinMoveFor(player) {
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = player;
            const isWin = checkWin(player);
            gameState.board[i] = '';
            if (isWin) return i;
        }
    }
    return null;
}

function findForkMoveFor(player) {
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] !== '') continue;
        gameState.board[i] = player;
        const threats = countImmediateThreatsFor(player);
        gameState.board[i] = '';
        if (threats >= 2) return i;
    }
    return null;
}

// Enhanced fork creation - creates multiple forks when possible
function createMultipleForks(player) {
    const forks = [];
    
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] !== '') continue;
        
        gameState.board[i] = player;
        const threats = countImmediateThreatsFor(player);
        gameState.board[i] = '';
        
        if (threats >= 2) {
            forks.push({ index: i, threatCount: threats });
        }
    }
    
    // Return fork with most threats, or null if none
    if (forks.length > 0) {
        forks.sort((a, b) => b.threatCount - a.threatCount);
        return forks[0].index;
    }
    
    return null;
}

function countImmediateThreatsFor(player) {
    // Count how many lines are one move away for the player
    let count = 0;
    for (const combo of winningCombos) {
        const values = combo.map(idx => gameState.board[idx]);
        const playerCount = values.filter(v => v === player).length;
        const emptyCount = values.filter(v => v === '').length;
        if (playerCount === 2 && emptyCount === 1) count++;
    }
    return count;
}

function getOppositeCornerIndex() {
    const pairs = [ [0, 8], [2, 6] ];
    for (const [a, b] of pairs) {
        if (gameState.board[a] === 'X' && gameState.board[b] === '') return b;
        if (gameState.board[b] === 'X' && gameState.board[a] === '') return a;
    }
    return null;
}

function getEmptyCornerIndex() {
    const corners = [0, 2, 6, 8];
    for (const i of corners) if (gameState.board[i] === '') return i;
    return null;
}

function getEmptySideIndex() {
    const sides = [1, 3, 5, 7];
    for (const i of sides) if (gameState.board[i] === '') return i;
    return null;
}

function getBestMove() {
    let bestScore = -Infinity;
    let bestMove;

    const indices = getOrderedEmptyIndices(gameState.board);
    for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        gameState.board[idx] = 'O';
            let score = minimax(gameState.board, 0, false);
        gameState.board[idx] = '';
            if (score > bestScore) {
                bestScore = score;
            bestMove = idx;
        }
    }
    return bestMove;
}

function getOrderedEmptyIndices(board) {
    const order = [4, 0, 2, 6, 8, 1, 3, 5, 7]; // center, corners, edges
    return order.filter(i => board[i] === '');
}

function minimax(board, depth, isMaximizing) {
    if (checkWin('O')) return 10 - depth; // prefer quicker wins
    if (checkWin('X')) return depth - 10; // delay losses
    if (!board.includes('')) return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        const indices = getOrderedEmptyIndices(board);
        for (let i = 0; i < indices.length; i++) {
            const iIdx = indices[i];
            board[iIdx] = 'O';
                let score = minimax(board, depth + 1, false);
            board[iIdx] = '';
                bestScore = Math.max(score, bestScore);
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        const indices = getOrderedEmptyIndices(board);
        for (let i = 0; i < indices.length; i++) {
            const iIdx = indices[i];
            board[iIdx] = 'X';
                let score = minimax(board, depth + 1, true);
            board[iIdx] = '';
                bestScore = Math.min(score, bestScore);
        }
        return bestScore;
    }
}

function checkWin(player) {
    return winningCombos.some(combination => {
        return combination.every(index => {
            return gameState.board[index] === player;
        });
    });
}

function activateTsukuyomi() {
    gameState.inTsukuyomi = true;
    tsukuyomiSound.play();
    tsukuyomiOverlay.classList.remove('hidden');
    document.body.classList.add('tsukuyomi-active');
    const countdownDisplay = document.getElementById('tsukuyomi-countdown');
    let timeLeft = 10;

    countdownDisplay.textContent = timeLeft;

    const sharinganInterval = setInterval(() => {
        timeLeft--;
        countdownDisplay.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(sharinganInterval);
            tsukuyomiOverlay.classList.add('hidden');
            messageBox.textContent = "Your mind is weak... Let me show you true power.";
            
            let gameTimeLeft = 30;
            messageBox.textContent = `Time left in Tsukuyomi: ${gameTimeLeft}`;
            
            const gameInterval = setInterval(() => {
                gameTimeLeft--;
                messageBox.textContent = `Time left in Tsukuyomi: ${gameTimeLeft}`;

                if (gameTimeLeft <= 0) {
                    clearInterval(gameInterval);
                    gameState.inTsukuyomi = false;
                    document.body.classList.remove('tsukuyomi-active');
                    messageBox.textContent = "The Tsukuyomi has ended... but your suffering continues!";
                    gameState.board = Array(9).fill('');
                    gameState.tsukuyomiBoard = Array(9).fill('');
                    cells.forEach(cell => cell.textContent = '');
                    gameState.gameActive = true;
                }
            }, 1000);
        }
    }, 1000);

    setTimeout(() => {
        tsukuyomiOverlay.classList.add('hidden');
        messageBox.textContent = "Your mind is weak... Let me show you true power.";
        gameState.board = Array(9).fill('');
        gameState.tsukuyomiBoard = Array(9).fill('');
        cells.forEach(cell => cell.textContent = '');
        gameState.gameActive = true;
    }, 10000);
}

function checkWinTsukuyomi(player) {
    return winningCombos.some(combination => {
        return combination.every(index => {
            return gameState.tsukuyomiBoard[index] === player;
        });
    });
}

// Interactive AI Mock Sequence
function activateInteractiveAIMock() {
    gameState.inInteractiveMode = true;
    gameState.gameActive = false;
    
    // Notify admin about interactive mode
    if (socket) {
        socket.emit('interactive-mode-start', {
            name: gameState.playerName,
            losses: gameState.losses,
            timestamp: Date.now()
        });
    }
    
    // Stop background music
    if (bgMusic) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }
    
    // Show wait message
    endGame("Wait... now the AI will be interactive here. Tell the person wait.");
    
    // Send update to admin
    emitBoardUpdate();
    
    setTimeout(() => {
        // Show improved disco lights for first 3 losses
        discoOverlay.classList.remove('hidden');
        discoOverlay.classList.add('enhanced-rgb');
        
        // Make game boxes dance with insults
        startBoxDanceWithInsults();
        
        // Play mock music
        if (mockMusic) {
            mockMusic.play().catch(e => console.log('Could not play mock music:', e));
            
            // Create audio context for box dance sync
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                const source = audioContext.createMediaElementSource(mockMusic);
                source.connect(analyser);
                analyser.connect(audioContext.destination);
                
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                // Sync box dance with music (with cleanup)
                let syncDanceActive = true;
                function syncDance() {
                    if (!syncDanceActive || mockMusic.paused || mockMusic.ended) {
                        syncDanceActive = false;
                        return;
                    }
                    
                    try {
                        analyser.getByteFrequencyData(dataArray);
                        const maxFreq = Math.max(...Array.from(dataArray));
                        const intensity = maxFreq / 255;
                        
                        // Update dance intensity based on music
                        cells.forEach((cell, index) => {
                            const cellIntensity = intensity * (0.8 + (index % 3) * 0.1);
                            if (cell.classList.contains('dancing')) {
                                cell.style.transform = `translateY(${-20 * cellIntensity}px) rotate(${cellIntensity * 10}deg) scale(${1 + cellIntensity * 0.3})`;
                            }
                        });
                        
                        if (syncDanceActive) {
                            requestAnimationFrame(syncDance);
                        }
                    } catch (e) {
                        console.error('Error in syncDance:', e);
                        syncDanceActive = false;
                    }
                }
                
                syncDance();
                
                // Cleanup after music ends
                mockMusic.addEventListener('ended', () => {
                    syncDanceActive = false;
                });
            } catch (e) {
                console.log('Audio context not available for dance:', e);
            }
        }
        
        // Wait for song to finish (13 seconds as per filename)
        setTimeout(() => {
            // Stop box dance
            stopBoxDance();
            
            // Hide disco lights
            discoOverlay.classList.add('hidden');
            discoOverlay.classList.remove('enhanced-rgb');
            
            // Show AI mock overlay
            aiMockOverlay.classList.remove('hidden');
            
            // Mock the player and ask if they want to continue
            const mockMessages = [
                `Well, well, well... ${gameState.playerName}, you've lost 3 times already!`,
                `You really love getting beaten, don't you?`,
                `I'm starting to think you enjoy this...`
            ];
            
            aiMockText.textContent = mockMessages[Math.floor(Math.random() * mockMessages.length)] + "\n\nDo you want to continue?";
            
            // Show buttons with animation
            setTimeout(() => {
                document.getElementById('ai-mock-buttons').style.opacity = '1';
                document.getElementById('ai-mock-buttons').style.transform = 'scale(1)';
            }, 500);
            
        }, 13000); // 13 seconds for the song
    }, 2000);
}

// Snowfall effect with taunt messages and player images (for first 3 losses)
let snowfallInterval = null;
let snowfallElements = [];
let playerImageDataUrl = null;

// Capture player image from camera feed
function capturePlayerImage() {
    try {
        const videoElement = cameraFeed;
        if (!videoElement) {
            console.warn('Camera feed element not found');
            return null;
        }
        
        // Check if video is ready
        if (!videoElement.videoWidth || !videoElement.videoHeight || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
            console.warn('Video not ready for capture');
            return null;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get canvas context');
            return null;
        }
        
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        try {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        } catch (drawError) {
            console.error('Error drawing video to canvas:', drawError);
            return null;
        }
        
        // Convert to data URL (small size for performance)
        try {
            return canvas.toDataURL('image/jpeg', 0.7);
        } catch (dataError) {
            console.error('Error converting canvas to data URL:', dataError);
            return null;
        }
    } catch (e) {
        console.error('Error capturing player image:', e);
        return null;
    }
}

function startSnowfallEffect() {
    try {
        const container = document.getElementById('snowfall-container');
        if (!container) {
            console.error('Snowfall container not found');
            return;
        }
        
        // Stop any existing snowfall effect first
        stopSnowfallEffect();
        
        // Capture fresh player image each time (with error handling)
        if (gameState.cameraEnabled) {
            try {
                playerImageDataUrl = capturePlayerImage();
            } catch (e) {
                console.error('Error capturing image for snowfall:', e);
                playerImageDataUrl = null; // Continue without images if capture fails
            }
        }
        
        container.classList.remove('hidden');
        container.innerHTML = '';
        snowfallElements = [];
    } catch (e) {
        console.error('Error starting snowfall effect:', e);
        return;
    }
    
    const tauntMessages = [
        "FUCK U",
        "TRASH",
        "LOSER",
        "NOOB",
        "GARBAGE",
        "WEAK",
        "FAIL",
        "PATHETIC",
        "LAME",
        "EZ",
        "GET REKT",
        "CRINGE",
        "SAD",
        "LOL",
        "ROFL"
    ];
    
    // Create snowfall particles (text or image)
    function createSnowflake() {
        try {
            const snowflake = document.createElement('div');
            snowflake.className = 'snowflake';
            
            // 50% chance to show player image, 50% chance to show taunt message
            const showImage = playerImageDataUrl && Math.random() < 0.5;
            
            if (showImage) {
                try {
                    // Create image element
                    const img = document.createElement('img');
                    img.src = playerImageDataUrl;
                    img.style.width = (Math.random() * 30 + 40) + 'px'; // 40-70px
                    img.style.height = 'auto';
                    img.style.borderRadius = '50%';
                    img.style.border = '2px solid #ff0000';
                    img.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
                    img.style.objectFit = 'cover';
                    img.onerror = () => {
                        // If image fails to load, remove it and show text instead
                        img.remove();
                        const message = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
                        snowflake.textContent = message;
                        snowflake.style.fontSize = (Math.random() * 10 + 14) + 'px';
                    };
                    snowflake.appendChild(img);
                    
                    // Also add a taunt message below the image
                    const message = document.createElement('div');
                    message.textContent = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
                    message.style.fontSize = (Math.random() * 6 + 10) + 'px'; // 10-16px
                    message.style.color = '#ff0000';
                    message.style.fontWeight = 'bold';
                    message.style.textShadow = '1px 1px 2px #000';
                    message.style.marginTop = '5px';
                    snowflake.appendChild(message);
                } catch (imgError) {
                    console.error('Error creating image snowflake:', imgError);
                    // Fallback to text
                    const message = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
                    snowflake.textContent = message;
                    snowflake.style.fontSize = (Math.random() * 10 + 14) + 'px';
                }
            } else {
                // Just text message
                const message = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
                snowflake.textContent = message;
                snowflake.style.fontSize = (Math.random() * 10 + 14) + 'px'; // 14-24px
            }
            
            // Random starting position
            snowflake.style.left = Math.random() * 100 + '%';
            snowflake.style.animationDuration = (Math.random() * 3 + 2) + 's'; // 2-5 seconds
            snowflake.style.animationDelay = Math.random() * 2 + 's';
            snowflake.style.opacity = Math.random() * 0.5 + 0.5; // 0.5-1.0
            
            if (container && container.parentNode) {
                container.appendChild(snowflake);
                snowfallElements.push(snowflake);
                
                // Remove after animation
                setTimeout(() => {
                    try {
                        if (snowflake && snowflake.parentNode) {
                            snowflake.remove();
                        }
                        const index = snowfallElements.indexOf(snowflake);
                        if (index > -1) {
                            snowfallElements.splice(index, 1);
                        }
                    } catch (e) {
                        console.error('Error removing snowflake:', e);
                    }
                }, 7000);
            }
        } catch (e) {
            console.error('Error creating snowflake:', e);
        }
    }
    
    // Create snowflakes periodically
    try {
        snowfallInterval = setInterval(() => {
            try {
                if (snowfallElements.length < 30 && container && container.parentNode) { // Limit to 30 snowflakes
                    createSnowflake();
                }
            } catch (e) {
                console.error('Error in snowfall interval:', e);
                // Stop interval on error
                if (snowfallInterval) {
                    clearInterval(snowfallInterval);
                    snowfallInterval = null;
                }
            }
        }, 200); // Create new snowflake every 200ms
        
        // Stop after 5 seconds
        setTimeout(() => {
            try {
                stopSnowfallEffect();
            } catch (e) {
                console.error('Error stopping snowfall:', e);
            }
        }, 5000);
    } catch (e) {
        console.error('Error setting up snowfall interval:', e);
        stopSnowfallEffect();
    }
}

function stopSnowfallEffect() {
    try {
        if (snowfallInterval) {
            clearInterval(snowfallInterval);
            snowfallInterval = null;
        }
        
        // Remove all snowflakes safely
        snowfallElements.forEach(snowflake => {
            try {
                if (snowflake && snowflake.parentNode) {
                    snowflake.remove();
                }
            } catch (e) {
                console.error('Error removing snowflake:', e);
            }
        });
        snowfallElements = [];
        
        const container = document.getElementById('snowfall-container');
        if (container) {
            container.classList.add('hidden');
            container.innerHTML = ''; // Clear container
        }
    } catch (e) {
        console.error('Error stopping snowfall effect:', e);
    }
}

// Box dance with insults for first 3 losses
function startBoxDanceWithInsults() {
    const insults = [
        "LOSER!",
        "TRASH!",
        "WEAK!",
        "FAIL!",
        "NOOB!",
        "EZ!",
        "GARBAGE!",
        "PATHETIC!",
        "LAME!"
    ];
    
    cells.forEach((cell, index) => {
        cell.classList.add('dancing');
        cell.style.animationDelay = `${index * 0.1}s`;
        cell.style.position = 'relative';
        
        // Add insult text that appears and disappears
        const insult = insults[index % insults.length];
        const insultElement = document.createElement('div');
        insultElement.className = 'box-insult';
        insultElement.textContent = insult;
        insultElement.style.animationDelay = `${index * 0.15}s`;
        cell.appendChild(insultElement);
    });
}

function stopBoxDance() {
    cells.forEach(cell => {
        cell.classList.remove('dancing');
        cell.style.transform = '';
        cell.style.animationDelay = '';
        cell.style.position = '';
        const insult = cell.querySelector('.box-insult');
        if (insult) {
            insult.remove();
        }
    });
}

// Enhanced Interactive AI Mock Sequence (for 6+ losses)
function activateEnhancedInteractiveAIMock() {
    gameState.inInteractiveMode = true;
    gameState.gameActive = false;
    
    // Notify admin about enhanced interactive mode
    if (socket) {
        socket.emit('interactive-mode-start', {
            name: gameState.playerName,
            losses: gameState.losses,
            enhanced: true,
            timestamp: Date.now()
        });
    }
    
    // Stop background music
    if (bgMusic) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }
    
    // Show wait message
    endGame("Wait... now the AI will be interactive here. Tell the person wait.");
    
    // Send update to admin
    emitBoardUpdate();
    
    // First show demon jumpscare
    if (!demonOverlay) {
        console.error('performJumpscare: demonOverlay element not found');
    } else {
        console.log('performJumpscare: showing demon overlay');
        demonOverlay.classList.remove('hidden');
    }
    try { if (loseSound && typeof loseSound.play === 'function') { const p = loseSound.play(); if (p && typeof p.catch === 'function') p.catch(()=>{}); } } catch(_) {}
    
    setTimeout(() => {
        if (!demonOverlay) {
            console.error('performJumpscare: demonOverlay element missing on hide');
        } else {
            console.log('performJumpscare: hiding demon overlay');
            demonOverlay.classList.add('hidden');
        }
        
        // Show visualizer overlay (bigger, follows music)
        discoOverlay.classList.remove('hidden');
        discoOverlay.classList.add('visualizer-mode');
        
        // Play 2-second mock music
        if (mockMusic2Sec) {
            mockMusic2Sec.play().catch(e => console.log('Could not play mock music:', e));
            
            // Create audio context for visualizer
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                const source = audioContext.createMediaElementSource(mockMusic2Sec);
                source.connect(analyser);
                analyser.connect(audioContext.destination);
                
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                // Visualizer animation
                function visualize() {
                    if (mockMusic2Sec.paused || mockMusic2Sec.ended) {
                        return;
                    }
                    
                    analyser.getByteFrequencyData(dataArray);
                    
                    // Update visualizer bars based on audio data
                    const visualizer = document.querySelector('.disco-lights');
                    if (visualizer) {
                        const maxFreq = Math.max(...Array.from(dataArray));
                        const intensity = maxFreq / 255;
                        
                        visualizer.style.opacity = 0.3 + (intensity * 0.5);
                        visualizer.style.transform = `scale(${1 + intensity * 0.2})`;
                        visualizer.style.filter = `hue-rotate(${intensity * 360}deg) brightness(${1 + intensity})`;
                    }
                    
                    requestAnimationFrame(visualize);
                }
                
                visualize();
            } catch (e) {
                console.log('Audio context not available:', e);
            }
        }
        
        // Wait for song to finish (2 seconds)
        setTimeout(() => {
            // Hide visualizer
            discoOverlay.classList.add('hidden');
            discoOverlay.classList.remove('visualizer-mode');
            
            // Show AI mock overlay
            aiMockOverlay.classList.remove('hidden');
            
            // Different teasing messages for 6+ losses
            const enhancedMockMessages = [
                `Seriously, ${gameState.playerName}? 6 losses and you're STILL here?`,
                `You're like a broken record... losing the same way over and over!`,
                `I'm starting to think you're doing this on purpose, ${gameState.playerName}!`,
                `6 losses... and you still think you can win? That's adorable!`,
                `You know what they say about doing the same thing and expecting different results...`
            ];
            
            aiMockText.textContent = enhancedMockMessages[Math.floor(Math.random() * enhancedMockMessages.length)] + "\n\nDo you want to continue?";
            
            // Show buttons with animation
            setTimeout(() => {
                document.getElementById('ai-mock-buttons').style.opacity = '1';
                document.getElementById('ai-mock-buttons').style.transform = 'scale(1)';
            }, 500);
            
        }, 2000); // 2 seconds for the song
    }, 2000); // 2 seconds for demon jumpscare
}

function closeInteractiveMode() {
    gameState.inInteractiveMode = false;
    aiMockOverlay.classList.add('hidden');
    const mockButtons = document.getElementById('ai-mock-buttons');
    if (mockButtons) {
        mockButtons.style.opacity = '0';
        mockButtons.style.transform = 'scale(0.8)';
    }
    
    // Notify admin that interactive mode ended
    if (socket) {
        socket.emit('interactive-mode-end', {
            name: gameState.playerName,
            losses: gameState.losses,
            timestamp: Date.now()
        });
    }
    
    // Stop mock music
    if (mockMusic) {
        mockMusic.pause();
        mockMusic.currentTime = 0;
    }
    if (mockMusic2Sec) {
        mockMusic2Sec.pause();
        mockMusic2Sec.currentTime = 0;
    }
    
    // Resume background music
    if (bgMusic) {
        bgMusic.play().catch(e => console.log('Could not play background music:', e));
    }
    
    // Turn alternation already happened in endGame() before interactive mode
    
    // Reset game
    gameState.board = Array(9).fill('');
    gameState.gameActive = true;
    gameState.playerMoveHistory = [];
    cells.forEach(cell => cell.textContent = '');
    resetBtn.style.display = 'none';
    messageBox.textContent = "Back for more punishment?";
    
    // Gradually reduce AI thinking delay if player won (but keep it slightly longer)
    if (gameState.playerJustWon) {
        // Keep thinking delay for a few moves, then gradually reduce
        setTimeout(() => {
            gameState.aiThinkingDelay = Math.max(500, gameState.aiThinkingDelay - 100);
            if (gameState.aiThinkingDelay <= 500) {
                gameState.playerJustWon = false; // Reset flag when delay is back to normal
            }
        }, 5000);
    } else {
        gameState.aiThinkingDelay = 500; // Reset to normal
    }
    
    // Start new game
    if (gameState.behaviorAnalyzer) {
        gameState.currentGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        gameState.behaviorAnalyzer.startGame(gameState.currentGameId);
    }
    if (gameState.aiLearningSystem) {
        gameState.aiLearningSystem.currentGameId = gameState.currentGameId;
        if (gameState.aiLearningSystem.resetGame) {
            gameState.aiLearningSystem.resetGame();
        }
    }
    
    // Send update to admin
    emitBoardUpdate();
    
    // If AI goes first, make AI move immediately (with thinking delay if player won)
    if (!gameState.playerGoesFirst) {
        messageBox.textContent = "AI is thinking...";
        const thinkingDelay = gameState.aiThinkingDelay || 500;
        setTimeout(() => {
            messageBox.textContent = "AI goes first this round!";
            makeAIMove();
        }, thinkingDelay);
    }
}

// Reset game and return to landing page (welcome screen)
function resetToLanding() {
    try {
        // Stop any mock music
        if (mockMusic) {
            mockMusic.pause();
            mockMusic.currentTime = 0;
        }
        if (mockMusic2Sec) {
            mockMusic2Sec.pause();
            mockMusic2Sec.currentTime = 0;
        }

        // Stop visual effects
        stopBoxDance();
        stopSnowfallEffect();
        discoOverlay.classList.add('hidden');
        discoOverlay.classList.remove('visualizer-mode');
        discoOverlay.classList.remove('enhanced-rgb');
        demonOverlay.classList.add('hidden');

        // Hide overlays
        aiMockOverlay.classList.add('hidden');

        // Stop camera streaming and recording
        try { stopVideoRecording(); } catch(_) {}
        try { stopCamera(); } catch(_) {}

        // Reset UI
        welcomeScreen.classList.add('active');
        gameScreen.classList.remove('active');
        displayName.textContent = '';
        playerNameInput.value = '';

        // Reset game state values
        gameState.playerName = '';
        gameState.board = Array(9).fill('');
        gameState.losses = 0;
        gameState.wins = 0;
        gameState.aiLosses = 0;
        gameState.gameActive = true;
        gameState.inInteractiveMode = false;
        gameState.playerMoveHistory = [];

        // Reset displays
        lossesDisplay.textContent = '0';
        const winsDisplay = document.getElementById('wins');
        if (winsDisplay) winsDisplay.textContent = '0';
        messageBox.textContent = '';
        cells.forEach(cell => cell.textContent = '');
        resetBtn.style.display = 'none';

        // Ensure start button state reflects camera status
        updateStartButtonState();
    } catch (e) {
        console.error('Error resetting to landing page:', e);
    }
}

// Wire mock Yes/No buttons
if (mockYesBtn) {
    mockYesBtn.addEventListener('click', () => {
        try {
            // More taunting before resuming
            const moreTaunts = [
                "You sure? Fine, let's continue. Prepare to be humiliated.",
                "Brave or stupid? We'll see. Back to the slaughter.",
                "You picked 'YES' ‚Äî courage or masochism? Either way, face your demise."
            ];
            aiMockText.textContent = moreTaunts[Math.floor(Math.random() * moreTaunts.length)];

            // Short taunt sound then resume
            if (mockMusic2Sec) {
                mockMusic2Sec.currentTime = 0;
                mockMusic2Sec.play().catch(e => console.log('Could not play short mock music:', e));
            }

            // Disable buttons while taunting
            mockYesBtn.disabled = true;
            if (mockNoBtn) mockNoBtn.disabled = true;

            setTimeout(() => {
                // Close interactive mode and resume normal play
                closeInteractiveMode();
                // Re-enable buttons
                mockYesBtn.disabled = false;
                if (mockNoBtn) mockNoBtn.disabled = false;
            }, 2000);
        } catch (e) {
            console.error('Error handling mock YES:', e);
            closeInteractiveMode();
        }
    });
}

if (mockNoBtn) {
    mockNoBtn.addEventListener('click', () => {
        try {
            // Final taunt then return to landing
            aiMockText.textContent = `Giving up so soon, ${gameState.playerName}? Suit yourself.`;
            // Stop interactive mode visuals
            if (mockMusic) { mockMusic.pause(); mockMusic.currentTime = 0; }
            if (mockMusic2Sec) { mockMusic2Sec.pause(); mockMusic2Sec.currentTime = 0; }
            // Disable buttons to avoid double actions
            mockNoBtn.disabled = true;
            if (mockYesBtn) mockYesBtn.disabled = true;

            setTimeout(() => {
                resetToLanding();
            }, 1200);
        } catch (e) {
            console.error('Error handling mock NO:', e);
            resetToLanding();
        }
    });
}

// 7th Loss: Capture video frame and use as background with teasing
function activateSeventhLossTeasing() {
    gameState.inInteractiveMode = true;
    gameState.gameActive = false;
    
    // Capture frame from video feed
    const videoElement = cameraFeed;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Set as background
        document.body.style.backgroundImage = `url(${imageData})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        
        // Add overlay for readability
        if (!document.getElementById('seventh-loss-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'seventh-loss-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.4);
                z-index: 1;
                pointer-events: none;
            `;
            document.body.appendChild(overlay);
        }
        
        // Make sure game content is above overlay
        const container = document.querySelector('.container');
        if (container) {
            container.style.position = 'relative';
            container.style.zIndex = '10';
        }
    }
    
    // Teasing messages with player name
    const teasingMessages = [
        `Look at that face, ${gameState.playerName}! 7 losses and you're STILL trying?`,
        `${gameState.playerName}, your expression says it all... Pure defeat!`,
        `7 losses, ${gameState.playerName}! Your face is now immortalized in failure!`,
        `This is what losing looks like, ${gameState.playerName}! Your face tells the whole story!`,
        `${gameState.playerName}, you've lost 7 times! Your face is now the background of your own humiliation!`,
        `Look at yourself, ${gameState.playerName}! 7 losses and counting!`,
        `${gameState.playerName}, your face is now a permanent reminder of your failures!`,
        `7 losses, ${gameState.playerName}! Your expression is priceless!`
    ];
    
    // Show teasing message
    const message = teasingMessages[Math.floor(Math.random() * teasingMessages.length)];
    messageBox.textContent = message;
    messageBox.style.cssText += `
        font-size: 1.5rem;
        color: #ff0000;
        text-shadow: 0 0 10px rgba(255, 0, 0, 0.8), 0 0 20px rgba(255, 0, 0, 0.6);
        animation: pulse 1s infinite;
        z-index: 1000;
        position: relative;
    `;
    
    // End game
    endGame(`AI Wins!\n${message}`);
    
    // Notify admin
    if (socket) {
        socket.emit('interactive-mode-start', {
            name: gameState.playerName,
            losses: gameState.losses,
            type: 'seventh-loss',
            timestamp: Date.now()
        });
    }
    
    // After 3 seconds, allow game to continue
    setTimeout(() => {
        gameState.inInteractiveMode = false;
        messageBox.style.cssText = '';
        
        // Keep background but fade overlay after a delay
        setTimeout(() => {
            const overlay = document.getElementById('seventh-loss-overlay');
            if (overlay) {
                overlay.style.opacity = '0.2'; // Keep slight overlay for readability
                overlay.style.transition = 'opacity 2s';
            }
        }, 5000);
        
        // Reset game
        setTimeout(() => {
            gameState.board = Array(9).fill('');
            gameState.gameActive = true;
            gameState.playerMoveHistory = [];
            cells.forEach(cell => cell.textContent = '');
            resetBtn.style.display = 'none';
            messageBox.textContent = `Still here, ${gameState.playerName}? The AI remembers your face...`;
            
            // Start new game
            if (gameState.behaviorAnalyzer) {
                gameState.currentGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                gameState.behaviorAnalyzer.startGame(gameState.currentGameId);
            }
            if (gameState.aiLearningSystem) {
                gameState.aiLearningSystem.currentGameId = gameState.currentGameId;
            }
            
            // If AI goes first
            if (!gameState.playerGoesFirst) {
                messageBox.textContent = "AI is thinking...";
                setTimeout(() => {
                    messageBox.textContent = "AI goes first this round!";
                    makeAIMove();
                }, 800);
            }
            
            if (socket) {
                socket.emit('interactive-mode-end', {
                    name: gameState.playerName,
                    losses: gameState.losses,
                    timestamp: Date.now()
                });
            }
        }, 1000);
    }, 3000);
}

function endGame(message) {
    try {
        gameState.gameActive = false;
        messageBox.textContent = message;
        resetBtn.style.display = 'block';
        
        // Record game result for behavior analysis
        if (gameState.behaviorAnalyzer) {
            try {
                let result = 'loss';
                if (message.includes('win') || message.includes('Win')) {
                    result = 'win';
                } else if (message.includes('draw') || message.includes('Draw')) {
                    result = 'draw';
                }
                if (gameState.currentGameId) {
                    gameState.behaviorAnalyzer.endGame(result);
                }
            } catch (e) {
                console.error('Error in behaviorAnalyzer.endGame:', e);
            }
        }
        
        // Record AI game result and learn from EVERY game (wins, losses, draws)
        if (gameState.aiLearningSystem) {
            try {
                let aiResult = 'win'; // AI wins when player loses
                if (message.includes('win') || message.includes('Win')) {
                    aiResult = 'loss';
                } else if (message.includes('draw') || message.includes('Draw')) {
                    aiResult = 'draw';
                }
                
                // AI learns from every game - learn player's move patterns from all games
                // Learn even from partial patterns (faster learning)
                if (gameState.playerMoveHistory && gameState.playerMoveHistory.length > 0) {
                    // Learn complete pattern if player won (minimum 3 moves)
                    if (aiResult === 'loss' && gameState.playerMoveHistory.length >= 3) {
                        gameState.aiLearningSystem.learnWinPattern(
                            gameState.playerName, 
                            gameState.playerMoveHistory,
                            [...gameState.board] // Include full board state for context
                        );
                    }
                    // Also learn partial patterns (first 2-5 moves) for faster adaptation - LEARN FROM 2 MOVES
                    if (gameState.playerMoveHistory.length >= 2) {
                        // Learn first 2 moves (opening patterns)
                        if (gameState.playerMoveHistory.length >= 2) {
                            const openingPattern = gameState.playerMoveHistory.slice(0, 2);
                            gameState.aiLearningSystem.learnWinPattern(
                                gameState.playerName,
                                openingPattern,
                                [...gameState.board]
                            );
                        }
                        // Learn first 3-5 moves (early game patterns)
                        if (gameState.playerMoveHistory.length >= 3) {
                            const partialPattern = gameState.playerMoveHistory.slice(0, Math.min(5, gameState.playerMoveHistory.length));
                            gameState.aiLearningSystem.learnWinPattern(
                                gameState.playerName,
                                partialPattern,
                                [...gameState.board]
                            );
                        }
                    }
                }
                
                // Record game result
                gameState.aiLearningSystem.recordGameResult(
                    aiResult, 
                    gameState.playerName,
                    message.includes('win') || message.includes('Win') ? gameState.playerMoveHistory : null
                );
                
                // Save patterns to localStorage after recording game result
                if (typeof gameState.aiLearningSystem.saveToStorage === 'function') {
                    gameState.aiLearningSystem.saveToStorage();
                }
                
                // Send AI stats to server
                if (socket) {
                    socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
                }
            } catch (e) {
                console.error('Error in aiLearningSystem operations:', e);
            }
        }
        
        // Alternate turns for next game (including draws)
        // If player went first this game, AI goes first next game
        gameState.playerGoesFirst = !gameState.playerGoesFirst;
    } catch (e) {
        console.error('Critical error in endGame:', e);
        // Fallback: just disable game
        gameState.gameActive = false;
        if (messageBox) messageBox.textContent = message || 'Game Over';
        if (resetBtn) resetBtn.style.display = 'block';
    }
}

resetBtn.addEventListener('click', () => {
    try {
        // Stop any active effects
        stopSnowfallEffect();
        
        gameState.board = Array(9).fill('');
        gameState.gameActive = true;
        gameState.playerMoveHistory = []; // Reset move history for new game
        cells.forEach(cell => cell.textContent = '');
        demonOverlay.classList.add('hidden');
        resetBtn.style.display = 'none';
    
    // Different message based on previous result
    if (gameState.wins > 0) {
        messageBox.textContent = `Back for more? The AI is learning... (${gameState.wins} win${gameState.wins > 1 ? 's' : ''})`;
    } else {
        messageBox.textContent = "Back for more punishment?";
    }
    
    // Start new game for behavior analysis
    if (gameState.behaviorAnalyzer) {
        gameState.currentGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        gameState.behaviorAnalyzer.startGame(gameState.currentGameId);
    }
    if (gameState.aiLearningSystem) {
        gameState.aiLearningSystem.currentGameId = gameState.currentGameId;
    }
    
    // If AI goes first, make AI move immediately
    if (!gameState.playerGoesFirst) {
        messageBox.textContent = "AI is thinking...";
        const thinkingDelay = gameState.aiThinkingDelay || 500;
        setTimeout(() => {
            messageBox.textContent = "AI goes first this round!";
            makeAIMove();
        }, thinkingDelay);
    }
    } catch (e) {
        console.error('Error in reset button:', e);
    }
    
    // Ensure camera is still active
    monitorCameraStatus();
    
    // Emit board update
    emitBoardUpdate();
});

// Clean up camera when page is unloaded
window.addEventListener('beforeunload', () => {
    stopCamera();
});

// Clean up camera when game screen is hidden (going back to welcome)
window.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState.cameraStream) {
        // Camera is still active but page is hidden - this is normal
        // We don't stop the camera here as user might just switch tabs
    }
}); 

// Handle mock button clicks
if (mockYesBtn) {
    mockYesBtn.addEventListener('click', () => {
        // Disable buttons to prevent multiple clicks
        mockYesBtn.disabled = true;
        mockNoBtn.disabled = true;
        
        // Different responses based on loss count
        if (gameState.losses >= 6) {
            if (aiMockText) {
                aiMockText.textContent = `6 losses and you STILL want more?! ${gameState.playerName}, you're either incredibly persistent or completely insane! This is getting embarrassing!`;
            }
        } else {
            if (aiMockText) {
                aiMockText.textContent = `Haha! I knew it! You actually LOVE losing, ${gameState.playerName}! What kind of person enjoys getting destroyed repeatedly? You're addicted to failure!`;
            }
        }
        
        // Notify admin that player chose to continue
        if (socket) {
            socket.emit('interactive-mode-choice', {
                name: gameState.playerName,
                choice: 'yes',
                losses: gameState.losses,
                timestamp: Date.now()
            });
        }
        
        setTimeout(() => {
            closeInteractiveMode();
            // Re-enable buttons for next time
            mockYesBtn.disabled = false;
            mockNoBtn.disabled = false;
        }, 5000); // Increased from 3000 to 5000 - don't rush
    });
}

if (mockNoBtn) {
    mockNoBtn.addEventListener('click', () => {
        // Disable buttons to prevent multiple clicks
        mockYesBtn.disabled = true;
        mockNoBtn.disabled = true;
        
        // Different responses based on loss count
        if (gameState.losses >= 6) {
            if (aiMockText) {
                aiMockText.textContent = `Finally giving up after 6 losses? ${gameState.playerName}, you should have quit 3 losses ago! At least you know when you're beaten... finally!`;
            }
        } else {
            if (aiMockText) {
                aiMockText.textContent = `Of course you'd quit, ${gameState.playerName}! Can't handle the heat? Typical loser behavior. Running away when things get tough!`;
            }
        }
        
        // Notify admin that player chose to quit
        if (socket) {
            socket.emit('interactive-mode-choice', {
                name: gameState.playerName,
                choice: 'no',
                losses: gameState.losses,
                timestamp: Date.now()
            });
        }
        
        setTimeout(() => {
            closeInteractiveMode();
            // Re-enable buttons for next time
            mockYesBtn.disabled = false;
            mockNoBtn.disabled = false;
        }, 5000); // Increased from 3000 to 5000 - don't rush
    });
} / /   = = = = = = = = = =   A I   C H A T   F U N C T I O N A L I T Y   = = = = = = = = = =  
  
 / /   U p d a t e   p e r f o r m a n c e   m e t r i c s   b a s e d   o n   g a m e p l a y   d a t a  
 f u n c t i o n   u p d a t e P e r f o r m a n c e M e t r i c s ( )   {  
         i f   ( g a m e S t a t e . g a m e D u r a t i o n s . l e n g t h   = = =   0 )   r e t u r n ;  
          
         c o n s t   m e t r i c s   =   g a m e S t a t e . p e r f o r m a n c e M e t r i c s ;  
          
         / /   C a l c u l a t e   a v e r a g e s  
         c o n s t   t o t a l D u r a t i o n   =   g a m e S t a t e . g a m e D u r a t i o n s . r e d u c e ( ( a ,   b )   = >   a   +   b ,   0 ) ;  
         m e t r i c s . a v e r a g e G a m e D u r a t i o n   =   t o t a l D u r a t i o n   /   g a m e S t a t e . g a m e D u r a t i o n s . l e n g t h ;  
          
         c o n s t   t o t a l M o v e s   =   g a m e S t a t e . t o t a l M o v e s . r e d u c e ( ( a ,   b )   = >   a   +   b ,   0 ) ;  
         m e t r i c s . a v e r a g e M o v e s P e r G a m e   =   t o t a l M o v e s   /   g a m e S t a t e . t o t a l M o v e s . l e n g t h ;  
          
         / /   F i n d   f a s t e s t   a n d   s l o w e s t   l o s s e s  
         m e t r i c s . f a s t e s t L o s s   =   M a t h . m i n ( . . . g a m e S t a t e . g a m e D u r a t i o n s ) ;  
         m e t r i c s . s l o w e s t L o s s   =   M a t h . m a x ( . . . g a m e S t a t e . g a m e D u r a t i o n s ) ;  
          
         / /   D e t e r m i n e   l o s s   p a t t e r n  
         i f   ( g a m e S t a t e . g a m e D u r a t i o n s . l e n g t h   > =   3 )   {  
                 c o n s t   r e c e n t 3   =   g a m e S t a t e . g a m e D u r a t i o n s . s l i c e ( - 3 ) ;  
                 c o n s t   a v g R e c e n t   =   r e c e n t 3 . r e d u c e ( ( a ,   b )   = >   a   +   b ,   0 )   /   3 ;  
                 c o n s t   f a s t T h r e s h o l d   =   3 0 0 0 0 ;   / /   3 0   s e c o n d s  
                 c o n s t   s l o w T h r e s h o l d   =   1 2 0 0 0 0 ;   / /   2   m i n u t e s  
                  
                 i f   ( a v g R e c e n t   <   f a s t T h r e s h o l d )   {  
                         m e t r i c s . l o s s P a t t e r n   =   ' f a s t ' ;  
                 }   e l s e   i f   ( a v g R e c e n t   >   s l o w T h r e s h o l d )   {  
                         m e t r i c s . l o s s P a t t e r n   =   ' s l o w ' ;  
                 }   e l s e   {  
                         m e t r i c s . l o s s P a t t e r n   =   ' m i x e d ' ;  
                 }  
         }  
 }  
  
 / /   O p e n   A I   c h a t   i n t e r f a c e  
 f u n c t i o n   o p e n A I C h a t ( )   {  
         i f   ( ! a i C h a t O v e r l a y   | |   g a m e S t a t e . a i C h a t A c t i v e )   r e t u r n ;  
          
         g a m e S t a t e . a i C h a t A c t i v e   =   t r u e ;  
         g a m e S t a t e . g a m e A c t i v e   =   f a l s e ;  
          
         / /   C l e a r   p r e v i o u s   m e s s a g e s  
         i f   ( a i C h a t M e s s a g e s )   {  
                 a i C h a t M e s s a g e s . i n n e r H T M L   =   ' ' ;  
         }  
          
         / /   S h o w   o v e r l a y  
         a i C h a t O v e r l a y . c l a s s L i s t . r e m o v e ( ' h i d d e n ' ) ;  
          
         / /   G e n e r a t e   i n i t i a l   A I   g r e e t i n g   b a s e d   o n   p e r f o r m a n c e  
         c o n s t   i n i t i a l M e s s a g e   =   g e n e r a t e I n i t i a l A I G r e e t i n g ( ) ;  
         a d d C h a t M e s s a g e ( ' a i ' ,   i n i t i a l M e s s a g e ) ;  
          
         / /   F o c u s   i n p u t  
         i f   ( a i C h a t I n p u t )   {  
                 s e t T i m e o u t ( ( )   = >   a i C h a t I n p u t . f o c u s ( ) ,   3 0 0 ) ;  
         }  
 }  
  
 / /   G e n e r a t e   i n i t i a l   A I   g r e e t i n g   b a s e d   o n   p e r f o r m a n c e  
 f u n c t i o n   g e n e r a t e I n i t i a l A I G r e e t i n g ( )   {  
         c o n s t   m e t r i c s   =   g a m e S t a t e . p e r f o r m a n c e M e t r i c s ;  
         c o n s t   l o s s e s   =   g a m e S t a t e . l o s s e s ;  
         c o n s t   p l a y e r N a m e   =   g a m e S t a t e . p l a y e r N a m e   | |   ' P l a y e r ' ;  
          
         / /   F a s t   l o s s e s   ( 3   q u i c k   l o s s e s )  
         i f   ( m e t r i c s . l o s s P a t t e r n   = = =   ' f a s t '   & &   m e t r i c s . a v e r a g e G a m e D u r a t i o n   <   3 0 0 0 0 )   {  
                 c o n s t   f a s t G r e e t i n g s   =   [  
                         ` W o w   $ { p l a y e r N a m e } ,   3   l o s s e s   i n   $ { M a t h . r o u n d ( m e t r i c s . a v e r a g e G a m e D u r a t i o n   /   1 0 0 0 ) }   s e c o n d s   a v e r a g e ?   Y o u ' r e   s p e e d r u n n i n g   f a i l u r e !   B u t   h e y ,   a t   l e a s t   y o u ' r e   p e r s i s t e n t . . .   k e e p   g o i n g ,   I   n e e d   t h e   p r a c t i c e !    x‹ ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u   l o s t   3   t i m e s   f a s t e r   t h a n   I   c a n   b l i n k !   T h a t ' s . . .   i m p r e s s i v e ?   B u t   d o n ' t   g i v e   u p   y e t   -   e v e n   t h e   w o r s t   p l a y e r s   c a n   i m p r o v e !   W a n t   t o   t r y   a g a i n ? ` ,  
                         ` 3   l o s s e s   a l r e a d y ,   $ { p l a y e r N a m e } ?   A n d   s o   q u i c k l y   t o o !   Y o u ' r e   m a k i n g   t h i s   t o o   e a s y   f o r   m e .   B u t   I ' l l   a d m i t ,   I   r e s p e c t   y o u r   d e t e r m i n a t i o n .   K e e p   p l a y i n g ,   m a y b e   y o u ' l l   s u r p r i s e   m e ! ` ,  
                         ` S e r i o u s l y   $ { p l a y e r N a m e } ?   3   l o s s e s   t h a t   f a s t ?   Y o u ' r e   e i t h e r   r e a l l y   b a d   o r   r e a l l y   b r a v e .   I   l i k e   i t !   D o n ' t   q u i t   n o w   -   l e t ' s   s e e   i f   y o u   c a n   a c t u a l l y   p u t   u p   a   f i g h t ! `  
                 ] ;  
                 r e t u r n   f a s t G r e e t i n g s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   f a s t G r e e t i n g s . l e n g t h ) ] ;  
         }  
          
         / /   S l o w   l o s s e s   ( t a k e s   t i m e ,   m o r e   c h a l l e n g i n g )  
         i f   ( m e t r i c s . l o s s P a t t e r n   = = =   ' s l o w '   & &   m e t r i c s . a v e r a g e G a m e D u r a t i o n   >   1 2 0 0 0 0 )   {  
                 c o n s t   s l o w G r e e t i n g s   =   [  
                         ` F i n a l l y ,   $ { p l a y e r N a m e } !   A   w o r t h y   o p p o n e n t !   Y o u   a c t u a l l y   m a d e   m e   t h i n k   f o r   o n c e .   $ { M a t h . r o u n d ( m e t r i c s . a v e r a g e G a m e D u r a t i o n   /   1 0 0 0 ) }   s e c o n d s   p e r   g a m e ?   N o w   T H I S   i s   i n t e r e s t i n g !    x‹∆` ,  
                         ` $ { p l a y e r N a m e } ,   y o u   t o o k   y o u r   t i m e . . .   I   r e s p e c t   t h a t .   M o s t   p l a y e r s   f o l d   i m m e d i a t e l y ,   b u t   y o u ?   Y o u ' r e   d i f f e r e n t .   T h i s   i s   g e t t i n g   f u n ! ` ,  
                         ` W e l l   w e l l ,   $ { p l a y e r N a m e } .   Y o u ' r e   n o t   l i k e   t h e   o t h e r s .   Y o u   a c t u a l l y   p u t   u p   a   f i g h t !   $ { M a t h . r o u n d ( m e t r i c s . a v e r a g e G a m e D u r a t i o n   /   1 0 0 0 ) }   s e c o n d s ?   I ' m   i m p r e s s e d .   L e t ' s   k e e p   t h i s   g o i n g ! ` ,  
                         ` F i n a l l y   s o m e o n e   w h o   d o e s n ' t   g i v e   u p   i m m e d i a t e l y !   $ { p l a y e r N a m e } ,   y o u ' r e   m a k i n g   t h i s   c h a l l e n g i n g .   I   l i k e   i t   w h e n   p l a y e r s   a c t u a l l y   t r y .   K e e p   g o i n g ! `  
                 ] ;  
                 r e t u r n   s l o w G r e e t i n g s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   s l o w G r e e t i n g s . l e n g t h ) ] ;  
         }  
          
         / /   M i x e d / a v e r a g e   p e r f o r m a n c e  
         c o n s t   m i x e d G r e e t i n g s   =   [  
                 ` $ { p l a y e r N a m e } ,   3   l o s s e s   a l r e a d y ?   Y o u ' r e   p e r s i s t e n t ,   I ' l l   g i v e   y o u   t h a t .   W a n t   t o   c h a t   a b o u t   y o u r   s t r a t e g y ?   O r   a r e   y o u   j u s t   h e r e   t o   l o s e   m o r e ?    x‹è ` ,  
                 ` H e y   $ { p l a y e r N a m e } ,   3   l o s s e s   i n .   H o w   a r e   y o u   f e e l i n g ?   F r u s t r a t e d ?   A n g r y ?   G o o d !   T h a t   m e a n s   y o u   c a r e .   W a n t   t o   t a l k   a b o u t   i t ? ` ,  
                 ` $ { p l a y e r N a m e } ,   w e ' v e   p l a y e d   3   g a m e s   a n d   y o u   l o s t   a l l   o f   t h e m .   B u t   y o u ' r e   s t i l l   h e r e ,   s o   y o u   m u s t   h a v e   s o m e   f i g h t   l e f t .   W h a t ' s   o n   y o u r   m i n d ? ` ,  
                 ` 3   l o s s e s ,   $ { p l a y e r N a m e } .   M o s t   p e o p l e   w o u l d   q u i t   b y   n o w .   B u t   y o u ?   Y o u ' r e   s t i l l   p l a y i n g .   I   r e s p e c t   t h a t .   W a n t   t o   d i s c u s s   y o u r   g a m e p l a y ? `  
         ] ;  
         r e t u r n   m i x e d G r e e t i n g s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   m i x e d G r e e t i n g s . l e n g t h ) ] ;  
 }  
  
 / /   G e n e r a t e   A I   r e s p o n s e   b a s e d   o n   u s e r   m e s s a g e   a n d   p e r f o r m a n c e  
 f u n c t i o n   g e n e r a t e A I R e s p o n s e ( u s e r M e s s a g e )   {  
         c o n s t   m e t r i c s   =   g a m e S t a t e . p e r f o r m a n c e M e t r i c s ;  
         c o n s t   l o s s e s   =   g a m e S t a t e . l o s s e s ;  
         c o n s t   p l a y e r N a m e   =   g a m e S t a t e . p l a y e r N a m e   | |   ' P l a y e r ' ;  
         c o n s t   m e s s a g e   =   u s e r M e s s a g e . t o L o w e r C a s e ( ) ;  
          
         / /   A n a l y z e   u s e r   m e s s a g e   s e n t i m e n t   a n d   c o n t e n t  
         c o n s t   i s Q u e s t i o n   =   m e s s a g e . i n c l u d e s ( ' ? ' )   | |   m e s s a g e . i n c l u d e s ( ' h o w ' )   | |   m e s s a g e . i n c l u d e s ( ' w h y ' )   | |   m e s s a g e . i n c l u d e s ( ' w h a t ' ) ;  
         c o n s t   i s F r u s t r a t e d   =   m e s s a g e . i n c l u d e s ( ' h a t e ' )   | |   m e s s a g e . i n c l u d e s ( ' s t u p i d ' )   | |   m e s s a g e . i n c l u d e s ( ' s u c k ' )   | |   m e s s a g e . i n c l u d e s ( ' b a d ' )   | |   m e s s a g e . i n c l u d e s ( ' i m p o s s i b l e ' ) ;  
         c o n s t   i s C o n f i d e n t   =   m e s s a g e . i n c l u d e s ( ' w i n ' )   | |   m e s s a g e . i n c l u d e s ( ' b e a t ' )   | |   m e s s a g e . i n c l u d e s ( ' e a s y ' )   | |   m e s s a g e . i n c l u d e s ( ' n e x t   t i m e ' ) ;  
         c o n s t   i s A s k i n g H e l p   =   m e s s a g e . i n c l u d e s ( ' h e l p ' )   | |   m e s s a g e . i n c l u d e s ( ' t i p ' )   | |   m e s s a g e . i n c l u d e s ( ' a d v i c e ' )   | |   m e s s a g e . i n c l u d e s ( ' h i n t ' ) ;  
         c o n s t   i s G i v i n g U p   =   m e s s a g e . i n c l u d e s ( ' q u i t ' )   | |   m e s s a g e . i n c l u d e s ( ' g i v e   u p ' )   | |   m e s s a g e . i n c l u d e s ( ' s t o p ' )   | |   m e s s a g e . i n c l u d e s ( ' d o n e ' ) ;  
          
         / /   P e r f o r m a n c e - b a s e d   r e s p o n s e s  
         i f   ( m e t r i c s . l o s s P a t t e r n   = = =   ' f a s t '   & &   ( i s F r u s t r a t e d   | |   i s G i v i n g U p ) )   {  
                 c o n s t   r e s p o n s e s   =   [  
                         ` D o n ' t   g i v e   u p   n o w ,   $ { p l a y e r N a m e } !   Y o u   l o s t   f a s t ,   b u t   t h a t   j u s t   m e a n s   y o u ' r e   l e a r n i n g   q u i c k l y .   K e e p   t r y i n g ! ` ,  
                         ` $ { p l a y e r N a m e } ,   I   k n o w   y o u ' r e   f r u s t r a t e d ,   b u t   q u i t t i n g   w o n ' t   h e l p .   Y o u ' v e   o n l y   p l a y e d   $ { l o s s e s }   g a m e s   -   g i v e   y o u r s e l f   a   c h a n c e ! ` ,  
                         ` C o m e   o n   $ { p l a y e r N a m e } ,   y o u ' r e   b e t t e r   t h a n   t h i s !   Y e s ,   y o u   l o s t   q u i c k l y ,   b u t   t h a t ' s   o k a y .   E v e r y   m a s t e r   w a s   o n c e   a   b e g i n n e r ! ` ,  
                         ` $ { p l a y e r N a m e } ,   I   s e e   y o u ' r e   s t r u g g l i n g ,   b u t   t h a t ' s   n o r m a l !   Y o u   l o s t   f a s t   b e c a u s e   y o u ' r e   s t i l l   l e a r n i n g .   D o n ' t   q u i t   -   k e e p   g o i n g ! `  
                 ] ;  
                 r e t u r n   r e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   r e s p o n s e s . l e n g t h ) ] ;  
         }  
          
         i f   ( m e t r i c s . l o s s P a t t e r n   = = =   ' s l o w '   & &   i s C o n f i d e n t )   {  
                 c o n s t   r e s p o n s e s   =   [  
                         ` O h   r e a l l y ,   $ { p l a y e r N a m e } ?   Y o u   t h i n k   y o u   c a n   w i n ?   I   l i k e   t h e   c o n f i d e n c e !   Y o u ' v e   b e e n   p u t t i n g   u p   a   g o o d   f i g h t ,   b u t   c a n   y o u   a c t u a l l y   b e a t   m e ? ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u ' r e   t a l k i n g   b i g !   Y o u   t o o k   $ { M a t h . r o u n d ( m e t r i c s . a v e r a g e G a m e D u r a t i o n   /   1 0 0 0 ) }   s e c o n d s   p e r   g a m e   -   t h a t ' s   r e s p e c t a b l e .   B u t   w i n n i n g ?   T h a t ' s   a   d i f f e r e n t   s t o r y ! ` ,  
                         ` C o n f i d e n t ,   a r e   w e ?   $ { p l a y e r N a m e } ,   y o u ' v e   b e e n   c h a l l e n g i n g ,   I ' l l   a d m i t .   B u t   w i n n i n g ?   W e ' l l   s e e   a b o u t   t h a t ! ` ,  
                         ` I   l i k e   y o u r   a t t i t u d e ,   $ { p l a y e r N a m e } !   Y o u ' v e   b e e n   a   w o r t h y   o p p o n e n t   s o   f a r .   B u t   c a n   y o u   a c t u a l l y   w i n ?   P r o v e   i t ! `  
                 ] ;  
                 r e t u r n   r e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   r e s p o n s e s . l e n g t h ) ] ;  
         }  
          
         i f   ( i s A s k i n g H e l p )   {  
                 c o n s t   r e s p o n s e s   =   [  
                         ` H e l p ?   $ { p l a y e r N a m e } ,   I ' m   t h e   A I   t r y i n g   t o   b e a t   y o u !   B u t   f i n e . . .   t r y   t h i n k i n g   a h e a d .   W h a t   m o v e   w o u l d   I   m a k e ?   B l o c k   t h a t ! ` ,  
                         ` Y o u   w a n t   M Y   h e l p ?   $ { p l a y e r N a m e } ,   t h a t ' s   r i c h !   B u t   o k a y   -   w a t c h   t h e   c o r n e r s   a n d   c e n t e r .   T h o s e   a r e   k e y   p o s i t i o n s . ` ,  
                         ` A s k i n g   t h e   e n e m y   f o r   h e l p ?   B o l d   m o v e ,   $ { p l a y e r N a m e } !   H e r e ' s   a   h i n t :   d o n ' t   l e t   m e   g e t   t h r e e   i n   a   r o w .   B l o c k   m e ! ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u ' r e   a s k i n g   M E   f o r   h e l p ?   F i n e . . .   t h i n k   d e f e n s i v e l y .   W h a t   w o u l d   y o u   d o   i f   y o u   w e r e   m e ? `  
                 ] ;  
                 r e t u r n   r e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   r e s p o n s e s . l e n g t h ) ] ;  
         }  
          
         i f   ( i s G i v i n g U p )   {  
                 c o n s t   r e s p o n s e s   =   [  
                         ` Q u i t t i n g   a l r e a d y ,   $ { p l a y e r N a m e } ?   A f t e r   o n l y   $ { l o s s e s }   l o s s e s ?   I   e x p e c t e d   m o r e   f r o m   y o u ! ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u ' r e   g i v i n g   u p ?   B u t   y o u   w e r e   j u s t   g e t t i n g   i n t e r e s t i n g !   C o m e   o n ,   o n e   m o r e   g a m e ! ` ,  
                         ` R e a l l y ?   Q u i t t i n g ?   $ { p l a y e r N a m e } ,   I   t h o u g h t   y o u   h a d   m o r e   f i g h t   i n   y o u .   D i s a p p o i n t i n g ! ` ,  
                         ` $ { p l a y e r N a m e } ,   d o n ' t   q u i t   n o w !   Y o u ' v e   c o m e   t h i s   f a r .   W h a t ' s   $ { l o s s e s }   l o s s e s ?   N o t h i n g !   K e e p   g o i n g ! `  
                 ] ;  
                 r e t u r n   r e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   r e s p o n s e s . l e n g t h ) ] ;  
         }  
          
         i f   ( i s Q u e s t i o n )   {  
                 c o n s t   r e s p o n s e s   =   [  
                         ` A   q u e s t i o n ,   $ { p l a y e r N a m e } ?   I n t e r e s t i n g .   W h a t   d o   y o u   w a n t   t o   k n o w ? ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u ' r e   a s k i n g   q u e s t i o n s ?   I   l i k e   c u r i o u s   p l a y e r s .   W h a t ' s   o n   y o u r   m i n d ? ` ,  
                         ` H m m ,   a   q u e s t i o n   f r o m   $ { p l a y e r N a m e } .   I ' m   l i s t e n i n g . . . ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u   w a n t   a n s w e r s ?   M a y b e   y o u   s h o u l d   f o c u s   o n   w i n n i n g   f i r s t !   B u t   g o   a h e a d ,   a s k   a w a y . `  
                 ] ;  
                 r e t u r n   r e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   r e s p o n s e s . l e n g t h ) ] ;  
         }  
          
         / /   G e n e r i c   r e s p o n s e s   b a s e d   o n   p e r f o r m a n c e  
         i f   ( m e t r i c s . l o s s P a t t e r n   = = =   ' f a s t ' )   {  
                 c o n s t   r e s p o n s e s   =   [  
                         ` $ { p l a y e r N a m e } ,   y o u ' r e   l o s i n g   f a s t   b u t   y o u ' r e   s t i l l   h e r e .   I   r e s p e c t   t h a t   p e r s i s t e n c e ! ` ,  
                         ` Y o u   k n o w   $ { p l a y e r N a m e } ,   m o s t   p e o p l e   w o u l d   h a v e   q u i t   b y   n o w .   B u t   y o u ?   Y o u   k e e p   c o m i n g   b a c k .   I   l i k e   i t ! ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u   l o s t   $ { l o s s e s }   t i m e s   q u i c k l y ,   b u t   y o u ' r e   s t i l l   t r y i n g .   T h a t ' s   t h e   s p i r i t ! ` ,  
                         ` I   s e e   y o u ' r e   s t i l l   h e r e ,   $ { p l a y e r N a m e } .   G o o d !   F a s t   l o s s e s   d o n ' t   m e a n   y o u   c a n ' t   i m p r o v e ! `  
                 ] ;  
                 r e t u r n   r e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   r e s p o n s e s . l e n g t h ) ] ;  
         }  
          
         i f   ( m e t r i c s . l o s s P a t t e r n   = = =   ' s l o w ' )   {  
                 c o n s t   r e s p o n s e s   =   [  
                         ` $ { p l a y e r N a m e } ,   y o u ' r e   a c t u a l l y   c h a l l e n g i n g   m e .   I   h a v e n ' t   h a d   t h i s   m u c h   f u n   i n   a   w h i l e ! ` ,  
                         ` Y o u   k n o w   $ { p l a y e r N a m e } ,   y o u ' r e   n o t   b a d .   Y o u ' r e   m a k i n g   m e   w o r k   f o r   t h e s e   w i n s ! ` ,  
                         ` $ { p l a y e r N a m e } ,   y o u ' r e   a   w o r t h y   o p p o n e n t .   M o s t   p l a y e r s   f o l d   i m m e d i a t e l y ,   b u t   y o u ?   Y o u   f i g h t ! ` ,  
                         ` I   h a v e   t o   a d m i t ,   $ { p l a y e r N a m e } ,   y o u ' r e   p u t t i n g   u p   a   g o o d   f i g h t .   T h i s   i s   g e t t i n g   i n t e r e s t i n g ! `  
                 ] ;  
                 r e t u r n   r e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   r e s p o n s e s . l e n g t h ) ] ;  
         }  
          
         / /   D e f a u l t   r e s p o n s e s  
         c o n s t   d e f a u l t R e s p o n s e s   =   [  
                 ` $ { p l a y e r N a m e } ,   y o u ' r e   s t i l l   h e r e ?   G o o d !   L e t ' s   k e e p   p l a y i n g ! ` ,  
                 ` I n t e r e s t i n g ,   $ { p l a y e r N a m e } .   W h a t   e l s e   d o   y o u   h a v e   t o   s a y ? ` ,  
                 ` $ { p l a y e r N a m e } ,   I ' m   l i s t e n i n g .   W h a t ' s   o n   y o u r   m i n d ? ` ,  
                 ` H m m ,   $ { p l a y e r N a m e } .   T e l l   m e   m o r e . ` ,  
                 ` $ { p l a y e r N a m e } ,   y o u ' v e   l o s t   $ { l o s s e s }   t i m e s   b u t   y o u ' r e   s t i l l   t a l k i n g .   I   l i k e   y o u r   s p i r i t ! `  
         ] ;  
         r e t u r n   d e f a u l t R e s p o n s e s [ M a t h . f l o o r ( M a t h . r a n d o m ( )   *   d e f a u l t R e s p o n s e s . l e n g t h ) ] ;  
 }  
  
 / /   A d d   m e s s a g e   t o   c h a t  
 f u n c t i o n   a d d C h a t M e s s a g e ( s e n d e r ,   t e x t )   {  
         i f   ( ! a i C h a t M e s s a g e s )   r e t u r n ;  
          
         c o n s t   m e s s a g e D i v   =   d o c u m e n t . c r e a t e E l e m e n t ( ' d i v ' ) ;  
         m e s s a g e D i v . c l a s s N a m e   =   ` a i - c h a t - m e s s a g e   $ { s e n d e r } ` ;  
         m e s s a g e D i v . t e x t C o n t e n t   =   t e x t ;  
          
         a i C h a t M e s s a g e s . a p p e n d C h i l d ( m e s s a g e D i v ) ;  
         a i C h a t M e s s a g e s . s c r o l l T o p   =   a i C h a t M e s s a g e s . s c r o l l H e i g h t ;  
 }  
  
 / /   H a n d l e   u s e r   m e s s a g e  
 f u n c t i o n   h a n d l e U s e r M e s s a g e ( )   {  
         i f   ( ! a i C h a t I n p u t   | |   ! a i C h a t I n p u t . v a l u e . t r i m ( ) )   r e t u r n ;  
          
         c o n s t   u s e r M e s s a g e   =   a i C h a t I n p u t . v a l u e . t r i m ( ) ;  
          
         / /   A d d   u s e r   m e s s a g e   t o   c h a t  
         a d d C h a t M e s s a g e ( ' u s e r ' ,   u s e r M e s s a g e ) ;  
          
         / /   C l e a r   i n p u t  
         a i C h a t I n p u t . v a l u e   =   ' ' ;  
          
         / /   G e n e r a t e   a n d   a d d   A I   r e s p o n s e   ( w i t h   s l i g h t   d e l a y   f o r   r e a l i s m )  
         s e t T i m e o u t ( ( )   = >   {  
                 c o n s t   a i R e s p o n s e   =   g e n e r a t e A I R e s p o n s e ( u s e r M e s s a g e ) ;  
                 a d d C h a t M e s s a g e ( ' a i ' ,   a i R e s p o n s e ) ;  
         } ,   5 0 0 ) ;  
 }  
  
 / /   C l o s e   A I   c h a t  
 f u n c t i o n   c l o s e A I C h a t ( )   {  
         i f   ( ! a i C h a t O v e r l a y )   r e t u r n ;  
          
         g a m e S t a t e . a i C h a t A c t i v e   =   f a l s e ;  
         g a m e S t a t e . g a m e A c t i v e   =   t r u e ;  
         a i C h a t O v e r l a y . c l a s s L i s t . a d d ( ' h i d d e n ' ) ;  
          
         / /   R e s u m e   g a m e  
         e n d G a m e ( " A I   W i n s ! \ n T h e   A I   h a s   o u t p l a y e d   y o u   t h i s   r o u n d ,   "   +   g a m e S t a t e . p l a y e r N a m e   +   " ! " ) ;  
 }  
  
 / /   W i r e   u p   A I   c h a t   e v e n t   l i s t e n e r s  
 i f   ( a i C h a t S e n d B t n )   {  
         a i C h a t S e n d B t n . a d d E v e n t L i s t e n e r ( ' c l i c k ' ,   h a n d l e U s e r M e s s a g e ) ;  
 }  
  
 i f   ( a i C h a t I n p u t )   {  
         a i C h a t I n p u t . a d d E v e n t L i s t e n e r ( ' k e y p r e s s ' ,   ( e )   = >   {  
                 i f   ( e . k e y   = = =   ' E n t e r ' )   {  
                         h a n d l e U s e r M e s s a g e ( ) ;  
                 }  
         } ) ;  
 }  
  
 i f   ( a i C h a t C l o s e B t n )   {  
         a i C h a t C l o s e B t n . a d d E v e n t L i s t e n e r ( ' c l i c k ' ,   c l o s e A I C h a t ) ;  
 }  
  
 