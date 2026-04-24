# Tic Tac Toe: Reimagined - Game Systems Overview

This document provides a technical and conceptual overview of the AI and Power-Up systems integrated into the game.

---

## 1. Adaptive AI System

The AI is designed to be a formidable, evolving opponent that learns from your behavior and adapts its strategy dynamically.

### Core Architecture
- **Decision Engine**: Primarily uses the **Minimax algorithm** to evaluate the best possible moves. It uses depth-based scoring, meaning it prioritizes moves that lead to faster wins and avoids moves that lead to immediate losses.
- **Move Prioritization**:
    1. **Immediate Win**: If the AI sees a winning move, it takes it instantly.
    2. **Block Player**: If the player is one move away from winning, the AI blocks it.
    3. **Pattern Counter**: If the player repeats a known winning pattern, the AI pre-emptively counters it.
    4. **Best Move**: Fallback to Minimax/Heuristics (Center > Corners > Sides).

### Learning & Adaptability
- **Behavioral Analysis**: The AI tracks your move sequences, timing, and preferred opening cells.
- **Win Rate Scaling**: The system monitors its own win rate. If it falls below 50%, the AI becomes "Aggressive," reducing randomness and tightening its defensive play.
- **Pattern Recognition**: The `aiLearningSystem` identifies repeating move strings. If you win using the same sequence twice, the AI will recognize the start of that sequence in future games and block the concluding move early.
- **Intelligence Persistence**: The AI's learned data and "Intelligence Level" persist across games, meaning it doesn't "forget" your tactics just because a new round starts.

### Psychological & Special States
- **Tsukuyomi Overlay**: A high-intensity visual/audio event triggered under specific conditions. It forces a 10-second "mental assault" timer, after which the board is cleared, and the AI mocks the player's weakness.
- **Interactive Mocks**: Triggered on significant loss milestones (3rd, 6th, 7th loss). These sequences pause the game, stop the music, and use custom animations/dialogue to taunt the player.
- **Fail-safes**: To ensure smooth gameplay, the AI has a 500ms "thought budget." If a move isn't calculated in time, it fallbacks to a simplified heuristic move to prevent the game from freezing.

---

## 2. Power-Up System (`PowerUpManager`)

Power-ups provide the player with tools to disrupt the AI's logic or gain a strategic advantage.

### Inventory Management
- **Progression**: Players receive 1 charge of each power-up per level. Levels advance after every game played.
- **Persistence**: Power-ups are independent. Using one does not consume others.

### Available Power-Ups
- **💡 Hint Pulse**: 
    - **Function**: Highlights a recommended move with a glowing pulse.
    - **Logic**: It runs a quick AI simulation to find the "best" move for the player's current state.
- **🌊 Board Shake**: 
    - **Function**: Physically "shuffles" the board.
    - **Logic**: It randomly reassigns the 0-8 indices of the cells. While the marks (X/O) stay on the screen, their underlying logical positions change.
    - **Impact**: This forces an `aiRecalculationNeeded` trigger, effectively "confusing" the AI and forcing it to re-evaluate the entire board from scratch.
- **⚡ Last Stand**: 
    - **Function**: A predictive defensive tool.
    - **Logic**: Instead of instant activation, the player "schedules" this for a future play (e.g., Play #4). If the AI is about to land a winning blow on that specific play, Last Stand triggers, preventing the loss and granting the player a window to counter.
- **🌀 Focus Aura**: 
    - **Function**: A visual-only effect in AI mode; intended as a psychological pressure tool in PvP.

### Integration with AI
- **Recalculation Trigger**: Whenever a power-up changes the board state (like Board Shake), the AI is notified via a state flag. This prevents the AI from using "stale" plans and ensures it responds accurately to the new reality of the board.
- **Tactical Claim**: Using power-ups is a trigger for the "Tactical Claim" system, which can result in the AI "reserving" certain cells as a counter-measure to the player's advantage.

---

## 3. Data Integrity & Turn Safety

- **Turn Locking**: The game uses a "Single Source of Truth" turn lock (`aiMoveInProgress`). This prevents the AI from moving twice during lag or when multiple triggers occur simultaneously.
- **State Validation**: Before every move, the system validates that the target cell is empty and not "Shielded" or "Reserved" by a system effect.
