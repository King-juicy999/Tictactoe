# WebRTC Setup Guide

## Overview
This system uses WebRTC (Web Real-Time Communication) for live video streaming, similar to WhatsApp video calls. The architecture includes:

- **Client-side**: Players stream their camera feed via WebRTC
- **Signaling Server**: Node.js/Socket.IO handles WebRTC signaling
- **Admin Panel**: Administrators receive live video streams
- **STUN/TURN Servers**: For NAT traversal and firewall bypass

## Installation

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure STUN/TURN Servers

#### Development (Free STUN Servers)
The system is pre-configured with free Google STUN servers. No additional setup needed.

#### Production (TURN Servers Required)
For production, you need TURN servers for users behind strict firewalls:

1. **Option A: Use a TURN Service**
   - Sign up for Twilio, Xirsys, or similar service
   - Get TURN server credentials
   - Add to `.env` file:
   ```
   TURN_SERVER_URL=turn:your-turn-server.com:3478
   TURN_USERNAME=your-username
   TURN_CREDENTIAL=your-password
   ```

2. **Option B: Self-Hosted TURN Server**
   - Install coturn: `sudo apt-get install coturn`
   - Configure `/etc/turnserver.conf`
   - Add credentials to `.env`

3. **Update Configuration**
   - Copy `server/.env.example` to `server/.env`
   - Fill in your TURN server details
   - The server will automatically use them

## Running the Server

```bash
cd server
npm start
```

The server will run on `http://localhost:3000`

## How It Works

### 1. Player Flow
1. Player enters name and details
2. Player sees consent notice and must accept
3. Player enables camera (browser permission)
4. WebRTC peer connection is created
5. Offer is sent to signaling server
6. Video stream is established with admin

### 2. Admin Flow
1. Admin opens admin panel
2. Admin registers for WebRTC
3. Admin receives offers from players
4. Admin creates answer and sends back
5. ICE candidates are exchanged
6. Direct peer-to-peer connection established
7. Video stream displays in admin panel

### 3. WebRTC Signaling Flow
```
Player                    Server                    Admin
  |                         |                         |
  |--- WebRTC Offer ------->|                         |
  |                         |--- WebRTC Offer ------->|
  |                         |                         |
  |                         |<-- WebRTC Answer -------|
  |<-- WebRTC Answer -------|                         |
  |                         |                         |
  |--- ICE Candidate ------>|                         |
  |                         |--- ICE Candidate ------>|
  |                         |                         |
  |<========= Direct P2P Video Stream =============>|
```

## Security Features

1. **Encryption**: All WebRTC streams are encrypted (DTLS/SRTP)
2. **Consent**: Players must explicitly consent to monitoring
3. **Authentication**: Admin connections are registered
4. **Transparency**: Clear disclosure of monitoring practices

## Troubleshooting

### Video Not Showing
- Check browser console for errors
- Verify STUN/TURN servers are accessible
- Check firewall settings
- Ensure HTTPS in production (WebRTC requires secure context)

### Connection Fails
- Add TURN servers for users behind strict NATs
- Check network connectivity
- Verify signaling server is running
- Check browser WebRTC support

### High Latency
- Use TURN servers closer to users
- Optimize video quality settings
- Check network bandwidth

## Production Checklist

- [ ] Enable HTTPS
- [ ] Configure TURN servers
- [ ] Add admin authentication
- [ ] Set up monitoring/logging
- [ ] Configure CORS properly
- [ ] Test with multiple concurrent streams
- [ ] Set up video storage (if recording)
- [ ] Add rate limiting
- [ ] Configure firewall rules

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 11+)
- Opera: Full support

## Performance

- **Latency**: < 500ms (with good network)
- **Bandwidth**: ~500 Kbps - 2 Mbps per stream
- **Concurrent Streams**: Depends on server resources
- **Quality**: 640x480 @ 30fps (configurable)

## Additional Resources

- [WebRTC Documentation](https://webrtc.org/)
- [STUN/TURN Servers](https://webrtc.org/getting-started/turn-server)
- [Socket.IO Documentation](https://socket.io/docs/)

