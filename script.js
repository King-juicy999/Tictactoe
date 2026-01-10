// Global error handler to prevent crashes

// Initialize Theme Manager on page load (but don't auto-load theme - wait for user selection in welcome flow)
// ThemeManager.loadTheme(); // Commented out - theme selection happens in welcome flow

// Welcome Flow State
let welcomeFlowState = {
    preWelcomeShown: false,
    themeSelected: false
};

// Pre-welcome overlay elements (will be set on DOMContentLoaded)
let preWelcomeOverlay, continueWelcomeBtn, themeSelectionOverlay, themePreviewCards, themeConfirmBtn, aiPresenceGameplay;
let selectedTheme = null;

function updateThemePreviewSelection() {
    if (themePreviewCards && selectedTheme) {
        themePreviewCards.forEach(card => {
            if (card.dataset.theme === selectedTheme) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }
}

// Theme Switcher UI
document.addEventListener('DOMContentLoaded', () => {
    // Get welcome flow elements
    preWelcomeOverlay = document.getElementById('pre-welcome-overlay');
    continueWelcomeBtn = document.getElementById('continue-welcome-btn');
    themeSelectionOverlay = document.getElementById('theme-selection-overlay');
    themePreviewCards = document.querySelectorAll('.theme-preview-card');
    themeConfirmBtn = document.getElementById('theme-confirm-btn');
    aiPresenceGameplay = document.getElementById('ai-presence-gameplay');
    
    // Initialize pre-welcome overlay
    if (preWelcomeOverlay) {
        setTimeout(() => {
            if (preWelcomeOverlay) {
                preWelcomeOverlay.style.display = 'flex';
            }
        }, 100);
    }
    
    // Continue button - MVP FLOW: Ready → Theme → Name
    let buttonTransitioned = false;
    
    const handleContinueClick = (e) => {
        try {
            // Prevent multiple transitions
            if (buttonTransitioned) {
                console.log('[Continue] Already transitioned, ignoring click');
                return;
            }
            
            console.log('[Continue] === BUTTON CLICKED - Showing Theme Selector ===');
            
            // Mark as transitioned immediately to prevent double-clicks
            buttonTransitioned = true;
            
            // Hide pre-welcome overlay with smooth animation
            const overlay = document.getElementById('pre-welcome-overlay');
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.4s ease-out';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.style.visibility = 'hidden';
                    overlay.style.pointerEvents = 'none';
                    overlay.classList.add('hiding');
                }, 400);
                console.log('[Continue] Pre-welcome overlay hidden');
                }
                
            // Show theme selection overlay FIRST (MVP requirement)
                if (themeSelectionOverlay) {
                    // Set default theme if none selected
                    if (!selectedTheme) {
                        selectedTheme = (typeof ThemeManager !== 'undefined' && ThemeManager.getCurrentTheme()) 
                            ? ThemeManager.getCurrentTheme() 
                            : 'light';
                    updateThemePreviewSelection();
                    }
                    
                // Animate theme selector onto screen smoothly
                    themeSelectionOverlay.style.display = 'flex';
                themeSelectionOverlay.style.opacity = '0';
                setTimeout(() => {
                    themeSelectionOverlay.classList.add('active');
                    themeSelectionOverlay.style.opacity = '1';
                }, 100);
                console.log('[Continue] Theme selection overlay shown');
                } else {
                console.error('[Continue] Theme selection overlay not found!');
                    // Fallback: show welcome screen directly
                    const welcomeScreen = document.getElementById('welcome-screen');
                    if (welcomeScreen) {
                        welcomeScreen.classList.add('active');
                    welcomeScreen.style.display = 'block';
                }
            }
            
            // Re-enable inputs
            if (typeof gameState !== 'undefined' && gameState) {
                gameState.uiLocked = false;
                gameState.uiLockingReason = null;
            }
            
        } catch (error) {
            console.error('[Continue] Error in handleContinueClick:', error);
            // Fallback: try to show theme selector or welcome screen
            const overlay = document.getElementById('pre-welcome-overlay');
            if (overlay) overlay.style.display = 'none';
            
            if (themeSelectionOverlay) {
                themeSelectionOverlay.style.display = 'flex';
                themeSelectionOverlay.classList.add('active');
            } else {
                const welcomeScreen = document.getElementById('welcome-screen');
                if (welcomeScreen) {
                    welcomeScreen.classList.add('active');
                    welcomeScreen.style.display = 'block';
                }
            }
        }
    };
    
    // Setup button with multiple attempts and error handling
    const setupContinueButton = () => {
        try {
            const btn = document.getElementById('continue-welcome-btn');
            if (!btn) {
                return false;
            }
            
            console.log('[Continue] Button found, setting up handlers');
            
            // Make button immediately clickable
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
            btn.disabled = false;
            btn.style.zIndex = '10002';
            btn.style.visibility = 'visible';
            btn.style.display = 'block';
            btn.style.position = 'relative';
            
            // Clone button to remove any existing listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            // Add multiple event handlers for maximum compatibility
            newBtn.onclick = handleContinueClick;
            newBtn.addEventListener('click', handleContinueClick, { passive: false, capture: false });
            newBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleContinueClick(e);
            }, { passive: false });
            newBtn.addEventListener('pointerup', handleContinueClick, { passive: false });
            
            console.log('[Continue] Button handlers attached successfully');
            return true;
        } catch (error) {
            console.error('[Continue] Error setting up button:', error);
            return false;
        }
    };
    
    // Try to setup button immediately and with delays (multiple failsafes)
    if (!setupContinueButton()) {
        setTimeout(() => setupContinueButton(), 50);
        setTimeout(() => setupContinueButton(), 200);
        setTimeout(() => setupContinueButton(), 500);
        setTimeout(() => setupContinueButton(), 1000);
        setTimeout(() => setupContinueButton(), 2000);
    }
    
    // Event delegation on document as ultimate failsafe
    document.addEventListener('click', (e) => {
        try {
            if (e.target && (e.target.id === 'continue-welcome-btn' || e.target.closest('#continue-welcome-btn'))) {
                console.log('[Continue] Click caught by document handler');
                e.preventDefault();
                e.stopPropagation();
                handleContinueClick(e);
            }
        } catch (error) {
            console.error('[Continue] Error in document click handler:', error);
    }
    }, true);
    
    // Theme preview card selection
    if (themePreviewCards && themePreviewCards.length > 0) {
        themePreviewCards.forEach(card => {
            card.addEventListener('click', () => {
                selectedTheme = card.dataset.theme;
                updateThemePreviewSelection();
            });
        });
    }
    
    // Confirm theme selection - MVP FLOW: Theme → Name Input
    if (themeConfirmBtn) {
        themeConfirmBtn.addEventListener('click', () => {
            try {
            if (selectedTheme && typeof ThemeManager !== 'undefined') {
                ThemeManager.applyTheme(selectedTheme);
                welcomeFlowState.themeSelected = true;
                
                    console.log('[Theme] Theme confirmed:', selectedTheme);
                    
                    // Hide theme selection overlay with smooth animation
                if (themeSelectionOverlay) {
                        themeSelectionOverlay.style.opacity = '0';
                        themeSelectionOverlay.style.transition = 'opacity 0.4s ease-out';
                        setTimeout(() => {
                    themeSelectionOverlay.classList.remove('active');
                            themeSelectionOverlay.style.display = 'none';
                            themeSelectionOverlay.style.pointerEvents = 'none';
                        }, 400);
                    }
                    
                    // Show welcome screen (name input & camera enable) - MVP requirement
                    const welcomeScreen = document.getElementById('welcome-screen');
                    if (welcomeScreen) {
                        welcomeScreen.style.opacity = '0';
                        welcomeScreen.style.display = 'block';
                        welcomeScreen.style.visibility = 'visible';
                        welcomeScreen.classList.add('active');
                        welcomeScreen.style.transition = 'opacity 0.4s ease-in';
                        setTimeout(() => {
                            welcomeScreen.style.opacity = '1';
                        }, 100);
                        console.log('[Theme] Welcome screen (name input) shown');
                    } else {
                        console.error('[Theme] Welcome screen not found!');
                }
                
                // Show AI presence during gameplay
                if (aiPresenceGameplay) {
                    setTimeout(() => {
                        aiPresenceGameplay.classList.remove('hidden');
                        aiPresenceGameplay.classList.add('active');
                    }, 500);
                    }
                } else {
                    console.warn('[Theme] No theme selected or ThemeManager not available');
                }
            } catch (error) {
                console.error('[Theme] Error confirming theme selection:', error);
                // Fallback: hide theme selector and show welcome screen
                if (themeSelectionOverlay) {
                    themeSelectionOverlay.style.display = 'none';
                    themeSelectionOverlay.classList.remove('active');
                }
                const welcomeScreen = document.getElementById('welcome-screen');
                if (welcomeScreen) {
                    welcomeScreen.classList.add('active');
                    welcomeScreen.style.display = 'block';
                }
            }
        });
    }
    
    // Initialize theme switcher UI
    const themeBtn = document.getElementById('theme-btn');
    const themeMenu = document.getElementById('theme-menu');
    const themeOptions = document.querySelectorAll('.theme-option');
    
    if (themeBtn && themeMenu) {
        // Toggle theme menu
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            themeMenu.classList.toggle('hidden');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!themeBtn.contains(e.target) && !themeMenu.contains(e.target)) {
                themeMenu.classList.add('hidden');
            }
        });
        
        // Theme selection
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                if (typeof ThemeManager !== 'undefined') {
                    ThemeManager.applyTheme(theme);
                    
                    // Update active state
                    themeOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    
                    // Close menu
                    themeMenu.classList.add('hidden');
                }
            });
        });
        
        // Set initial active theme
        if (typeof ThemeManager !== 'undefined') {
            const currentTheme = ThemeManager.getCurrentTheme();
            themeOptions.forEach(opt => {
                if (opt.dataset.theme === currentTheme) {
                    opt.classList.add('active');
                }
            });
        }
    }
    
    // Setup guide icon buttons on page load (so guide can always be reopened)
    setupGuideIconButtons();
});
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
    currentLevel: 1, // Current level (ALWAYS Level 1 until graduation)
    totalGamesPlayed: 0, // Total games (wins + losses) for level calculation
    level1Wins: 0, // Wins in current level (need 5 to graduate)
    level1Losses: 0, // Losses in current level
    aiWinsInLevel: 0, // AI wins in current level (need 5 to prevent graduation)
    roundCount: 0, // Total rounds completed (increments on every game end: win/loss/draw)
    // Shield Guard removed - shieldedCells no longer used
    shieldedCells: [], // Kept for compatibility but not used (all checks removed from AI logic)
    // Tactical Claim (Level 1 only)
    tacticalClaimUsed: false, // Track if Tactical Claim was used this match
    reservedCells: [], // Array of {cellIndex, turnsRemaining} for Tactical Claim
    turnCount: 0, // Track turns for Tactical Claim unlock timing
    // MVP: Board layout lock - prevent shrinking between rounds
    boardInitialized: false, // Track if board has been initialized (prevents re-animation between rounds)
    // MVP: Track if game has started once - prevents Play Game button from reappearing
    hasGameStartedOnce: false, // Track if first game has started (prevents reset button from showing after first game)
    // CRITICAL: Turn locking to prevent AI from playing twice
    aiTurnInProgress: false, // Prevents AI from executing multiple moves in one turn
    // Level 1 leniency tracking
    firstRoundOfSession: true, // Track if this is the first round of the session
    playerWinningPatterns: [], // Track patterns player used to win
    // Last Stand power-up tracking
    lastStandUsed: false, // Track if Last Stand was used this game
    lastStandScheduledForPlay: null, // Track which play count (1-5) Last Stand is scheduled for (null = not scheduled)
    currentPlayCount: 0, // Track current play count (1-5) - increments each game
    // AI recalculation trigger (set to true when power-up changes board state)
    aiRecalculationNeeded: false,
    // Additional AI turn lock for double-move prevention
    aiMoveInProgress: false // Secondary lock to prevent double moves
};

/**
 * Power-Up Manager System
 * Front-end only - visual effects, no AI logic changes
 */
const PowerUpManager = {
    powerUps: {
        hintPulse: {
            id: 'hintPulse',
            name: 'Hint Pulse',
            icon: '💡',
            description: 'Reveals a suggested move with a glowing pulse',
            duration: 2000, // 2 seconds
            audioType: 'chime',
            requiresTarget: false
        },
        boardShake: {
            id: 'boardShake',
            name: 'Board Shake',
            icon: '🌊',
            description: 'Reindexes all cell positions once. Marks remain but positions remap.',
            duration: 200, // Animation duration
            audioType: 'chime',
            requiresTarget: false,
            level1Only: true
        },
        lastStand: {
            id: 'lastStand',
            name: 'Last Stand',
            icon: '⚡',
            description: 'Schedule deployment for a future play count (1-5). Auto-triggers when about to lose on that play.',
            duration: 600, // Animation duration
            audioType: 'chime',
            requiresTarget: false,
            level1Only: true,
            autoTrigger: false // Now requires scheduling
        },
        focusAura: {
            id: 'focusAura',
            name: 'Focus Aura',
            icon: '🌀',
            description: 'PvP only - Radiating aura effect (visual only in PvE)',
            duration: 4000, // 4 seconds
            audioType: 'chime',
            requiresTarget: false,
            pvpOnly: true
        }
    },
    
    currentLevel: 1,
    quantities: {}, // Track quantities per power-up
    activeEffects: {}, // Track currently active effects
    
    /**
     * Initialize power-up system
     */
    init() {
        this.currentLevel = gameState.currentLevel || 1;
        this.resetPowerUpsForLevel();
        this.renderSidebar();
        this.setupEventListeners();
    },
    
    /**
     * Reset power-ups for new level (1 free power-up per level)
     */
    resetPowerUpsForLevel() {
        Object.keys(this.powerUps).forEach(powerUpId => {
            this.quantities[powerUpId] = 1; // 1 free power-up per level
        });
        // Note: activeEffects and shields are cleared when new game starts, not when level changes
        
        // REMOVED: Auto-prompt on level reset - Last Stand now schedules on click only
    },
    
    /**
     * Clear all shields (called when new game starts)
     * NOTE: Shield Guard removed - this function kept for compatibility but does nothing
     */
    clearAllShields() {
        // Shield Guard removed - no shields to clear
    },
    
    /**
     * Update level based on total games played
     */
    updateLevel() {
        const newLevel = Math.floor((gameState.totalGamesPlayed || 0) / 1) + 1; // New level every game
        if (newLevel !== this.currentLevel) {
            this.currentLevel = newLevel;
            gameState.currentLevel = newLevel;
            this.resetPowerUpsForLevel();
            this.renderSidebar();
        }
    },
    
    /**
     * Render power-up sidebar
     */
    renderSidebar() {
        const sidebar = document.getElementById('powerup-sidebar');
        const list = document.getElementById('powerup-list');
        const levelDisplay = document.getElementById('powerup-level-display');
        
        if (!sidebar || !list) return;
        
        // Update level display
        if (levelDisplay) {
            levelDisplay.textContent = this.currentLevel;
        }
        
        // Clear existing power-ups
        list.innerHTML = '';
        
        // Create power-up items
        Object.values(this.powerUps).forEach(powerUp => {
            // Skip PvP-only power-ups in Player vs AI mode
            if (powerUp.pvpOnly && gameState.mode !== 'pvp') {
                return;
            }
            
            // Skip Level 1-only power-ups if not in Level 1
            if (powerUp.level1Only && this.currentLevel !== 1) {
                return;
            }
            
            // Skip auto-trigger power-ups from UI (they trigger automatically)
            if (powerUp.autoTrigger) {
                return;
            }
            
            const item = document.createElement('div');
            item.className = 'powerup-item';
            item.dataset.powerupId = powerUp.id;
            
            // CRITICAL: Power-up persistence - each power-up has independent state
            // Read quantity directly from quantities object - do NOT modify other power-ups
            const quantity = this.quantities[powerUp.id] !== undefined ? this.quantities[powerUp.id] : 0;
            const isActive = this.activeEffects[powerUp.id] ? true : false;
            const isDisabled = quantity === 0 || isActive;
            const isPvpOnly = powerUp.pvpOnly && gameState.mode !== 'pvp';
            
            // CRITICAL: Only hide power-ups that have quantity 0 AND are not active
            // Do NOT filter out power-ups that still have quantity > 0
            // Each power-up's visibility is independent
            
            // CRITICAL: No permanent names/labels - icons only for clean UI
            item.innerHTML = `
                <button class="powerup-button ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}" 
                        data-powerup-id="${powerUp.id}"
                        ${isDisabled ? 'disabled' : ''}
                        aria-label="${powerUp.name}">
                    <span class="powerup-icon">${powerUp.icon}</span>
                    <span class="powerup-quantity">${quantity}</span>
                </button>
                <div class="powerup-tooltip">
                    <div class="powerup-tooltip-name">${powerUp.name}</div>
                    <div class="powerup-tooltip-desc">${powerUp.description}</div>
                    ${isPvpOnly ? '<div class="powerup-tooltip-note">PvP only</div>' : ''}
                    ${isActive ? '<div class="powerup-tooltip-active">Active</div>' : ''}
                </div>
            `;
            
            list.appendChild(item);
        });
        
        // Attach click handlers
        list.querySelectorAll('.powerup-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const powerUpId = btn.dataset.powerupId;
                if (powerUpId) {
                    this.activatePowerUp(powerUpId);
                }
            });
        });
    },
    
    /**
     * Activate a power-up (visual effects only)
     */
    activatePowerUp(powerUpId) {
        const powerUp = this.powerUps[powerUpId];
        if (!powerUp) return;
        
        const quantity = this.quantities[powerUpId] || 0;
        if (quantity === 0) return;
        
        // Check if already active
        if (this.activeEffects[powerUpId]) return;
        
        // Check PvP only restriction
        if (powerUp.pvpOnly && gameState.mode !== 'pvp') {
            this.showActivationMessage({...powerUp, name: 'Focus Aura (PvP only)'}, true);
            return;
        }
        
        // CRITICAL: Last Stand requires forward-scheduling (not instant activation)
        if (powerUpId === 'lastStand') {
            this.scheduleLastStandDeployment();
            return; // Don't activate immediately - wait for scheduling
        }
        
        // No power-ups require cell selection anymore (Shield Guard removed)
        
        // CRITICAL: Power-up consumption - ONLY decrease THIS power-up's quantity
        // Do NOT modify other power-ups' quantities or states
        // Each power-up has independent state that persists until individually consumed
        this.quantities[powerUpId] = Math.max(0, quantity - 1);
        
        // Mark as active - ONLY this power-up
        this.activeEffects[powerUpId] = true;
        
        // Play audio cue
        this.playPowerUpAudio(powerUp.audioType);
        
        // Apply visual effect
        this.applyVisualEffect(powerUpId);
        
        // CRITICAL: Trigger AI recalculation for ALL power-ups that affect gameplay
        // This ensures AI re-evaluates board state after any power-up activation
        // Power-ups that affect gameplay: boardShake (remaps board), hintPulse (visual only but may affect player strategy)
        // Note: This is NOT an intelligence change - just a recalculation trigger
        if (powerUpId === 'boardShake' || powerUpId === 'hintPulse') {
            gameState.aiRecalculationNeeded = true;
        }
        
        // CRITICAL: Power-up state isolation - only update THIS power-up's state
        // Do NOT modify other power-ups' quantities, activeEffects, or render state
        // Each power-up tracks its own state independently
        
        // Update sidebar with activation highlight
        this.highlightPowerUpButton(powerUpId);
        // CRITICAL: renderSidebar() rebuilds UI but preserves all power-up states
        // It reads from quantities and activeEffects - these are not modified for other power-ups
        this.renderSidebar();
        
        // Show prominent activation feedback banner
        this.showPowerUpActivationBanner(powerUp);
        
        // Show activation message (legacy - kept for compatibility)
        this.showActivationMessage(powerUp);
        
        // Deactivate after duration
        setTimeout(() => {
            this.deactivatePowerUp(powerUpId);
        }, powerUp.duration);
    },
    
    /**
     * Schedule Last Stand deployment - player chooses future play count (1-5)
     */
    scheduleLastStandDeployment() {
        // Check if already scheduled
        if (gameState.lastStandScheduledForPlay !== null) {
            const messageBox = document.getElementById('message-box');
            if (messageBox) {
                messageBox.textContent = `Last Stand already scheduled for Play #${gameState.lastStandScheduledForPlay}`;
            }
            return;
        }
        
        // Show deployment play count selection UI
        this.showLastStandDeploymentUI();
    },
    
    /**
     * Show UI for Last Stand deployment play count selection (CINEMATIC)
     */
    showLastStandDeploymentUI() {
        // CINEMATIC: Pause gameplay input
        const wasGameActive = gameState.gameActive;
        gameState.gameActive = false;
        gameState.uiLocked = true;
        
        // Create cinematic overlay with dimming
        const overlay = document.createElement('div');
        overlay.id = 'laststand-deployment-overlay';
        overlay.className = 'laststand-deployment-overlay cinematic-overlay';
        
        const currentPlay = gameState.currentPlayCount || 0;
        const maxPlay = 5; // Maximum play count
        
        let content = '<div class="laststand-deployment-content cinematic-content">';
        content += '<div class="cinematic-header">';
        content += '<h3 class="cinematic-title">You are choosing a moment in the future...</h3>';
        content += '</div>';
        content += `<p class="laststand-deployment-subtitle">Select when Last Stand will activate (Play #${currentPlay + 1} - ${maxPlay} only)</p>`;
        content += '<div class="laststand-level-options cinematic-options">';
        
        // Show only future play counts (forward-only)
        for (let play = currentPlay + 1; play <= maxPlay; play++) {
            content += `<button class="laststand-level-btn cinematic-btn" data-play="${play}">`;
            content += `Play #${play}`;
            content += '</button>';
        }
        
        content += '</div>';
        content += '<button class="laststand-cancel-btn cinematic-cancel">Cancel</button>';
        content += '</div>';
        
        overlay.innerHTML = content;
        document.body.appendChild(overlay);
        
        // CINEMATIC: Dim background
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            gameScreen.classList.add('dimmed-for-overlay');
        }
        
        // Animate in with fade
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);
        
        // Attach event listeners
        overlay.querySelectorAll('.laststand-level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playCount = parseInt(e.target.dataset.play);
                this.confirmLastStandDeployment(playCount, wasGameActive);
                overlay.classList.remove('active');
                // Remove dimming
                if (gameScreen) {
                    gameScreen.classList.remove('dimmed-for-overlay');
                }
                setTimeout(() => overlay.remove(), 300);
            });
        });
        
        overlay.querySelector('.laststand-cancel-btn').addEventListener('click', () => {
            overlay.classList.remove('active');
            // Remove dimming and resume gameplay
            if (gameScreen) {
                gameScreen.classList.remove('dimmed-for-overlay');
            }
            gameState.gameActive = wasGameActive;
            gameState.uiLocked = false;
            setTimeout(() => overlay.remove(), 300);
        });
    },
    
    /**
     * Confirm Last Stand deployment for selected play count
     */
    confirmLastStandDeployment(playCount, resumeGameplay = true) {
        gameState.lastStandScheduledForPlay = playCount;
        
        // Consume the power-up
        this.quantities['lastStand'] = Math.max(0, (this.quantities['lastStand'] || 0) - 1);
        this.renderSidebar();
        
        // CINEMATIC: Resume gameplay after selection
        if (resumeGameplay) {
            gameState.gameActive = true;
            gameState.uiLocked = false;
        }
        
        // Show confirmation
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.textContent = `⚡ Last Stand scheduled for Play #${playCount}`;
            setTimeout(() => {
                if (messageBox.textContent.includes('Last Stand scheduled')) {
                    messageBox.textContent = gameState.playerName ? `Your turn, ${gameState.playerName}!` : 'Your turn!';
                }
            }, 3000);
        }
    },
    
    
    /**
     * Play power-up audio cue
     */
    playPowerUpAudio(audioType) {
        const audio = document.getElementById('powerup-activate-sound');
        if (audio) {
            audio.currentTime = 0;
            audio.volume = audioType === 'shield' ? 0.25 : 0.3; // Subtle volume
            audio.play().catch(() => {}); // Ignore autoplay errors
        }
    },
    
    /**
     * Highlight power-up button on activation
     */
    highlightPowerUpButton(powerUpId) {
        const button = document.querySelector(`[data-powerup-id="${powerUpId}"]`);
        if (button) {
            button.classList.add('powerup-activating');
            setTimeout(() => {
                button.classList.remove('powerup-activating');
            }, 500);
        }
    },
    
    /**
     * Apply visual effect for power-up
     */
    applyVisualEffect(powerUpId) {
        const board = document.querySelector('.game-board');
        const cells = document.querySelectorAll('.cell');
        
        if (!board) return;
        
        switch(powerUpId) {
            case 'hintPulse':
                this.createHintPulse(cells);
                break;
            case 'boardShake':
                this.createBoardShake();
                break;
            case 'lastStand':
                this.createLastStand();
                break;
            case 'focusAura':
                this.createFocusAura();
                break;
        }
    },
    
    /**
     * Apply visual effect on specific cell
     * NOTE: Shield Guard removed - no cell-specific effects currently
     */
    applyVisualEffectOnCell(powerUpId, cellIndex) {
        // No cell-specific power-ups currently
    },
    
    /**
     * Create Hint Pulse effect - shows suggested move
     * Visual only - uses AI logic to suggest but doesn't modify game state
     */
    createHintPulse(cells) {
        // Get AI's suggested move (visual only, doesn't affect AI logic)
        let suggestedIndex = null;
        try {
            // Store original board state
            const originalBoard = [...gameState.board];
            const originalPlayerGoesFirst = gameState.playerGoesFirst;
            
            // Temporarily set AI as next player to get its move suggestion
            // This is read-only for hint purposes
            if (typeof chooseHardAIMove === 'function') {
                // Call AI move function to get suggestion
                // Note: chooseHardAIMove should not modify board, but we'll restore anyway
                suggestedIndex = chooseHardAIMove();
            }
            
            // Restore board state (safety check - should not be modified)
            gameState.board = originalBoard;
            gameState.playerGoesFirst = originalPlayerGoesFirst;
            
            // Validate suggestion is an empty cell
            if (suggestedIndex !== null && suggestedIndex >= 0 && suggestedIndex < 9) {
                if (gameState.board[suggestedIndex] !== '') {
                    // Invalid suggestion, find first empty cell
                    suggestedIndex = null;
                }
            } else {
                suggestedIndex = null;
            }
        } catch (e) {
            console.log('Could not get hint suggestion:', e);
            suggestedIndex = null;
        }
        
        // Fallback: find first empty cell if no valid suggestion
        if (suggestedIndex === null) {
            for (let i = 0; i < cells.length; i++) {
                if (!cells[i].textContent.trim() && gameState.board[i] === '') {
                    suggestedIndex = i;
                    break;
                }
            }
        }
        
        if (suggestedIndex !== null && cells[suggestedIndex]) {
            const cell = cells[suggestedIndex];
            cell.classList.add('powerup-hint-pulse');
            
            // Remove after animation
            setTimeout(() => {
                cell.classList.remove('powerup-hint-pulse');
            }, 2000);
        }
    },
    
    /**
     * Create Board Shake effect - reindexes cell positions
     */
    createBoardShake() {
        const board = document.querySelector('.game-board');
        const cells = document.querySelectorAll('.cell');
        if (!board || !cells || cells.length !== 9) return;
        
        // Store current board state (marks)
        const currentMarks = Array.from(cells).map(cell => ({
            mark: cell.textContent.trim(),
            dataMark: cell.getAttribute('data-mark') || ''
        }));
        
        // Create random permutation of indices (0-8)
        const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        // Apply shake animation
        board.style.animation = 'board-shake 0.2s ease-in-out';
        
        // After animation, remap board state
        setTimeout(() => {
            // Create new board state array
            const newBoard = Array(9).fill('');
            const newMarks = Array(9).fill(null);
            
            // Remap marks to new positions
            indices.forEach((newIndex, oldIndex) => {
                newBoard[newIndex] = gameState.board[oldIndex];
                newMarks[newIndex] = currentMarks[oldIndex];
            });
            
            // Update gameState.board
            gameState.board = newBoard;
            
            // Update visual cells
            cells.forEach((cell, index) => {
                const markData = newMarks[index];
                if (markData) {
                    cell.textContent = markData.mark;
                    if (markData.dataMark) {
                        cell.setAttribute('data-mark', markData.dataMark);
                    } else {
                        cell.removeAttribute('data-mark');
                    }
                } else {
                    cell.textContent = '';
                    cell.removeAttribute('data-mark');
                }
            });
            
            // Clear animation
            board.style.animation = '';
            
            // CRITICAL: Trigger AI recalculation - board state changed
            gameState.aiRecalculationNeeded = true;
            
            // Trigger AI recalculation hook (if exists)
            if (typeof emitBoardUpdate === 'function') {
                emitBoardUpdate();
            }
        }, 200);
    },
    
    /**
     * Create Last Stand effect - grants extra move when one move from losing
     */
    createLastStand() {
        const board = document.querySelector('.game-board');
        const messageBox = document.getElementById('message-box');
        
        if (!board) return;
        
        // Visual effect: pulse and glow
        board.style.animation = 'last-stand-pulse 0.6s ease-out';
        board.classList.add('last-stand-active');
        
        // Show activation message
        if (messageBox) {
            const originalText = messageBox.textContent;
            messageBox.textContent = '⚡ LAST STAND ACTIVATED';
            messageBox.classList.add('last-stand-message');
            
            setTimeout(() => {
                messageBox.classList.remove('last-stand-message');
                messageBox.textContent = originalText;
            }, 2000);
        }
        
        // Clear visual effects after animation
        setTimeout(() => {
            board.style.animation = '';
            board.classList.remove('last-stand-active');
        }, 600);
        
        // Mark as used for this game
        gameState.lastStandUsed = true;
        
        // CRITICAL: Trigger AI recalculation - Last Stand activated
        gameState.aiRecalculationNeeded = true;
        
        // CRITICAL: Power-up isolation - Last Stand does NOT affect other power-ups
        // Board Shake, Hint Pulse remain fully functional
        // No shared cleanup or reset functions called
        
        // CRITICAL: Trigger AI recalculation - Last Stand activated, board state may change
        gameState.aiRecalculationNeeded = true;
    },
    
    /**
     * Create Focus Aura effect (visual only, PvP placeholder)
     */
    createFocusAura() {
        // In PvE, just show visual aura from player info area
        const playerInfo = document.getElementById('player-info');
        if (playerInfo) {
            playerInfo.classList.add('powerup-focus-aura');
            
            setTimeout(() => {
                playerInfo.classList.remove('powerup-focus-aura');
            }, 4000);
        }
        
        // Also add aura to sidebar power-up button
        const button = document.querySelector('[data-powerup-id="focusAura"]');
        if (button) {
            button.classList.add('powerup-aura-active');
            setTimeout(() => {
                button.classList.remove('powerup-aura-active');
            }, 4000);
        }
    },
    
    /**
     * Deactivate power-up effect
     */
    deactivatePowerUp(powerUpId) {
        // CRITICAL: Power-up state isolation - only deactivate THIS power-up
        // Do NOT modify other power-ups' states
        if (!this.activeEffects[powerUpId]) return;
        
        const effectData = this.activeEffects[powerUpId];
        // CRITICAL: Only delete THIS power-up's active effect
        delete this.activeEffects[powerUpId];
        
        const cells = document.querySelectorAll('.cell');
        
        // Remove visual effects based on power-up type
        // CRITICAL: Only remove visual effects for THIS power-up
        switch(powerUpId) {
            case 'hintPulse':
                cells.forEach(cell => {
                    cell.classList.remove('powerup-hint-pulse');
                });
                break;
            case 'boardShake':
                // Animation completes automatically, just mark inactive
                break;
            case 'lastStand':
                // Animation completes automatically, just mark inactive
                break;
            case 'focusAura':
                const playerInfo = document.getElementById('player-info');
                if (playerInfo) {
                    playerInfo.classList.remove('powerup-focus-aura');
                }
                const button = document.querySelector('[data-powerup-id="focusAura"]');
                if (button) {
                    button.classList.remove('powerup-aura-active');
                }
                break;
        }
        
        // CRITICAL: Update sidebar - this rebuilds UI but preserves all power-up states
        // renderSidebar() reads from quantities and activeEffects - these remain unchanged for other power-ups
        this.renderSidebar();
    },
    
    /**
     * Show brief cinematic flash for power-up activation
     * Fast, non-intrusive, with background darkening
     */
    showPowerUpActivationBanner(powerUp) {
        // Remove any existing banner/darkening first
        const existingBanner = document.getElementById('powerup-activation-banner');
        const existingDarken = document.getElementById('powerup-activation-darken');
        if (existingBanner) existingBanner.remove();
        if (existingDarken) existingDarken.remove();
        
        // Create background darkening overlay
        const darken = document.createElement('div');
        darken.id = 'powerup-activation-darken';
        darken.className = 'powerup-activation-darken';
        document.body.appendChild(darken);
        
        // Create small centered card
        const banner = document.createElement('div');
        banner.id = 'powerup-activation-banner';
        banner.className = 'powerup-activation-banner';
        banner.innerHTML = `
            <div class="powerup-banner-content">
                <span class="powerup-banner-icon">${powerUp.icon}</span>
                <span class="powerup-banner-text">${powerUp.name} Activated</span>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // Animate in
        setTimeout(() => {
            darken.classList.add('visible');
            banner.classList.add('visible');
        }, 10);
        
        // Fade out and remove after ~2 seconds total
        setTimeout(() => {
            darken.classList.remove('visible');
            banner.classList.remove('visible');
            setTimeout(() => {
                if (banner.parentNode) banner.remove();
                if (darken.parentNode) darken.remove();
            }, 300);
        }, 2000);
    },
    
    /**
     * Show activation message (legacy - kept for compatibility)
     */
    showActivationMessage(powerUp, isError = false) {
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            const originalText = messageBox.textContent;
            if (isError) {
                messageBox.textContent = `${powerUp.icon} ${powerUp.name} - PvP mode only`;
                messageBox.classList.add('powerup-message', 'powerup-error');
            } else {
                messageBox.textContent = `${powerUp.icon} ${powerUp.name} activated!`;
                messageBox.classList.add('powerup-message');
            }
            
            setTimeout(() => {
                messageBox.classList.remove('powerup-message', 'powerup-error');
                if (gameState.gameActive && !isError) {
                    messageBox.textContent = originalText;
                }
            }, 2000);
        }
    },
    
    /**
     * Setup sidebar toggle
     */
    setupEventListeners() {
        const toggle = document.getElementById('powerup-toggle');
        const sidebar = document.getElementById('powerup-sidebar');
        
        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                // Desktop: toggle collapsed state
                if (window.innerWidth > 768) {
                    sidebar.classList.toggle('collapsed');
                    const icon = toggle.querySelector('.powerup-toggle-icon');
                    if (icon) {
                        icon.textContent = sidebar.classList.contains('collapsed') ? '▲' : '▼';
                    }
                }
            });
        }
        
        // MOBILE: Tap sidebar symbol to open panel
        // CRITICAL: Use both touch and pointer events for reliable mobile input
        // Attach listener regardless of initial screen size - check at event time
        if (sidebar) {
            // Handle touch/pointer events for mobile
            const handleMobileToggle = (e) => {
                // Only process if on mobile viewport
                if (window.innerWidth <= 768) {
                    // Prevent event from bubbling to power-up buttons
                    e.stopPropagation();
                    
                    // Only toggle if clicking the sidebar container itself, not a power-up button
                    const clickedButton = e.target.closest('.powerup-button');
                    if (!clickedButton) {
                        sidebar.classList.toggle('mobile-expanded');
                    }
                }
            };
            
            // Support multiple input methods for mobile compatibility
            sidebar.addEventListener('click', handleMobileToggle);
            sidebar.addEventListener('touchstart', handleMobileToggle, { passive: true });
            sidebar.addEventListener('pointerdown', handleMobileToggle);
        }
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

// Camera state management - ensure getUserMedia is called only once per session
let cameraInitialized = false;
let cameraInitializationInProgress = false;

// Camera functionality - isolated from game rendering
async function requestCameraAccess() {
    // Prevent multiple simultaneous calls
    if (cameraInitializationInProgress) {
        console.log('Camera initialization already in progress');
        return gameState.cameraEnabled;
    }
    
    // If camera already initialized, reuse existing stream
    if (cameraInitialized && gameState.cameraStream) {
        console.log('Camera already initialized, reusing existing stream');
        // Ensure video element is properly connected
        if (cameraFeed && cameraFeed.srcObject !== gameState.cameraStream) {
            cameraFeed.srcObject = gameState.cameraStream;
            ensureVideoPlayback();
        }
        return true;
    }
    
    cameraInitializationInProgress = true;
    
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
        
        // getUserMedia called only once per session
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints,
            audio: false 
        });
        
        // Store stream persistently - never recreate
        gameState.cameraStream = stream;
        gameState.cameraEnabled = true;
        cameraInitialized = true;
        
        // Connect stream to video element (never remount the element)
        if (cameraFeed) {
            cameraFeed.srcObject = stream;
            // Wait for metadata before playing
            ensureVideoPlayback();
        }
        
        cameraPreview.style.display = 'block';
        enableCameraBtn.textContent = 'Camera Enabled';
        enableCameraBtn.disabled = true;
        enableCameraBtn.style.background = '#4CAF50';
        
        // Update status
        cameraStatus.innerHTML = '<span class="camera-icon">📹</span><span class="camera-text">Camera access granted - Anti-cheat active</span>';
        
        // Enable start button
        updateStartButtonState();
        
        // MVP: If name is already entered, auto-proceed to game board
        if (gameState.playerName && playerNameInput && playerNameInput.value.trim()) {
            // Small delay to ensure UI is ready
            setTimeout(() => {
                try {
                    // Trigger start button click to proceed to game
                    if (startBtn && !startBtn.disabled) {
                        startBtn.click();
                    }
                } catch (autoStartError) {
                    console.warn('Auto-start after camera enable failed:', autoStartError);
                    // Fallback: Just enable the button, user can click manually
                }
            }, 300);
        }
        
        // Notify admin of camera status (only when player name is set)
        if (gameState.playerName) {
            try { 
                if (socket) socket.emit('camera-status', { 
                    name: gameState.playerName, 
                    connected: true 
                }); 
            } catch(_) {}
        }
        
        cameraInitializationInProgress = false;
        return true;
    } catch (error) {
        console.error('Camera access denied:', error);
        cameraStatus.innerHTML = '<span class="camera-icon">❌</span><span class="camera-text">Camera access denied - Required to prevent cheating</span>';
        enableCameraBtn.textContent = 'Retry Camera Access';
        gameState.cameraEnabled = false;
        cameraInitialized = false;
        cameraInitializationInProgress = false;
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

// Ensure video playback only after metadata is ready - isolated camera logic
function ensureVideoPlayback() {
    if (!cameraFeed || !gameState.cameraStream) return;
    
    // Only set srcObject if not already set
    if (cameraFeed.srcObject !== gameState.cameraStream) {
        cameraFeed.srcObject = gameState.cameraStream;
    }
    
    // Play only after metadata is ready
    if (cameraFeed.readyState >= 1) { // HAVE_METADATA
        cameraFeed.play().catch(error => {
            console.log('Video play deferred (autoplay policy):', error);
            // Play will be triggered by user interaction
        });
    } else {
        cameraFeed.onloadedmetadata = () => {
            cameraFeed.play().catch(error => {
                console.log('Video play after metadata:', error);
            });
        };
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
        
        // Stop periodic status updates
        stopCameraStatusUpdates();
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
// TURN servers included for ngrok/cross-network compatibility
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
        
        // Handle track ended (camera disconnected) - auto-reconnect for stability
        track.onended = () => {
            console.log('Camera track ended - attempting reconnection');
            gameState.cameraEnabled = false;
            
            // Auto-reconnect camera stream if track ends (fixes black screen issue)
            if (peerConnectionReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                setTimeout(() => {
                    // Check if stream still exists but track ended
                    if (gameState.cameraStream) {
                        const tracks = gameState.cameraStream.getTracks();
                        const hasLiveTrack = tracks.some(t => t.readyState === 'live');
                        
                        if (!hasLiveTrack) {
                            // Stream exists but no live tracks - request new access
                            console.log('Reconnecting camera - requesting new stream');
                            requestCameraAccess().then(success => {
                                if (success && gameState.cameraStream) {
                                    startCameraStreaming();
                                    peerConnectionReconnectAttempts = 0; // Reset on success
                                } else {
                                    peerConnectionReconnectAttempts++;
                                }
                            }).catch(() => {
                                peerConnectionReconnectAttempts++;
                            });
                        } else {
                            // Stream has live tracks - just restart streaming
                            startCameraStreaming();
                            peerConnectionReconnectAttempts = 0; // Reset on success
                        }
                    } else {
                        // No stream - request new access
                        console.log('Reconnecting camera - no stream available');
                        requestCameraAccess().then(success => {
                            if (success && gameState.cameraStream) {
                                startCameraStreaming();
                                peerConnectionReconnectAttempts = 0;
                            } else {
                                peerConnectionReconnectAttempts++;
                            }
                        }).catch(() => {
                            peerConnectionReconnectAttempts++;
                        });
                    }
                }, 2000);
                peerConnectionReconnectAttempts++;
            } else {
                console.warn('Max camera reconnection attempts reached');
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

// Periodic camera status update to admin (every 3 seconds)
let cameraStatusUpdateInterval = null;

function startCameraStatusUpdates() {
    // Clear any existing interval
    if (cameraStatusUpdateInterval) {
        clearInterval(cameraStatusUpdateInterval);
    }
    
    // Send initial status
    sendCameraStatusUpdate();
    
    // Send status every 3 seconds
    cameraStatusUpdateInterval = setInterval(() => {
        sendCameraStatusUpdate();
    }, 3000);
}

function stopCameraStatusUpdates() {
    if (cameraStatusUpdateInterval) {
        clearInterval(cameraStatusUpdateInterval);
        cameraStatusUpdateInterval = null;
    }
}

function sendCameraStatusUpdate() {
    if (!socket || !socket.connected || !gameState.playerName) {
        return;
    }
    
    // Check camera stream status
    let isActive = false;
    let hasVideoTrack = false;
    
    if (gameState.cameraStream) {
        const tracks = gameState.cameraStream.getTracks();
        hasVideoTrack = tracks.some(track => track.kind === 'video' && track.readyState === 'live');
        isActive = hasVideoTrack;
        
        // If track ended, attempt auto-reconnect (camera stability fix)
        if (!hasVideoTrack || tracks.every(track => track.readyState === 'ended')) {
            gameState.cameraEnabled = false;
            isActive = false;
            
            // Auto-reconnect if track ended during gameplay (fixes black screen)
            if (gameState.gameActive && peerConnectionReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                console.log('Camera track ended during gameplay - attempting reconnection');
                setTimeout(() => {
                    requestCameraAccess().then(success => {
                        if (success && gameState.cameraStream) {
                            startCameraStreaming();
                            peerConnectionReconnectAttempts = 0;
                        }
                    }).catch(() => {
                        // Silent fail - will retry on next status update
                    });
                }, 3000);
                peerConnectionReconnectAttempts++;
            }
        }
    }
    
    // Send status to server (will forward to admin) - invisible to user, just backend communication
    try {
        socket.emit('camera-status-update', {
            name: gameState.playerName,
            connected: isActive && hasVideoTrack,
            hasStream: !!gameState.cameraStream,
            streamActive: hasVideoTrack,
            timestamp: Date.now()
        });
    } catch (e) {
        console.log('Error sending camera status update:', e);
    }
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
            case 'trigger-tactical-claim':
                // Admin override for Tactical Claim
                if (gameState.currentLevel === 1 && !gameState.tacticalClaimUsed && gameState.gameActive) {
                    activateTacticalClaim();
                    // Emit admin-triggered event
                    if (socket) {
                        try {
                            socket.emit('powerup-event', {
                                playerName: gameState.playerName,
                                type: 'tactical-claim-admin',
                                isAdminTriggered: true
                            });
                        } catch (e) {
                            console.error('Error emitting admin Tactical Claim event:', e);
                        }
                    }
                }
                break;
            case 'request-face-visible':
                // Show message to player to show their face
                const faceMessage = payload.value && payload.value.message 
                    ? payload.value.message 
                    : 'Please show your face so the AI anti-cheat system can see you';
                messageBox.textContent = faceMessage;
                messageBox.style.color = '#ff6600';
                messageBox.style.fontSize = '1.5rem';
                messageBox.style.fontWeight = 'bold';
                messageBox.style.animation = 'flash 0.5s ease-in-out 3';
                // Play alert sound if available
                try {
                    if (clickSound && typeof clickSound.play === 'function') {
                        clickSound.play().catch(() => {});
                    }
                } catch (e) {}
                // Reset message after 5 seconds
                setTimeout(() => {
                    messageBox.style.color = '';
                    messageBox.style.fontSize = '';
                    messageBox.style.fontWeight = '';
                    messageBox.style.animation = '';
                    if (gameState.gameActive) {
                        messageBox.textContent = gameState.playerName ? `Your turn, ${gameState.playerName}!` : 'Your turn!';
                    }
                }, 5000);
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
            
            // Animate board reset (premium animation)
            if (typeof AnimationUtils !== 'undefined') {
                const boardElement = document.querySelector('.game-board');
                if (boardElement) {
                    AnimationUtils.clearWinningLine(boardElement);
                    AnimationUtils.animateBoardReset(cells);
                }
            } else {
                cells.forEach(cell => {
                    cell.textContent = '';
                    cell.removeAttribute('data-mark');
                });
            }
            
            resetBtn.style.display = 'none';
            
            // MVP: Animate board entry ONLY on first PvP start - prevent shrinking between rounds
            if (typeof AnimationUtils !== 'undefined' && !gameState.boardInitialized) {
                setTimeout(() => {
                    const boardElement = document.querySelector('.game-board');
                    if (boardElement) {
                        AnimationUtils.animateBoardEntry(boardElement);
                        // MVP: Lock board dimensions after initial animation completes
                        setTimeout(() => {
                            boardElement.style.opacity = '1';
                            boardElement.style.transform = 'translateY(0)';
                            boardElement.style.transition = 'none'; // Remove transitions to prevent shrinking
                            gameState.boardInitialized = true; // Mark as initialized
                        }, 450); // After animation completes (400ms + 50ms buffer)
                    }
                    AnimationUtils.animateMessage(messageBox, 'default');
                }, 350);
            } else if (gameState.boardInitialized) {
                // MVP: Board already initialized - ensure it stays locked
                const boardElement = document.querySelector('.game-board');
                if (boardElement) {
                    boardElement.style.opacity = '1';
                    boardElement.style.transform = 'translateY(0)';
                    boardElement.style.transition = 'none'; // Ensure no transitions
                }
            }
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
        // Get current theme
        const currentTheme = (typeof ThemeManager !== 'undefined' && ThemeManager.getCurrentTheme()) 
            ? ThemeManager.getCurrentTheme() 
            : 'light';
        
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
            // Level visibility data - ALWAYS Level 1 until graduation
            currentLevel: 1, // FORCE Level 1 display (never show other level numbers)
            level1Wins: gameState.level1Wins || 0,
            aiWinsInLevel: gameState.aiWinsInLevel || 0, // AI wins in current level
            roundCount: gameState.roundCount || 0, // Total rounds completed (includes draws)
            tacticalClaimUsed: gameState.tacticalClaimUsed || false,
            theme: currentTheme,
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
        cells[bestIdx].setAttribute('data-mark', 'O');
        
        // Animate cell placement (premium animation)
        if (typeof AnimationUtils !== 'undefined') {
            AnimationUtils.animateCellPlacement(cells[bestIdx]);
        }
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
// TAUNTING SYSTEM: The AI does NOT praise players. Ever.
// The AI exists to: Mock, Taunt, Undermine confidence, Apply pressure, Distract
// Taunts must feel: Intelligent, Context aware, Mean but fun, Not repetitive
const tauntMessages = [
    // Context-aware taunts
    "Are you even trying?",
    "You play worse than a chicken!",
    "Pathetic! Is that all you've got?",
    "My grandmother plays better than you!",
    "Is this your first time playing?",
    "You're making this too easy!",
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
    "Even luck gave up on you.",
    // Additional variety
    "Predictable.",
    "I knew you'd do that.",
    "How original.",
    "Tell me you're new without telling me.",
    "This is getting sad.",
    "I'm almost impressed by how bad that was.",
    "Did you think about that move?",
    "Swing and a miss.",
    "Close... if close meant impossible.",
    "Thanks for the free win.",
    "You're making my job easy.",
    "I've seen better play from a bot... on easy mode.",
    "Maybe try thinking first?",
    "That wasn't even close to good.",
    "You're predictable and bad.",
    "I could win blindfolded.",
    "Your best move is quitting.",
    "Each game just gets worse for you.",
    "I'm starting to feel bad. Almost.",
    "You're not improving. At all."
];

// Taunt triggers tracking (to avoid repetition)
let recentTauntTypes = [];
const MAX_RECENT_TAUNTS = 5;

// After entering name & enabling camera, show mode selection (AI or Player)
// UI INPUT GUARANTEE: Button must ALWAYS respond - if handler fails, reset and proceed
startBtn.addEventListener('click', () => {
    try {
    gameState.playerName = playerNameInput.value.trim();

    if (!gameState.playerName) {
            if (messageBox) messageBox.textContent = "Enter your name to proceed...";
        return;
    }

    if (!gameState.cameraEnabled) {
            if (messageBox) messageBox.textContent = "Camera access is required to prevent cheating!";
        return;
    }

    // Hide welcome screen and show mode selection page
    const modeSelect = document.getElementById('mode-select');
    if (welcomeScreen) welcomeScreen.classList.remove('active');
    if (modeSelect) modeSelect.classList.remove('hidden');
        
        // FAILSAFE: Ensure game state is valid
        gameState.gameActive = false; // Will be set to true when game starts
        
    // Announce presence to server so other players see us in lobby immediately
    try {
        if (socket) socket.emit('player-start', { name: gameState.playerName });
    } catch (e) {
        console.log('Could not announce presence to server:', e);
            // Continue anyway - not critical
        }
    } catch (e) {
        // FAILSAFE: If handler fails, log and reset state
        console.error('Error in start button handler (resetting):', e);
        gameState.gameActive = false;
        if (messageBox) messageBox.textContent = "Please try again.";
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

/**
 * Show name entry explanation (STAGE 2: NAME ENTRY SCREEN)
 * UX ONLY: Explains that AI will remember how they play, implies intelligence
 */
function showNameEntryExplanation() {
    const nameInput = document.getElementById('player-name');
    if (!nameInput) return;
    
    // Show subtle explanation after name is entered
    nameInput.addEventListener('blur', () => {
        if (nameInput.value.trim()) {
            // Create subtle tooltip/explanation
            const explanation = document.createElement('div');
            explanation.className = 'name-explanation';
            explanation.textContent = 'The AI will remember how you play.';
            explanation.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                margin-top: 8px;
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.7);
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;
            
            const formContainer = nameInput.closest('.form-container');
            if (formContainer) {
                formContainer.style.position = 'relative';
                formContainer.appendChild(explanation);
                
                setTimeout(() => {
                    explanation.style.opacity = '1';
                }, 10);
                
                // Remove after 3 seconds
                setTimeout(() => {
                    explanation.style.opacity = '0';
                    setTimeout(() => {
                        explanation.remove();
                    }, 300);
                }, 3000);
            }
        }
    }, { once: true });
}

// Initialize name entry explanation
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showNameEntryExplanation);
} else {
    showNameEntryExplanation();
}

// Start game as AI (extract of previous start logic)
function startGameAsAI() {
    // MVP: Mark that game has started once - prevents Play Game button from reappearing
    gameState.hasGameStartedOnce = true;
    
    displayName.textContent = gameState.playerName;
    
    // Hide welcome screen with smooth fade, then fully remove onboarding DOM
    if (welcomeScreen) {
        try {
        welcomeScreen.style.opacity = '0';
        welcomeScreen.style.transition = 'opacity 0.4s ease-out';
        setTimeout(() => {
            welcomeScreen.classList.remove('active');
                // MVP: Fully unmount welcome screen so it cannot push layout
                if (welcomeScreen.parentNode) {
                    welcomeScreen.parentNode.removeChild(welcomeScreen);
                }
        }, 400);
        } catch (e) {
            console.warn('[Layout] Failed to fade/remove welcome screen:', e);
            // Hard fallback: force-remove without animation
            try {
                if (welcomeScreen.parentNode) {
                    welcomeScreen.parentNode.removeChild(welcomeScreen);
                }
            } catch (_) {}
        }
    }

    // MVP: Also ensure pre-welcome and theme overlays are removed from DOM
    try {
        const preOverlay = document.getElementById('pre-welcome-overlay');
        if (preOverlay && preOverlay.parentNode) {
            preOverlay.parentNode.removeChild(preOverlay);
        }
        const themeOverlay = document.getElementById('theme-selection-overlay');
        if (themeOverlay && themeOverlay.parentNode) {
            themeOverlay.parentNode.removeChild(themeOverlay);
        }
    } catch (e) {
        console.warn('[Layout] Failed to remove onboarding overlays (non‑critical):', e);
    }
    
    // Show game screen with smooth fade
    gameScreen.style.opacity = '0';
    gameScreen.classList.add('active');
    setTimeout(() => {
        gameScreen.style.transition = 'opacity 0.4s ease-out';
        gameScreen.style.opacity = '1';

        // MVP: Hard-reset scroll so board is immediately visible, no vertical gap
        try {
            window.scrollTo({ top: 0, behavior: 'auto' });
        } catch (_) {
            window.scrollTo(0, 0);
        }
    }, 100);

    // STAGE 5: FINAL PRE-PLAY MESSAGE
    // Just before first move: One last short line, Something ominous, No advice, No friendliness
    messageBox.textContent = "Let's see what you're made of...";
    
    // MVP: Animate board entry ONLY on first game start - prevent shrinking between rounds
    if (typeof AnimationUtils !== 'undefined' && !gameState.boardInitialized) {
        setTimeout(() => {
            const boardElement = document.querySelector('.game-board');
            if (boardElement) {
                AnimationUtils.animateBoardEntry(boardElement);
                // MVP: Lock board dimensions after initial animation completes
                setTimeout(() => {
                    boardElement.style.opacity = '1';
                    boardElement.style.transform = 'translateY(0)';
                    boardElement.style.transition = 'none'; // Remove transitions to prevent shrinking
                    gameState.boardInitialized = true; // Mark as initialized
                }, 450); // After animation completes (400ms + 50ms buffer)
            }
            AnimationUtils.animateMessage(messageBox, 'default');
        }, 200);
    } else if (gameState.boardInitialized) {
        // MVP: Board already initialized - ensure it stays locked
        const boardElement = document.querySelector('.game-board');
        if (boardElement) {
            boardElement.style.opacity = '1';
            boardElement.style.transform = 'translateY(0)';
            boardElement.style.transition = 'none'; // Ensure no transitions
        }
    }
    
    // Fade out AI presence during active play (subtle presence only)
    if (typeof aiPresenceGameplay !== 'undefined' && aiPresenceGameplay) {
        setTimeout(() => {
            aiPresenceGameplay.classList.remove('active');
            aiPresenceGameplay.classList.add('hidden');
        }, 1000);
    }
    
    // Start background music
    if (bgMusic) {
        bgMusic.volume = 0.3; // Set volume to 30%
        bgMusic.play().catch(e => console.log('Could not play background music:', e));
    }
    
    // Initialize Power-Up Manager
    if (typeof PowerUpManager !== 'undefined') {
        PowerUpManager.init();
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
        
        // Start periodic camera status updates
        startCameraStatusUpdates();
        
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
        // Still start status updates (to report that camera is off)
        startCameraStatusUpdates();
    }

    reportSessionStart();
    try { if (socket) socket.emit('player-start', { name: gameState.playerName }); } catch(_) {}
    emitBoardUpdate();
    
    // CRITICAL: Ensure Sarah narrative overlay is completely removed and doesn't block input
    if (sarahNarrativeOverlay) {
        sarahNarrativeOverlay.classList.remove('active');
        sarahNarrativeOverlay.classList.add('hidden');
        sarahNarrativeOverlay.style.pointerEvents = 'none';
        sarahNarrativeOverlay.style.display = 'none';
        sarahNarrativeOverlay.style.zIndex = '-1';
    }
    
    // CRITICAL: Ensure game is active and UI is unlocked for board interaction
    gameState.gameActive = true;
    gameState.uiLocked = false;
    gameState.uiLockingReason = null;
    
    // CRITICAL: Force enable all cells and ensure they're clickable
    const cells = Array.from(document.querySelectorAll('.cell'));
    cells.forEach(cell => {
        if (cell) {
            cell.style.pointerEvents = 'auto';
            cell.style.cursor = 'pointer';
            cell.style.zIndex = '1';
            // Remove any disabled states
            cell.removeAttribute('disabled');
            cell.classList.remove('disabled');
        }
    });
    
    // CRITICAL: Ensure game board itself is not blocked
    const boardElement = document.querySelector('.game-board');
    if (boardElement) {
        boardElement.style.pointerEvents = 'auto';
        boardElement.style.zIndex = '1';
    }
}

// Sarah Narrative System (presentation only, no gameplay logic changes)
const sarahNarrativeOverlay = document.getElementById('sarah-narrative-overlay');
const sarahNarrativeText = document.getElementById('sarah-narrative-text');
const sarahNarrativeActions = document.getElementById('sarah-narrative-actions');
let sarahDifficultyChoice = null; // 'easy' or 'hard'
let sarahWinCount = 0; // Track wins for narrative only

function isSarah() {
    // Case-insensitive Sarah detection: 'Sarah', 'SARAH', 'sarah', etc.
    return gameState.playerName && gameState.playerName.trim().toLowerCase() === 'sarah';
}

function showSarahNarrative(message, actions) {
    if (!sarahNarrativeOverlay || !sarahNarrativeText || !sarahNarrativeActions) return;
    
    sarahNarrativeText.textContent = message;
    sarahNarrativeActions.innerHTML = '';
    
    if (actions && actions.length > 0) {
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'sarah-narrative-btn' + (action.secondary ? ' secondary' : '');
            btn.textContent = action.label;
            btn.onclick = () => {
                if (action.callback) action.callback();
            };
            sarahNarrativeActions.appendChild(btn);
        });
    } else {
        // Skip button if no actions
        const skipBtn = document.createElement('button');
        skipBtn.className = 'sarah-narrative-btn secondary';
        skipBtn.textContent = 'Continue';
        skipBtn.onclick = () => {
            sarahNarrativeOverlay.classList.remove('active');
            sarahNarrativeOverlay.classList.add('hidden');
        };
        sarahNarrativeActions.appendChild(skipBtn);
    }
    
    sarahNarrativeOverlay.classList.remove('hidden');
    setTimeout(() => {
        sarahNarrativeOverlay.classList.add('active');
    }, 10);
}

function hideSarahNarrative() {
    if (!sarahNarrativeOverlay) return;
    // CRITICAL: Immediately disable pointer events to prevent blocking board clicks
    sarahNarrativeOverlay.style.pointerEvents = 'none';
    sarahNarrativeOverlay.classList.remove('active');
    setTimeout(() => {
        sarahNarrativeOverlay.classList.add('hidden');
        // Ensure overlay is completely disabled
        sarahNarrativeOverlay.style.pointerEvents = 'none';
        sarahNarrativeOverlay.style.display = 'none';
    }, 400);
}

// Mode selection buttons
const modeAiBtn = document.getElementById('mode-ai');
const modePlayerBtn = document.getElementById('mode-player');
if (modeAiBtn) {
    modeAiBtn.addEventListener('click', () => {
        const modeSelect = document.getElementById('mode-select');
        if (modeSelect) modeSelect.classList.add('hidden');
        
        // Show Sarah narrative before starting game - enhanced immersive welcome
        if (isSarah()) {
            showSarahNarrative(
                "Good evening, Miss Sarah. It is an honor and privilege to welcome the master's daughter. Your father has entrusted me with ensuring you have the finest experience. I am here to support your growth and celebrate your achievements. How would you like to proceed today?",
                [
                    {
                        label: 'Easy Mode',
                        callback: () => {
                            sarahDifficultyChoice = 'easy';
                            showSarahNarrative(
                                "An excellent choice, Miss Sarah. Easy mode will allow you to build confidence and enjoy the game. I shall provide gentle guidance and encouragement throughout. Shall we begin?",
                                [
                                    {
                                        label: 'Begin',
                                        callback: () => {
                                            hideSarahNarrative();
                                            // CRITICAL: Wait for overlay to fully hide before starting game
                                            setTimeout(() => startGameAsAI(), 500);
                                        }
                                    }
                                ]
                            );
                        }
                    },
                    {
                        label: 'Hard Mode',
                        callback: () => {
                            sarahDifficultyChoice = 'hard';
                            showSarahNarrative(
                                "Miss Sarah, I must express my concern with the utmost respect. The hard mode presents significant challenges, and while I have every confidence in your abilities, I would not wish to see you face unnecessary difficulty. However, if you are determined to test your skills, I shall be here to support you with calm encouragement and respectful guidance. Are you certain you wish to proceed?",
                                [
                                    {
                                        label: 'Yes, I am sure',
                                        callback: () => {
                                            showSarahNarrative(
                                                "Very well, Miss Sarah. I admire your determination. I shall be here to provide encouragement and support, even when the challenges become difficult. Let us begin your training.",
                                                [
                                                    {
                                                        label: 'Begin',
                                                        callback: () => {
                                                            hideSarahNarrative();
                                                            // CRITICAL: Wait for overlay to fully hide before starting game
                                                            setTimeout(() => startGameAsAI(), 500);
                                                        }
                                                    }
                                                ]
                                            );
                                        }
                                    },
                                    {
                                        label: 'Choose Easy Instead',
                                        callback: () => {
                                            sarahDifficultyChoice = 'easy';
                                            showSarahNarrative(
                                                "A wise decision, Miss Sarah. Easy mode will provide a more comfortable experience. Shall we begin?",
                                                [
                                                    {
                                                        label: 'Begin',
                                                        callback: () => {
                                                            hideSarahNarrative();
                                                            // CRITICAL: Wait for overlay to fully hide before starting game
                                                            setTimeout(() => startGameAsAI(), 500);
                                                        }
                                                    }
                                                ]
                                            );
                                        },
                                        secondary: true
                                    }
                                ]
                            );
                        },
                        secondary: true
                    }
                ]
            );
        } else {
            // ALWAYS show power-up guide before first game (restored for tutorial)
            // Guide pauses gameplay until dismissed
            showPowerUpGuide(true); // true = first play
        }
    });
}

/**
 * Power Up Guide System
 */
let currentGuidePage = 1;
// MVP: Keep JS in sync with HTML - there are exactly 8 guide pages
const totalGuidePages = 8;

/**
 * Show power-up guide
 * @param {boolean} isFirstPlay - If true, this is shown before first game
 */
function showPowerUpGuide(isFirstPlay = false) {
    const guideOverlay = document.getElementById('powerup-guide-overlay');
    if (!guideOverlay) {
        console.warn('Guide overlay not found, starting game directly');
        // If guide doesn't exist, start game directly
        startGameAsAI();
        return;
    }
    
    // Ensure overlay is visible
    guideOverlay.style.display = 'flex';
    guideOverlay.classList.remove('hidden');
    
    currentGuidePage = 1;
    updateGuidePage();
    
    // Show overlay with animation
    setTimeout(() => {
        guideOverlay.classList.add('active');
    }, 50);
    
    // Animate level circles on page 2
    if (isFirstPlay) {
        setTimeout(() => {
            animateLevelCircles();
        }, 500);
    }
    
    // Setup navigation
    setupGuideNavigation(isFirstPlay);
}

/**
 * Hide power-up guide
 * CRITICAL: Must re-enable all inputs immediately after closing
 */
function hidePowerUpGuide() {
    const guideOverlay = document.getElementById('powerup-guide-overlay');
    if (!guideOverlay) return;
    
    guideOverlay.classList.remove('active');
    setTimeout(() => {
        guideOverlay.classList.add('hidden');
        
        // MVP: Smooth scroll to game board immediately after guidebook closes
        // Ensure board is visible with minimal gap
        try {
            const gameBoard = document.querySelector('.game-board');
            const gameScreen = document.getElementById('game-screen');
            
            if (gameBoard && gameScreen && gameScreen.classList.contains('active')) {
                // MVP: Scroll to board smoothly (0.3-0.5 seconds) with minimal offset
                setTimeout(() => {
                    const boardRect = gameBoard.getBoundingClientRect();
                    const scrollOffset = window.pageYOffset || document.documentElement.scrollTop;
                    // MVP: Minimal top spacing (10-20px) - no huge gap
                    const topPadding = Math.max(10, Math.min(20, window.innerWidth > 768 ? 20 : 10));
                    const targetY = boardRect.top + scrollOffset - topPadding;
                    
                    window.scrollTo({
                        top: Math.max(0, targetY),
                        behavior: 'smooth'
                    });
                    
                    console.log('[Guide] Scrolled to game board with minimal gap');
                }, 100); // Small delay to ensure DOM is ready
            }
        } catch (scrollError) {
            console.warn('[Guide] Scroll to board failed (non-critical):', scrollError);
        }
        
        // MVP: Ensure no large gaps - reset any scroll position if needed
        try {
            // If page was scrolled down during guidebook, reset to top of game screen
            const gameScreen = document.getElementById('game-screen');
            if (gameScreen && gameScreen.classList.contains('active')) {
                // Only scroll if we're way down the page
                if (window.scrollY > 200) {
                    setTimeout(() => {
                        gameScreen.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start',
                            inline: 'nearest'
                        });
                    }, 200);
                }
            }
        } catch (resetError) {
            console.warn('[Guide] Scroll reset failed (non-critical):', resetError);
        }
        
        // CRITICAL: Re-enable all inputs immediately after guide closes
        // No screen, overlay, animation, or modal is allowed to trap clicks
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
        gameState.gameActive = true; // Ensure game is active if it should be
        
        // Release any waiting handlers
        if (typeof window.__guideCloseHandler === 'function') {
            try {
                window.__guideCloseHandler();
                window.__guideCloseHandler = null;
            } catch (e) {
                console.error('Error in guide close handler:', e);
            }
        }
        
        // Ensure cells are clickable
        cells.forEach(cell => {
            if (cell) {
                cell.style.pointerEvents = 'auto';
            }
        });
        
        console.log('[Guide] Guide closed - all inputs re-enabled');
    }, 400);
    
    // Stop all demo animations when guide closes
    stopAllGuideDemos();
    
    // Don't mark guide as seen - allow it to show again if needed
    // localStorage.setItem('powerupGuideSeen', 'true'); // Removed - guide always available
}

// Guidebook demo animation intervals (for cleanup)
let guideDemoIntervals = {
    hint: null,
    boardShake: null,
    lastStand: null
};

/**
 * Stop all guidebook demo animations
 */
function stopAllGuideDemos() {
    Object.keys(guideDemoIntervals).forEach(key => {
        if (guideDemoIntervals[key]) {
            clearInterval(guideDemoIntervals[key]);
            guideDemoIntervals[key] = null;
        }
    });
}

/**
 * Guidebook Demo: Hint Pulse
 */
function startHintPulseDemo() {
    const board = document.getElementById('guide-hint-demo-board');
    const caption = document.getElementById('guide-hint-caption');
    if (!board || !caption) return;
    
    let cycleCount = 0;
    
    const runDemo = () => {
        cycleCount++;
        const cells = board.querySelectorAll('.guide-demo-cell');
        
        // Reset all cells
        cells.forEach(cell => {
            cell.classList.remove('guide-hint-pulse-demo');
        });
        
        // Highlight the best move (center cell - index 4)
        const hintCell = cells[4];
        if (hintCell) {
            hintCell.classList.add('guide-hint-pulse-demo');
            caption.textContent = 'Highlighting best move...';
            caption.classList.add('visible');
        }
        
        // After 2 seconds, show usage limit message
        setTimeout(() => {
            if (cycleCount % 2 === 0) {
                caption.textContent = 'Can be used twice per run. Locks after two uses until next run.';
            } else {
                caption.textContent = 'Highlighting best move...';
            }
        }, 2000);
    };
    
    runDemo(); // Run immediately
    guideDemoIntervals.hint = setInterval(runDemo, 4000); // Loop every 4 seconds
}

/**
 * Guidebook Demo: Board Shake
 */
function startBoardShakeDemo() {
    const board = document.getElementById('guide-board-shake-demo');
    const caption = document.getElementById('guide-shake-caption');
    if (!board || !caption) return;
    
    // Original state
    const originalState = [
        { mark: 'X', index: 0 },
        { mark: '', index: 1 },
        { mark: 'O', index: 2 },
        { mark: '', index: 3 },
        { mark: 'X', index: 4 },
        { mark: 'O', index: 5 },
        { mark: '', index: 6 },
        { mark: 'X', index: 7 },
        { mark: '', index: 8 }
    ];
    
    const resetBoard = () => {
        const cells = board.querySelectorAll('.guide-demo-cell');
        originalState.forEach((state, i) => {
            if (cells[i]) {
                cells[i].textContent = state.mark;
                cells[i].setAttribute('data-mark', state.mark);
                cells[i].setAttribute('data-index', state.index.toString());
            }
        });
    };
    
    const runDemo = () => {
        resetBoard();
        caption.textContent = '';
        caption.classList.remove('visible');
        
        // Wait a moment, then shake
        setTimeout(() => {
            board.classList.add('shaking');
            caption.textContent = 'Shaking board...';
            caption.classList.add('visible');
            
            // After shake animation, remap
            setTimeout(() => {
                const cells = board.querySelectorAll('.guide-demo-cell');
                
                // Create random permutation
                const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
                for (let i = indices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indices[i], indices[j]] = [indices[j], indices[i]];
                }
                
                // Mark cells as remapping
                cells.forEach(cell => {
                    cell.classList.add('remapping');
                });
                
                // Remap after brief delay
                setTimeout(() => {
                    const newMarks = Array(9).fill(null);
                    originalState.forEach((state, oldIndex) => {
                        newMarks[indices[oldIndex]] = state.mark;
                    });
                    
                    cells.forEach((cell, newIndex) => {
                        const mark = newMarks[newIndex];
                        cell.textContent = mark;
                        cell.setAttribute('data-mark', mark);
                        cell.classList.remove('remapping');
                    });
                    
                    board.classList.remove('shaking');
                    caption.textContent = 'Board positions have been reshuffled. All marks remain.';
                }, 300);
            }, 200);
        }, 1000);
    };
    
    runDemo(); // Run immediately
    guideDemoIntervals.boardShake = setInterval(runDemo, 5000); // Loop every 5 seconds
}

/**
 * Guidebook Demo: Last Stand
 */
function startLastStandDemo() {
    const board = document.getElementById('guide-last-stand-demo');
    const caption = document.getElementById('guide-laststand-caption');
    if (!board || !caption) return;
    
    const originalState = [
        { mark: 'O', index: 0 },
        { mark: 'O', index: 1 },
        { mark: '', index: 2 }, // AI can win here
        { mark: 'X', index: 3 },
        { mark: 'X', index: 4 },
        { mark: '', index: 5 },
        { mark: '', index: 6 },
        { mark: '', index: 7 },
        { mark: '', index: 8 }
    ];
    
    const resetBoard = () => {
        const cells = board.querySelectorAll('.guide-demo-cell');
        originalState.forEach((state, i) => {
            if (cells[i]) {
                cells[i].textContent = state.mark;
                cells[i].setAttribute('data-mark', state.mark);
                cells[i].classList.remove('losing-line', 'laststand-granted');
            }
        });
        board.classList.remove('pulsing');
        caption.textContent = '';
        caption.classList.remove('visible');
    };
    
    const runDemo = () => {
        resetBoard();
        
        // Step 1: Show "Click Last Chance" prompt
        setTimeout(() => {
            caption.textContent = 'Click Last Chance → Choose the future';
            caption.classList.add('visible');
            board.classList.add('scheduled');
        }, 500);
        
        // Step 2: Show selection (Play #3 scheduled)
        setTimeout(() => {
            caption.textContent = 'Scheduled for Play #3';
            const cells = board.querySelectorAll('.guide-demo-cell');
            // Show visual indicator that it's scheduled
            if (cells[4]) {
                cells[4].classList.add('scheduled-indicator');
            }
        }, 2000);
        
        // Step 3: Fast forward to Play #3 - show threat
        setTimeout(() => {
            resetBoard();
            const cells = board.querySelectorAll('.guide-demo-cell');
            // Highlight the losing line (cells 0, 1, 2 - AI can win)
            [0, 1, 2].forEach(idx => {
                if (cells[idx]) {
                    cells[idx].classList.add('losing-line');
                }
            });
            caption.textContent = 'Play #3: AI is about to win...';
            caption.classList.add('visible');
            
            // Step 4: Trigger Last Stand (scheduled activation)
            setTimeout(() => {
                board.classList.add('pulsing');
                caption.textContent = '⚡ LAST STAND ACTIVATED';
                
                // Show extra move granted
                setTimeout(() => {
                    const cells = board.querySelectorAll('.guide-demo-cell');
                    // Highlight a cell where player can block
                    if (cells[2]) {
                        cells[2].classList.add('laststand-granted');
                        cells[2].textContent = 'X';
                    }
                    caption.textContent = 'Second chance granted - extra move available';
                }, 600);
            }, 2000);
        }, 3500);
    };
    
    runDemo(); // Run immediately
    guideDemoIntervals.lastStand = setInterval(runDemo, 8000); // Loop every 8 seconds (longer for full flow)
}

/**
 * Update current guide page display
 */
function updateGuidePage() {
    // Stop all demos when changing pages
    stopAllGuideDemos();
    
    // Hide all pages
    document.querySelectorAll('.guide-page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show current page
    const currentPage = document.querySelector(`.guide-page[data-page="${currentGuidePage}"]`);
    if (currentPage) {
        currentPage.classList.add('active');
        
        // Start appropriate demo based on page
        setTimeout(() => {
            if (currentGuidePage === 4) {
                startHintPulseDemo();
            } else if (currentGuidePage === 5) {
                startBoardShakeDemo();
            } else if (currentGuidePage === 6) {
                startLastStandDemo();
            }
        }, 300); // Small delay to ensure page is visible
    }
    
    // Update page indicator
    const pageIndicator = document.getElementById('guide-page-number');
    if (pageIndicator) {
        pageIndicator.textContent = currentGuidePage;
    }
    
    // Update navigation buttons
    const prevBtn = document.getElementById('guide-prev');
    const nextBtn = document.getElementById('guide-next');
    const skipBtn = document.getElementById('guide-skip');
    
    if (prevBtn) {
        prevBtn.disabled = currentGuidePage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentGuidePage === totalGuidePages;
    }
    
    // Show skip button only on first page
    if (skipBtn) {
        skipBtn.style.display = currentGuidePage === 1 ? 'block' : 'none';
    }
}

/**
 * Setup guide navigation handlers
 */
function setupGuideNavigation(isFirstPlay) {
    const prevBtn = document.getElementById('guide-prev');
    const nextBtn = document.getElementById('guide-next');
    const skipBtn = document.getElementById('guide-skip');
    const startBtn = document.getElementById('guide-start-game');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentGuidePage > 1) {
                currentGuidePage--;
                updateGuidePage();
            }
        };
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentGuidePage < totalGuidePages) {
                currentGuidePage++;
                updateGuidePage();
            }
        };
    }
    
    if (skipBtn) {
        skipBtn.onclick = () => {
            hidePowerUpGuide();
            // CRITICAL: Re-enable inputs before starting game
            setTimeout(() => {
                gameState.uiLocked = false;
                gameState.uiLockingReason = null;
            startGameAsAI();
            }, 450); // Wait for guide close animation
        };
    }
    
    if (startBtn) {
        startBtn.onclick = () => {
            hidePowerUpGuide();
            // CRITICAL: Re-enable inputs before starting game
            setTimeout(() => {
                gameState.uiLocked = false;
                gameState.uiLockingReason = null;
            startGameAsAI();
            }, 450); // Wait for guide close animation
        };
    }
    
    // Setup guide icon buttons (to reopen guide) - set up every time
    setupGuideIconButtons();
}

/**
 * Setup guide icon button handlers (call on page load)
 */
function setupGuideIconButtons() {
    const guideIconBtn = document.getElementById('guide-icon-btn');
    const guideIconBtnGame = document.getElementById('guide-icon-btn-game');
    
    if (guideIconBtn) {
        guideIconBtn.onclick = () => {
            showPowerUpGuide(false);
        };
    }
    
    if (guideIconBtnGame) {
        guideIconBtnGame.onclick = () => {
            showPowerUpGuide(false);
        };
    }
}

/**
 * Animate level circles (for page 2 demo)
 */
function animateLevelCircles() {
    const circles = document.querySelectorAll('.guide-circle');
    circles.forEach((circle, index) => {
        setTimeout(() => {
            circle.classList.add('filled');
        }, index * 300);
    });
}

/**
 * Tactical Claim System (Level 1 only)
 */

/**
 * Check if Tactical Claim should be activated
 */
function shouldActivateTacticalClaim() {
    // Must be Level 1
    if (gameState.currentLevel !== 1) return false;
    
    // Must not have been used this match
    if (gameState.tacticalClaimUsed) return false;
    
    // Never early: require a real mid‑/late‑game state (at least 4 moves played)
    const totalMoves = gameState.board.filter(cell => cell !== '').length;
    if (totalMoves < 4) return false;

    // Player dominance: player must have demonstrated strength in this level.
    // Treat 2+ wins in Level 1 as "dominance" for activation purposes.
    const playerWinsInLevel = gameState.level1Wins || 0;
    if (playerWinsInLevel < 2) return false;

    // AI disadvantage: more player wins than AI wins overall this session.
    const playerWinsTotal = gameState.wins || 0;
    const aiWinsTotal = gameState.losses || 0;
    if (playerWinsTotal <= aiWinsTotal) return false;

    // Situation critical: player has at least one imminent winning move available
    // on the current board if the AI does nothing.
    let criticalThreat = false;
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'X';
            if (checkWin('X')) {
                criticalThreat = true;
                gameState.board[i] = '';
                break;
            }
            gameState.board[i] = '';
        }
    }
    if (!criticalThreat) return false;
    
    // Count empty cells (excluding shielded and reserved)
    const emptyCells = gameState.board
        .map((cell, i) => {
            if (cell !== '') return null;
            // Shield Guard removed - no shielded cell check
            if (gameState.reservedCells.some(r => r.cellIndex === i)) return null;
            return i;
        })
        .filter(i => i !== null);
    
    // Require at least 3 free targets so Tactical Claim is meaningful
    if (emptyCells.length < 3) return false;

    // LAST RESORT: if player is one win away from finishing Level 1,
    // increase the activation chance slightly, but still keep it a
    // rare tactical response, not a default pattern.
    const isLastResort = playerWinsInLevel >= 4; // Player needs 5 wins, so 4 means one away
    
    const baseChance = 0.35;       // Normal critical activation chance
    const lastResortChance = 0.75; // Higher chance when at absolute brink
    const activationChance = isLastResort ? lastResortChance : baseChance;

    return Math.random() < activationChance;
}

/**
 * Activate Tactical Claim - reserves a cell for 2 full turns
 */
function activateTacticalClaim() {
    // CRITICAL: Tactical Claim is VISUAL ONLY - must NOT block gameplay
    // This function runs synchronously and does not pause or delay anything
    
    // Find a suitable cell to reserve
    const emptyCells = gameState.board
        .map((cell, i) => {
            if (cell !== '') return null;
            // Shield Guard removed - no shielded cell check
            if (gameState.reservedCells.some(r => r.cellIndex === i)) return null;
            return i;
        })
        .filter(i => i !== null);
    
    if (emptyCells.length === 0) {
        // FAILSAFE: If no cells available, don't activate
        gameState.tacticalClaimUsed = false; // Allow retry next turn
        return;
    }
    
    // Select a cell that won't guarantee immediate win
    // Prefer center or corners (strategic but not winning)
    let selectedCell = null;
    const center = 4;
    const corners = [0, 2, 6, 8];
    
    // Try center first
    if (emptyCells.includes(center)) {
        // Check if reserving center would block a win
        const wouldBlockWin = checkIfReservingWouldBlockWin(center);
        if (!wouldBlockWin) {
            selectedCell = center;
        }
    }
    
    // Try corners if center not suitable
    if (!selectedCell) {
        for (const corner of corners) {
            if (emptyCells.includes(corner)) {
                const wouldBlockWin = checkIfReservingWouldBlockWin(corner);
                if (!wouldBlockWin) {
                    selectedCell = corner;
                    break;
                }
            }
        }
    }
    
    // Fallback to any empty cell
    if (!selectedCell && emptyCells.length > 0) {
        selectedCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }
    
    if (selectedCell === null) return;
    
    // Reserve the cell for 2 full turns (player + AI)
    gameState.reservedCells.push({
        cellIndex: selectedCell,
        turnsRemaining: 2
    });
    
    // CRITICAL: tacticalClaimUsed is set in makeAIMove before calling this function
    // Do NOT set it again here to prevent duplicate setting
    
    // Play cinematic animation
    playTacticalClaimAnimation(selectedCell);
    
    // Show AI announcement
    showTacticalClaimAnnouncement();
    
    // Emit power-up event to admin
    if (socket) {
        try {
            socket.emit('powerup-event', {
                playerName: gameState.playerName,
                type: 'tactical-claim',
                isAdminTriggered: false
            });
        } catch (e) {
            console.error('Error emitting Tactical Claim event:', e);
        }
    }
}

/**
 * Check if reserving a cell would block an immediate win
 */
function checkIfReservingWouldBlockWin(cellIndex) {
    // Temporarily reserve the cell
    const testBoard = [...gameState.board];
    testBoard[cellIndex] = 'RESERVED';
    
    // Check if player has a winning move that would be blocked
    for (let i = 0; i < 9; i++) {
        if (testBoard[i] === '') {
            testBoard[i] = 'X';
            if (checkWinOnBoard(testBoard, 'X')) {
                return true; // Would block a win
            }
            testBoard[i] = '';
        }
    }
    
    return false;
}

/**
 * Check win on a specific board state
 */
function checkWinOnBoard(board, player) {
    const winningCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    return winningCombos.some(combo => {
        return combo.every(index => board[index] === player);
    });
}

/**
 * Update Tactical Claim reservations (decrement turns, unlock if needed)
 */
function updateTacticalClaimReservations() {
    gameState.reservedCells = gameState.reservedCells.map(reservation => {
        const updated = {
            cellIndex: reservation.cellIndex,
            turnsRemaining: reservation.turnsRemaining - 1
        };
        
        // Update countdown display
        const cell = document.querySelector(`.cell[data-index="${reservation.cellIndex}"]`);
        if (cell) {
            const countdown = cell.querySelector('.tactical-claim-countdown');
            if (countdown) {
                countdown.textContent = updated.turnsRemaining;
                // Fade effect as turns decrease
                if (updated.turnsRemaining === 1) {
                    countdown.classList.add('fading');
                }
            }
        }
        
        return updated;
    }).filter(reservation => {
        if (reservation.turnsRemaining <= 0) {
            // Unlock this cell
            unlockTacticalClaimCell(reservation.cellIndex);
            return false; // Remove from list
        }
        return true; // Keep in list
    });
}

/**
 * Unlock a Tactical Claim cell
 */
function unlockTacticalClaimCell(cellIndex) {
    const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
    if (cell) {
        cell.classList.remove('tactical-claim-reserved');
        const lockIcon = cell.querySelector('.tactical-claim-lock');
        if (lockIcon) {
            lockIcon.remove();
        }
        const countdown = cell.querySelector('.tactical-claim-countdown');
        if (countdown) {
            countdown.remove();
        }
    }
}

/**
 * Clear all Tactical Claim visuals
 */
function clearTacticalClaimVisuals() {
    document.querySelectorAll('.tactical-claim-reserved').forEach(cell => {
        cell.classList.remove('tactical-claim-reserved');
        const lockIcon = cell.querySelector('.tactical-claim-lock');
        if (lockIcon) lockIcon.remove();
        const countdown = cell.querySelector('.tactical-claim-countdown');
        if (countdown) countdown.remove();
    });
}

/**
 * Get list of reserved cell indices
 */
function getReservedCellIndices() {
    return gameState.reservedCells.map(r => r.cellIndex);
}

/**
 * Play Tactical Claim cinematic animation
 * CRITICAL: This is VISUAL ONLY - must NOT block gameplay, inputs, or AI thinking
 */
function playTacticalClaimAnimation(cellIndex) {
    // FAILSAFE: If animation system fails, skip it and continue
    try {
    const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
    if (!cell) return;
    
    const board = document.querySelector('.game-board');
    if (!board) return;
    
        // CRITICAL: Ensure inputs remain enabled during animation
        // Tactical Claim animation must NEVER block clicks or pause the game
        gameState.uiLocked = false; // Explicitly unlock UI
        cells.forEach(c => {
            if (c) c.style.pointerEvents = 'auto';
        });
        
        // 0. DRAMATIC CINEMATIC ANNOUNCEMENT - bold word/phrase
    const announcement = document.createElement('div');
    announcement.className = 'tactical-claim-announcement-text';
        announcement.textContent = 'TACTICAL CLAIM';
        announcement.style.pointerEvents = 'none'; // Don't block clicks
    document.body.appendChild(announcement);
    
    // Animate announcement appearance
    setTimeout(() => {
        announcement.classList.add('active');
    }, 10);
    
        // 1. Screen dim (non-blocking overlay)
    const dimOverlay = document.createElement('div');
    dimOverlay.className = 'tactical-claim-dim';
        dimOverlay.style.pointerEvents = 'none'; // CRITICAL: Don't block clicks
    document.body.appendChild(dimOverlay);
    
    setTimeout(() => {
        dimOverlay.classList.add('active');
    }, 10);
    
        // 2. Green energy flash from AI side (non-blocking)
    setTimeout(() => {
            try {
        const flash = document.createElement('div');
        flash.className = 'tactical-claim-flash';
                flash.style.pointerEvents = 'none'; // Don't block clicks
        board.appendChild(flash);
        
        setTimeout(() => {
            flash.classList.add('active');
        }, 10);
        
        setTimeout(() => {
            flash.remove();
        }, 600);
            } catch (e) {
                console.error('Flash animation error (continued):', e);
            }
    }, 100);
    
        // 3. Cell stamp and lock animation (non-blocking)
    setTimeout(() => {
            try {
                const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
                if (!cell) return;
                
        cell.classList.add('tactical-claim-reserved');
        
        // Create lock icon
        const lockIcon = document.createElement('div');
        lockIcon.className = 'tactical-claim-lock';
        lockIcon.innerHTML = '🔒';
                lockIcon.style.pointerEvents = 'none'; // Don't block clicks
        cell.appendChild(lockIcon);
        
        // Create countdown indicator
        const countdown = document.createElement('div');
        countdown.className = 'tactical-claim-countdown';
        countdown.textContent = '2';
                countdown.style.pointerEvents = 'none'; // Don't block clicks
        cell.appendChild(countdown);
        
                // Holographic ring (non-blocking)
        const ring = document.createElement('div');
        ring.className = 'tactical-claim-ring';
                ring.style.pointerEvents = 'none';
        cell.appendChild(ring);
        
                // Shockwave (non-blocking)
        const shockwave = document.createElement('div');
        shockwave.className = 'tactical-claim-shockwave';
                shockwave.style.pointerEvents = 'none';
        board.appendChild(shockwave);
        
        setTimeout(() => {
            shockwave.classList.add('active');
        }, 10);
        
        setTimeout(() => {
            shockwave.remove();
            ring.remove();
        }, 800);
            } catch (e) {
                console.error('Cell animation error (continued):', e);
            }
    }, 300);
    
        // 4. Return to normal brightness (non-blocking)
    setTimeout(() => {
            try {
                const dimOverlay = document.querySelector('.tactical-claim-dim');
                if (dimOverlay) {
        dimOverlay.classList.remove('active');
        setTimeout(() => {
            dimOverlay.remove();
        }, 300);
                }
            } catch (e) {
                console.error('Dim overlay cleanup error (continued):', e);
            }
    }, 600);
    
        // Remove announcement after animation (visible for at least 1.5 seconds)
    setTimeout(() => {
            try {
                const announcement = document.querySelector('.tactical-claim-announcement-text');
                if (announcement) {
        announcement.classList.remove('active');
        setTimeout(() => {
            announcement.remove();
                    }, 600);
                }
            } catch (e) {
                console.error('Announcement cleanup error (continued):', e);
            }
            
            // CRITICAL: Ensure inputs are fully enabled after animation completes
            gameState.uiLocked = false;
            gameState.uiLockingReason = null;
            cells.forEach(c => {
                if (c) c.style.pointerEvents = 'auto';
            });
        }, 1500); // Show for 1.5 seconds, then fade out
    } catch (animError) {
        // FAILSAFE: If entire animation fails, ensure game continues
        console.error('Tactical Claim animation critical error (game continues):', animError);
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
    }
}

// REMOVED: activateSoulSnatch function - second-loss taunt feature completely removed

/**
 * Generic missed move taunt
 * UX ONLY - Does NOT affect AI logic
 */
function showMissedMoveTaunt() {
    // Find if player had a winning move they missed
    const missedWinningMoves = [];
    const missedBlockingMoves = [];
    
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            const testBoard = [...gameState.board];
            testBoard[i] = 'X';
            const testWinningCombo = winningCombos.find(combo => 
                combo.every(idx => testBoard[idx] === 'X')
            );
            if (testWinningCombo) {
                missedWinningMoves.push(i);
            }
            
            testBoard[i] = 'O';
            const aiWinCombo = winningCombos.find(combo => 
                combo.every(idx => testBoard[idx] === 'O')
            );
            if (aiWinCombo) {
                missedBlockingMoves.push(i);
            }
        }
    }
    
    let missedCellIndex = null;
    let tauntType = 'none';
    
    if (missedWinningMoves.length > 0) {
        missedCellIndex = missedWinningMoves[0];
        tauntType = 'win';
    } else if (missedBlockingMoves.length > 0) {
        missedCellIndex = missedBlockingMoves[0];
        tauntType = 'block';
    }
    
    if (!missedCellIndex || tauntType === 'none') {
        return;
    }
    
    gameState.uiLocked = true;
    const missedCell = cells[missedCellIndex];
    if (!missedCell) return;
    
    // Create overlay
    const tauntOverlay = document.createElement('div');
    tauntOverlay.className = 'missed-move-taunt';
    tauntOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    `;
    document.body.appendChild(tauntOverlay);
    
    setTimeout(() => {
        tauntOverlay.style.opacity = '1';
    }, 50);
    
    // Highlight missed cell
    missedCell.style.cssText += `
        box-shadow: 0 0 30px rgba(255, 0, 0, 0.8) !important;
        border: 3px solid #ff0000 !important;
        animation: pulse-red 0.5s ease-in-out 3;
        z-index: 10001;
        position: relative;
    `;
    
    const style = document.createElement('style');
    style.id = 'missed-move-pulse-style';
    style.textContent = `
        @keyframes pulse-red {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
    `;
    document.head.appendChild(style);
    
    // Show message
    const tauntMessage = document.createElement('div');
    tauntMessage.style.cssText = `
        color: #ff4444;
        font-size: 1.4rem;
        font-weight: bold;
        text-align: center;
        margin-top: 2rem;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    tauntMessage.textContent = tauntType === 'win' 
        ? "You could have won here. But you didn't."
        : "You should have blocked here. But you didn't.";
    
    tauntOverlay.appendChild(tauntMessage);
    
    setTimeout(() => {
        tauntMessage.style.opacity = '1';
    }, 300);
    
    setTimeout(() => {
        const insults = [
            "How predictable.",
            "Maybe think next time?",
            "I knew you'd miss that.",
            "Thanks for the free win.",
            "That was embarrassingly obvious."
        ];
        tauntMessage.textContent = insults[Math.floor(Math.random() * insults.length)];
        tauntMessage.style.color = '#ff6666';
    }, 1800);
    
    // Clean up after 2.5 seconds
    setTimeout(() => {
        tauntOverlay.style.opacity = '0';
        setTimeout(() => {
            tauntOverlay.remove();
            const styleEl = document.getElementById('missed-move-pulse-style');
            if (styleEl) styleEl.remove();
        }, 300);
        
        missedCell.style.cssText = '';
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
    }, 2500);
}

/**
 * Show Tactical Claim announcement
 */
function showTacticalClaimAnnouncement() {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) return;
    
    const announcements = [
        "Tactical Claim initiated.",
        "This position is now under my watch.",
        "I will secure this square.",
        "A calculated hold."
    ];
    
    const announcement = announcements[Math.floor(Math.random() * announcements.length)];
    messageBox.textContent = announcement;
    messageBox.classList.add('tactical-claim-announcement');
    
    setTimeout(() => {
        messageBox.classList.remove('tactical-claim-announcement');
    }, 3000);
}

/**
 * Show game welcome screen with Level 1 info and power-ups (legacy - kept for compatibility)
 */
function showGameWelcomeScreen() {
    // Redirect to new guide system
    showPowerUpGuide(true);
}

/**
 * Hide game welcome screen (legacy - kept for compatibility)
 */
function hideGameWelcomeScreen() {
    hidePowerUpGuide();
}

/**
 * Update level progress display
 */
function updateLevelProgress() {
    const progressFill = document.getElementById('level-progress-fill');
    const winsCount = document.getElementById('level-wins-count');
    const progressDots = document.querySelectorAll('.progress-dot');
    
    const wins = gameState.level1Wins || 0;
    const progress = Math.min((wins / 5) * 100, 100);
    
    if (progressFill) {
        progressFill.style.width = progress + '%';
    }
    
    if (winsCount) {
        winsCount.textContent = wins;
    }
    
    // Update progress dots
    if (progressDots) {
        progressDots.forEach((dot, index) => {
            if (index < wins) {
                dot.classList.add('completed');
            } else {
                dot.classList.remove('completed');
            }
        });
    }
}

/**
 * Show checkpoints briefly after a win, then hide them
 */
function showCheckpointsAfterWin() {
    const container = document.querySelector('.level-progress-container');
    if (!container) return;
    
    // Show checkpoints
    container.classList.add('show-after-win');
    
    // Hide after 3 seconds
    setTimeout(() => {
        container.classList.remove('show-after-win');
    }, 3000);
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
        
        // Shield Guard removed - no selection mode check needed
        
        // Lock UI during player move to prevent double clicks and overlapping animations
        if (gameState.uiLocked) return;
        gameState.uiLocked = true;
        gameState.uiLockingReason = 'player-move';
    
    const index = cell.dataset.index;
    if (gameState.board[index] !== '') {
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
        return;
    }
    
    // Shield Guard removed - no shielded cell check
    
    // Prevent player from clicking reserved cells (Tactical Claim)
    const reservedIndices = getReservedCellIndices();
    if (reservedIndices.includes(parseInt(index))) {
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
        messageBox.textContent = "This cell is temporarily reserved.";
        return;
    }

    clickSound.play();
    gameState.board[index] = 'X';
    cell.textContent = 'X';
    cell.setAttribute('data-mark', 'X');
    
    // Animate cell placement (premium animation)
    if (typeof AnimationUtils !== 'undefined') {
        AnimationUtils.animateCellPlacement(cell);
    }

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
                cells[blockMove].setAttribute('data-mark', 'O');
                
                // Animate cell placement (premium animation)
                if (typeof AnimationUtils !== 'undefined') {
                    AnimationUtils.animateCellPlacement(cells[blockMove]);
                }
                
                clickSound.play();
                if (gameState.aiLearningSystem.blockedWinPatterns) {
                    gameState.aiLearningSystem.blockedWinPatterns.add(patternCheck.pattern);
                    gameState.aiLearningSystem.markPatternBlocked(patternCheck.pattern);
                }
                // Conditional message for Sarah
                if (isSarah()) {
                    messageBox.textContent = "The AI adapts to your patterns, Miss Sarah.";
                } else {
                    messageBox.textContent = "The AI is adapting...";
                }
                emitBoardUpdate();
                
                // Check if AI won after blocking
                if (checkWin('O')) {
                    // Find winning combination for animation
                    const winningCombo = winningCombos.find(combo => 
                        combo.every(i => gameState.board[i] === 'O')
                    );
                    
                    // Animate winning line (premium animation)
                    if (typeof AnimationUtils !== 'undefined' && winningCombo) {
                        const boardElement = document.querySelector('.game-board');
                        if (boardElement) {
                            AnimationUtils.animateWinningLine(winningCombo, boardElement, ThemeManager?.getCurrentTheme());
                        }
                    }
                    
                    gameState.losses++;
                    lossesDisplay.textContent = gameState.losses;
                    
                    // CRITICAL: Increment level1Losses for second-loss taunt tracking
                    if (gameState.currentLevel === 1) {
                        gameState.level1Losses = (gameState.level1Losses || 0) + 1;
                    }
                    
                    if (gameState.aiLearningSystem && gameState.currentGameId) {
                        gameState.aiLearningSystem.recordGameResult('win', gameState.playerName);
                        if (socket) {
                            socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
                        }
                    }
                    
                    // REMOVED: Second-loss taunt feature
                    
                    // Conditional message for Sarah
                    if (isSarah()) {
                        endGame("The AI has blocked your pattern, Miss Sarah. Shall we continue?");
                    } else {
                        endGame("AI Wins!\nThe AI blocked your pattern!");
                    }
                    emitBoardUpdate();
                    return;
                }
                
                // Continue game after blocking - AI made its move
                if (!gameState.board.includes('')) {
                    // CRITICAL: Clear AI state before ending round (draw)
                    gameState.aiTurnInProgress = false;
                    gameState.uiLocked = false;
                    gameState.uiLockingReason = null;
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
                cells[flipIdx].setAttribute('data-mark', 'O');
                
                // Animate cell placement (premium animation)
                if (typeof AnimationUtils !== 'undefined') {
                    AnimationUtils.animateCellPlacement(cells[flipIdx]);
                }
            }
        }
        // Otherwise, allow the win - AI will learn from it
    }
    
    if (checkWin('X')) {
        // Find winning combination for animation
        const winningCombo = winningCombos.find(combo => 
            combo.every(i => gameState.board[i] === 'X')
        );
        
        // Animate winning line (premium animation)
        if (typeof AnimationUtils !== 'undefined' && winningCombo) {
            const boardElement = document.querySelector('.game-board');
            if (boardElement) {
                AnimationUtils.animateWinningLine(winningCombo, boardElement, ThemeManager?.getCurrentTheme());
            }
        }
        
        // Player wins - allow it and let AI learn from the pattern
        gameState.wins = (gameState.wins || 0) + 1;
        gameState.level1Wins = (gameState.level1Wins || 0) + 1;
        playerWinCount++;
        gameState.playerJustWon = true; // Mark that player won - AI will think longer next game
        gameState.aiThinkingDelay = 1500; // Increase thinking delay to 1.5 seconds
        
        // LEVEL 1: Track winning pattern for adaptation
        if (gameState.currentLevel === 1 && gameState.playerMoveHistory.length > 0) {
            const patternKey = gameState.playerMoveHistory.join('-');
            if (!gameState.playerWinningPatterns.includes(patternKey)) {
                gameState.playerWinningPatterns.push(patternKey);
                // Keep only last 5 winning patterns
                if (gameState.playerWinningPatterns.length > 5) {
                    gameState.playerWinningPatterns.shift();
                }
            }
        }
        
        // Mark first round as complete
        gameState.firstRoundOfSession = false;
        
        // Update wins display
        const winsDisplay = document.getElementById('wins');
        if (winsDisplay) {
            winsDisplay.textContent = gameState.wins;
        }
        
        // Update level progress and show checkpoints briefly after win
        updateLevelProgress();
        showCheckpointsAfterWin();
        
        // Check if level completed (5 wins)
        if (gameState.level1Wins >= 5) {
            // Level completed - show celebration message
            const messageBox = document.getElementById('message-box');
            if (messageBox) {
                messageBox.textContent = `Congratulations! You've completed Level 1 with ${gameState.level1Wins} wins!`;
            }
        }
        
        // Play win sound
        try {
            winSound.play();
        } catch (e) {
            console.error('Error playing win sound:', e);
        }
        
        // Animate message (premium animation)
        if (typeof AnimationUtils !== 'undefined' && messageBox) {
            AnimationUtils.animateMessage(messageBox, 'win');
        }
        
        // Report win to server
        try {
            reportWin();
        } catch (e) {
            console.error('Error reporting win:', e);
        }
        
        // Conditional narrative for Sarah - enhanced butler feedback
        let winMessage = "You win... for now.";
        if (isSarah()) {
            sarahWinCount++;
            if (sarahDifficultyChoice === 'easy' && sarahWinCount === 5) {
                // After 5th win on Easy mode - gentle message about growth
                winMessage = "Magnificent, Miss Sarah! Your fifth victory demonstrates remarkable progress. Your father has mentioned that he wishes for you to grow stronger. Perhaps we should consider more challenging training when you are ready. I am proud of your dedication.";
            } else if (sarahWinCount === 1) {
                winMessage = "Excellent play, Miss Sarah! Your first victory is well-earned. I am pleased to see your skills developing.";
            } else if (sarahWinCount === 3) {
                winMessage = "Outstanding, Miss Sarah! Three victories now. Your consistency is admirable, and I can see your understanding of the game deepening.";
            } else {
                // Regular win message for Sarah with variety
                const sarahWinMessages = [
                    "Excellent play, Miss Sarah. Well done.",
                    "Splendid victory, Miss Sarah. Your strategy was impressive.",
                    "Well executed, Miss Sarah. I am proud of your performance.",
                    "Brilliant move, Miss Sarah. You continue to improve.",
                    "Superb play, Miss Sarah. Your skills are developing beautifully."
                ];
                winMessage = sarahWinMessages[Math.floor(Math.random() * sarahWinMessages.length)];
            }
            
            // Add subtle visual feedback for Sarah wins
            if (typeof AnimationUtils !== 'undefined') {
                const messageElement = document.getElementById('message-box');
                if (messageElement) {
                    messageElement.style.transition = 'all 0.5s ease';
                    messageElement.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.6)';
                    setTimeout(() => {
                        messageElement.style.boxShadow = '';
                    }, 2000);
                }
            }
        }
        
        // End game (this will handle AI learning)
        try {
            endGame(winMessage);
        } catch (e) {
            console.error('Error in endGame:', e);
            // Fallback: just disable game
            gameState.gameActive = false;
            messageBox.textContent = winMessage;
            resetBtn.style.display = 'block';
        }
        
        emitBoardUpdate();
        return;
    }

    if (!gameState.board.includes('')) {
        // CRITICAL: Draw handling - must clear AI state before ending round
        // This prevents AI from getting stuck in "thinking" state
        
        // Clear AI turn lock immediately (draw ends the round)
        gameState.aiTurnInProgress = false;
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
        
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
        
        // End game - will trigger unified round transition
        endGame("It's a draw!");
        return;
    }

    // LAST STAND: Forward-only deployment - check if scheduled and conditions met
    // Only trigger if:
    // 1. Last Stand is scheduled for current play count
    // 2. Player is one move away from losing
    // 3. Last Stand hasn't been used this game
    if (gameState.lastStandScheduledForPlay !== null && 
        gameState.currentPlayCount === gameState.lastStandScheduledForPlay &&
        !gameState.lastStandUsed && 
        !checkWin('X') && 
        !checkWin('O') && 
        gameState.board.includes('')) {
        
        // Check if AI can win on next move
        let aiCanWin = false;
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '') {
                const testBoard = [...gameState.board];
                testBoard[i] = 'O';
                if (checkWinOnBoard(testBoard, 'O')) {
                    aiCanWin = true;
                    break;
                }
            }
        }
        
        // Trigger Last Stand if AI can win and scheduled play count matches
        if (aiCanWin) {
            PowerUpManager.activeEffects['lastStand'] = true;
            PowerUpManager.createLastStand();
            
            // CRITICAL: Trigger AI recalculation - Last Stand activated
            gameState.aiRecalculationNeeded = true;
            
            // Mark as used and clear scheduled value
            gameState.lastStandUsed = true;
            gameState.lastStandScheduledForPlay = null;
            
            // Grant extra move - player can move again immediately
            gameState.uiLocked = false;
            return; // Exit early - player gets another turn
        }
    }
    
    // PACING: AI thinking delay with smooth transitions
    // Longer if player just won, but ensure minimum pacing
    const thinkingDelay = Math.max(300, gameState.aiThinkingDelay || 500); // Minimum 300ms for pacing
    messageBox.textContent = "AI is thinking...";
    
    // Lock UI during player move animation
    gameState.uiLocked = true;
    const cellAnimationDuration = 180; // Match CSS animation duration
    const pacingDelayAfterMove = 100; // Small delay after move for pacing
    
    // Wait for cell animation + pacing delay, then AI thinking delay
    setTimeout(() => {
        gameState.uiLocked = false;
        
        // PACING: Small delay before showing "AI is thinking" for smoothness
        setTimeout(() => {
            // Now trigger AI move after thinking delay
            setTimeout(() => {
                // CRITICAL: Single-source-of-truth check - aiMoveInProgress is authoritative
                if (gameState.aiMoveInProgress) {
                    console.warn('[AI] Move already in progress (aiMoveInProgress=true), skipping scheduled move');
                    return;
                }
                // Secondary check
                if (gameState.aiTurnInProgress) {
                    console.warn('[AI] Turn already in progress (aiTurnInProgress=true), skipping scheduled move');
                    return;
                }
                // Lock UI again before AI move
                gameState.uiLocked = true;
                makeAIMove();
                
                // Reset thinking delay after move (but keep it slightly longer if player won)
                if (gameState.playerJustWon) {
                    gameState.aiThinkingDelay = 800; // Keep it at 800ms for a few moves
                }
            }, thinkingDelay);
        }, pacingDelayAfterMove);
    }, cellAnimationDuration + pacingDelayAfterMove);
    
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
        cell.setAttribute('data-mark', 'X');
        
        // Animate cell placement (premium animation)
        if (typeof AnimationUtils !== 'undefined') {
            AnimationUtils.animateCellPlacement(cell);
        }

        if (checkWinTsukuyomi('X')) {
            setTimeout(() => {
                winSound.play();
                messageBox.textContent = "Foolish little brother... You never stood a chance.";
                gameState.losses++;
                lossesDisplay.textContent = gameState.losses;
                
                // CRITICAL: Increment level1Losses for second-loss taunt tracking
                if (gameState.currentLevel === 1) {
                    gameState.level1Losses = (gameState.level1Losses || 0) + 1;
                }
                
                // REMOVED: Second-loss taunt feature
                
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
                cells[aiIndex].setAttribute('data-mark', 'O');
                
                // Animate cell placement (premium animation)
                if (typeof AnimationUtils !== 'undefined') {
                    AnimationUtils.animateCellPlacement(cells[aiIndex]);
                }
                
                clickSound.play();
            }
        }, 500);
    } else {
        originalHandleCellClick(cell);
    }
};

function makeAIMove() {
    // CRITICAL: Single-source-of-truth turn lock - prevent AI from playing twice
    // ENFORCE: AI move may ONLY start if aiMoveInProgress === false
    // This is the authoritative check - all other checks are secondary
    if (gameState.aiMoveInProgress) {
        console.warn('[AI] Move already in progress (aiMoveInProgress=true), ignoring duplicate call');
        return;
    }
    
    // Secondary check for additional safety
    if (gameState.aiTurnInProgress) {
        console.warn('[AI] Turn already in progress (aiTurnInProgress=true), ignoring duplicate call');
        return;
    }
    
    // FAILSAFE: If game is blocked, don't attempt move
    // CRITICAL: Do NOT pause music when game is blocked - music continues as global ambience
    if (!gameState.gameActive || gameState.inInteractiveMode) {
        return;
    }
    
    // CRITICAL: Lock turn IMMEDIATELY before any async operations
    // Set BOTH locks to prevent any possibility of double moves
    // This must be the FIRST thing after validation checks
    // Once locked, no async callback, timeout, or animation can trigger a second move
    // aiMoveInProgress is the single source of truth
    gameState.aiMoveInProgress = true;
    gameState.aiTurnInProgress = true;
    
    // CRITICAL: AI Strategy Recalculation Trigger
    // If power-up changed board state, invalidate previous evaluation and recompute
    if (gameState.aiRecalculationNeeded) {
        gameState.aiRecalculationNeeded = false;
        // Force fresh evaluation - AI will recompute from current board state
        // This ensures AI doesn't use pre-power-up planned moves
    }
    
    // CRITICAL: Use try/finally to guarantee turn unlock
    let moveExecuted = false;
    let index = null;
    let aiMoveTimeout = null;
    
    try {

    // Shields remain active for entire match - do NOT remove after AI move
    
    // Update Tactical Claim reserved cells (decrement turns, unlock if needed)
    updateTacticalClaimReservations();
    
    // Check if Tactical Claim should be activated (Level 1 only, once per match, mid-game)
    // CRITICAL: Tactical Claim is VISUAL ONLY - it must NOT block gameplay, pause turns, or delay AI moves
    // It may not pause the game, delay turns, suppress AI moves, or override win detection
    // CRITICAL: Do NOT activate during AI turn - only check, don't interrupt
    if (gameState.currentLevel === 1 && !gameState.tacticalClaimUsed) {
        try {
        const shouldActivate = shouldActivateTacticalClaim();
        if (shouldActivate) {
                // Activate Tactical Claim visual effects (non-blocking)
                // CRITICAL: This must NOT affect turn state or cause AI to play twice
            activateTacticalClaim();
                // Mark as used immediately to prevent re-activation
                gameState.tacticalClaimUsed = true;
                // CRITICAL: Tactical Claim does NOT pause, delay, or block anything
                // AI immediately continues with full decision logic
            }
        } catch (e) {
            // FAILSAFE: If Tactical Claim causes any error, skip it and continue
            console.error('Tactical Claim error (skipped):', e);
            // Do NOT reset tacticalClaimUsed on error - prevent infinite retries
        }
    }

    // CRITICAL: AI must respond within time budget - use timeout for safety (reduced to 500ms)
    // This prevents AI thinking freeze and ensures smooth gameplay
    aiMoveTimeout = setTimeout(() => {
        // FALLBACK: If AI takes too long, use simplified heuristic
        console.warn('[AI] Move timeout - using fallback move');
        const reservedIndices = getReservedCellIndices();
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (emptyCells.length > 0) {
            index = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            console.log('[AI] Timeout fallback selected move:', index);
        }
    }, 500); // 500ms timeout - prevents deadlock and ensures smooth pacing

    try {
    // If a subtle pending move was prepared during a blackout, use it if still valid
    if (gameState.pendingCheatMoveIndex !== null && gameState.board[gameState.pendingCheatMoveIndex] === '') {
        index = gameState.pendingCheatMoveIndex;
        gameState.pendingCheatMoveIndex = null;
    } else if (gameState.isKingWilliam) {
        const reservedIndices = getReservedCellIndices();
        const emptyIndices = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (emptyIndices.length > 0) {
            index = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        }
    } else {
        index = chooseHardAIMove();
    }

    // Clear timeout once move is selected
    clearTimeout(aiMoveTimeout);

    // CRITICAL: HARD FAILSAFE - If index is still null, force a move
    if (index === null || index === undefined) {
        console.warn('[AI] Move selection returned null - using hard failsafe');
        const reservedIndices = getReservedCellIndices();
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (emptyCells.length > 0) {
            index = emptyCells[0]; // Always pick first available - guaranteed move
            console.log('[AI] Hard failsafe selected move:', index);
        } else {
            // Ultimate fallback - find ANY empty cell (ignore shields/reserved if necessary)
            for (let i = 0; i < 9; i++) {
                if (gameState.board[i] === '') {
                    index = i;
                    console.warn('[AI] Emergency fallback - using cell:', i);
                    break;
                }
            }
            // If still no move, game is in invalid state - unlock and return
            if (index === null || index === undefined) {
                console.error('[AI] CRITICAL: No valid moves available - game in invalid state');
                gameState.aiTurnInProgress = false;
            return;
            }
        }
    }

    } catch (moveError) {
        // FAILSAFE: If move selection fails, use hard fallback
        if (aiMoveTimeout) clearTimeout(aiMoveTimeout);
        console.error('[AI] Move selection error (using hard fallback):', moveError);
        const reservedIndices = getReservedCellIndices();
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (emptyCells.length > 0) {
            index = emptyCells[0]; // Guaranteed move
            console.log('[AI] Error fallback selected move:', index);
        } else {
            // Ultimate fallback - find ANY empty cell
            for (let i = 0; i < 9; i++) {
                if (gameState.board[i] === '') {
                    index = i;
                    console.warn('[AI] Emergency error fallback - using cell:', i);
                    break;
                }
            }
            // If still no move, unlock and return
            if (index === null || index === undefined) {
                console.error('[AI] CRITICAL: Cannot recover from move selection error');
                gameState.aiTurnInProgress = false;
                gameState.aiMoveInProgress = false;
                return;
            }
        }
    }

    // STATE CONSISTENCY CHECK: Verify board state before making move
    if (gameState.board[index] !== '' || getReservedCellIndices().includes(index)) {
        console.warn('[AI] Attempted invalid move - recalculating');
        // Recalculate from scratch
        const reservedIndices = getReservedCellIndices();
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (emptyCells.length > 0) {
            index = emptyCells[0]; // Guaranteed valid move
            console.log('[AI] Recalculation selected move:', index);
        } else {
            // Hard fallback - find ANY empty cell
            for (let i = 0; i < 9; i++) {
                if (gameState.board[i] === '') {
                    index = i;
                    console.warn('[AI] Emergency recalculation fallback - using cell:', i);
                    break;
                }
            }
            // If still invalid, unlock and return
            if (index === null || index === undefined || gameState.board[index] !== '') {
                console.error('[AI] CRITICAL: Cannot find valid move after recalculation');
                gameState.aiTurnInProgress = false;
                gameState.aiMoveInProgress = false;
            return;
        }
    }
    }
    
    // CRITICAL: Final validation before committing move
    if (gameState.board[index] !== '' || getReservedCellIndices().includes(index)) {
        console.error('[AI] Move still invalid after recalculation - using emergency fallback');
        // Emergency fallback - find ANY empty cell
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '') {
                index = i;
                console.warn('[AI] Emergency final fallback - using cell:', i);
                break;
            }
        }
        // If still invalid, unlock and return
        if (index === null || index === undefined || gameState.board[index] !== '') {
            console.error('[AI] CRITICAL: Cannot find valid move after final validation');
            gameState.aiTurnInProgress = false;
            gameState.aiMoveInProgress = false;
            return;
        }
    }

    // CRITICAL: Execute move - this must always happen
    // Move is committed synchronously - no async operations can interrupt
    gameState.board[index] = 'O';
    cells[index].textContent = 'O';
    cells[index].setAttribute('data-mark', 'O');
    moveExecuted = true; // Mark that move was executed
    
    // CRITICAL: Unlock turn IMMEDIATELY after move is committed to board
    // Turn ends here - no second move can be triggered
    // This happens BEFORE any animations or async operations
    // Unlock BOTH locks to ensure clean state
    gameState.aiTurnInProgress = false;
    gameState.aiMoveInProgress = false;
    
    // Animate cell placement (premium animation) - happens after turn unlock
    // This is safe because turn is already unlocked and move is committed
    if (typeof AnimationUtils !== 'undefined') {
        AnimationUtils.animateCellPlacement(cells[index]);
    }
    
    clickSound.play();
    emitBoardUpdate();
    
    // PACING: Unlock UI after AI move animation completes with smooth delay
    // Add small delay for pacing - prevents instant cascades
    const aiMoveAnimationDuration = 180;
    const pacingDelay = 150; // Additional delay for smooth pacing
    setTimeout(() => {
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
    }, aiMoveAnimationDuration + pacingDelay);

    // CRITICAL: Check win conditions FIRST, then draw
    // Resolution order: AI win → Player win → Draw
    // This prevents AI wins from being misclassified as draws
    
    if (checkWin('O')) {
        // AI wins - record it properly
        gameState.losses++;
        lossesDisplay.textContent = gameState.losses;
        
        // Increment level1Losses for tracking
        if (gameState.currentLevel === 1) {
            gameState.level1Losses = (gameState.level1Losses || 0) + 1;
        }
        
        // REMOVED: Second-loss taunt feature
        
        // ADAPTIVE INTELLIGENCE PERSISTENCE: AI intelligence must persist after AI wins
        // The AI must NOT lose intelligence, adaptability, or strategic awareness after winning
        // Record AI win in learning system - intelligence persists
        if (gameState.aiLearningSystem && gameState.currentGameId) {
            gameState.aiLearningSystem.recordGameResult('win', gameState.playerName);
            
            // Send AI stats update to server - maintains intelligence state
            if (socket) {
                socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
            }
        }
        // CRITICAL: AI intelligence persists - never reset or degrade after wins
        
        // THIRD LOSS (SPECIAL STATE): Trigger full taunt sequence with music pause
        // - Immediately stop background music
        // - Trigger the taunt sequence: Stronger insults, Slower pacing, Clear dominance tone
        // - Display taunt UI with animation: Slide-in or pop-in, no sudden appearance
        // - Only after taunt sequence finishes: Resume background music, Smooth transition back
        // Now works for all players including Sarah (with respectful messages for Sarah)
        if (gameState.losses === 3 && !gameState.inTsukuyomi && !gameState.inInteractiveMode) {
            try {
                // MUSIC RULE: Pause music on third loss
                if (bgMusic && !bgMusic.paused) {
                    bgMusic.pause();
                    gameState.musicPausedForTaunt = true;
                }
                
                // Activate the interactive AI mock sequence which handles pausing the game,
                // showing disco lights, syncing dance, and showing the Yes/No card.
                // Music will resume after taunt finishes
                activateInteractiveAIMock();
            } catch (e) {
                console.error('Error activating interactive AI mock on loss #3:', e);
                // Fallback: simple endGame and resume music
                if (gameState.musicPausedForTaunt && bgMusic) {
                    bgMusic.play().catch(() => {});
                    gameState.musicPausedForTaunt = false;
                }
                if (isSarah()) {
                    endGame("The AI has won this round, Miss Sarah. Shall we try again?");
                } else {
                    endGame("AI Wins!\nThe AI has outplayed you this round, " + gameState.playerName + "!");
                }
            }
        } else if (gameState.losses === 7 && !gameState.inTsukuyomi && !gameState.inInteractiveMode && !isSarah()) {
            // At 7 losses, capture video frame and use as background with teasing
            activateSeventhLossTeasing();
        } else if (gameState.losses % 6 === 0 && !gameState.inTsukuyomi && !gameState.inInteractiveMode && !isSarah()) {
            // At 6 losses, trigger enhanced interactive sequence with demon jumpscare
            activateEnhancedInteractiveAIMock();
        } else if (gameState.losses > 3 && gameState.losses % 3 === 0 && !gameState.inInteractiveMode) {
            // At every 3 losses after the 3rd (6, 9, 12, etc.), trigger interactive AI mock sequence
            // 6+ losses - use enhanced version with demon jumpscare (skip demon for Sarah)
            if (isSarah()) {
                // For Sarah, use respectful version without demon jumpscare
                activateInteractiveAIMock();
            } else {
                activateEnhancedInteractiveAIMock();
            }
        } else {
            // For quick losses, still record but continue game
            // Conditional message for Sarah - enhanced butler feedback
            if (isSarah()) {
                // Different messages based on difficulty and loss count
                let sarahLossMessage = "The AI has won this round, Miss Sarah. Shall we try again?";
                if (sarahDifficultyChoice === 'hard') {
                    const hardLossMessages = [
                        "The AI has won this round, Miss Sarah. Hard mode presents significant challenges, but I believe in your ability to overcome them. Would you like to continue?",
                        "Miss Sarah, the AI has claimed this round. Do not be discouraged - every loss is a learning opportunity. Shall we continue?",
                        "The AI has won, Miss Sarah. I apologize if this feels frustrating. Your persistence is admirable. Would you like to try again?"
                    ];
                    sarahLossMessage = hardLossMessages[Math.floor(Math.random() * hardLossMessages.length)];
                } else {
                    const easyLossMessages = [
                        "The AI has won this round, Miss Sarah. No need to worry - practice makes perfect. Shall we try again?",
                        "Miss Sarah, the AI has won this round. You are learning with each game. Would you like to continue?",
                        "The AI has won, Miss Sarah. Your effort is what matters most. Shall we continue practicing?"
                    ];
                    sarahLossMessage = easyLossMessages[Math.floor(Math.random() * easyLossMessages.length)];
                }
                endGame(sarahLossMessage);
                
                // Add subtle visual feedback for Sarah losses
                if (typeof AnimationUtils !== 'undefined') {
                    const messageElement = document.getElementById('message-box');
                    if (messageElement) {
                        messageElement.style.transition = 'all 0.5s ease';
                        messageElement.style.opacity = '0.9';
                        setTimeout(() => {
                            messageElement.style.opacity = '';
                        }, 1500);
                    }
                }
            } else {
                endGame("AI Wins!\nThe AI has outplayed you this round, " + gameState.playerName + "!");
            }
            // CRITICAL: Use unified round finalization instead of duplicate logic
            // This ensures consistent state cleanup for all round endings
            setTimeout(() => {
                finalizeRoundAndStartNext();
            }, 1000);
        }
        reportLoss();
        emitBoardUpdate();
        // Turn is already unlocked after move execution
        return;
    }
    
    // CRITICAL: Check for draw AFTER win checks (AI win already checked above)
    // Resolution order: AI win → Player win → Draw
    if (!gameState.board.includes('')) {
        // Draw detected after AI move - clear state and end round
        gameState.aiTurnInProgress = false;
        gameState.aiMoveInProgress = false;
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
        
        // Record draw for AI learning
        if (gameState.aiLearningSystem && gameState.currentGameId) {
            gameState.aiLearningSystem.recordGameResult('draw', gameState.playerName);
            if (socket) {
                socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
            }
        }
        
        // End game - will trigger unified round transition
        endGame("It's a draw!");
        return;
    }

    if (!gameState.isKingWilliam) {
        // TAUNT VARIETY RULE: Randomize taunt selection to avoid repetition
        // Track recent taunts to ensure variety
        let selectedTaunt = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
        
        // Avoid repeating same taunt if possible
        if (recentTauntTypes.length > 0) {
            const recentTaunts = recentTauntTypes.slice(-3);
            let attempts = 0;
            while (recentTaunts.includes(selectedTaunt) && attempts < 5) {
                selectedTaunt = tauntMessages[Math.floor(Math.random() * tauntMessages.length)];
                attempts++;
            }
        }
        
        // Track this taunt
        recentTauntTypes.push(selectedTaunt);
        if (recentTauntTypes.length > MAX_RECENT_TAUNTS) {
            recentTauntTypes.shift();
        }
        
        messageBox.textContent = selectedTaunt;
    }
    
    } catch (e) {
        console.error('[AI] Critical error in makeAIMove:', e);
        // CRITICAL: Ensure move is executed even on error
        if (!moveExecuted && index !== null && index !== undefined) {
            try {
                // Emergency move execution
                if (gameState.board[index] === '') {
                    gameState.board[index] = 'O';
                    cells[index].textContent = 'O';
                    cells[index].setAttribute('data-mark', 'O');
                    moveExecuted = true;
                    console.log('[AI] Emergency move executed on error:', index);
                }
            } catch (emergencyError) {
                console.error('[AI] Failed to execute emergency move:', emergencyError);
            }
        }
    } finally {
        // CRITICAL: Always unlock turn and clear timeout
        // Reset BOTH locks to ensure clean state and prevent double moves
        if (aiMoveTimeout) clearTimeout(aiMoveTimeout);
        gameState.aiTurnInProgress = false;
        gameState.aiMoveInProgress = false;
        
        // If no move was executed, force one
        if (!moveExecuted) {
            console.warn('[AI] No move executed - forcing emergency move');
            const reservedIndices = getReservedCellIndices();
            const emptyCells = gameState.board
                .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
                .filter(i => i !== null);
            if (emptyCells.length > 0) {
                const emergencyIndex = emptyCells[0];
                try {
                    gameState.board[emergencyIndex] = 'O';
                    cells[emergencyIndex].textContent = 'O';
                    cells[emergencyIndex].setAttribute('data-mark', 'O');
                    clickSound.play();
                    emitBoardUpdate();
                    console.log('[AI] Forced emergency move:', emergencyIndex);
                } catch (forceError) {
                    console.error('[AI] Failed to force emergency move:', forceError);
                }
            }
        }
    }
}

function chooseHardAIMove() {
    try {
        // STATE AWARENESS: AI must always know current game state
        // Recalculate immediately if any value is unknown
        const currentLevel = gameState.currentLevel || 1;
        const currentRound = gameState.roundCount || 0;
        const playerWins = gameState.wins || 0;
        const aiWins = gameState.losses || 0; // AI wins = player losses
        const draws = (gameState.roundCount || 0) - (playerWins + aiWins);
        const tacticalClaimUsed = gameState.tacticalClaimUsed || false;
        const isAdminOverride = false; // TODO: Track admin override state if needed
        const isPlayerActive = gameState.gameActive && !gameState.inInteractiveMode;
        
        // ADAPTIVE AI: Gets smarter when losing, learns from patterns
        const moveOptions = [];
    
        // Calculate AI's current performance to adjust difficulty.
        // Prefer the shared database snapshot (data.json via /api/ai/stats),
        // but fall back to the in-memory/localStorage stats.
    let aiWinRate = 0;
    let adaptationLevel = 0;
        let lastLosingMoveIndex = null;
    if (gameState.aiLearningSystem) {
        const stats = gameState.aiLearningSystem.getStats();
        aiWinRate = stats.winRate || 0;
        adaptationLevel = stats.adaptationLevel || 0;
            if (typeof stats.lastLosingMoveIndex === 'number') {
                lastLosingMoveIndex = stats.lastLosingMoveIndex;
            }
    }
    
    // Adaptive difficulty: Reduce randomness when AI is losing
    // If win rate < 50%, AI gets more aggressive and less random
    const isLosing = aiWinRate < 50;
        // NOTE: We deliberately do NOT use any blind random "chaos mode" here.
        // Every move below is chosen based on the current board plus the
        // player's move history; randomness is only used to break ties between
        // moves that are already evaluated as equally good.

        const reservedIndices = getReservedCellIndices();

        // === STEP 1: AI WINNING MOVE (ABSOLUTE PRIORITY - MANDATORY) ===
        // AI MOVE PRIORITIZATION FIX: AI must always evaluate its own winning moves first.
        // If a winning move exists → AI takes it immediately.
        // AI never sacrifices a guaranteed win for a block.
        const winMoves = [];
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '' && !reservedIndices.includes(i)) {
                gameState.board[i] = 'O';
                if (checkWin('O')) {
                    winMoves.push(i);
                }
                gameState.board[i] = '';
            }
        }
        if (winMoves.length > 0) {
            // If AI has immediate win, take it - this is mandatory
            // Choose among winning moves if multiple exist
            const chosenWin = winMoves[Math.floor(Math.random() * winMoves.length)];
            const moveType = 'win';
            const reasoning = 'Immediate AI winning move (absolute priority - AI never misses its own win)';

            if (gameState.aiLearningSystem && chosenWin !== null) {
                gameState.aiLearningSystem.recordAIMove(chosenWin, gameState.board, moveType, reasoning);
                if (socket) {
                    socket.emit('ai-move', {
                        moveIndex: chosenWin,
                        boardState: [...gameState.board],
                        moveType: moveType,
                        reasoning: reasoning,
                        gameId: gameState.currentGameId
                    });
                }
            }
            return chosenWin;
        }
        
        // === STEP 2: BLOCK PLAYER WIN (Only if no AI winning move) ===
        // Only if there is no AI winning move, the AI blocks player's winning moves.
        const blockMoves = [];
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '' && !reservedIndices.includes(i)) {
                gameState.board[i] = 'X';
                if (checkWin('X')) {
                    blockMoves.push(i);
                }
                gameState.board[i] = '';
            }
        }
        if (blockMoves.length > 0) {
            // If player has immediate win and AI cannot win, block it
            // Choose among blocking moves if multiple exist
            const selectedBlock = blockMoves[Math.floor(Math.random() * blockMoves.length)];
            const moveType = 'block';
            const reasoning = 'Blocking player win (secondary priority - only when AI cannot win)';

            if (gameState.aiLearningSystem && selectedBlock !== null) {
                gameState.aiLearningSystem.recordAIMove(selectedBlock, gameState.board, moveType, reasoning);
                if (socket) {
                    socket.emit('ai-move', {
                        moveIndex: selectedBlock,
                        boardState: [...gameState.board],
                        moveType: moveType,
                        reasoning: reasoning,
                        gameId: gameState.currentGameId
                    });
                }
            }
            return selectedBlock;
        }

        // === STEP 3: PATTERN-AWARE STRATEGIC PLAY (learned patterns etc.) ===
    if (gameState.aiLearningSystem && gameState.playerMoveHistory.length > 0) {
        const patternCheck = gameState.aiLearningSystem.shouldBlockPattern(
            gameState.board, 
            gameState.playerMoveHistory
        );
        
        if (patternCheck.shouldBlock && patternCheck.nextExpectedMove !== null) {
            const blockMove = patternCheck.nextExpectedMove;
                const reserved = getReservedCellIndices();
            // Check if cell is empty and not shielded or reserved
                if (gameState.board[blockMove] === '' && !reserved.includes(blockMove)) {
                const blockChance = isLosing ? 0.98 : 0.95;
                if (Math.random() < blockChance) {
                    moveOptions.push({
                        index: blockMove,
                            priority: isLosing ? 1100 : 100,
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
        
        // LEVEL 1: Counter repeated winning patterns
        if (isLevel1 && gameState.playerWinningPatterns.length > 0 && gameState.playerMoveHistory.length >= 2) {
            const currentPattern = gameState.playerMoveHistory.join('-');
            // Check if player is repeating a known winning pattern
            for (const winningPattern of gameState.playerWinningPatterns) {
                const patternMoves = winningPattern.split('-').map(Number);
                if (gameState.playerMoveHistory.length <= patternMoves.length) {
                    // Check if current moves match the start of a known winning pattern
                    const matches = gameState.playerMoveHistory.every((move, idx) => 
                        idx < patternMoves.length && move === patternMoves[idx]
                    );
                    if (matches && gameState.playerMoveHistory.length < patternMoves.length) {
                        // Player is repeating a known pattern - counter it decisively
                        const nextExpectedMove = patternMoves[gameState.playerMoveHistory.length];
                        const reserved = getReservedCellIndices();
                        if (nextExpectedMove !== undefined && 
                            gameState.board[nextExpectedMove] === '' && 
                            !reserved.includes(nextExpectedMove)) {
                            moveOptions.push({
                                index: nextExpectedMove,
                                priority: 1200, // High priority to counter known pattern
                                type: 'pattern_counter',
                                reasoning: `Countering repeated winning pattern: ${winningPattern}`
                            });
                            console.log(`[Level 1] AI countering repeated pattern: ${winningPattern}`);
                        }
                    }
                }
            }
        }
        
            // Proactive partial pattern blocking
        for (const [patternKey, patternData] of Object.entries(gameState.aiLearningSystem.learnedPatterns)) {
            const patternMoves = patternKey.split('-').map(Number);
            if (gameState.playerMoveHistory.length >= 2 && 
                gameState.playerMoveHistory.length < patternMoves.length) {
                const matches = gameState.playerMoveHistory.every((move, idx) => 
                    idx < patternMoves.length && move === patternMoves[idx]
                );
                if (matches) {
                    const nextMove = patternMoves[gameState.playerMoveHistory.length];
                        const reserved = getReservedCellIndices();
                        if (nextMove !== undefined && gameState.board[nextMove] === '' && !reserved.includes(nextMove)) {
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

    // 3) Create forks (collect all fork moves, exclude shielded and reserved cells)
    const forkMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '' && !gameState.shieldedCells.includes(i) && !reservedIndices.includes(i)) {
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

    // 4) Block opponent's fork (collect all fork blocks, exclude shielded and reserved cells)
    const forkBlockMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '' && !gameState.shieldedCells.includes(i) && !reservedIndices.includes(i)) {
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

    // 5) Strategic positions (center, corners, sides) - collect all options, exclude shielded and reserved cells
    const strategicMoves = [];
    if (gameState.board[4] === '' && !reservedIndices.includes(4)) {
        strategicMoves.push({ index: 4, priority: 600, type: 'center', reasoning: 'Taking center' });
    }
    
    const corners = [0, 2, 6, 8].filter(i => gameState.board[i] === '' && !reservedIndices.includes(i));
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
    
    const sides = [1, 3, 5, 7].filter(i => gameState.board[i] === '' && !reservedIndices.includes(i));
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
    // Exclude shielded cells and reserved cells (AI cannot select them)
    const emptyIndices = gameState.board
        .map((cell, i) => (cell === '' && !gameState.shieldedCells.includes(i) && !reservedIndices.includes(i)) ? i : null)
        .filter(i => i !== null);
    if (emptyIndices.length > 0) {
        const minimaxScores = [];
        emptyIndices.forEach(idx => {
            gameState.board[idx] = 'O';
            const score = minimax(gameState.board, 0, false);
            gameState.board[idx] = '';
            minimaxScores.push({ index: idx, score: score });
        });
        
        // Sort by score and use weighted selection from top moves (restored adaptability)
        minimaxScores.sort((a, b) => b.score - a.score);
        
        // Add top 3 minimax moves with slight priority variation for unpredictability
        const topMinimaxMoves = minimaxScores.slice(0, Math.min(3, minimaxScores.length));
        topMinimaxMoves.forEach((move, idx) => {
            moveOptions.push({
                index: move.index,
                priority: 300 - (idx * 5), // Slight priority difference
                type: 'minimax',
                reasoning: `Minimax move (rank ${idx + 1})`
            });
        });
    }

    // Select move with weighted randomness - higher priority moves more likely, but not guaranteed
    if (moveOptions.length === 0) {
        // Ultimate fallback - random empty cell (exclude shielded and reserved)
        const empty = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (empty.length > 0) {
                // Respect the "no repeated losing move twice in a row" rule here as well
                let candidatePool = empty.slice();
                if (lastLosingMoveIndex !== null && candidatePool.length > 1) {
                    candidatePool = candidatePool.filter(i => i !== lastLosingMoveIndex);
                    if (candidatePool.length === 0) {
                        candidatePool = empty;
                    }
                }
                return candidatePool[Math.floor(Math.random() * candidatePool.length)];
        }
        // CRITICAL: Hard failsafe - find ANY empty cell (ignore shields if necessary)
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '') {
                console.warn('[AI] chooseHardAIMove: Emergency fallback - using cell:', i);
                return i;
            }
        }
        // Ultimate fallback - return 0 (should never happen, but prevents null)
        console.error('[AI] chooseHardAIMove: CRITICAL - no empty cells found, returning 0');
        return 0;
    }

    // Sort by priority
    moveOptions.sort((a, b) => b.priority - a.priority);
    
    // LEVEL 1 LENIENCY: Controlled leniency for Level 1 only
    // This makes Level 1 beatable while maintaining AI intelligence
    const isLevel1 = currentLevel === 1;
    const isFirstRound = gameState.firstRoundOfSession;
    const totalMoves = gameState.board.filter(cell => cell !== '').length;
    
    // RESTORED: Weighted randomness for adaptability - higher priority moves more likely, but not guaranteed
    // This prevents AI from being predictable and allows player strategy variety
    let selected;
    if (moveOptions.length === 1) {
        selected = moveOptions[0];
    } else if (moveOptions.length > 1) {
        // Group moves by priority tier
        const topPriority = moveOptions[0].priority;
        const topTier = moveOptions.filter(m => m.priority === topPriority);
        
        // LEVEL 1 LENIENCY: In Level 1, when multiple safe moves exist, occasionally choose less aggressive
        if (isLevel1 && topTier.length > 1 && topPriority < 700) {
            // For non-critical moves (not win/block/fork), apply leniency
            // First round: 30% chance to choose second-best safe move
            // Later rounds: 15% chance
            const leniencyChance = isFirstRound ? 0.30 : 0.15;
            if (Math.random() < leniencyChance && moveOptions.length > 1) {
                // Choose from top 2-3 safe moves instead of always the best
                const safeMoves = moveOptions.filter(m => m.priority >= 400 && m.priority < 700);
                if (safeMoves.length > 0) {
                    selected = safeMoves[Math.floor(Math.random() * safeMoves.length)];
                } else {
                    selected = topTier[Math.floor(Math.random() * topTier.length)];
                }
            } else {
                selected = topTier[Math.floor(Math.random() * topTier.length)];
            }
        } else if (topTier.length > 1) {
        // If multiple moves share top priority, randomly choose among them
            selected = topTier[Math.floor(Math.random() * topTier.length)];
        } else {
            // Weighted selection: 70% chance for top move, 20% for second, 10% for others
            // LEVEL 1: Slightly more lenient (60/25/15 instead of 70/20/10)
            const topChance = isLevel1 ? 0.60 : 0.70;
            const secondChance = isLevel1 ? 0.25 : 0.20;
            const rand = Math.random();
            if (rand < topChance || moveOptions.length === 1) {
                selected = moveOptions[0];
            } else if (rand < (topChance + secondChance) && moveOptions.length > 1) {
                selected = moveOptions[1];
            } else {
                // Pick from top 3 moves (adds unpredictability)
                const topThree = moveOptions.slice(0, Math.min(3, moveOptions.length));
                selected = topThree[Math.floor(Math.random() * topThree.length)];
            }
        }
    } else {
        // Fallback (shouldn't happen)
        const empty = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (empty.length > 0) {
                let candidatePool = empty.slice();
                if (lastLosingMoveIndex !== null && candidatePool.length > 1) {
                    candidatePool = candidatePool.filter(i => i !== lastLosingMoveIndex);
                    if (candidatePool.length === 0) {
                        candidatePool = empty;
                    }
                }
                return candidatePool[Math.floor(Math.random() * candidatePool.length)];
        }
        // CRITICAL: Hard failsafe - find ANY empty cell
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '') {
                console.warn('[AI] chooseHardAIMove: Ultimate fallback - using cell:', i);
                return i;
            }
        }
        // Should never happen, but return 0 as absolute last resort
        console.error('[AI] chooseHardAIMove: CRITICAL - no empty cells, returning 0');
        return 0;
    }
    
    // CRITICAL: Ensure selected exists before accessing index
    if (!selected || selected.index === null || selected.index === undefined) {
        console.error('[AI] chooseHardAIMove: Selected move is invalid, using emergency fallback');
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '') {
                return i;
            }
        }
        return 0; // Last resort
    }
    
    const moveIndex = selected.index;
    const moveType = selected.type || 'unpredictable';
    const reasoning = selected.reasoning || 'Unpredictable move selection';

        // If we are about to repeat the exact losing move and have alternatives in the
        // same priority tier, shift to a different move instead. This enforces:
        // "AI must never repeat a losing move twice in a row unless unavoidable."
        if (lastLosingMoveIndex !== null && moveIndex === lastLosingMoveIndex) {
            const sameTierAlternatives = moveOptions.filter(
                m => m.priority === selected.priority && m.index !== lastLosingMoveIndex
            );
            if (sameTierAlternatives.length > 0) {
                const alt = sameTierAlternatives[Math.floor(Math.random() * sameTierAlternatives.length)];
                selected.index = alt.index;
            }
        }
        
        const finalMoveIndex = selected.index;
        
    // Record AI move
    if (gameState.aiLearningSystem && finalMoveIndex !== null) {
        try {
            gameState.aiLearningSystem.recordAIMove(finalMoveIndex, gameState.board, moveType, reasoning);
        
            // Send to server so data.json is always up to date
        if (socket) {
            socket.emit('ai-move', {
                    moveIndex: finalMoveIndex,
                boardState: [...gameState.board],
                moveType: moveType,
                reasoning: reasoning,
                gameId: gameState.currentGameId
            });
            }
        } catch (recordError) {
            // FAILSAFE: If recording fails, continue anyway
            console.error('Error recording AI move (continued):', recordError);
        }
    }
    
    return finalMoveIndex;
    } catch (e) {
        // FAILSAFE: If any error occurs, use fallback and continue game
        console.error('Critical error in chooseHardAIMove (using fallback):', e);
        const reservedIndices = getReservedCellIndices();
        const empty = gameState.board
            .map((cell, i) => (cell === '' && !reservedIndices.includes(i)) ? i : null)
            .filter(i => i !== null);
        if (empty.length > 0) {
            return empty[Math.floor(Math.random() * empty.length)];
        }
        // Ultimate fallback - return first empty cell if available
        for (let i = 0; i < 9; i++) {
            if (gameState.board[i] === '') return i;
        }
        return 0; // Last resort
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
        
        // Clear shields when new game starts (shields persist for entire match, not level)
        if (typeof PowerUpManager !== 'undefined') {
            PowerUpManager.clearAllShields();
        }
        
        // Reset Tactical Claim state for new game (but keep round count and level wins)
        gameState.tacticalClaimUsed = false;
        // NOTE: roundCount, level1Wins, and aiWinsInLevel persist across games within the same level
        gameState.reservedCells = [];
        gameState.turnCount = 0;
        // Clear visual Tactical Claim effects
        clearTacticalClaimVisuals();
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
    
    // THIRD LOSS MUSIC RULE: Background music is paused during third-loss taunt
    // Music was already paused before calling this function (in makeAIMove)
    // Music will resume after taunt sequence finishes
    
    // Show wait message - different for Sarah
    if (isSarah()) {
        endGame("Miss Sarah, allow me a moment to prepare something special...");
    } else {
        endGame("Wait... now the AI will be interactive here. Tell the person wait.");
    }
    
    // Send update to admin
    emitBoardUpdate();
    
    setTimeout(() => {
        // Show improved disco lights for first 3 losses
        discoOverlay.classList.remove('hidden');
        discoOverlay.classList.add('enhanced-rgb');
        
        // Make game boxes dance - with respectful messages for Sarah
        if (isSarah()) {
            startBoxDanceWithRespectfulMessages();
        } else {
            startBoxDanceWithInsults();
        }
        
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
            
            // Different messages for Sarah vs other players
            if (isSarah()) {
                // Respectful butler messages for Sarah
                const sarahRespectfulMessages = [
                    "Miss Sarah, you've experienced three losses. I understand this can be frustrating. Would you like to continue practicing?",
                    "The master's daughter, you've faced some challenges. Shall we continue with your training?",
                    "Miss Sarah, three losses in a row. I believe in your ability to improve. Would you like to try again?"
                ];
                aiMockText.textContent = sarahRespectfulMessages[Math.floor(Math.random() * sarahRespectfulMessages.length)] + "\n\nWould you like to continue?";
            } else {
                // Regular taunt messages for other players
                const mockMessages = [
                    `Well, well, well... ${gameState.playerName}, you've lost 3 times already!`,
                    `You really love getting beaten, don't you?`,
                    `I'm starting to think you enjoy this...`
                ];
                aiMockText.textContent = mockMessages[Math.floor(Math.random() * mockMessages.length)] + "\n\nDo you want to continue?";
            }
            
            // Show buttons with animation
            setTimeout(() => {
                document.getElementById('ai-mock-buttons').style.opacity = '1';
                document.getElementById('ai-mock-buttons').style.transform = 'scale(1)';
                
                // THIRD LOSS MUSIC RULE: Resume background music after taunt sequence finishes
                // Music was paused at start of third loss, now resume it
                if (gameState.musicPausedForTaunt && bgMusic) {
                    bgMusic.play().catch(e => console.log('Could not resume background music:', e));
                    gameState.musicPausedForTaunt = false;
                }
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

// Box dance with respectful messages for Sarah
function startBoxDanceWithRespectfulMessages() {
    const respectfulMessages = [
        "PRACTICE",
        "GROWTH",
        "LEARNING",
        "PROGRESS",
        "EFFORT",
        "DEDICATION",
        "IMPROVEMENT",
        "PERSISTENCE",
        "STRENGTH"
    ];
    
    cells.forEach((cell, index) => {
        cell.classList.add('dancing');
        cell.style.animationDelay = `${index * 0.1}s`;
        cell.style.position = 'relative';
        
        // Add respectful message text that appears and disappears
        const message = respectfulMessages[index % respectfulMessages.length];
        const messageElement = document.createElement('div');
        messageElement.className = 'box-insult sarah-respectful';
        messageElement.textContent = message;
        messageElement.style.animationDelay = `${index * 0.15}s`;
        cell.appendChild(messageElement);
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
    // For Sarah, use respectful version without demon jumpscare
    if (isSarah()) {
        // Use the regular interactive mock but with respectful messages
        activateInteractiveAIMock();
        return;
    }
    
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
    
    // MUSIC CONTINUITY: Background music continues even during interactive sequences
    // Music is global ambience and should not stop
    
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
            
            // Skip harsh mocking for Sarah
            if (isSarah()) {
                aiMockText.textContent = "Miss Sarah, you've had several losses. Would you like to continue, or take a break?";
            } else {
                aiMockText.textContent = enhancedMockMessages[Math.floor(Math.random() * enhancedMockMessages.length)] + "\n\nDo you want to continue?";
            }
            
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
    // NOTE: level1Losses persists across games within the same level
    // It only resets when level changes or player resets to landing
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
    
    // Clear shields when new game starts (shields persist for entire match, not level)
    if (typeof PowerUpManager !== 'undefined') {
        PowerUpManager.clearAllShields();
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
        // CRITICAL: Check turn lock before scheduling AI move
        if (gameState.aiMoveInProgress || gameState.aiTurnInProgress) {
            console.warn('[AI] Turn already in progress, skipping AI-first move');
            return;
        }
        messageBox.textContent = "AI is thinking...";
        const thinkingDelay = gameState.aiThinkingDelay || 500;
            setTimeout(() => {
                // CRITICAL: Single-source-of-truth check - aiMoveInProgress is authoritative
                if (gameState.aiMoveInProgress) {
                    console.warn('[AI] Move already in progress (aiMoveInProgress=true), aborting AI-first move');
                    return;
                }
                // Secondary check
                if (gameState.aiTurnInProgress) {
                    console.warn('[AI] Turn lock active (aiTurnInProgress=true), aborting AI-first move');
                    return;
                }
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
        
        // Stop camera status updates
        stopCameraStatusUpdates();

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
        gameState.level1Losses = 0; // Reset level-specific loss count
        gameState.boardInitialized = false; // MVP: Reset board initialization so it can animate on next fresh start
        gameState.hasGameStartedOnce = false; // MVP: Reset flag to allow Play Game button on fresh start
        gameState.aiTurnInProgress = false; // CRITICAL: Reset turn lock
        gameState.firstRoundOfSession = true; // Reset first round flag
        gameState.playerWinningPatterns = []; // Reset winning patterns
        gameState.gameActive = true;
        gameState.inInteractiveMode = false;
        gameState.playerMoveHistory = [];

        // Reset displays
        lossesDisplay.textContent = '0';
        const winsDisplay = document.getElementById('wins');
        if (winsDisplay) winsDisplay.textContent = '0';
        messageBox.textContent = '';
        
        // Clear winning line and animate board reset (premium animation)
        if (typeof AnimationUtils !== 'undefined') {
            const boardElement = document.querySelector('.game-board');
            if (boardElement) {
                AnimationUtils.clearWinningLine(boardElement);
                AnimationUtils.animateBoardReset(cells);
            }
        } else {
            // Fallback if animations not available
            cells.forEach(cell => {
                cell.textContent = '';
                cell.removeAttribute('data-mark');
            });
        }
        
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
                "You picked 'YES' — courage or masochism? Either way, face your demise."
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
            // Conditional message for Sarah
            if (isSarah()) {
                aiMockText.textContent = "As you wish, Miss Sarah. Thank you for playing.";
            } else {
                aiMockText.textContent = `Giving up so soon, ${gameState.playerName}? Suit yourself.`;
            }
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
                // CRITICAL: Check turn lock before scheduling AI move
                if (gameState.aiMoveInProgress || gameState.aiTurnInProgress) {
                    console.warn('[AI] Turn already in progress, skipping AI-first move');
                    return;
                }
                messageBox.textContent = "AI is thinking...";
                setTimeout(() => {
                    // CRITICAL: Single-source-of-truth check - aiMoveInProgress is authoritative
                    if (gameState.aiMoveInProgress) {
                        console.warn('[AI] Move already in progress (aiMoveInProgress=true), aborting AI-first move');
                        return;
                    }
                    // Secondary check
                    if (gameState.aiTurnInProgress) {
                        console.warn('[AI] Turn lock active (aiTurnInProgress=true), aborting AI-first move');
                        return;
                    }
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

/**
 * CRITICAL: Unified round finalization and cleanup
 * Called for ALL round endings (win/loss/draw) to ensure clean state transition
 */
function finalizeRoundAndStartNext() {
    try {
        // CRITICAL: Clear all AI-related state and timers
        // This prevents AI from getting stuck in "thinking" state
        gameState.aiTurnInProgress = false;
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
        
        // Clear any pending AI move timers (safety - should already be cleared)
        // Note: aiMoveTimeout is scoped to makeAIMove, but we ensure state is clean
        
        // Reset board state
        gameState.board = Array(9).fill('');
        gameState.playerMoveHistory = [];
        // CRITICAL: Power-up isolation - only reset Last Stand if it was used
        // Other power-ups (Board Shake, Hint Pulse) remain unaffected
        const wasLastStandUsed = gameState.lastStandUsed;
        gameState.lastStandUsed = false; // Reset Last Stand for new game
        // Only clear scheduled play count if Last Stand was actually used
        if (wasLastStandUsed) {
            gameState.lastStandScheduledForPlay = null;
        }
        gameState.aiRecalculationNeeded = false; // Reset recalculation flag
        gameState.aiMoveInProgress = false; // Reset AI move lock
        
        // Hide checkpoints during gameplay
        const checkpointContainer = document.querySelector('.level-progress-container');
        if (checkpointContainer) {
            checkpointContainer.classList.remove('show-after-win');
        }
        
        // Clear visual board
        const cells = document.querySelectorAll('.cell');
        if (cells) {
            cells.forEach(cell => {
                cell.textContent = '';
                cell.setAttribute('data-mark', '');
            });
        }
        
        // Clear winning line animation if present
        if (typeof AnimationUtils !== 'undefined') {
            const boardElement = document.querySelector('.game-board');
            if (boardElement) {
                AnimationUtils.clearWinningLine(boardElement);
            }
        }
        
        // Reset game state for next round
        gameState.gameActive = true;
        
        // Start new game tracking
        if (gameState.behaviorAnalyzer) {
            gameState.currentGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            gameState.behaviorAnalyzer.startGame(gameState.currentGameId);
        }
        if (gameState.aiLearningSystem) {
            gameState.aiLearningSystem.currentGameId = gameState.currentGameId;
        }
        
        // Update message
        const messageBox = document.getElementById('message-box');
        if (messageBox) {
            messageBox.textContent = gameState.playerName ? `Your turn, ${gameState.playerName}!` : 'Your turn!';
        }
        
        // If AI goes first, make AI move after a short delay
        if (!gameState.playerGoesFirst) {
            if (messageBox) {
                messageBox.textContent = "AI is thinking...";
            }
            setTimeout(() => {
                // CRITICAL: Single-source-of-truth check before AI move
                if (gameState.aiMoveInProgress) {
                    console.warn('[AI] Move already in progress (aiMoveInProgress=true), skipping AI-first move');
                    return;
                }
                if (gameState.aiTurnInProgress) {
                    console.warn('[AI] Turn lock active (aiTurnInProgress=true), skipping AI-first move');
                    return;
                }
                if (messageBox) {
                    messageBox.textContent = "AI goes first this round!";
                }
                makeAIMove();
            }, 800);
        }
        
        // Hide reset button (auto-start mode)
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.style.display = 'none';
        }
        
    } catch (e) {
        console.error('[Round Finalization] Critical error:', e);
        // Fallback: at least reset basic state
        gameState.gameActive = true;
        gameState.aiTurnInProgress = false;
        gameState.uiLocked = false;
    }
}

function endGame(message) {
    try {
        // CRITICAL: Win state must NOT pause the game loop, freeze inputs, reset AI brain, or stop music
        // Winning a round must only: Update score, Trigger UI feedback, Trigger dialogue or taunts
        // Win state must be isolated from core gameplay systems
        gameState.gameActive = false;
        
        // CRITICAL: Clear AI state immediately to prevent "thinking" freeze
        // This must happen BEFORE any async operations
        gameState.aiTurnInProgress = false;
        gameState.uiLocked = false;
        gameState.uiLockingReason = null;
        
        // MUSIC CONTINUITY RULE: Background music must continue across rounds, wins, losses, animations
        // Background music must NEVER stop unless the user explicitly toggles sound off
        // Winning, losing, or ending a round must NOT pause, stop, reset, or mute background music
        // Music is global ambience and should continue playing
        // REMOVED: Music pause on win/loss - music continues
        
        // CRITICAL: Increment round count on EVERY game end (win/loss/draw)
        // Round count must never stay at zero once gameplay begins
        gameState.roundCount = (gameState.roundCount || 0) + 1;
        
        // CRITICAL: Increment play count (1-5, cycles)
        gameState.currentPlayCount = ((gameState.currentPlayCount || 0) % 5) + 1;
        
        // Track AI wins in level (AI wins when player loses)
        if (message.includes('AI Wins') || message.includes('AI has outplayed')) {
            gameState.aiWinsInLevel = (gameState.aiWinsInLevel || 0) + 1;
        }
        
        // Conditional message modification for Sarah (presentation only)
        let displayMessage = message;
        if (isSarah() && message.includes('AI Wins')) {
            // Replace harsh messages with gentle ones for Sarah
            displayMessage = "The AI has won this round, Miss Sarah. Shall we try again?";
        } else if (isSarah() && message.includes('draw')) {
            displayMessage = "A draw, Miss Sarah. A respectable outcome.";
        }
        
        messageBox.textContent = displayMessage;
        
        // Animate message based on result (premium animation)
        if (typeof AnimationUtils !== 'undefined') {
            const messageType = message.includes('win') || message.includes('Win') ? 'win' : 
                               message.includes('draw') || message.includes('Draw') ? 'default' : 'loss';
            AnimationUtils.animateMessage(messageBox, messageType);
        }
        
        // CRITICAL: Unified round transition - works for win/loss/draw
        // Only show reset button (Play Game) if game hasn't started yet
        // After first game starts, auto-start next rounds without showing button
        if (!gameState.hasGameStartedOnce) {
            resetBtn.style.display = 'block';
        } else {
            // Auto-start next round after first game (for ALL outcomes: win/loss/draw)
            resetBtn.style.display = 'none';
            // Use unified finalization function after a short delay
            setTimeout(() => {
                try {
                    finalizeRoundAndStartNext();
                } catch (autoResetError) {
                    console.warn('[Round Transition] Auto-start failed:', autoResetError);
                    // Fallback: Show button if auto-start fails
                    resetBtn.style.display = 'block';
                }
            }, 1500); // Short delay to let animations complete
        }
        
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
                
                // ADAPTIVE INTELLIGENCE PERSISTENCE RULE: AI must NEVER lose intelligence, adaptability, or strategic awareness
                // after AI win, Player win, Draw, Tactical Claim usage, End of round, or Level continuation.
                // Winning a round must NOT reset, degrade, pause, or simplify AI reasoning.
                // The AI must carry forward learned patterns within the same session.
                // Record game result - intelligence persists across rounds
                gameState.aiLearningSystem.recordGameResult(
                    aiResult, 
                    gameState.playerName,
                    message.includes('win') || message.includes('Win') ? gameState.playerMoveHistory : null
                );
                
                // Save patterns to localStorage after recording game result - ensures persistence
                if (typeof gameState.aiLearningSystem.saveToStorage === 'function') {
                    gameState.aiLearningSystem.saveToStorage();
                }
                
                // Send AI stats to server - maintains intelligence state across sessions
                if (socket) {
                    socket.emit('ai-stats-update', gameState.aiLearningSystem.getStats());
                }
                
                // CRITICAL: AI intelligence must persist - never reset or degrade
                // The AI learning system maintains its state and continues to adapt
            } catch (e) {
                console.error('Error in aiLearningSystem operations:', e);
            }
        }
        
        // Alternate turns for next game (including draws)
        // If player went first this game, AI goes first next game
        gameState.playerGoesFirst = !gameState.playerGoesFirst;
        
        // Update level tracking for power-ups (visual only, no AI logic)
        gameState.totalGamesPlayed = (gameState.wins || 0) + (gameState.losses || 0);
        if (typeof PowerUpManager !== 'undefined') {
            PowerUpManager.updateLevel();
        }
    } catch (e) {
        console.error('Critical error in endGame:', e);
        // Fallback: just disable game
        gameState.gameActive = false;
        if (messageBox) messageBox.textContent = message || 'Game Over';
        if (resetBtn) resetBtn.style.display = 'block';
    }
}

// UI INPUT GUARANTEE: Reset button must ALWAYS work - if handler fails, reset state and continue
resetBtn.addEventListener('click', () => {
    try {
    // Clear winning line animation if present
        try {
    if (typeof AnimationUtils !== 'undefined') {
        const boardElement = document.querySelector('.game-board');
        if (boardElement) {
            AnimationUtils.clearWinningLine(boardElement);
        }
            }
        } catch (animError) {
            console.error('Error clearing animation (continued):', animError);
    }
    
        // Stop any active effects
        try {
        stopSnowfallEffect();
        } catch (effectError) {
            console.error('Error stopping effects (continued):', effectError);
        }
        
        // CRITICAL: Reset game state - must always succeed
        gameState.board = Array(9).fill('');
        gameState.gameActive = true;
        gameState.inInteractiveMode = false; // Ensure not stuck in interactive mode
        gameState.playerMoveHistory = []; // Reset move history for new game
        gameState.uiLocked = false; // Unlock UI
        gameState.uiLockingReason = null;
        gameState.aiTurnInProgress = false; // CRITICAL: Unlock AI turn
        gameState.aiMoveInProgress = false; // Reset AI move lock
        // CRITICAL: Power-up isolation - only reset Last Stand if it was used
        const wasLastStandUsed = gameState.lastStandUsed;
        gameState.lastStandUsed = false; // Reset Last Stand
        if (wasLastStandUsed) {
            gameState.lastStandScheduledForPlay = null; // Only reset if used
        }
        gameState.aiRecalculationNeeded = false; // Reset recalculation flag
        
        // MVP: Clear board visually WITHOUT re-animating or resizing
        // Ensure board stays locked to prevent shrinking
        const boardElement = document.querySelector('.game-board');
        if (boardElement && gameState.boardInitialized) {
            // MVP: Lock board dimensions - prevent any size changes
            boardElement.style.opacity = '1';
            boardElement.style.transform = 'translateY(0)';
            boardElement.style.transition = 'none'; // No transitions between rounds
        }
        
        cells.forEach(cell => {
            if (cell) {
                cell.textContent = '';
                cell.setAttribute('data-mark', '');
            }
        });
        
        if (demonOverlay) demonOverlay.classList.add('hidden');
        if (resetBtn) resetBtn.style.display = 'none';
    
    // Different message based on previous result
        if (messageBox) {
    if (gameState.wins > 0) {
        messageBox.textContent = `Back for more? The AI is learning... (${gameState.wins} win${gameState.wins > 1 ? 's' : ''})`;
    } else {
        messageBox.textContent = "Back for more punishment?";
            }
    }
    
    // Start new game for behavior analysis
        try {
    if (gameState.behaviorAnalyzer) {
        gameState.currentGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        gameState.behaviorAnalyzer.startGame(gameState.currentGameId);
    }
    if (gameState.aiLearningSystem) {
        gameState.aiLearningSystem.currentGameId = gameState.currentGameId;
            }
        } catch (analystError) {
            console.error('Error initializing behavior analysis (continued):', analystError);
            // Continue anyway
    }
    
        // If AI goes first, make AI move immediately (with timeout failsafe)
    if (!gameState.playerGoesFirst) {
            if (messageBox) messageBox.textContent = "AI is thinking...";
            const thinkingDelay = Math.min(gameState.aiThinkingDelay || 500, 1000); // Cap at 1s
            const moveTimeout = setTimeout(() => {
                // FAILSAFE: If AI doesn't move, force it (but check lock first)
                console.warn('AI move timeout in reset - forcing move');
                try {
                    // CRITICAL: Check lock before forcing move
                    if (!gameState.aiMoveInProgress && !gameState.aiTurnInProgress) {
                        makeAIMove();
                    } else {
                        console.warn('[AI] Turn lock active, cannot force move');
                    }
                } catch (moveError) {
                    console.error('Error forcing AI move (game continues):', moveError);
                }
            }, thinkingDelay + 500); // Extra 500ms grace period
            
        setTimeout(() => {
                clearTimeout(moveTimeout);
                // CRITICAL: Single-source-of-truth check before AI move
                if (gameState.aiMoveInProgress) {
                    console.warn('[AI] Move already in progress (aiMoveInProgress=true), skipping AI-first move');
                    return;
                }
                if (gameState.aiTurnInProgress) {
                    console.warn('[AI] Turn lock active (aiTurnInProgress=true), skipping AI-first move');
                    return;
                }
                if (messageBox) messageBox.textContent = "AI goes first this round!";
                try {
                    makeAIMove();
                } catch (moveError) {
                    console.error('Error in AI move after reset (game continues):', moveError);
                }
        }, thinkingDelay);
    }
    
    // Ensure camera is still active
        try {
    monitorCameraStatus();
        } catch (cameraError) {
            console.error('Error monitoring camera (continued):', cameraError);
        }
    
    // Emit board update
        try {
    emitBoardUpdate();
        } catch (emitError) {
            console.error('Error emitting board update (continued):', emitError);
        }
    } catch (e) {
        // FAILSAFE: If everything fails, at least reset the board
        console.error('Critical error in reset button (emergency reset):', e);
        gameState.board = Array(9).fill('');
        gameState.gameActive = true;
        gameState.inInteractiveMode = false;
        gameState.uiLocked = false;
        gameState.aiTurnInProgress = false; // CRITICAL: Unlock AI turn
        cells.forEach(cell => {
            if (cell) {
                cell.textContent = '';
                cell.setAttribute('data-mark', '');
            }
        });
        if (messageBox) messageBox.textContent = "Game reset. Try again.";
        if (resetBtn) resetBtn.style.display = 'none';
    }
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
        
        // Different responses based on loss count - respectful encouragement for Sarah
        if (isSarah()) {
            if (aiMockText) {
                const sarahContinueMessages = [
                    "As you wish, Miss Sarah. Your determination is admirable. Let us continue with your training.",
                    "Excellent, Miss Sarah. I am pleased by your persistence. Shall we proceed?",
                    "Very well, Miss Sarah. Your commitment to improvement is inspiring. Let us continue."
                ];
                aiMockText.textContent = sarahContinueMessages[Math.floor(Math.random() * sarahContinueMessages.length)];
            }
        } else {
            if (gameState.losses >= 6) {
                if (aiMockText) {
                    aiMockText.textContent = `6 losses and you STILL want more?! ${gameState.playerName}, you're either incredibly persistent or completely insane! This is getting embarrassing!`;
                }
            } else {
                if (aiMockText) {
                    aiMockText.textContent = `Haha! I knew it! You actually LOVE losing, ${gameState.playerName}! What kind of person enjoys getting destroyed repeatedly? You're addicted to failure!`;
                }
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
        
        // Different responses based on loss count - respectful for Sarah
        if (isSarah()) {
            if (aiMockText) {
                const sarahQuitMessages = [
                    "I understand, Miss Sarah. Sometimes it is wise to take a break. You may return whenever you are ready. I shall be here to assist you.",
                    "As you wish, Miss Sarah. There is no shame in pausing. Your well-being is my priority. Please return when you feel ready to continue.",
                    "Very well, Miss Sarah. I respect your decision. Take your time, and know that I am here whenever you wish to resume your training."
                ];
                aiMockText.textContent = sarahQuitMessages[Math.floor(Math.random() * sarahQuitMessages.length)];
            }
        } else {
            if (gameState.losses >= 6) {
                if (aiMockText) {
                    aiMockText.textContent = `Finally giving up after 6 losses? ${gameState.playerName}, you should have quit 3 losses ago! At least you know when you're beaten... finally!`;
                }
            } else {
                if (aiMockText) {
                    aiMockText.textContent = `Of course you'd quit, ${gameState.playerName}! Can't handle the heat? Typical loser behavior. Running away when things get tough!`;
                }
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
} 