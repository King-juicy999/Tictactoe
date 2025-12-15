// WebRTC Configuration - STUN/TURN Servers
// This file contains the STUN/TURN server configuration for WebRTC connections

// Free STUN servers (Google's public STUN servers)
const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Additional free STUN servers
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' }
];

// TURN servers (for production - requires paid service or self-hosted)
// Examples: Twilio, Xirsys, or self-hosted coturn
// For production, set these via environment variables:
// TURN_SERVER_URL, TURN_USERNAME, TURN_CREDENTIAL
const getTURNServers = () => {
    const turnServers = [];
    
    // Check for environment variables (production)
    if (process.env.TURN_SERVER_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
        turnServers.push({
            urls: process.env.TURN_SERVER_URL,
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_CREDENTIAL
        });
    }
    
    // Add free TURN servers (limited availability)
    // Note: These may have rate limits
    if (process.env.USE_FREE_TURN === 'true') {
        // Example free TURN (replace with actual free TURN service)
        // turnServers.push({
        //     urls: 'turn:free-turn-server.com:3478',
        //     username: 'user',
        //     credential: 'pass'
        // });
    }
    
    return turnServers;
};

// Complete RTC configuration
const getRTCConfiguration = () => {
    return {
        iceServers: [
            ...STUN_SERVERS,
            ...getTURNServers()
        ],
        iceCandidatePoolSize: 10, // Pre-gather ICE candidates
        bundlePolicy: 'max-bundle', // Bundle RTP and RTCP
        rtcpMuxPolicy: 'require' // Require RTCP muxing
    };
};

// Client-side configuration (for browser)
const getClientRTCConfiguration = () => {
    // Same configuration but formatted for browser
    const config = {
        iceServers: [
            ...STUN_SERVERS.map(s => ({ urls: s.urls })),
            ...getTURNServers().map(t => ({
                urls: t.urls,
                username: t.username,
                credential: t.credential
            }))
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
    };
    
    return config;
};

module.exports = {
    STUN_SERVERS,
    getTURNServers,
    getRTCConfiguration,
    getClientRTCConfiguration
};

