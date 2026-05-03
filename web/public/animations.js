/**
 * Premium Animation System for Tic Tac Toe
 * GPU-optimized, performance-focused animations
 * Separated from game logic for maintainability
 */

// Animation utility functions
const AnimationUtils = {
    /**
     * Dim board except winning cells for premium win feedback
     */
    dimBoardForWin(boardElement) {
        let dimOverlay = boardElement.querySelector('.board-dim-overlay');
        if (!dimOverlay) {
            dimOverlay = document.createElement('div');
            dimOverlay.className = 'board-dim-overlay';
            boardElement.appendChild(dimOverlay);
        }
        dimOverlay.classList.add('active');
    },
    
    /**
     * Clear board dimming
     */
    clearBoardDim(boardElement) {
        const dimOverlay = boardElement.querySelector('.board-dim-overlay');
        if (dimOverlay) {
            dimOverlay.classList.remove('active');
        }
    },
    
    /**
     * Animate cell placement (scale from 0.7 to 1.0 with fade in)
     * Triggered when a mark is placed in a cell
     */
    animateCellPlacement(cellElement) {
        if (!cellElement || cellElement.classList.contains('cell-animated')) {
            return; // Already animated or invalid
        }
        
        // Mark as animated to prevent repeat animations
        cellElement.classList.add('cell-animated');
        
        // Use CSS animation for GPU acceleration
        cellElement.classList.add('cell-place-animation');
        
        // Remove animation class after completion to allow cleanup
        setTimeout(() => {
            cellElement.classList.remove('cell-place-animation');
        }, 180);
    },
    
    /**
     * Dim board except winning cells for premium win feedback
     */
    dimBoardForWin(boardElement) {
        let dimOverlay = boardElement.querySelector('.board-dim-overlay');
        if (!dimOverlay) {
            dimOverlay = document.createElement('div');
            dimOverlay.className = 'board-dim-overlay';
            boardElement.appendChild(dimOverlay);
        }
        dimOverlay.classList.add('active');
    },
    
    /**
     * Clear board dimming
     */
    clearBoardDim(boardElement) {
        const dimOverlay = boardElement.querySelector('.board-dim-overlay');
        if (dimOverlay) {
            dimOverlay.classList.remove('active');
        }
    },
    
    /**
     * Animate winning line across winning cells
     * Creates an SVG line that animates from start to end
     */
    animateWinningLine(winningCombo, boardElement, theme = 'default') {
        // Remove any existing winning line
        const existingLine = document.getElementById('winning-line-svg');
        if (existingLine) {
            existingLine.remove();
        }
        
        if (!winningCombo || winningCombo.length < 3) return;
        
        // Get cell positions
        const cells = Array.from(boardElement.children);
        if (cells.length < 9) return;
        
        const startCell = cells[winningCombo[0]];
        const endCell = cells[winningCombo[winningCombo.length - 1]];
        
        if (!startCell || !endCell) return;
        
        const boardRect = boardElement.getBoundingClientRect();
        const startRect = startCell.getBoundingClientRect();
        const endRect = endCell.getBoundingClientRect();
        
        // Calculate line positions relative to board
        const startX = startRect.left + startRect.width / 2 - boardRect.left;
        const startY = startRect.top + startRect.height / 2 - boardRect.top;
        const endX = endRect.left + endRect.width / 2 - boardRect.left;
        const endY = endRect.top + endRect.height / 2 - boardRect.top;
        
        // Create SVG line
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'winning-line-svg';
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '10';
        svg.setAttribute('preserveAspectRatio', 'none');
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startX.toString());
        line.setAttribute('y1', startY.toString());
        line.setAttribute('x2', startX.toString());
        line.setAttribute('y2', startY.toString());
        line.setAttribute('stroke', 'var(--win-line-color, #FFD700)');
        line.setAttribute('stroke-width', '4');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', '0.9');
        line.classList.add('winning-line-path');
        
        // Add glow filter for premium feel
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'win-glow');
        const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        feGaussianBlur.setAttribute('stdDeviation', '3');
        feGaussianBlur.setAttribute('result', 'coloredBlur');
        const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        feMergeNode1.setAttribute('in', 'coloredBlur');
        const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        feMergeNode2.setAttribute('in', 'SourceGraphic');
        feMerge.appendChild(feMergeNode1);
        feMerge.appendChild(feMergeNode2);
        filter.appendChild(feGaussianBlur);
        filter.appendChild(feMerge);
        defs.appendChild(filter);
        
        svg.appendChild(defs);
        svg.appendChild(line);
        boardElement.style.position = 'relative';
        boardElement.appendChild(svg);
        
        // Animate line drawing with smooth transition using stroke-dasharray
        line.setAttribute('x2', startX.toString());
        line.setAttribute('y2', startY.toString());
        
        // Calculate line length for stroke-dasharray animation
        const lineLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        line.style.strokeDasharray = `${lineLength} ${lineLength}`;
        line.style.strokeDashoffset = lineLength.toString();
        line.style.filter = 'url(#win-glow)';
        
        // Dim board for premium win feedback
        this.dimBoardForWin(boardElement);
        
        // Animate to end position using CSS animation
        requestAnimationFrame(() => {
            line.setAttribute('x2', endX.toString());
            line.setAttribute('y2', endY.toString());
            line.style.strokeDashoffset = '0';
            line.style.transition = 'stroke-dashoffset 0.4s ease-out';
        });
        
        // Highlight winning cells
        winningCombo.forEach(index => {
            const cell = cells[index];
            if (cell) {
                cell.classList.add('winning-cell');
            }
        });
    },
    
    /**
     * Clear winning line and cell highlights
     */
    clearWinningLine(boardElement) {
        const svg = document.getElementById('winning-line-svg');
        if (svg) {
            svg.style.opacity = '0';
            setTimeout(() => svg.remove(), 500);
        }
        
        // Clear board dimming
        this.clearBoardDim(boardElement);
        
        // Remove winning cell highlights
        const cells = Array.from(boardElement.children);
        cells.forEach(cell => {
            cell.classList.remove('winning-cell', 'cell-animated');
        });
    },
    
    /**
     * Animate board fade in when game starts
     */
    animateBoardEntry(boardElement) {
        boardElement.style.opacity = '0';
        boardElement.style.transform = 'translateY(10px)';
        requestAnimationFrame(() => {
            boardElement.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
            boardElement.style.opacity = '1';
            boardElement.style.transform = 'translateY(0)';
        });
    },
    
    /**
     * Animate board reset (cells clear with fade)
     * Optimized to use requestAnimationFrame for better performance
     */
    animateBoardReset(cells) {
        const cellsToClear = cells.filter(cell => cell.textContent);
        if (cellsToClear.length === 0) return;
        
        // Use requestAnimationFrame for smoother animation
        let clearedCount = 0;
        const clearNext = () => {
            if (clearedCount < cellsToClear.length) {
                const cell = cellsToClear[clearedCount];
                cell.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
                cell.style.opacity = '0';
                cell.style.transform = 'scale(0.9)';
                
                setTimeout(() => {
                    cell.style.opacity = '';
                    cell.style.transform = '';
                    cell.textContent = '';
                    cell.removeAttribute('data-mark');
                    cell.classList.remove('cell-animated', 'winning-cell');
                }, 200);
                
                clearedCount++;
                if (clearedCount < cellsToClear.length) {
                    requestAnimationFrame(() => {
                        setTimeout(clearNext, 30);
                    });
                }
            }
        };
        
        requestAnimationFrame(clearNext);
    },
    
    /**
     * Animate message text appearance
     */
    animateMessage(messageElement, type = 'default') {
        if (!messageElement) return;
        
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(-10px)';
        
        requestAnimationFrame(() => {
            messageElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });
        
        // Special animation for win/loss
        if (type === 'win' || type === 'loss') {
            messageElement.classList.add('message-' + type);
            setTimeout(() => {
                messageElement.classList.remove('message-' + type);
            }, 1000);
        }
    }
};

/**
 * Theme Manager - Handles theme switching and persistence
 */
const ThemeManager = {
    currentTheme: 'light',
    
    themes: {
        light: {
            name: 'Light',
            vars: {
                '--bg-primary': '#ffffff',
                '--bg-secondary': '#faf3d1',
                '--text-primary': '#2b2b2b',
                '--text-secondary': '#5a4a00',
                '--cell-bg': 'rgba(255, 255, 255, 0.85)',
                '--cell-border': '#FFD700',
                '--cell-hover': 'rgba(255, 255, 255, 0.95)',
                '--mark-x': '#b8860b',
                '--mark-o': '#5a4a00',
                '--win-line-color': '#FFD700',
                '--win-glow': 'rgba(255, 215, 0, 0.4)',
                '--shadow': 'rgba(184, 134, 11, 0.15)',
                '--primary-color': '#FFD700'
            }
        },
        dark: {
            name: 'Dark',
            vars: {
                '--bg-primary': '#1a1a1a',
                '--bg-secondary': '#2d2d2d',
                '--text-primary': '#e0e0e0',
                '--text-secondary': '#b0b0b0',
                '--cell-bg': 'rgba(45, 45, 45, 0.8)',
                '--cell-border': '#4a4a4a',
                '--cell-hover': 'rgba(60, 60, 60, 0.9)',
                '--mark-x': '#ff6b6b',
                '--mark-o': '#4ecdc4',
                '--win-line-color': '#ffd93d',
                '--win-glow': 'rgba(255, 217, 61, 0.5)',
                '--shadow': 'rgba(0, 0, 0, 0.5)',
                '--primary-color': '#ffd93d'
            }
        },
        neon: {
            name: 'Neon',
            vars: {
                '--bg-primary': '#0a0a0f',
                '--bg-secondary': '#151520',
                '--text-primary': '#e0f7ff',
                '--text-secondary': '#b0d4ff',
                '--cell-bg': 'rgba(21, 21, 32, 0.9)',
                '--cell-border': '#00ffff',
                '--cell-hover': 'rgba(0, 255, 255, 0.1)',
                '--mark-x': '#ff00ff',
                '--mark-o': '#00ffff',
                '--win-line-color': '#00ffff',
                '--win-glow': 'rgba(0, 255, 255, 0.6)',
                '--shadow': 'rgba(0, 255, 255, 0.3)',
                '--primary-color': '#00ffff'
            }
        },
        retro: {
            name: 'Retro Arcade',
            vars: {
                '--bg-primary': '#1a1a2e',
                '--bg-secondary': '#16213e',
                '--text-primary': '#0f3460',
                '--text-secondary': '#533483',
                '--cell-bg': 'rgba(26, 26, 46, 0.9)',
                '--cell-border': '#e94560',
                '--cell-hover': 'rgba(233, 69, 96, 0.2)',
                '--mark-x': '#e94560',
                '--mark-o': '#00d9ff',
                '--win-line-color': '#e94560',
                '--win-glow': 'rgba(233, 69, 96, 0.5)',
                '--shadow': 'rgba(233, 69, 96, 0.3)',
                '--primary-color': '#e94560'
            }
        }
    },
    
    /**
     * Apply theme to document
     */
    applyTheme(themeName) {
        const theme = this.themes[themeName];
        if (!theme) {
            console.warn('Theme not found:', themeName);
            return;
        }
        
        this.currentTheme = themeName;
        
        // Apply CSS variables
        const root = document.documentElement;
        Object.entries(theme.vars).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        
        // Add theme class to body
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add('theme-' + themeName);
        
        // Save to localStorage
        try {
            localStorage.setItem('ticTacToeTheme', themeName);
        } catch (e) {
            console.log('Could not save theme preference:', e);
        }
    },
    
    /**
     * Load saved theme or default
     */
    loadTheme() {
        try {
            const saved = localStorage.getItem('ticTacToeTheme');
            if (saved && this.themes[saved]) {
                this.applyTheme(saved);
                return;
            }
        } catch (e) {
            console.log('Could not load theme preference:', e);
        }
        // Default to light theme
        this.applyTheme('light');
    },
    
    /**
     * Get current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
};

// Export for use in script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnimationUtils, ThemeManager };
}
