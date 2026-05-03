// Client-Side Behavior Analysis and Data Collection
// Runs in browser, collects gameplay data, sends to server

class BehaviorAnalyzer {
    constructor(playerName) {
        this.playerName = playerName;
        this.currentGame = null;
        this.moveHistory = [];
        this.gameStartTime = null;
        this.lastMoveTime = null;
        this.patterns = {
            preferredOpenings: [],
            commonSequences: new Map(),
            responseTimes: []
        };
    }

    startGame(gameId) {
        this.currentGame = {
            gameId: gameId,
            playerName: this.playerName,
            moves: [],
            startTime: Date.now(),
            boardStates: []
        };
        this.gameStartTime = Date.now();
        this.lastMoveTime = this.gameStartTime;
        this.moveHistory = [];
    }

    recordMove(moveIndex, boardState, moveType = 'neutral') {
        if (!this.currentGame) return;

        const now = Date.now();
        const responseTime = now - this.lastMoveTime;
        const gamePhase = this.determineGamePhase(boardState);

        const moveEvent = {
            gameId: this.currentGame.gameId,
            playerId: this.playerName,
            moveIndex: moveIndex,
            boardState: [...boardState],
            timestamp: now - this.gameStartTime,
            responseTime: responseTime,
            gamePhase: gamePhase,
            moveType: moveType,
            moveNumber: this.moveHistory.length + 1
        };

        this.moveHistory.push(moveEvent);
        this.currentGame.moves.push(moveEvent);
        this.currentGame.boardStates.push([...boardState]);

        // Update patterns
        this.updatePatterns(moveEvent);

        this.lastMoveTime = now;
    }

    determineGamePhase(boardState) {
        const moveCount = boardState.filter(cell => cell !== '').length;
        if (moveCount <= 2) return 'opening';
        if (moveCount <= 6) return 'midgame';
        return 'endgame';
    }

    classifyMoveType(moveIndex, boardState, isWinningMove) {
        if (isWinningMove) return 'offensive';
        
        // Check if blocking opponent win
        const opponent = 'O';
        const player = 'X';
        const blocking = this.isBlockingMove(moveIndex, boardState, opponent);
        if (blocking) return 'defensive';
        
        return 'neutral';
    }

    isBlockingMove(moveIndex, boardState, opponent) {
        // Simplified: check if move prevents opponent win
        const testBoard = [...boardState];
        testBoard[moveIndex] = opponent;
        
        // Check winning combinations
        const winningCombos = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        
        for (const combo of winningCombos) {
            const values = combo.map(i => testBoard[i]);
            if (values.filter(v => v === opponent).length === 2 && 
                values.filter(v => v === '').length === 1) {
                return true;
            }
        }
        return false;
    }

    updatePatterns(moveEvent) {
        // Track preferred openings
        if (moveEvent.moveNumber === 1) {
            this.patterns.preferredOpenings.push(moveEvent.moveIndex);
        }

        // Track response times
        if (moveEvent.responseTime > 0) {
            this.patterns.responseTimes.push(moveEvent.responseTime);
        }

        // Track move sequences (last 3 moves)
        if (this.moveHistory.length >= 2) {
            const sequence = this.moveHistory
                .slice(-3)
                .map(m => m.moveIndex)
                .join('-');
            const count = this.patterns.commonSequences.get(sequence) || 0;
            this.patterns.commonSequences.set(sequence, count + 1);
        }
    }

    endGame(result) {
        if (!this.currentGame) return;

        // Mark all moves with result
        this.currentGame.moves.forEach(move => {
            move.result = result;
        });

        // Send to server
        this.sendGameData(result);

        // Reset for next game
        this.currentGame = null;
        this.moveHistory = [];
    }

    async sendGameData(result) {
        try {
            const gameData = {
                playerName: this.playerName,
                gameId: this.currentGame.gameId,
                result: result,
                moves: this.currentGame.moves,
                duration: Date.now() - this.gameStartTime,
                patterns: {
                    preferredOpenings: this.patterns.preferredOpenings,
                    commonSequences: Object.fromEntries(this.patterns.commonSequences),
                    averageResponseTime: this.calculateAverageResponseTime()
                }
            };

            // Send via fetch or socket
            if (window.socket) {
                window.socket.emit('behavior-data', gameData);
            } else {
                await fetch('/api/behavior/record-game', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(gameData)
                });
            }

            console.log('Behavior data sent to server');
        } catch (error) {
            console.error('Error sending behavior data:', error);
        }
    }

    calculateAverageResponseTime() {
        if (this.patterns.responseTimes.length === 0) return 0;
        const sum = this.patterns.responseTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.patterns.responseTimes.length);
    }

    // Predict next move based on patterns (client-side lightweight prediction)
    predictNextMove(boardState) {
        // Simple pattern matching
        const currentSequence = this.moveHistory
            .slice(-2)
            .map(m => m.moveIndex)
            .join('-');

        // Find similar sequences
        let bestMatch = null;
        let maxCount = 0;
        for (const [sequence, count] of this.patterns.commonSequences.entries()) {
            if (sequence.startsWith(currentSequence) && count > maxCount) {
                maxCount = count;
                bestMatch = sequence;
            }
        }

        if (bestMatch) {
            const moves = bestMatch.split('-').map(Number);
            const nextMove = moves[moves.length - 1];
            if (boardState[nextMove] === '') {
                return nextMove;
            }
        }

        return null;
    }

    // Calculate exploitability score (how predictable the player is)
    calculateExploitabilityScore() {
        const totalMoves = this.moveHistory.length;
        if (totalMoves === 0) return 0;

        // More repeated sequences = more exploitable
        const uniqueSequences = this.patterns.commonSequences.size;
        const totalSequences = Array.from(this.patterns.commonSequences.values())
            .reduce((a, b) => a + b, 0);
        
        if (totalSequences === 0) return 0;
        
        // Lower score = more exploitable (more repetition)
        const diversity = uniqueSequences / totalSequences;
        return Math.round((1 - diversity) * 100);
    }
}

// Export for use in script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BehaviorAnalyzer;
}

