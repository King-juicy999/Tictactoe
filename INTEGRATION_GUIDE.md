# Integration Guide: AI Behavior Analysis System

## Quick Start

### 1. Client-Side Integration (JavaScript)

The `BehaviorAnalyzer` class is already integrated into `script.js`. It automatically:
- Records all moves with timing
- Tracks board states
- Sends data to server after each game
- Tracks wins and losses

### 2. Server-Side Setup (Django)

1. **Create Django app:**
```bash
python manage.py startapp behavior_analysis
```

2. **Add models** (copy from `server/ai_models.py`)

3. **Add URLs** (copy from `server/urls.py`)

4. **Run migrations:**
```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Node.js Server Integration

The Node.js server already forwards behavior data. In production, configure it to POST to Django:

```javascript
// In server.js, update behavior-data handler:
socket.on('behavior-data', async (payload) => {
    try {
        await fetch('http://localhost:8000/api/behavior/record-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error forwarding to Django:', error);
    }
});
```

## Features

✅ **Win Tracking**: Wins are now tracked and displayed
✅ **Behavior Analysis**: All moves are analyzed
✅ **Pattern Recognition**: Player patterns are identified
✅ **Adaptive Difficulty**: AI adjusts based on player skill
✅ **Anomaly Detection**: Suspicious behavior is flagged
✅ **Leaderboard**: Players ranked by wins

## API Endpoints

- `POST /api/behavior/record-game` - Record completed game
- `GET /api/behavior/profile/{player_name}` - Get player profile
- `POST /api/behavior/predict-move` - Predict next move
- `GET /api/behavior/difficulty/{player_name}` - Get adaptive difficulty
- `POST /api/behavior/check-anomalies` - Check for anomalies
- `GET /api/behavior/leaderboard` - Get leaderboard

## Data Privacy

✅ Only gameplay behavior is analyzed
❌ No personal data collected
❌ No facial recognition
❌ No identity analysis

