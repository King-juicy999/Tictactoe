# Angelic

A psychological tic-tac-toe game. You declare a name, cross a cinematic threshold, and
play nine squares of tic-tac-toe against an intelligence that studies how you play,
remembers it between sessions, and gets harder the more you lose.

The antagonist behaviour is the product, not a bug. The AI lies, the board reshuffles
itself mid-game, the tiles change their own mind, and milestones in your loss count
trigger taunts, jumpscares and a full-screen "Tsukuyomi" event. If you are reading this
to decide whether to fork it, that is the tone.

---

## Table of contents

- [What you are looking at](#what-you-are-looking-at)
- [Architecture](#architecture)
- [How a play session actually flows](#how-a-play-session-actually-flows)
- [The AI](#the-ai)
- [The deliberate cheating](#the-deliberate-cheating)
- [Power-ups](#power-ups)
- [The loss ladder](#the-loss-ladder)
- [The Sarah persona](#the-sarah-persona)
- [The learning store](#the-learning-store)
- [The guidebook](#the-guidebook)
- [Remote control](#remote-control)
- [Running it locally](#running-it-locally)
- [Deployment](#deployment)
- [Repository layout](#repository-layout)
- [The build pipeline](#the-build-pipeline)
- [Socket.IO and REST reference](#socketio-and-rest-reference)
- [What changed in the September 2026 cleanup](#what-changed-in-the-september-2026-cleanup)
- [Known gaps and dead code](#known-gaps-and-dead-code)
- [The other markdown files](#the-other-markdown-files)

---

## What you are looking at

There are two separate applications in this repository, deployed to two different hosts.

**1. The landing site (`web/`)**
A React 19 + Vite 8 + TypeScript single page app. One component, one purpose: a
GSAP-animated cinematic hero with the tagline *"An adaptive intelligence. It never
forgets."* The visitor types a name and presses **Enter the Threshold**. Clicking
anywhere on the hero fast-forwards the animation to the next beat, unless the visitor
has `prefers-reduced-motion` set, in which case the click-to-skip handler returns early
and the timeline plays on its own.

Source: [`web/src/components/ui/cinematic-landing-hero.tsx`](web/src/components/ui/cinematic-landing-hero.tsx)
(1,007 lines), [`web/src/App.tsx`](web/src/App.tsx), [`web/src/main.tsx`](web/src/main.tsx).

**2. The game (`web/public/`)**
Vanilla JavaScript, no framework, no build step of its own. One HTML file plus four
scripts loaded as classic `<script src>` tags. This is the actual tic-tac-toe game,
the guidebook, the taunts, the power-ups and every animation.

| File | Lines | Role |
| --- | --- | --- |
| [`web/public/index.html`](web/public/index.html) | 647 | Every screen and every `<audio>` element |
| [`web/public/script.js`](web/public/script.js) | 6,513 | The game, the AI, the taunts, the socket client |
| [`web/public/styles.css`](web/public/styles.css) | 5,064 | All styling, including 3D transforms for the board and guidebook |
| [`web/public/animations.js`](web/public/animations.js) | 418 | `AnimationUtils`, cell placement, winning lines, board reset |
| [`web/public/guidebook-cinematic.js`](web/public/guidebook-cinematic.js) | 479 | The 3D book that opens on a 3D cover and flips page by page |

Both are served from the **same origin**. That is what makes the handoff in
[How a play session actually flows](#how-a-play-session-actually-flows) possible.

---

## Architecture

```
  Browser
  ┌──────────────────────────────────────────────────────────┐
  │  /                     React SPA (Vite build → dist)    │
  │    cinematic hero, name entry                            │
  │        │                                                 │
  │        │ sessionStorage + window.location.assign        │
  │        ▼                                                 │
  │  /play/index.html      vanilla game, same origin         │
  │    9 cells, AI, power-ups, guidebook, taunts             │
  └────────────┬─────────────────────────────────────────────┘
               │ Socket.IO (real time) + fetch (REST)
               ▼
  ┌──────────────────────────────────────────────────────────┐
  │  Node + Express + Socket.IO host   (server/server.js)    │
  │    ├── /api/*  REST, reads and writes data.json         │
  │    └── socket   events, lobby, invites, learning data   │
  │                                                      │
  │  server/data.json  the whole "database"                  │
  └──────────────────────────────────────────────────────────┘
```

Three deployable units, two hosts:

- The **SPA**, built by Vercel from `web/`, output `web/dist`.
- The **game**, copied into `web/dist/play/` at build time by
  [`web/scripts/copy-legacy-to-dist.mjs`](web/scripts/copy-legacy-to-dist.mjs), so it
  ships as static files on the same origin as the SPA.
- The **server**, a separate Node process on a different host. In production the game
  is told where it lives through
  [`web/public/angelic-socket-config.js`](web/public/angelic-socket-config.js), which
  is generated at build time. Locally it is empty and `io()` connects to the page's own
  origin.

`★ Insight ─────────────────────────────────────`
`angelic-socket-config.js` is generated, not hand-written, and it is checked in.
That is deliberate: it is loaded by a plain `<script src>` tag with no bundler, so it
has to exist as a real file at the path the tag names. The build step writes the
environment variable into that file before Vite copies `public/` into `dist/`, which
is why `web/package.json` runs `write-socket-config.mjs` *before* `vite build` and
not after.
`─────────────────────────────────────────────────`

---

## How a play session actually flows

### 1. The visitor arrives and enters a name

`AngelicCinematicHero.submitThreshold()` trims the name. Empty means a validation
message; non-empty means it calls `onEnterThreshold({ playerName })`.

### 2. The SPA writes the handoff and navigates

[`web/src/App.tsx`](web/src/App.tsx) `handleEnterThreshold` writes three
`sessionStorage` keys and then calls `window.location.assign('/play/index.html')`.

| Key | Written by | Read by | Purpose |
| --- | --- | --- | --- |
| `angelic_spa_launch` | `App.tsx` | `readAngelicSpaLaunchPayload()` in `script.js` | The name, plus a timestamp. This is the payload the game consumes. |
| `angelic_spa_skip_void` | `App.tsx` | inline script in `index.html` lines 10-30 | Skips the star-field void intro that a direct visit to `/play/` would get |
| `angelic_cinematic_gate` | `App.tsx` | `script.js` gate reader | Legacy mirror of the launch key |
| `angelic_spa_handoff_applied` | `script.js` | `script.js` | Marks that the handoff already ran once in this tab |
| `angelic_spa_home_href` | `App.tsx` | inline script in `index.html` | Where a reload of `/play/` should bounce back to |
| `angelic_guidebook_seen` | `script.js` | `script.js` | Suppresses the guidebook on repeat visits |

`sessionStorage` and not `localStorage` is the right call here: the payload must
survive the full-page navigation from the SPA to `/play/`, and must *not* survive the
tab closing. A returning visitor gets the void intro again instead of being dropped
straight into a game with their last name pre-filled.

### 3. The game applies the handoff on load

`applyAngelicCinematicGateFromReact()` runs at script load
([script.js:3415](web/public/script.js#L3415)), immediately followed by a bare call
so it executes once during initial parse.

- No `angelic_spa_launch` present, the function returns and the normal welcome flow runs.
- Present, it fills the name input, sets `gameState.playerName`, hides the pre-welcome
  overlay and the welcome screen, and shows the mode picker (AI or PvP).
- On the *first* handoff in a tab it also clears `angelic_guidebook_seen`, so the
  guidebook runs again even if a partial earlier session already consumed it.
- It emits `player-start` over the socket, which is what creates the player record on
  the server and increments their `plays` counter.

### 4. The visitor picks a mode

`mode-ai` starts an AI game. `mode-player` opens the lobby and emits `join-lobby`.
Both paths call the guidebook first, unless it has already been seen.

### 5. Play

`handleCellClick` is the single entry point for a player move. It bails if the game is
not active, if an interactive taunt is playing, or if `gameState.uiLocked` is set. The
lock is the reason you cannot double-click a cell during its 180ms placement animation.

After the placement animation and a pacing delay, `makeAIMove` fires. The AI takes
between 300 and 500ms (`aiThinkingDelay`), which is purely theatre: it exists so the
game does not feel instantaneous.

---

## The AI

There are three separate move-selection layers in this codebase. Only two of them run.

### Layer 1: `AngelicAI_Level1` (this is the one that plays)

A 5-game series against a deliberately beatable opponent, defined at
[script.js:1420](web/public/script.js#L1420). `gameState.level1` tracks
`playerWins`, `aiWins`, `gamesPlayed` (out of `totalGames: 5`), `complete` and
`history`.

It evolves in three phases based on `gamesPlayed`:

| Phase | Games | Behaviour |
| --- | --- | --- |
| 1, Cold | 1-2 | Take a win, block a win, otherwise centre, then corners, then sides |
| 2, Aware | 3-4 | Adds fork creation and opening memory pre-emption |
| 3, Adaptive | 5 | Adds minimax at depth 4 as the final fallback |

Opening memory is the interesting part. `AngelicAI_Level1.memory` stores
`{ opening: "0,4", thirdMove: 8 }` records via `recordOpening()`. In phases 2 and 3,
when the player has made exactly two moves, the AI looks up `"0,4"` in that memory. If
it has seen you open that way before, it plays the third cell it learned blocks you,
before you get there.

When the fifth game resolves, `handleLevel1Logic` compares `playerWins > aiWins`. The
player advances on a majority; anything else is `showLevel1Failed`.

### Layer 2: `chooseHardAIMove` (the priority chain, [script.js:4293](web/public/script.js#L4293))

A long, explicit, strictly ordered decision chain:

1. **Win** (`STEP 1`, absolute priority, the AI never misses its own win).
2. **Block** (`STEP 2`, only reached when the AI cannot win itself).
3. Counter repeated winning patterns, using the learned pattern store.
4. Fork creation, fork blocking, blocking forks.
5. Centre, opposite-corner, corner and edge heuristics, each scored with a numeric
   priority.
6. Tactical Claim bonus, applied to fork, fork-block and strategic move scoring.

Every option is pushed with a numeric `priority`, the list is sorted descending, and
selection happens on the top tier. There is deliberate leniency: at Level 1, when the
top tier contains only non-critical moves (priority between 400 and 700), there is a
30% chance on the session's first round and 15% afterwards of picking a *worse but
still safe* move instead. At higher levels, ties break 70/20/10 across the top three.

The AI's win rate is read from `aiLearningSystem.getStats()`, which prefers the
`data.json` snapshot and falls back to `localStorage`. Below 50% the AI is treated as
losing and the code notes it should get more aggressive, though the only randomness
control is the tie-breaking above.

### Layer 3: `minimax` / `getBestMove` (dead)

Standalone functions at [script.js:4878](web/public/script.js#L4878) and
[script.js:4901](web/public/script.js#L4901). Nothing calls them. `AngelicAI_Level1`
has its *own* `minimax` method, which is the one that runs in phase 3. The standalone
pair is leftover and can be deleted.

### Turn safety

`aiMoveInProgress` is the documented single source of truth. It and `aiTurnInProgress`
are both set immediately before any async work in `makeAIMove`, and the whole body is
wrapped in `try/finally` so a throw still unlocks the turn. Two independent failsafes
back this up:

- A **500ms think timeout** on move selection. If the chain has not produced a move by
  then, a random empty cell is used.
- A **watchdog timer** armed before the AI turn. If the number of `O` marks on the
  board has not changed by the time it fires, the turn is forcibly released and
  `makeAIMove` is called again.

---

## The deliberate cheating

This is the part that would get a game taken down if it were not obviously a joke, so
it is documented plainly rather than buried.

**`performSubtleTileCheat()`** ([script.js:2642](web/public/script.js#L2642))
silently converts **one** of the player's `X` marks into an `O`, including rewriting
the DOM (`textContent`, `data-mark`) and playing the normal placement animation so it
looks like an ordinary AI move. It evaluates every `X` on the board by counting how many
immediate threats the AI would have with that tile flipped, plus 100 bonus if the flip
is an immediate win, and takes the best cell if the score improves.

**`ensureAIWinningPath()`** computes the AI's strongest move without placing it, and
stashes the index in `gameState.pendingCheatMoveIndex`. `makeAIMove` checks that field
first and uses it in preference to the honest decision chain.

**`shuffleBoardContents()`** reassigns the logical indices behind the nine tiles. The
marks stay exactly where they appear on screen, but the underlying index-to-cell
mapping is permuted, which invalidates every cached AI plan.

Both are invoked from `performJumpscare`, which is the classic admin-triggered
`jumpscare` control and also the 6-loss demon sequence. The scare is the distraction;
the board manipulation is the payload.

**`isKingWilliam`** is a hidden easy-mode. Hold either Shift key for two seconds and
`gameState.isKingWilliam` becomes `true`, at which point `makeAIMove` plays a uniformly
random empty cell instead of calling `chooseHardAIMove`. It also suppresses the
post-win taunt at [script.js:3558](web/public/script.js#L3558). It is also reachable
over the socket via a `control` message with `type: 'difficulty'` and
`value: 'easy'`, which is how the removed admin panel used to grant mercy.

---

## Power-ups

Three are usable, one belongs to the AI. They live in the `#powerup-sidebar` and in
the ritual dock at the bottom of the screen, and both are wired by
`wirePowerUpSidebarActivations()`.

| Power-up | Key | Charges | What it does |
| --- | --- | --- | --- |
| Hint Pulse | `hint-pulse` | 2 | Runs a depth-4 minimax for the *player's* position and pulses the recommended cell |
| Board Shake | `board-shake` | 1 | Calls `shuffleBoardContents()`, permuting logical cell indices |
| Last Stand | `last-stand` | 1 | Schedules a guard for a *future* play number. If the AI is about to complete a line on that play, the move is stopped and the player gets a window to counter |
| Tactical Claim | `tactical-claim` | AI only | Not a button. A scoring bonus the AI applies to its own candidate moves in `chooseHardAIMove`. `aria-disabled="true"` in the markup |

The charges live on `gameState` as `hintPulseCharges`, `boardShakeCharges` and
`lastStandCharges`, and `refreshPowerUpChargeLabels()` repaints the counters after
every move, every activation and every reset.

`★ Insight ─────────────────────────────────────`
Board Shake is a genuinely elegant AI-confusion primitive. Because the DOM is left
untouched and only the `board` array's index mapping is permuted, the AI's entire
evaluation of the position is now wrong, but the human's mental model of the position
is still correct. It is a real information-asymmetry attack, not just a visual gag.
`─────────────────────────────────────────────────`

---

## The loss ladder

Losses are counted in `gameState.losses`. The dispatch happens once, in `endGame`, at
[script.js:4116](web/public/script.js#L4116).

| Losses | Event | Detail |
| --- | --- | --- |
| 1-2 | None | A plain taunt message |
| 3 | `activateInteractiveAIMock()` | Music pauses (`musicPausedForTaunt`), disco lights, a YES/NO card, then music resumes |
| 6, 12, 18... | `activateEnhancedInteractiveAIMock()` | The above plus a demon jumpscare, every 6th loss |
| 9, 15, 21... | `activateInteractiveAIMock()` | Falls through to the same milestone rule as 3, every 3rd loss after that |
| 7 | `activateSeventhLossTeasing()` | A full-screen red pulsing message naming the player, then `endGame`, then a 3-second pause and an automatic board reset |
| Tsukuyomi | `activateTsukuyomi()` | A separate 10-second event that clears the board and mocks the player |

`activateTsukuyomi()` sets `gameState.inTsukuyomi` and runs a countdown. While it is
true, `checkWinTsukuyomi()` is used instead of `checkWin`, so the win condition
behaves differently during the event.

All of these gate on `!gameState.inTsukuyomi && !gameState.inInteractiveMode`, so two
taunts can never stack. They set `inInteractiveMode = true` and `gameActive = false`
for the duration, which is exactly what makes `handleCellClick` refuse input.

---

## The Sarah persona

`isSarah()` at [script.js:3089](web/public/script.js#L3089) is a case-insensitive
comparison of the trimmed player name against the literal string `'sarah'`. If it
matches, the entire game switches to a deferential butler register and the jumpscares
are suppressed.

- The 3rd loss falls back to *"The AI has won this round, Miss Sarah. Shall we try
  again?"* instead of the insult.
- The 7th loss teasing is skipped entirely (`!isSarah()` guards it).
- The 6-loss demon jumpscare is skipped; the plain interactive mock runs instead.
- `showSarahNarrative()` takes over the narrative overlay.

This is hardcoded client-side and matches on the name only. It is a joke with a
specific person, and it is a one-line change to remove.

---

## The learning store

Two client classes and one server file.

### `BehaviorAnalyzer` (`web/public/server/behavior_analyzer.js`, 228 lines)

Runs in the browser. `recordMove(moveIndex, boardState, moveType)` captures a
`MoveEvent` containing the board snapshot, the timestamp since game start, the
**response time** since the last move, a derived `gamePhase` of opening/midgame/endgame,
and the move number. On game end it sends the summary over the socket as
`behavior-data`.

### `AILearningSystem` (`web/public/server/ai_learning.js`, 430 lines)

Persists AI stats to `localStorage` and hydrates from the server. Its constructor
fires a `syncWithServer()` that GETs `/api/ai/stats` and merges the result, using
`Math.max` on every counter so a merge can only ever add history, never lose it. It
rate-limits itself to once every two seconds.

It records the last move index that appeared in a losing game
(`lastLosingMoveIndex`) and the player's `patternsData`, both of which are surfaced
through `/api/ai/stats` so a returning player inherits what the AI learned last time.

### `server/data.json`

The entire "database", read and written synchronously with
`fs.readFileSync`/`writeFileSync` on every request. Shape:

```json
{
  "players": {
    "<name>": {
      "losses": 0, "wins": 0, "plays": 0,
      "lastActive": 0, "matricNumber": "", "life": "",
      "behaviorStats": {
        "totalGames": 0, "wins": 0, "losses": 0, "draws": 0,
        "preferredOpenings": {}, "commonSequences": {},
        "averageResponseTime": 0, "lastResult": null, "lastGameAt": null
      }
    }
  },
  "sessions": [],
  "ai": {
    "wins": 0, "losses": 0, "draws": 0, "totalGames": 0,
    "moveHistory": [], "learnedPatterns": {}, "patternsData": {},
    "adaptationLevel": 0, "lastLosingMoveIndex": null
  }
}
```

`ensureDb()` recreates this file from that exact template if it is missing, so a fresh
clone self-heals on first server start. `moveHistory` is capped at 1,000 entries.

**`data.json` is gitignored.** It holds real player records including matriculation
numbers and is untracked, so it does not travel with the repository.

---

## The guidebook

`guidebook-cinematic.js` is a self-contained IIFE. It builds a 3D book from the
`.guide-page` elements in `index.html`, animates the cover opening with GSAP, and
flips one page at a time on click. It deliberately avoids `ScrollTrigger`, because the
overlay is not scrollable.

Three entry points on `window`:

- `openGuidebookCinematic(onComplete)` opens it and calls back on close.
- `openGuidebookReplay()` reopens it after the first session.
- `stopAllGuideDemos()` cancels every in-flight demo interval and timeout by bumping a
  `guideDemoRunId` counter that all closures check.

Pages 4 onward hold **live animated demos** of all four power-ups, driven by
`initGuidebookPowerUpDemos()` in `script.js`. Each demo is an independent mini-board
that plays its animation on a loop while the page is visible. This is the one place
where the guidebook teaches rather than just describes.

---

## Remote control

The game connects to Socket.IO at load and listens for a `control` message. The
origin comes from `window.__ANGELIC_SOCKET_URL` if it is set, otherwise `io()` uses
the page's own origin.

| `type` | Effect |
| --- | --- |
| `difficulty` | `'easy'` sets `isKingWilliam`, `'hard'` clears it |
| `jumpscare` | `performJumpscare({ variant, duration, cheat })`, which is the cheat entry point |
| `move-board` | Slides the board: `shake`, `left`, `right`, `up`, `down`, `center` |
| `shuffle-tiles` | Calls `shuffleBoardContents()` directly |
| `pause` / `resume` | Sets `gameActive` and writes a message |

A `control` payload carrying a `target` field is ignored by every client whose
`playerName` does not match. That is the only targeting mechanism, and it is a
client-side string comparison, not authentication. **Anyone who can reach the server
can send a `control` message to every connected player.** The panel that used to send
these was removed in the September 2026 cleanup, but the receiving end is fully intact.

---

## Running it locally

Two terminals.

**Terminal 1, the game and the SPA:**

```bash
cd web
npm install
npm run dev
```

That runs `write-socket-config.mjs` and then Vite. The dev server mounts
`web/public/` at `/play/` through a `sirv` middleware in
[`web/vite.config.ts`](web/vite.config.ts), so both the SPA at `/` and the game at
`/play/` are on one origin, exactly as in production. `/game-static/*` is a 302 that
redirects to `/play/*` so old links still resolve.

**Terminal 2, the server:**

```bash
cd server
npm install
npm start
```

Listens on `process.env.PORT` or 3000. The dev SPA has no `VITE_SOCKET_URL` set, so
`angelic-socket-config.js` is written as an empty string and `io()` connects to the
page origin, which is the Vite dev server, not this Node process. **To have the dev
game talk to the Node server, start Vite with the variable set:**

```bash
cd web
VITE_SOCKET_URL=http://localhost:3000 npm run dev
```

`ANGELIC_SOCKET_URL` works as an alias for the same thing. Either variable makes
`write-socket-config.mjs` write that origin into `web/public/angelic-socket-config.js`.

---

## Deployment

**The SPA and the game** are deployed to Vercel from the `web/` directory.
[`web/vercel.json`](web/vercel.json) sets `buildCommand: npm run build`,
`outputDirectory: dist`, `framework: vite`. The build produces `web/dist/` containing
the SPA at the root and the whole vanilla game under `web/dist/play/`.

**The server** is a separate Node process on a separate host, started with
`npm start` in `server/`. Set `PORT` as its environment variable. It persists state to
`data.json` on its own filesystem, so the host must have a writable disk. On a
platform with an ephemeral filesystem the learning data resets on every deploy.

Set `VITE_SOCKET_URL` (or `ANGELIC_SOCKET_URL`) in the Vercel environment to the
server's origin, scheme and host only, for example
`https://your-app.up.railway.app`, with no `/socket.io` path. The build writes it into
`angelic-socket-config.js`.

`★ Insight ─────────────────────────────────────`
The server binds CORS to `origin: '*'` and Socket.IO to `cors: { origin: '*' }`. For a
Vercel static front end talking to a separate Node host that is genuinely required,
because there is no shared origin to fall back on. It also means the `control` channel
described above is open to anyone who learns the server URL. If you deploy this,
put it behind a host with authentication or at minimum change the wildcard.
`─────────────────────────────────────────────────`

---

## Repository layout

```
.
├── README.md                     this file
├── .gitignore                    data.json, node_modules, dist, .env, .remember
│
├── AI_ARCHITECTURE.md            design notes (see caveat below)
├── GAME_SYSTEMS_OVERVIEW.md      AI and power-up design notes
├── INTEGRATION_GUIDE.md          Django integration notes (not implemented)
├── SECURITY.md                   camera/WebRTC notes (feature now removed)
├── WEBRTC_SETUP.md               WebRTC notes (feature now removed)
├── CAMERA_FIX_DOCUMENTATION.md   camera notes (feature now removed)
│
├── server/                       the Node host
│   ├── server.js                 Express + Socket.IO, REST API, lobby, invites
│   ├── data.json                 the store (gitignored, real player records)
│   ├── ai_learning.js            identical copy of the client file
│   ├── behavior_analyzer.js      identical copy of the client file
│   ├── webrtc-config.js          orphaned, see Known gaps
│   ├── ai_models.py              orphaned Django model file
│   ├── api/views.py              orphaned Django view file
│   └── urls.py                   orphaned Django urlconf
│
└── web/                          the deployable target
    ├── vercel.json
    ├── vite.config.ts            React plugin + /play sirv mount
    ├── scripts/
    │   ├── write-socket-config.mjs    generates public/angelic-socket-config.js
    │   └── copy-legacy-to-dist.mjs    copies public/ into dist/play/
    ├── src/
    │   ├── main.tsx              React entry, imports public/styles.css
    │   ├── App.tsx               the SPA to game handoff
    │   ├── components/ui/cinematic-landing-hero.tsx
    │   ├── lib/utils.ts          cn() classname helper
    │   └── index.css
    └── public/                   the vanilla game
        ├── index.html            all screens, all audio
        ├── script.js             6,513 lines
        ├── styles.css            5,064 lines
        ├── animations.js         AnimationUtils
        ├── guidebook-cinematic.js
        ├── angelic-socket-config.js   generated, committed
        ├── socket.io.min.js          build-time replacement for /socket.io/socket.io.js
        ├── server/                   the two client learning classes
        ├── favicon.svg, icons.svg
        ├── madara.webp, demon.avif
        └── 6 audio files
```

`★ Insight ─────────────────────────────────────`
`server/ai_learning.js` and `server/behavior_analyzer.js` are byte-identical to their
counterparts in `web/public/server/`. The copy in `web/public/server/` is the one the
browser loads via `<script src="server/ai_learning.js">`. The copy in `server/` is
loaded by nothing. The browser copy is the real one; the server-side copy is a
leftover and both can be deleted from `server/`.
`─────────────────────────────────────────────────`

---

## The build pipeline

`npm run build` in `web/` runs four steps in order:

1. `tsc -b`, type-checking the SPA.
2. `node scripts/write-socket-config.mjs`, writing `public/angelic-socket-config.js`
   from `VITE_SOCKET_URL` or `ANGELIC_SOCKET_URL`. **Before** the Vite build, because
   Vite copies `public/` into `dist/` and the file must already be correct.
3. `vite build`, producing the SPA in `dist/`.
4. `node scripts/copy-legacy-to-dist.mjs`, copying the game into `dist/play/`.

Step 4 copies 14 named files, both files from `public/server/`, and
`socket.io.min.js`. It also rewrites one line of `index.html` on the way through:

```html
<!-- source (dev) -->
<script src="/socket.io/socket.io.js"></script>

<!-- rewritten (build) -->
<script src="socket.io.min.js"></script>
```

In dev, `/socket.io/socket.io.js` is served by Socket.IO's own server. On a static
host there is no such route, so the build ships a pinned client file instead. The
Node server exposes `/socket.io.min.js` too, serving the copy from its own
`node_modules`, for anyone running the two together without the SPA build.

---

## Socket.IO and REST reference

**REST**, all on the Node host:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/socket.io.min.js` | The bundled Socket.IO browser client |
| GET | `/api/stats` | All players and sessions |
| GET | `/api/ai/stats` | AI counters, learned patterns, `lastLosingMoveIndex` |
| GET | `/api/player/:name` | One player record, case-insensitive lookup |
| POST | `/api/control` | Broadcasts a `control` payload to every socket |
| POST | `/api/session/start` | Creates or bumps a player, logs a session |
| POST | `/api/loss` | Increments losses |
| POST | `/api/win` | Increments wins |
| POST | `/api/player/delete` | Deletes a player by name |
| DELETE | `/api/player/:name` | Same, REST-style |

**Socket events the game sends:** `player-start`, `join-lobby`, `leave-lobby`,
`invite`, `invite-response`, `ai-move`, `ai-stats-update`, `behavior-data`,
`board-update`, `powerup-event`, `client-jumpscare`, `interactive-mode-*`.

**Socket events the game receives:** `hello`, `control`, `lobby-players`, `invite`,
`invite-error`, `invite-response`, `start-pvp`, `spectate`, `spectate-jumpscare`,
`board-update`, `powerup-event`, `interactive-mode-*`.

Note that `powerup-event`, `board-update` and `interactive-mode-*` are broadcast to
every connected client but **nothing in the game listens for them**. They are the
remnants of the admin spectate view, kept because removing the panel did not mean
removing the spectate data feed.

**Lobby and invites.** `join-lobby` and `leave-lobby` both re-broadcast
`lobby-players`, the list of currently connected names. `invite` looks the target up in
the name to socket map and emits `invite` to that socket only. `invite-response` with
`accepted: true` mints a `pvp_<timestamp>_<random>` session id and sends `start-pvp`
to both parties with their roles.

---

## What changed in the September 2026 cleanup

Commit `3a7a5c5`, *"refactor: remove camera, admin panel, and duplicate root game
files"*.

The repository used to hold two complete copies of the game, one at the root and one
under `web/public/`, and the root copy was the one several build scripts read from. The
cleanup inverted that: `web/public/` is now the single source of truth, and the build
scripts point at it.

**Removed entirely:**

- The entire camera and WebRTC subsystem from `script.js`, roughly 816 lines. The
  functions `requestCameraAccess`, `ensureVideoPlayback`, `stopCamera`,
  `monitorCameraStatus`, `startCameraStreaming`, `stopCameraStreaming`,
  `startVideoRecording`, `stopVideoRecording`, `sendVideoToServer`,
  `startCameraStatusUpdates`, `stopCameraStatusUpdates`, `sendCameraStatusUpdate`,
  `capturePlayerImage`, plus the `peerConnection`, `mediaRecorder`, `recordedChunks`,
  `rtcConfiguration` and reconnect-attempt state, and every call site in
  `startGameAsAI`, `applyAngelicCinematicGateFromReact`, `resetToLanding`, the reset
  handler, `beforeunload` and `visibilitychange`. The `gameState.cameraEnabled` and
  `cameraStream` fields went with them.
- The camera markup from `index.html`: the welcome `.camera-section` with
  `#camera-status`, `#enable-camera-btn`, `#camera-preview` and `#camera-feed`, and the
  `.game-camera-status` block with `#game-camera-status`.
- 188 lines of dead camera CSS from `styles.css`, deleted by brace matching rather than
  line range so no surviving rule was cut. 5,252 lines to 5,064.
- Every WebRTC and admin handler from `server/server.js`: `webrtc-offer`,
  `webrtc-answer`, `webrtc-ice-candidate`, `admin-register`, `request-player-stream`,
  `admin-control`, `camera-feed`, `live-camera-feed`, `camera-status`,
  `camera-status-update` and `test-message`, plus the `webrtcConnections` and
  `adminConnections` maps. The four remaining `adminConnections.forEach` fan-outs for
  `powerup-event`, `board-update` and the `interactive-mode-*` events became
  `io.emit`, since a broadcast to nobody is harmless and preserves the data feed.
- The `/admin` rewrite from `web/vercel.json` and the `app.get('/admin')` route.
- The duplicate root copy of the game: `index.html`, `script.js`, `styles.css`,
  `animations.js`, `guidebook-cinematic.js`, `angelic-socket-config.js`,
  `push_to_github.ps1`, `package.json`, `package-lock.json`, `Angel.jpg` and a root
  `node_modules/` holding only `@radix-ui/colors`, which nothing imported.
- `"Camera anti-cheat."` from the landing hero card description.

**Changed to point at `web/public/`:**

- `web/scripts/copy-legacy-to-dist.mjs`, which read from the repo root and took the
  Socket.IO client from `server/node_modules`. Both now come from `web/public/`.
- `web/vite.config.ts`, where both `configureServer` and `configurePreviewServer`
  mounted `sirv` at the repo root. Both now mount `web/public/`.
- `web/scripts/write-socket-config.mjs`, which wrote both a root copy and a
  `web/public/` copy. It writes only `web/public/` now.
- `web/src/main.tsx`, which imported `../../styles.css`, a path that pointed at the
  root `styles.css` the sweep deleted. It is now `../public/styles.css`. **Without this
  the Vite build fails on a fresh clone.**
- The two `blackbear` taunt tracks and every other asset moved into `web/public/` so
  the game has everything it needs under one directory.

**Not removed, by instruction:** every `.md` file, `guidebook-cinematic.js`, and every
audio and image asset.

---

## Known gaps and dead code

Stated plainly so nobody rediscovers them the hard way.

- **PvP does not work.** The lobby, the invite flow and the `start-pvp` handshake are
  all real and all work. The moment the board appears, nothing happens: the source says
  it directly at [script.js:2214](web/public/script.js#L2214),
  *"moves must be synced via socket events (not implemented here yet)"*. There is no
  `pvp-move` event on either side. Two players can enter a match and neither can play.
- **`web/public/admin.html` still exists** and is still deployed, though nothing links
  to it, `vercel.json` no longer routes `/admin` to it, and the server no longer
  serves it. It is an orphaned page. Deleting it was blocked pending explicit approval.
- **`web/scripts/sync-admin-html-to-root.mjs` still exists** and is no longer invoked
  by any npm script. It is dead code.
- **`server/webrtc-config.js` still exists** and is required by nothing.
- **`server/ai_models.py`, `server/api/views.py` and `server/urls.py` are Django files
  in a Node project.** Nothing loads them. `INTEGRATION_GUIDE.md` describes a Django
  backend that was never built.
- **`AI_ARCHITECTURE.md` describes a Django and scikit-learn backend** with
  `PlayerBehaviorProfile` and `MoveEvent` models. None of it exists. The real
  implementation is `BehaviorAnalyzer` in the browser writing to a JSON file. Read that
  document as design intent, not as a description of the code.
- **`SECURITY.md`, `WEBRTC_SETUP.md` and `CAMERA_FIX_DOCUMENTATION.md` describe a
  feature that no longer exists.** They document camera consent flows, WebRTC DTLS/SRTP
  encryption and TURN server configuration, all of which were removed in the September
  2026 cleanup.
- **`getBestMove` and `minimax` at module scope in `script.js`** are unreferenced.
  `AngelicAI_Level1` has its own copies that are actually used.
- **`finalizeRoundAndStartNext` is declared twice** in `script.js`. This is legal, the
  file is loaded as a classic script, and the second declaration wins. Worth knowing
  before you run `node --check` on it and get a `SyntaxError` that does not exist in
  any browser.
- **`guidebook-cinematic.js:98` still tells the player** that the ritual camera exists
  to honour fair play. That line was left untouched by instruction, and it is now
  untrue.
- **`server/server.js:72` serves `express.static(path.join(__dirname, '..'))`**, which
  is the repo root. With the root swept, this now serves the markdown files and the
  `web/` directory listing. It is not a security hole on its own, but it is not what the
  comment above it says it is.

---

## The other markdown files

Five of the six documents in this repository describe things that are not in the code.

| File | Accurate? |
| --- | --- |
| `GAME_SYSTEMS_OVERVIEW.md` | Mostly. The AI phases, the power-up list and the turn locking are described correctly. The "Minimax is the primary decision engine" claim is wrong: minimax only runs in `AngelicAI_Level1` phase 3, as a last resort. It also documents a `Focus Aura` power-up that does not exist in the markup. |
| `AI_ARCHITECTURE.md` | Design intent only. Describes a Django/scikit-learn backend that was never built. |
| `INTEGRATION_GUIDE.md` | Same. Every endpoint it lists under `/api/behavior/*` returns 404. |
| `SECURITY.md`, `WEBRTC_SETUP.md`, `CAMERA_FIX_DOCUMENTATION.md` | Describe the camera and WebRTC feature removed in commit `3a7a5c5`. |

They are kept because you asked to keep every `.md` file. If you want them corrected or
removed, say which and it is a small job.
