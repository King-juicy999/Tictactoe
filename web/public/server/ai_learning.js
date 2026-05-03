// AI Learning and Adaptation System
// Tracks AI moves, learns from games, prevents repeated win patterns

class AILearningSystem {
    constructor() {
        this.aiStats = {
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            winRate: 0
        };
        this.moveHistory = [];
        this.learnedPatterns = {}; // Player win patterns that AI has learned to block
        this.blockedWinPatterns = new Set(); // Patterns AI has successfully blocked
        this.adaptationLevel = 0; // How well AI adapts (0-100)
        this.serverStats = null; // Snapshot of stats coming from server/data.json
        this.lastServerSync = 0;
        this.lastLosingMoveIndex = null; // Track last move that appeared in a losing game
        
        // Load persistent data from localStorage
        this.loadFromStorage();

        // Also try to hydrate from server-side database in real time when running in browser
        // This lets the AI use historical outcomes stored in data.json (via /api/ai/stats)
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            // Fire and forget – no need to block constructor
            this.syncWithServer().catch(err => {
                console.error('Error syncing AI learning data from server:', err);
            });
        }
    }

    // Merge stats from server-side DB (data.json) into local stats
    async syncWithServer() {
        try {
            const now = Date.now();
            // Avoid hammering the server – at most once every 2s from any caller,
            // but still keep data.json effectively "live" for decision making.
            if (this.lastServerSync && now - this.lastServerSync < 2000) return;

            const res = await fetch('/api/ai/stats', { cache: 'no-store' });
            if (!res.ok) return;

            const payload = await res.json();
            if (!payload || !payload.ok || !payload.stats) return;

            this.serverStats = payload.stats;
            this.lastServerSync = now;

            // Carefully merge counts – prefer the highest values so we never "forget" history
            const s = this.serverStats;
            if (typeof s.wins === 'number')   this.aiStats.wins   = Math.max(this.aiStats.wins,   s.wins);
            if (typeof s.losses === 'number') this.aiStats.losses = Math.max(this.aiStats.losses, s.losses);
            if (typeof s.draws === 'number')  this.aiStats.draws  = Math.max(this.aiStats.draws,  s.draws);

            const totalFromCounts = this.aiStats.wins + this.aiStats.losses + this.aiStats.draws;
            const totalFromServer = typeof s.totalGames === 'number' ? s.totalGames : 0;
            this.aiStats.totalGames = Math.max(this.aiStats.totalGames, totalFromCounts, totalFromServer);

            // Merge long-term learned patterns from the shared database into the
            // in-memory pattern map so the AI can counter strategies across
            // multiple sessions and not just the current browser's history.
            if (s.patternsData && typeof s.patternsData === 'object') {
                for (const [patternKey, pdata] of Object.entries(s.patternsData)) {
                    if (!this.learnedPatterns[patternKey]) {
                        this.learnedPatterns[patternKey] = {
                            count: 0,
                            players: new Set(),
                            lastSeen: Date.now(),
                            firstSeen: Date.now(),
                            boardStates: []
                        };
                    }
                    const lp = this.learnedPatterns[patternKey];
                    if (typeof pdata.count === 'number') {
                        lp.count = Math.max(lp.count, pdata.count);
                    }
                    if (Array.isArray(pdata.players)) {
                        pdata.players.forEach(p => lp.players.add(p));
                    }
                    if (pdata.lastSeen) {
                        lp.lastSeen = Math.max(lp.lastSeen, pdata.lastSeen);
                    }
                    if (pdata.firstSeen) {
                        lp.firstSeen = Math.min(lp.firstSeen, pdata.firstSeen);
                    }
                }
            }

            // Recompute win rate and adaptation level with merged data
            this.aiStats.winRate = this.aiStats.totalGames > 0
                ? (this.aiStats.wins / this.aiStats.totalGames) * 100
                : 0;
            this.adaptationLevel = this.calculateAdaptationLevel();

            console.log('AI learning data hydrated from server stats (data.json)');
        } catch (error) {
            console.error('Error loading AI learning data from server:', error);
        }
    }
    
    // Save patterns and stats to localStorage
    saveToStorage() {
        try {
            const storageData = {
                learnedPatterns: {},
                blockedWinPatterns: Array.from(this.blockedWinPatterns),
                aiStats: { ...this.aiStats },
                lastSaved: Date.now()
            };
            
            // Convert learned patterns to serializable format
            for (const [patternKey, patternData] of Object.entries(this.learnedPatterns)) {
                storageData.learnedPatterns[patternKey] = {
                    count: patternData.count,
                    players: Array.from(patternData.players), // Convert Set to Array
                    lastSeen: patternData.lastSeen,
                    firstSeen: patternData.firstSeen
                    // Don't store boardStates to save space
                };
            }
            
            localStorage.setItem('ai_learning_data', JSON.stringify(storageData));
            console.log('AI learning data saved to localStorage');
        } catch (error) {
            console.error('Error saving AI learning data:', error);
        }
    }
    
    // Load patterns and stats from localStorage
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('ai_learning_data');
            if (!stored) {
                console.log('No stored AI learning data found');
                return;
            }
            
            const storageData = JSON.parse(stored);
            
            // Restore learned patterns
            if (storageData.learnedPatterns) {
                for (const [patternKey, patternData] of Object.entries(storageData.learnedPatterns)) {
                    this.learnedPatterns[patternKey] = {
                        count: patternData.count,
                        players: new Set(patternData.players), // Convert Array back to Set
                        lastSeen: patternData.lastSeen,
                        firstSeen: patternData.firstSeen,
                        boardStates: [] // Start fresh for board states
                    };
                }
                console.log(`Loaded ${Object.keys(this.learnedPatterns).length} learned patterns from storage`);
            }
            
            // Restore blocked patterns
            if (storageData.blockedWinPatterns && Array.isArray(storageData.blockedWinPatterns)) {
                this.blockedWinPatterns = new Set(storageData.blockedWinPatterns);
                console.log(`Loaded ${this.blockedWinPatterns.size} blocked patterns from storage`);
            }
            
            // Restore AI stats (optional - you might want to reset stats on refresh)
            // Uncomment if you want stats to persist:
            // if (storageData.aiStats) {
            //     this.aiStats = { ...this.aiStats, ...storageData.aiStats };
            // }
            
            // Recalculate adaptation level
            this.adaptationLevel = this.calculateAdaptationLevel();
            
            console.log('AI learning data loaded from localStorage');
        } catch (error) {
            console.error('Error loading AI learning data:', error);
        }
    }

    // Record AI move
    recordAIMove(moveIndex, boardState, moveType, reasoning) {
        const move = {
            timestamp: Date.now(),
            moveIndex: moveIndex,
            boardState: [...boardState],
            moveType: moveType, // 'win', 'block', 'fork', 'defensive', 'offensive'
            reasoning: reasoning,
            gameId: this.currentGameId || null
        };
        
        this.moveHistory.push(move);
        
        // Keep only last 1000 moves
        if (this.moveHistory.length > 1000) {
            this.moveHistory.shift();
        }
        
        return move;
    }

    // Record game result
    recordGameResult(result, playerName, winPattern = null) {
        this.aiStats.totalGames++;
        
        if (result === 'win') {
            this.aiStats.wins++;
            console.log(`AI won game ${this.aiStats.totalGames}. Total wins: ${this.aiStats.wins}`);
        } else if (result === 'loss') {
            this.aiStats.losses++;

            // Remember the last AI move index that appeared in this losing game.
            // This will be used by the move selector to avoid repeating losing moves
            // twice in a row when there is any alternative.
            if (this.moveHistory.length > 0) {
                const lastMove = this.moveHistory[this.moveHistory.length - 1];
                if (lastMove && typeof lastMove.moveIndex === 'number') {
                    this.lastLosingMoveIndex = lastMove.moveIndex;
                }
            }

            // Learn from player's win pattern
            if (winPattern && Array.isArray(winPattern) && winPattern.length > 0) {
                this.learnWinPattern(playerName, winPattern);
            }
            console.log(`AI lost game ${this.aiStats.totalGames}. Total losses: ${this.aiStats.losses}`);
        } else {
            this.aiStats.draws++;
            console.log(`AI drew game ${this.aiStats.totalGames}. Total draws: ${this.aiStats.draws}`);
        }
        
        this.aiStats.winRate = this.aiStats.totalGames > 0 
            ? (this.aiStats.wins / this.aiStats.totalGames) * 100 
            : 0;
        
        this.adaptationLevel = this.calculateAdaptationLevel();
        
        console.log(`AI Stats: ${this.aiStats.wins}W/${this.aiStats.losses}L/${this.aiStats.draws}D - Win Rate: ${this.aiStats.winRate.toFixed(1)}% - Adaptation: ${this.adaptationLevel}%`);
    }

    // Learn from player win pattern (enhanced with full context)
    learnWinPattern(playerName, winPattern, boardState = null) {
        // winPattern is the sequence of moves that led to player win
        const patternKey = winPattern.join('-');
        
        if (!this.learnedPatterns[patternKey]) {
            this.learnedPatterns[patternKey] = {
                count: 0,
                players: new Set(),
                lastSeen: Date.now(),
                firstSeen: Date.now(),
                boardStates: [] // Store board states when pattern was used
            };
        }
        
        this.learnedPatterns[patternKey].count++;
        this.learnedPatterns[patternKey].players.add(playerName);
        this.learnedPatterns[patternKey].lastSeen = Date.now();
        
        // Store board state context if provided
        if (boardState && Array.isArray(boardState)) {
            this.learnedPatterns[patternKey].boardStates.push([...boardState]);
            // Keep only last 10 board states to avoid memory bloat
            if (this.learnedPatterns[patternKey].boardStates.length > 10) {
                this.learnedPatterns[patternKey].boardStates.shift();
            }
        }
        
        console.log(`AI learned win pattern: ${patternKey} (seen ${this.learnedPatterns[patternKey].count} times by ${this.learnedPatterns[patternKey].players.size} players)`);
        
        // Save to localStorage after learning a pattern
        this.saveToStorage();
    }

    // Check if current board matches a learned win pattern (enhanced validation)
    shouldBlockPattern(boardState, moveHistory) {
        // Check if player is following a known win pattern
        for (const [patternKey, patternData] of Object.entries(this.learnedPatterns)) {
            const patternMoves = patternKey.split('-').map(Number);
            
            // Validate pattern is still possible given current board state
            if (!this.isPatternStillPossible(boardState, patternMoves, moveHistory)) {
                continue; // Skip this pattern - it's no longer possible
            }
            
            // Check if current moves match pattern (can be partial match) - FASTER: check even with 1 move
            if (moveHistory.length > 0 && moveHistory.length <= patternMoves.length) {
                // Check if player is following this pattern exactly (even partial matches)
                const matches = moveHistory.every((move, idx) => 
                    idx < patternMoves.length && move === patternMoves[idx]
                );
                
                // Block earlier - even if pattern is just starting (faster learning)
                if (matches && moveHistory.length < patternMoves.length) {
                    // Player is following known win pattern - block the next move!
                    const nextMove = patternMoves[moveHistory.length];
                    if (nextMove !== null && nextMove !== undefined && boardState[nextMove] === '') {
                        // Validate next move is still available
                        // Higher confidence for patterns seen more times, but block even on first sight
                        return {
                            shouldBlock: true,
                            pattern: patternKey,
                            nextExpectedMove: nextMove,
                            confidence: Math.max(patternData.count, 1) // Minimum confidence of 1 for faster blocking
                        };
                    }
                }
            }
            
            // Also check for complete pattern match (player might be repeating)
            if (moveHistory.length >= patternMoves.length) {
                const recentMoves = moveHistory.slice(-patternMoves.length);
                const matches = patternMoves.every((move, idx) => recentMoves[idx] === move);
                
                if (matches) {
                    // Player completed the pattern - check if they're trying to repeat it
                    return {
                        shouldBlock: true,
                        pattern: patternKey,
                        nextExpectedMove: null, // Pattern already completed
                        confidence: patternData.count
                    };
                }
            }
        }
        
        return { shouldBlock: false };
    }
    
    // Validate if a pattern is still possible given current board state
    isPatternStillPossible(boardState, patternMoves, moveHistory) {
        // Check if all moves in the pattern that have been made are still valid
        for (let i = 0; i < Math.min(moveHistory.length, patternMoves.length); i++) {
            const patternMove = patternMoves[i];
            const actualMove = moveHistory[i];
            
            // If pattern move doesn't match actual move, pattern is not being followed
            if (patternMove !== actualMove) {
                return false;
            }
            
            // Check if the cell is still available (not blocked by AI)
            if (i < moveHistory.length && boardState[patternMove] !== 'X') {
                // Pattern cell is blocked or occupied by AI - pattern no longer possible
                return false;
            }
        }
        
        // Check if future pattern moves are still possible
        for (let i = moveHistory.length; i < patternMoves.length; i++) {
            const futureMove = patternMoves[i];
            if (boardState[futureMove] !== '') {
                // Future pattern move is blocked - pattern no longer possible
                return false;
            }
        }
        
        return true;
    }

    // Calculate adaptation level (0-100)
    calculateAdaptationLevel() {
        const totalPatterns = Object.keys(this.learnedPatterns).length;
        const blockedPatterns = this.blockedWinPatterns.size;
        const winRate = this.aiStats.winRate;
        
        // Adaptation based on:
        // - Number of patterns learned
        // - Successfully blocked patterns
        // - Win rate
        const patternScore = Math.min(totalPatterns * 10, 40);
        const blockScore = Math.min(blockedPatterns * 5, 30);
        const winRateScore = winRate * 0.3;
        
        return Math.min(Math.round(patternScore + blockScore + winRateScore), 100);
    }

    // Get AI stats for display
    getStats() {
        // Optionally refresh from server if stale when stats are requested
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            this.syncWithServer().catch(() => {});
        }

        // Convert learned patterns to serializable format
        const patternsData = {};
        for (const [patternKey, patternData] of Object.entries(this.learnedPatterns)) {
            patternsData[patternKey] = {
                count: patternData.count,
                players: Array.from(patternData.players), // Convert Set to Array
                lastSeen: patternData.lastSeen,
                firstSeen: patternData.firstSeen,
                isBlocked: this.blockedWinPatterns.has(patternKey),
                moves: patternKey.split('-').map(Number) // Include move sequence
            };
        }
        
        return {
            wins: this.aiStats.wins || 0,
            losses: this.aiStats.losses || 0,
            draws: this.aiStats.draws || 0,
            totalGames: this.aiStats.totalGames || 0,
            winRate: this.aiStats.winRate || 0,
            adaptationLevel: this.adaptationLevel || 0,
            learnedPatterns: Object.keys(this.learnedPatterns).length,
            blockedPatterns: this.blockedWinPatterns.size,
            recentMoves: this.moveHistory.slice(-10), // Last 10 moves
            patternsData: patternsData, // Full pattern details
            // Expose lastLosingMoveIndex so the move selector can avoid repeating it
            lastLosingMoveIndex: this.lastLosingMoveIndex
        };
    }

    // Mark pattern as successfully blocked
    markPatternBlocked(patternKey) {
        this.blockedWinPatterns.add(patternKey);
        // Save to localStorage after blocking a pattern
        this.saveToStorage();
    }
    
    // Clear all stored patterns (for admin use)
    clearAllPatterns() {
        this.learnedPatterns = {};
        this.blockedWinPatterns.clear();
        this.saveToStorage();
        console.log('All AI patterns cleared');
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AILearningSystem;
}

