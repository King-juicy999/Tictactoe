// Global error handler to prevent crashes

// Welcome Flow State
let welcomeFlowState = {
    preWelcomeShown: false,
    /** Set when SPA (`web/` Vite hero) bridged — blocks DOMContentLoaded from re-opening the void intro. */
    skipVoidBootstrapFromSpaGate: false,
};

var ANGELIC_SPA_SKIP_VOID_KEY = 'angelic_spa_skip_void';
var ANGELIC_SPA_LAUNCH_KEY = 'angelic_spa_launch';
var ANGELIC_SPA_HANDOFF_KEY = 'angelic_spa_handoff_applied';

/** Survives refresh while the tab stays open (`sessionStorage`) so `/play/` reload skips the void ritual. */
function syncAngelicSpaVoidSkipFromStorage() {
    try {
        if (sessionStorage.getItem(ANGELIC_SPA_SKIP_VOID_KEY) === '1')
            welcomeFlowState.skipVoidBootstrapFromSpaGate = true;
    } catch (_) {}
}
syncAngelicSpaVoidSkipFromStorage();

function readAngelicSpaLaunchPayload() {
    try {
        var raw =
            sessionStorage.getItem(ANGELIC_SPA_LAUNCH_KEY) ||
            sessionStorage.getItem('angelic_cinematic_gate');
        if (!raw) return null;
        var gate = JSON.parse(raw);
        var maxAgeMs = 24 * 60 * 60 * 1000;
        if (
            !gate ||
            typeof gate.playerName !== 'string' ||
            (gate.mode !== 'ai' && gate.mode !== 'player') ||
            Date.now() - (gate.ts || 0) > maxAgeMs
        ) {
            try {
                sessionStorage.removeItem(ANGELIC_SPA_LAUNCH_KEY);
                sessionStorage.removeItem('angelic_cinematic_gate');
                sessionStorage.removeItem(ANGELIC_SPA_HANDOFF_KEY);
            } catch (_) {}
            return null;
        }
        return gate;
    } catch (e) {
        try {
            sessionStorage.removeItem(ANGELIC_SPA_LAUNCH_KEY);
            sessionStorage.removeItem('angelic_cinematic_gate');
            sessionStorage.removeItem(ANGELIC_SPA_HANDOFF_KEY);
        } catch (_) {}
        return null;
    }
}

// Pre-welcome overlay elements (will be set on DOMContentLoaded)
let preWelcomeOverlay, continueWelcomeBtn, aiPresenceGameplay;
let preWelcomeAutoTimer = null;

/** Slow parallax star field for void intro (canvas). */
function initVoidStarfield() {
    const canvas = document.getElementById('void-stars-canvas');
    if (!canvas) return;
    const gl =
        canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) ||
        canvas.getContext('experimental-webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;

    const prefersReduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let viewportWidth = 0;
    let viewportHeight = 0;
    let dpr = 1;
    let sigilOpacity = 0;
    let sigilAngle = 0;
    let nextShootingAt = 0;
    let stars = [];
    let orbiters = [];
    let shootingStars = [];

    const pointVertexSource = `
        attribute vec2 a_position;
        attribute float a_size;
        attribute vec4 a_color;
        varying vec4 v_color;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            gl_PointSize = a_size;
            v_color = a_color;
        }
    `;

    const pointFragmentSource = `
        precision mediump float;
        varying vec4 v_color;
        void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float dist = length(uv);
            float alpha = smoothstep(0.5, 0.0, dist) * v_color.a;
            gl_FragColor = vec4(v_color.rgb, alpha);
        }
    `;

    const lineVertexSource = `
        attribute vec2 a_position;
        attribute vec4 a_color;
        varying vec4 v_color;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_color = a_color;
        }
    `;

    const lineFragmentSource = `
        precision mediump float;
        varying vec4 v_color;
        void main() {
            gl_FragColor = v_color;
        }
    `;

    const glowVertexSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const glowFragmentSource = `
        precision mediump float;
        varying vec2 v_uv;
        uniform vec2 u_resolution;
        void main() {
            vec2 frag = gl_FragCoord.xy / u_resolution.xy;
            vec2 centered = (frag - vec2(0.5)) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
            float dist = length(centered * vec2(1.0, 1.2));
            float alpha = smoothstep(0.95, 0.0, dist) * 0.18;
            vec3 color = vec3(74.0 / 255.0, 63.0 / 255.0, 107.0 / 255.0);
            gl_FragColor = vec4(color, alpha);
        }
    `;

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    function createProgram(vertexSource, fragmentSource) {
        const program = gl.createProgram();
        gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        return program;
    }

    const pointProgram = createProgram(pointVertexSource, pointFragmentSource);
    const lineProgram = createProgram(lineVertexSource, lineFragmentSource);
    const glowProgram = createProgram(glowVertexSource, glowFragmentSource);

    const pointBuffer = gl.createBuffer();
    const lineBuffer = gl.createBuffer();
    const glowBuffer = gl.createBuffer();

    const pointPositionLoc = gl.getAttribLocation(pointProgram, 'a_position');
    const pointSizeLoc = gl.getAttribLocation(pointProgram, 'a_size');
    const pointColorLoc = gl.getAttribLocation(pointProgram, 'a_color');
    const linePositionLoc = gl.getAttribLocation(lineProgram, 'a_position');
    const lineColorLoc = gl.getAttribLocation(lineProgram, 'a_color');
    const glowPositionLoc = gl.getAttribLocation(glowProgram, 'a_position');
    const glowResolutionLoc = gl.getUniformLocation(glowProgram, 'u_resolution');

    function toClipX(x) {
        return (x / viewportWidth) * 2 - 1;
    }

    function toClipY(y) {
        return 1 - (y / viewportHeight) * 2;
    }

    function rotatePoint(x, y, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return { x: x * c - y * s, y: x * s + y * c };
    }

    function projectPoint(x, y, rx) {
        const cosX = Math.cos(rx);
        const sinX = Math.sin(rx);
        const y3 = y * cosX;
        const z3 = y * sinX;
        const perspective = 1 / (1 + z3 * 0.85);
        return { x: x * perspective, y: y3 * perspective };
    }

    function scheduleNextShootingStar(now = performance.now()) {
        nextShootingAt = now + 5000 + Math.random() * 4000;
    }

    function buildScene() {
        stars = [];
        orbiters = [];
        shootingStars = [];
        const starCount = 360;
        for (let i = 0; i < starCount; i++) {
            const roll = Math.random();
            let size;
            let color;
            let drift;
            let baseAlpha;
            let additive = 0;
            if (roll > 0.95) {
                size = 1.2 + Math.random() * 0.8;
                color = [200 / 255, 169 / 255, 110 / 255];
                baseAlpha = 0.7;
                additive = 1;
                drift = 0.03 + Math.random() * 0.03;
            } else if (roll > 0.38) {
                size = 0.5 + Math.random() * 0.5;
                color = [200 / 255, 196 / 255, 230 / 255];
                baseAlpha = 0.45;
                drift = 0.02 + Math.random() * 0.025;
            } else {
                size = 0.15 + Math.random() * 0.25;
                color = [200 / 255, 196 / 255, 230 / 255];
                baseAlpha = 0.25;
                drift = 0.01 + Math.random() * 0.02;
            }
            stars.push({
                x: Math.random() * viewportWidth,
                y: Math.random() * viewportHeight,
                size,
                color,
                drift,
                baseAlpha,
                phase: Math.random() * Math.PI * 2,
                twinkle: 0.6 + Math.random() * 1.3,
                additive
            });
        }

        for (let i = 0; i < 40; i++) {
            orbiters.push({
                radiusX: 0.15 + Math.random() * 0.4,
                radiusY: 0.09 + Math.random() * 0.28,
                speed: 0.25 + Math.random() * 0.65,
                phase: Math.random() * Math.PI * 2,
                drift: -1 + Math.random() * 2
            });
        }
        scheduleNextShootingStar();
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        viewportWidth = Math.floor(window.innerWidth);
        viewportHeight = Math.floor(window.innerHeight);
        canvas.width = Math.floor(viewportWidth * dpr);
        canvas.height = Math.floor(viewportHeight * dpr);
        canvas.style.width = viewportWidth + 'px';
        canvas.style.height = viewportHeight + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
        buildScene();
    }

    function spawnShootingStar(now) {
        shootingStars.push({
            startX: -0.85 + Math.random() * 0.45,
            startY: 0.75 - Math.random() * 0.35,
            endX: -0.15 + Math.random() * 0.85,
            endY: -0.1 - Math.random() * 0.55,
            width: 0.002 + Math.random() * 0.002,
            life: 1500,
            bornAt: now
        });
    }

    function drawGlow() {
        gl.useProgram(glowProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, glowBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW
        );
        gl.enableVertexAttribArray(glowPositionLoc);
        gl.vertexAttribPointer(glowPositionLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(glowResolutionLoc, canvas.width, canvas.height);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function drawPoints(points) {
        if (!points.length) return;
        const data = new Float32Array(points.length * 7);
        let offset = 0;
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            data[offset++] = pt.x;
            data[offset++] = pt.y;
            data[offset++] = pt.size;
            data[offset++] = pt.color[0];
            data[offset++] = pt.color[1];
            data[offset++] = pt.color[2];
            data[offset++] = pt.alpha;
        }
        gl.useProgram(pointProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        const stride = 7 * 4;
        gl.enableVertexAttribArray(pointPositionLoc);
        gl.vertexAttribPointer(pointPositionLoc, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(pointSizeLoc);
        gl.vertexAttribPointer(pointSizeLoc, 1, gl.FLOAT, false, stride, 2 * 4);
        gl.enableVertexAttribArray(pointColorLoc);
        gl.vertexAttribPointer(pointColorLoc, 4, gl.FLOAT, false, stride, 3 * 4);
        gl.drawArrays(gl.POINTS, 0, points.length);
    }

    function drawLines(vertices) {
        if (!vertices.length) return;
        const data = new Float32Array(vertices.length * 6);
        let offset = 0;
        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            data[offset++] = v.x;
            data[offset++] = v.y;
            data[offset++] = v.color[0];
            data[offset++] = v.color[1];
            data[offset++] = v.color[2];
            data[offset++] = v.alpha;
        }
        gl.useProgram(lineProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        const stride = 6 * 4;
        gl.enableVertexAttribArray(linePositionLoc);
        gl.vertexAttribPointer(linePositionLoc, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(lineColorLoc);
        gl.vertexAttribPointer(lineColorLoc, 4, gl.FLOAT, false, stride, 2 * 4);
        gl.drawArrays(gl.LINES, 0, vertices.length);
    }

    function frame(now) {
        if (!viewportWidth || !viewportHeight) {
            rafId = requestAnimationFrame(frame);
            return;
        }
        if (now >= nextShootingAt) {
            spawnShootingStar(now);
            scheduleNextShootingStar(now);
        }

        sigilAngle += 0.0008 * 16.6667;
        sigilOpacity = Math.min(0.22, sigilOpacity + 0.22 / (3000 / 16.6667));

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        drawGlow();

        const coolPoints = [];
        const goldPoints = [];
        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            star.y -= star.drift;
            if (star.y < -4) star.y = viewportHeight + 4;
            const twinkle = 0.55 + Math.sin(now * 0.0012 * star.twinkle + star.phase) * 0.45;
            const alpha = Math.max(0.05, star.baseAlpha * twinkle);
            const point = {
                x: toClipX(star.x),
                y: toClipY(star.y),
                size: star.size * dpr * 2.2,
                color: star.color,
                alpha
            };
            if (star.additive) {
                goldPoints.push(point);
            } else {
                coolPoints.push(point);
            }
        }

        drawPoints(coolPoints);
        gl.blendFunc(gl.ONE, gl.ONE);
        drawPoints(goldPoints);

        const orbiterPoints = [];
        for (let i = 0; i < orbiters.length; i++) {
            const orb = orbiters[i];
            const angle = now * 0.001 * orb.speed + orb.phase;
            let x = Math.cos(angle) * orb.radiusX;
            let y = Math.sin(angle) * orb.radiusY + Math.sin(angle * 0.35 + orb.phase) * 0.03 + orb.drift * 0.00025 * now;
            if (y > 0.7) {
                orb.phase = Math.random() * Math.PI * 2;
                orb.drift = -1 + Math.random() * 2;
                y = -0.7;
            }
            orbiterPoints.push({
                x,
                y,
                size: dpr * 2.2,
                color: [200 / 255, 169 / 255, 110 / 255],
                alpha: 0.6
            });
        }
        drawPoints(orbiterPoints);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const lineVertices = [];
        const sigilColor = [122 / 255, 107 / 255, 160 / 255];
        const ringRadii = [0.55, 0.44, 0.34, 0.24, 0.14];
        for (let r = 0; r < ringRadii.length; r++) {
            const radius = ringRadii[r];
            const segments = 80;
            for (let i = 0; i < segments; i++) {
                const a0 = (i / segments) * Math.PI * 2 + sigilAngle;
                const a1 = ((i + 1) / segments) * Math.PI * 2 + sigilAngle;
                const p0 = { x: Math.cos(a0) * radius * viewportHeight / viewportWidth, y: Math.sin(a0) * radius };
                const p1 = { x: Math.cos(a1) * radius * viewportHeight / viewportWidth, y: Math.sin(a1) * radius };
                lineVertices.push({ x: p0.x, y: p0.y, color: sigilColor, alpha: sigilOpacity });
                lineVertices.push({ x: p1.x, y: p1.y, color: sigilColor, alpha: sigilOpacity });
            }
        }
        const crossLines = [
            [-0.62, -0.62, 0.62, 0.62],
            [-0.62, 0.62, 0.62, -0.62],
            [0, -0.68, 0, 0.68],
            [-0.68, 0, 0.68, 0]
        ];
        crossLines.forEach((line) => {
            const p0 = rotatePoint(line[0], line[1], sigilAngle);
            const p1 = rotatePoint(line[2], line[3], sigilAngle);
            lineVertices.push({ x: p0.x * viewportHeight / viewportWidth, y: p0.y, color: sigilColor, alpha: sigilOpacity });
            lineVertices.push({ x: p1.x * viewportHeight / viewportWidth, y: p1.y, color: sigilColor, alpha: sigilOpacity });
        });

        const boardColor = [200 / 255, 169 / 255, 110 / 255];
        const boardPulse = 0.5 + Math.sin(now * 0.0008) * 0.2;
        const boardLines = [-0.1267, 0.1267];
        boardLines.forEach((x) => {
            const start = projectPoint(x, -0.38 + Math.sin(now * 0.0011 + x * 2.5) * 0.018, 15 * Math.PI / 180);
            const end = projectPoint(x, 0.38 + Math.sin(now * 0.0011 + x * 2.5) * 0.018, 15 * Math.PI / 180);
            lineVertices.push({ x: start.x, y: start.y, color: boardColor, alpha: boardPulse });
            lineVertices.push({ x: end.x, y: end.y, color: boardColor, alpha: boardPulse });
        });
        boardLines.forEach((y) => {
            const start = projectPoint(-0.38, y + Math.sin(now * 0.0011 - y * 3.5) * 0.018, 15 * Math.PI / 180);
            const end = projectPoint(0.38, y + Math.sin(now * 0.0011 - y * 3.5) * 0.018, 15 * Math.PI / 180);
            lineVertices.push({ x: start.x, y: start.y, color: boardColor, alpha: boardPulse });
            lineVertices.push({ x: end.x, y: end.y, color: boardColor, alpha: boardPulse });
        });

        shootingStars = shootingStars.filter((shoot) => {
            const progress = (now - shoot.bornAt) / shoot.life;
            if (progress >= 1) return false;
            const alpha = progress < 0.15 ? progress / 0.15 : 1 - ((progress - 0.15) / 0.85);
            const sx = shoot.startX + (shoot.endX - shoot.startX) * progress;
            const sy = shoot.startY + (shoot.endY - shoot.startY) * progress;
            const tailX = sx - 0.18;
            const tailY = sy + 0.18;
            lineVertices.push({ x: tailX, y: tailY, color: boardColor, alpha: 0 });
            lineVertices.push({ x: sx, y: sy, color: boardColor, alpha: alpha * 0.9 });
            return true;
        });

        drawLines(lineVertices);
        rafId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!prefersReduced) {
        console.log('[Starfield] RAF started');
        scheduleNextShootingStar(performance.now());
        rafId = requestAnimationFrame(frame);
    } else {
        frame(performance.now());
    }

    const overlay = document.getElementById('pre-welcome-overlay');
    const stop = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        window.removeEventListener('resize', resize);
    };
    if (overlay && typeof MutationObserver !== 'undefined') {
        const mo = new MutationObserver(() => {
            if (overlay.classList.contains('hiding') || overlay.style.display === 'none') {
                stop();
                mo.disconnect();
            }
        });
        mo.observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
    }
} 

/* ============================================
   GUIDEBOOK POWER-UP DEMOS
   Self-contained loops. No gameState access.
   ============================================ */
(function initGuidebookPowerUpDemos() {
    const onReady = (fn) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    };

    onReady(() => {
        const setDots = (page, activeIndex) => {
            if (!page) return;
            page.querySelectorAll('.guide-demo-dots span').forEach((dot, index) => {
                dot.classList.toggle('is-active', index === activeIndex);
            });
        };

        const hintPage = document.querySelector('.guide-page[data-page="4"]');
        if (hintPage) {
            const cells = hintPage.querySelectorAll('.mini-cell');
            const status = hintPage.querySelector('[data-status]');
            const hintTexts = [
                'Scanning the board for the best line...',
                'Best move found in the center node.',
                'Hint Pulse is active. Take the center.'
            ];
            let phase = 0;

            const runHintPhase = () => {
                cells.forEach((cell) => cell.classList.remove('hint-pulse'));
                if (phase >= 1 && cells[4]) {
                    cells[4].classList.add('hint-pulse');
                }
                if (status) status.textContent = hintTexts[phase];
                setDots(hintPage, phase);
                phase = (phase + 1) % 3;
            };

            runHintPhase();
            window.setInterval(runHintPhase, 1800);
        }

        const shakePage = document.querySelector('.guide-page[data-page="5"]');
        if (shakePage) {
            const board = shakePage.querySelector('[data-demo="board-shake"]');
            const status = shakePage.querySelector('[data-status]');
            const cells = Array.from(shakePage.querySelectorAll('.mini-cell'));
            const baseMarks = ['✕', '◯', '', '', '✕', '', '◯', '', '✕'];
            let dotPhase = 0;

            const applyPermutation = () => {
                const nextMarks = baseMarks.slice();
                for (let i = nextMarks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [nextMarks[i], nextMarks[j]] = [nextMarks[j], nextMarks[i]];
                }
                cells.forEach((cell, index) => {
                    cell.textContent = nextMarks[index];
                    cell.classList.remove('remap-pop');
                    if (nextMarks[index]) {
                        void cell.offsetWidth;
                        cell.classList.add('remap-pop');
                    }
                });
            };

            const triggerBoardShake = () => {
                if (!board) return;
                status.textContent = 'Board Shake triggers. The grid is losing its anchor.';
                setDots(shakePage, dotPhase % 3);
                dotPhase += 1;
                board.classList.remove('board-shake');
                void board.offsetWidth;
                board.classList.add('board-shake');

                window.setTimeout(() => {
                    applyPermutation();
                    status.textContent = 'Cells remapped. The marks remain, but their meaning has shifted.';
                    setDots(shakePage, 2);
                }, 450);

                window.setTimeout(() => {
                    status.textContent = 'Board rests before the next remap.';
                    setDots(shakePage, 0);
                }, 1850);
            };

            triggerBoardShake();
            window.setInterval(triggerBoardShake, 3200);
        }

        const lastStandPage = document.querySelector('.guide-page[data-page="6"]');
        if (lastStandPage) {
            const board = lastStandPage.querySelector('[data-demo="last-stand"]');
            const cells = lastStandPage.querySelectorAll('.mini-cell');
            const status = lastStandPage.querySelector('[data-status]');
            const texts = [
                'Watching for a lethal AI turn...',
                'Threat detected. The AI is about to claim the top row.',
                'Last Stand triggers and floods the board with gold.',
                'An extra move is granted. The line is interrupted.'
            ];
            let phase = 0;

            const runLastStandPhase = () => {
                const threatCell = cells[2];
                if (!threatCell) return;
                threatCell.classList.remove('is-threat', 'is-saved');
                threatCell.textContent = '';
                if (board) board.classList.remove('last-stand');

                if (phase === 1) {
                    threatCell.classList.add('is-threat');
                }
                if (phase === 2) {
                    threatCell.classList.add('is-saved');
                    if (board) {
                        void board.offsetWidth;
                        board.classList.add('last-stand');
                    }
                }
                if (phase === 3) {
                    threatCell.classList.add('is-saved');
                    threatCell.textContent = '✕';
                }

                if (status) status.textContent = texts[phase];
                setDots(lastStandPage, phase);
                phase = (phase + 1) % 4;
            };

            runLastStandPhase();
            window.setInterval(runLastStandPhase, 2200);
        }

        const tacticalPage = document.querySelector('.guide-page[data-page="7"]');
        if (tacticalPage) {
            const overlay = tacticalPage.querySelector('.tactical-claim-overlay');
            const status = tacticalPage.querySelector('[data-status]');
            let phase = 0;
            const statuses = [
                'The AI is waiting to answer your advantage.',
                'Tactical Claim ignites a steel grid across the board.',
                'The wave fades, but the warning remains.'
            ];

            const fireTacticalWave = () => {
                if (!overlay) return;
                status.textContent = statuses[phase % statuses.length];
                setDots(tacticalPage, phase % 3);
                phase += 1;
                overlay.classList.remove('is-active');
                void overlay.offsetWidth;
                overlay.classList.add('is-active');

                window.setTimeout(() => {
                    status.textContent = statuses[2];
                    setDots(tacticalPage, 2);
                }, 1200);
            };

            fireTacticalWave();
            window.setInterval(fireTacticalWave, 2800);
        }
    });
})();

function initRitualWelcomeStarfield() {
    const canvas = document.getElementById('ritual-stars-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const prefersReduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let stars = [];

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = 220;
        stars = Array.from({ length: count }, () => {
            const roll = Math.random();
            return {
                x: Math.random() * w,
                y: Math.random() * h,
                r: roll > 0.94 ? 1.1 + Math.random() * 0.8 : roll > 0.4 ? 0.5 + Math.random() * 0.4 : 0.15 + Math.random() * 0.25,
                v: 0.015 + Math.random() * 0.05,
                phase: Math.random() * Math.PI * 2,
                color: roll > 0.94 ? '200,169,110' : '200,196,230',
                baseAlpha: roll > 0.94 ? 0.52 : roll > 0.4 ? 0.36 : 0.22
            };
        });
    }

    function frame(now) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) {
            rafId = requestAnimationFrame(frame);
            return;
        }
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            star.y -= star.v;
            if (star.y < -2) star.y = h + 2;
            const alpha = star.baseAlpha * (0.7 + Math.sin(now * 0.0012 + star.phase) * 0.3);
            ctx.fillStyle = `rgba(${star.color}, ${Math.max(0.08, alpha)})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            ctx.fill();
        }
        rafId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!prefersReduced) {
        rafId = requestAnimationFrame(frame);
    } else {
        frame(performance.now());
    }
}

function runCinematicScreenTransition(fromEl, toEl, options = {}) {
    const { removeFromDom = false, hideWithDisplayNone = false } = options;
    const phaseOneMs = 300;
    const phaseHoldMs = 150;
    const phaseThreeMs = 500;

    if (fromEl) {
        fromEl.classList.remove('screen-transition-enter', 'screen-transition-fade-in');
        fromEl.classList.add('screen-transition-fade-out');
    }

    window.setTimeout(() => {
        if (fromEl) {
            fromEl.classList.remove('screen-transition-fade-out', 'active');
            if (hideWithDisplayNone) {
                fromEl.style.display = 'none';
                fromEl.style.visibility = 'hidden';
                fromEl.style.pointerEvents = 'none';
                fromEl.classList.add('hiding');
            } else if (removeFromDom) {
                if (fromEl.parentNode) fromEl.parentNode.removeChild(fromEl);
            } else {
                fromEl.style.display = '';
            }
        }
    }, phaseOneMs);

    if (!toEl) return;

    toEl.classList.remove('hidden');
    toEl.classList.add('screen-transition-enter');
    if (toEl.classList.contains('screen')) {
        toEl.classList.add('active');
        toEl.style.display = toEl.id === 'welcome-screen' ? 'flex' : 'block';
    } else {
        toEl.style.display = 'flex';
    }
    toEl.style.visibility = 'visible';
    toEl.style.pointerEvents = 'auto';

    window.setTimeout(() => {
        toEl.classList.add('screen-transition-fade-in');
        toEl.classList.remove('screen-transition-enter');
        window.setTimeout(() => {
            toEl.classList.remove('screen-transition-fade-in');
            toEl.style.opacity = '';
            toEl.style.transform = '';
            toEl.style.background = '';
            toEl.style.transition = '';
        }, phaseThreeMs);
    }, phaseOneMs + phaseHoldMs);
}

// Welcome / intro UI
document.addEventListener('DOMContentLoaded', () => {
    // Get welcome flow elements
    preWelcomeOverlay = document.getElementById('pre-welcome-overlay');
    continueWelcomeBtn = document.getElementById('continue-welcome-btn');
    aiPresenceGameplay = document.getElementById('ai-presence-gameplay');
    
    // Initialize pre-welcome overlay (skipped when React hero already bridged name + mode)
    if (preWelcomeOverlay) {
        setTimeout(() => {
            if (welcomeFlowState.skipVoidBootstrapFromSpaGate) return;
            if (preWelcomeOverlay) {
                preWelcomeOverlay.style.display = 'flex';
                initVoidStarfield();
                initRitualWelcomeStarfield();
            }
        }, 100);
    }

    // Continue button - Flow: Intro → Welcome (name/camera)
    let buttonTransitioned = false;
    
    const handleContinueClick = (e) => {
        try {
            if (preWelcomeAutoTimer) {
                clearTimeout(preWelcomeAutoTimer);
                preWelcomeAutoTimer = null;
            }
            // Prevent multiple transitions
            if (buttonTransitioned) {
                console.log('[Continue] Already transitioned, ignoring click');
                return;
            }
            
            console.log('[Continue] === BUTTON CLICKED - Showing Welcome Screen ===');
            
            // Mark as transitioned immediately to prevent double-clicks
            buttonTransitioned = true;
            
            const overlay = document.getElementById('pre-welcome-overlay');
            const welcomeScreen = document.getElementById('welcome-screen');
            if (overlay && welcomeScreen) {
                runCinematicScreenTransition(overlay, welcomeScreen, { hideWithDisplayNone: true });
                console.log('[Continue] Pre-welcome overlay hidden');
                console.log('[Continue] Welcome screen shown');
            } else if (welcomeScreen) {
                welcomeScreen.classList.add('active');
                welcomeScreen.style.display = 'block';
            } else {
                console.error('[Continue] Welcome screen not found!');
            }

            // Show AI presence during gameplay (decorative)
            if (aiPresenceGameplay) {
                setTimeout(() => {
                    aiPresenceGameplay.classList.remove('hidden');
                    aiPresenceGameplay.classList.add('active');
                }, 500);
            }
            
            // Re-enable inputs
            if (typeof gameState !== 'undefined' && gameState) {
                gameState.uiLocked = false;
                gameState.uiLockingReason = null;
            }
            
        } catch (error) {
            console.error('[Continue] Error in handleContinueClick:', error);
            // Fallback: try to show welcome screen
            const overlay = document.getElementById('pre-welcome-overlay');
            if (overlay) overlay.style.display = 'none';
            
            const welcomeScreen = document.getElementById('welcome-screen');
            if (welcomeScreen) {
                welcomeScreen.classList.add('active');
                welcomeScreen.style.display = 'block';
            }
        }
    };

    /* Cinematic intro: auto-advance timer removed per user request
    preWelcomeAutoTimer = setTimeout(() => {
        const overlay = document.getElementById('pre-welcome-overlay');
        if (!overlay || overlay.classList.contains('hiding')) return;
        if (overlay.style.display === 'none' || overlay.style.visibility === 'hidden') return;
        handleContinueClick({ preventDefault: () => {} });
    }, 6500);
    */
    
    // Setup button with multiple attempts and error handling
    const setupContinueButton = () => {
        try {
            const btn = document.getElementById('continue-welcome-btn');
            if (!btn) {
                return false;
            }
            
            console.log('[Continue] Button found, setting up handlers');
            
            // Make button immediately clickable (keep CSS stagger opacity on void intro skip)
            if (!btn.classList.contains('void-skip-btn')) {
                btn.style.opacity = '1';
            }
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
    
    // Removed power-up guide setup


    // Add 3D tilt effect to mode cards
    const modeCards = document.querySelectorAll('.mode-btn');
    modeCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            // 3D Tilt: Subtle rotation based on mouse position
            card.style.transform = `perspective(600px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.transition = 'transform 0.4s ease';
        });
    });

    // Initialize 3D Interactive Mode Board
    initMode3DCanvas();

    wirePowerUpSidebarActivations();
    initPowerupOrbitPicker();
});

/**
 * 3D Interactive Tic Tac Toe Board for Mode Selection
 * Vanilla JS 3D perspective rendering with mouse tilt & particles
 */
function initMode3DCanvas() {
    const canvas = document.getElementById('ttt-3d-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.closest('.mode-container');
    if (!container) return;
    
    let width, height;
    let mouseX = 0, mouseY = 0;
    let targetRotX = 22 * (Math.PI / 180);
    let targetRotY = 8 * (Math.PI / 180);
    let currentRotX = targetRotX;
    let currentRotY = targetRotY;
    let lastMouseMove = Date.now();
    let isMouseOver = false;

    // Particles floating upward
    const particles = [];
    for(let i=0; i<18; i++) {
        particles.push({
            x: Math.random() * 260 - 130,
            y: Math.random() * 100,
            z: Math.random() * 260 - 130,
            s: 0.3 + Math.random() * 0.5,
            c: i % 2 === 0 ? '#C8A96E' : '#86A8C7',
            r: 0.8 + Math.random() * 1.5,
            o: Math.random()
        });
    }

    // Static ghost game state
    const ghostState = [
        {idx: 4, mark: 'X'}, // Center
        {idx: 0, mark: 'X'}, // Top-left
        {idx: 2, mark: 'O'}, // Top-right
        {idx: 6, mark: 'O'}, // Bottom-left
        {idx: 8, mark: 'X'}  // Bottom-right
    ];

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
    }

    window.addEventListener('resize', resize);
    resize();

    // Mouse tracking for tilt
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width - 0.5;
        mouseY = (e.clientY - rect.top) / rect.height - 0.5;
        
        // Map mouse position to rotation targets
        targetRotY = mouseX * 30 * (Math.PI / 180);
        targetRotX = (22 + mouseY * 20) * (Math.PI / 180);
        
        lastMouseMove = Date.now();
        isMouseOver = true;
    });

    container.addEventListener('mouseleave', () => {
        targetRotX = 22 * (Math.PI / 180);
        targetRotY = 8 * (Math.PI / 180);
        isMouseOver = false;
    });

    // Simple 3D projection function
    function project(x, y, z) {
        // Rotation around Y
        let nx = x * Math.cos(currentRotY) - z * Math.sin(currentRotY);
        let nz = x * Math.sin(currentRotY) + z * Math.cos(currentRotY);
        
        // Rotation around X
        let ny = y * Math.cos(currentRotX) - nz * Math.sin(currentRotX);
        let fz = y * Math.sin(currentRotX) + nz * Math.cos(currentRotX);
        
        const perspective = 500;
        const scale = perspective / (perspective + fz + 250);
        
        return {
            x: nx * scale + width / 2,
            y: ny * scale + height / 2 + 15,
            s: scale,
            depth: fz
        };
    }

    function draw() {
        // Skip rendering if hidden to save resources
        const overlay = document.getElementById('mode-select');
        if (!overlay || overlay.classList.contains('hidden')) {
            requestAnimationFrame(draw);
            return;
        }

        ctx.clearRect(0, 0, width, height);

        // Auto-rotation logic (turntable)
        if (!isMouseOver && Date.now() - lastMouseMove > 2000) {
            targetRotY += 0.005;
        }

        // Smooth Lerping
        currentRotX += (targetRotX - currentRotX) * 0.06;
        currentRotY += (targetRotY - currentRotY) * 0.06;

        const size = 130;
        const cellSize = size / 3;

        // 1. Draw back-depth particles
        particles.forEach(p => { if (p.z < 0) drawParticle(p); });

        // 2. Draw 3D Grid
        ctx.strokeStyle = 'rgba(200, 169, 110, 0.6)';
        ctx.lineWidth = 1.5;

        // Draw cells and highlight
        let closestCell = -1;
        let minD = 45;
        const mx = (mouseX + 0.5) * width;
        const my = (mouseY + 0.5) * height;

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const cx = -size/2 + (c + 0.5) * cellSize;
                const cz = -size/2 + (r + 0.5) * cellSize;
                const p = project(cx, 0, cz);
                
                // Track closest cell for hover effect
                const d = Math.sqrt((p.x - mx)**2 + (p.y - (my - 20))**2);
                if (d < minD) { minD = d; closestCell = r * 3 + c; }
                
                // Draw cell base
                ctx.fillStyle = 'rgba(10, 12, 24, 0.4)';
                ctx.beginPath();
                const tl = project(cx - cellSize/2, 0, cz - cellSize/2);
                const tr = project(cx + cellSize/2, 0, cz - cellSize/2);
                const br = project(cx + cellSize/2, 0, cz + cellSize/2);
                const bl = project(cx - cellSize/2, 0, cz + cellSize/2);
                ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
                ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
                ctx.fill();
            }
        }

        // Pulse highlight for hovered cell
        if (closestCell !== -1 && isMouseOver) {
            const r = Math.floor(closestCell / 3);
            const c = closestCell % 3;
            const cx = -size/2 + (c + 0.5) * cellSize;
            const cz = -size/2 + (r + 0.5) * cellSize;
            const p = project(cx, 0, cz);
            
            ctx.fillStyle = `rgba(200, 169, 110, ${0.1 + Math.sin(Date.now()/200)*0.05})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 28 * p.s, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Grid Lines
        for (let i = 0; i <= 3; i++) {
            // Horizontal
            ctx.beginPath();
            let a = project(-size/2, 0, -size/2 + i * cellSize);
            let b = project(size/2, 0, -size/2 + i * cellSize);
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Vertical
            ctx.beginPath();
            a = project(-size/2 + i * cellSize, 0, -size/2);
            b = project(-size/2 + i * cellSize, 0, size/2);
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        // 3. Draw Marks
        ghostState.forEach(s => {
            const r = Math.floor(s.idx / 3);
            const c = s.idx % 3;
            const cx = -size/2 + (c + 0.5) * cellSize;
            const cz = -size/2 + (r + 0.5) * cellSize;
            const p = project(cx, -2, cz); // Slightly above grid

            ctx.lineWidth = 2.5 * p.s;
            if (s.mark === 'X') {
                ctx.strokeStyle = '#C8A96E';
                const off = 10 * p.s;
                ctx.beginPath();
                ctx.moveTo(p.x - off, p.y - off); ctx.lineTo(p.x + off, p.y + off);
                ctx.moveTo(p.x + off, p.y - off); ctx.lineTo(p.x - off, p.y + off);
                ctx.stroke();
            } else {
                ctx.strokeStyle = '#86A8C7';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10 * p.s, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        // 4. Draw front-depth particles
        particles.forEach(p => { if (p.z >= 0) drawParticle(p); });

        requestAnimationFrame(draw);
    }

    function drawParticle(p) {
        p.y -= p.s; // Float up
        if (p.y < -80) { p.y = 80; p.x = Math.random() * 260 - 130; p.z = Math.random() * 260 - 130; }
        
        const proj = project(p.x, p.y, p.z);
        const alpha = Math.min(1, Math.max(0, 1 - Math.abs(p.y)/80));
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, p.r * proj.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    draw();
}
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

const gameState = {
    gameActive: false,
    board: Array(9).fill(''),
    playerName: '',
    wins: 0,
    losses: 0,
    playerGoesFirst: true,
    uiLocked: false,
    uiLockingReason: null,
    inTsukuyomi: false,
    inInteractiveMode: false,
    aiTurnInProgress: false,
    aiMoveInProgress: false,
    mode: 'ai',
    cameraEnabled: false,
    cameraStream: null,
    boardInitialized: false,
    roundCount: 0,
    firstRoundOfSession: true,
    playerWinningPatterns: [],
    aiFailSafeTimer: null,
    currentLevel: 1,
    level1: {
      playerWins: 0,
      aiWins: 0,
      gamesPlayed: 0,
      totalGames: 5,
      complete: false,
      history: []
    },
    hintPulseCharges: 2,
    boardShakeCharges: 1,
    lastStandCharges: 1,
    lastStandPending: false,
    lastStandUsed: false,
    lastStandScheduledForPlay: null
};

/**
 * Angelic AI Level 1 - Beatable but adaptive intelligence.
 * Evolves across 5 games with three distinct phases.
 */
const AngelicAI_Level1 = {
    memory: [], // Stores { opening: '0,4', thirdMove: 8 }

    getBestMove(board, gamesPlayed) {
        const phase = this.getPhase(gamesPlayed);
        console.log(`[Level 1 AI] Game ${gamesPlayed + 1}, Phase ${phase} active`);

        // Phase 1 (Games 1-2): Cold
        if (phase === 1) {
            return this.phase1Move(board);
        }
        // Phase 2 (Games 3-4): Aware
        if (phase === 2) {
            return this.phase2Move(board);
        }
        // Phase 3 (Game 5): Adaptive
        if (phase === 3) {
            return this.phase3Move(board);
        }
        return this.phase1Move(board);
    },

    getPhase(gamesPlayed) {
        if (gamesPlayed < 2) return 1;
        if (gamesPlayed < 4) return 2;
        return 3;
    },

    phase1Move(board) {
        // 1. Immediate win
        let move = this.findWinningMove(board, 'O');
        if (move !== null) return move;

        // 2. Immediate block
        move = this.findWinningMove(board, 'X');
        if (move !== null) return move;

        // 3. Center -> corners -> sides
        return this.basicPriorityMove(board);
    },

    phase2Move(board) {
        // 1. Win/Block
        let move = this.findWinningMove(board, 'O');
        if (move !== null) return move;
        move = this.findWinningMove(board, 'X');
        if (move !== null) return move;

        // 2. Opening memory pre-emption
        const playerMoves = gameState.playerMoveHistory || [];
        if (playerMoves.length === 2) {
            const pattern = playerMoves.join(',');
            const predicted = this.memory.find(p => p.opening === pattern);
            if (predicted && board[predicted.thirdMove] === '') {
                console.log(`[Level 1 AI] Pre-empting known opening: ${pattern}`);
                return predicted.thirdMove;
            }
        }

        // 3. Fork creation
        move = this.findForkMove(board, 'O');
        if (move !== null) return move;

        return this.basicPriorityMove(board);
    },

    phase3Move(board) {
        // 1. Win/Block
        let move = this.findWinningMove(board, 'O');
        if (move !== null) return move;
        move = this.findWinningMove(board, 'X');
        if (move !== null) return move;

        // 2. Memory pre-emption
        const playerMoves = gameState.playerMoveHistory || [];
        if (playerMoves.length === 2) {
            const pattern = playerMoves.join(',');
            const predicted = this.memory.find(p => p.opening === pattern);
            if (predicted && board[predicted.thirdMove] === '') {
                return predicted.thirdMove;
            }
        }

        // 3. Fork
        move = this.findForkMove(board, 'O');
        if (move !== null) return move;

        // 4. Minimax depth 4
        return this.minimax(board, 0, true, 4).index;
    },

    findWinningMove(board, mark) {
        const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (let p of winPatterns) {
            const [a, b, c] = p;
            if (board[a] === mark && board[b] === mark && board[c] === '') return c;
            if (board[a] === mark && board[c] === mark && board[b] === '') return b;
            if (board[b] === mark && board[c] === mark && board[a] === '') return a;
        }
        return null;
    },

    findForkMove(board, mark) {
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                const temp = [...board];
                temp[i] = mark;
                let threats = 0;
                const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
                for (let p of winPatterns) {
                    const [a, b, c] = p;
                    if (temp[a] === mark && temp[b] === mark && temp[c] === '') threats++;
                    else if (temp[a] === mark && temp[c] === mark && temp[b] === '') threats++;
                    else if (temp[b] === mark && temp[c] === mark && temp[a] === '') threats++;
                }
                if (threats >= 2) return i;
            }
        }
        return null;
    },

    basicPriorityMove(board) {
        if (board[4] === '') return 4;
        const corners = [0, 2, 6, 8].filter(i => board[i] === '');
        if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
        const sides = [1, 3, 5, 7].filter(i => board[i] === '');
        if (sides.length > 0) return sides[Math.floor(Math.random() * sides.length)];
        const available = board.map((c, i) => c === '' ? i : null).filter(i => i !== null);
        return available[Math.floor(Math.random() * available.length)];
    },

    minimax(board, depth, isMaximizing, maxDepth) {
        const winner = this.checkWinner(board);
        if (winner === 'O') return { score: 10 - depth };
        if (winner === 'X') return { score: depth - 10 };
        if (board.every(c => c !== '') || depth === maxDepth) return { score: 0 };

        if (isMaximizing) {
            let best = -Infinity;
            let move = null;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = 'O';
                    let score = this.minimax(board, depth + 1, false, maxDepth).score;
                    board[i] = '';
                    if (score > best) { best = score; move = i; }
                }
            }
            return { score: best, index: move };
        } else {
            let best = Infinity;
            let move = null;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = 'X';
                    let score = this.minimax(board, depth + 1, true, maxDepth).score;
                    board[i] = '';
                    if (score < best) { best = score; move = i; }
                }
            }
            return { score: best, index: move };
        }
    },

    checkWinner(board) {
        const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (let p of winPatterns) {
            const [a, b, c] = p;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
        }
        return null;
    },

    recordOpening(moves) {
        if (moves && moves.length >= 3) {
            const opening = moves.slice(0, 2).join(',');
            const thirdMove = moves[2];
            if (!this.memory.some(p => p.opening === opening)) {
                this.memory.push({ opening, thirdMove });
                console.log(`[Level 1 AI] Learned opening: ${opening} -> ${thirdMove}`);
            }
        }
    }
};

/**
 * Inject Level 1 UI Styles
 */
(function injectLevel1Styles() {
    const style = document.createElement('style');
    style.id = 'level1-styles';
    style.innerHTML = `
        .level1-progress {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            justify-content: center;
            align-items: center;
        }
        .progress-slot {
            width: 14px;
            height: 14px;
            border: 1px solid rgba(200, 169, 110, 0.3);
            transform: rotate(45deg);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }
        .progress-slot.current {
            border-color: var(--champagne);
            box-shadow: 0 0 10px var(--champagne);
            animation: diamond-pulse 1.5s infinite ease-in-out;
        }
        @keyframes diamond-pulse {
            0%, 100% { opacity: 0.6; transform: rotate(45deg) scale(1); }
            50% { opacity: 1; transform: rotate(45deg) scale(1.2); }
        }
        .progress-slot.player-win {
            background: var(--champagne);
            border-color: var(--champagne);
            box-shadow: 0 0 15px var(--champagne);
        }
        .progress-slot.ai-win {
            background: var(--steel);
            border-color: var(--steel);
            box-shadow: 0 0 15px var(--steel);
        }
        .progress-slot.draw {
            border-color: rgba(255, 255, 255, 0.4);
            background: rgba(255, 255, 255, 0.1);
        }

        .level-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 5, 10, 0.85);
            backdrop-filter: blur(12px);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.8s ease;
            color: white;
            text-align: center;
            padding: 20px;
        }
        .level-overlay.active { opacity: 1; }
        
        .level-overlay h2 {
            font-family: 'Cinzel', serif;
            font-size: 3.5rem;
            margin-bottom: 0.5rem;
            letter-spacing: 0.2rem;
        }
        .level-overlay.complete h2 { color: var(--champagne); text-shadow: 0 0 20px rgba(200, 169, 110, 0.4); }
        .level-overlay.failed h2 { color: #ff3333; text-shadow: 0 0 20px rgba(255, 51, 51, 0.4); }
        
        .level-overlay .subtext {
            font-family: 'Cormorant Garamond', serif;
            font-style: italic;
            font-size: 1.4rem;
            opacity: 0.8;
            margin-bottom: 2.5rem;
        }
        
        .level-score {
            font-family: 'DM Mono', monospace;
            font-size: 2.5rem;
            margin-bottom: 3rem;
            display: flex;
            gap: 20px;
            align-items: center;
        }
        .score-val { color: var(--champagne); }
        .score-val.ai { color: var(--steel); }
        .score-divider { opacity: 0.3; }

        .overlay-buttons {
            display: flex;
            gap: 20px;
        }
        .overlay-btn {
            padding: 12px 30px;
            font-family: 'Cinzel', serif;
            font-size: 1rem;
            cursor: pointer;
            border: 1px solid;
            background: transparent;
            transition: all 0.3s ease;
            letter-spacing: 1px;
        }
        .btn-gold { border-color: var(--champagne); color: var(--champagne); }
        .btn-gold:hover:not(:disabled) { background: var(--champagne); color: black; }
        .btn-gold:disabled { border-color: #555; color: #555; cursor: not-allowed; }
        
        .btn-steel { border-color: var(--steel); color: var(--steel); }
        .btn-steel:hover { background: var(--steel); color: white; }

        .taunt-line {
            margin-top: 2rem;
            font-size: 0.9rem;
            opacity: 0.6;
            font-family: 'Cormorant Garamond', serif;
        }

        .sigil-bg {
            position: absolute;
            width: 500px;
            height: 500px;
            opacity: 0.05;
            z-index: -1;
            pointer-events: none;
            animation: rotate-sigil 60s linear infinite;
        }
        @keyframes rotate-sigil {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
})();


/**
 * Finalizes the current round and starts the next one.
 * Transitions to next round automatically after first game.
 */
function finalizeRoundAndStartNext() {
    try {
        if (gameState.level1 && gameState.level1.gamesPlayed >= gameState.level1.totalGames) {
            return; // Series over — overlay is handling it
        }
        console.log('[Round Transition] Finalizing round and starting next...');
        gameState.roundCount = (gameState.roundCount || 0) + 1;
        
        // Trigger the reset button click logic to re-initialize the game
        if (resetBtn) {
            resetBtn.click();
        } else {
            // Fallback if button missing
            gameState.board = Array(9).fill('');
            gameState.gameActive = true;
            cells.forEach(cell => {
                cell.textContent = '';
                cell.setAttribute('data-mark', '');
            });
            emitBoardUpdate();
        }
    } catch (e) {
        console.error('[Round Transition] Error in finalizeRoundAndStartNext:', e);
    }
}

/**
 * Power-Up Manager System
 * Front-end only - visual effects, no AI logic changes
 */
/* (Removed PowerUpManager) */

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
let bgMusicRetryArmed = false;
let bgMusicStartRequested = false;

function armBgMusicGestureRetry() {
    if (bgMusicRetryArmed) return;
    bgMusicRetryArmed = true;
    const handler = () => {
        bgMusicRetryArmed = false;
        tryStartBackgroundMusic('gesture-retry');
    };
    document.addEventListener('pointerdown', handler, { once: true, passive: true });
    document.addEventListener('touchend', handler, { once: true, passive: true });
}

function tryStartBackgroundMusic(source = 'unknown') {
    if (!bgMusic) return;
    // Ensure volume is set once before attempting playback.
    if (!bgMusicStartRequested) {
        bgMusic.volume = 0.3;
        bgMusicStartRequested = true;
    }
    try {
        const playPromise = bgMusic.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch((e) => {
                console.log(`Could not play background music (${source}):`, e);
                armBgMusicGestureRetry();
            });
        }
    } catch (e) {
        console.log(`Could not play background music (${source}):`, e);
        armBgMusicGestureRetry();
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
        
        if (cameraPreview) cameraPreview.style.display = 'block';
        if (enableCameraBtn) {
            enableCameraBtn.textContent = 'Camera Enabled';
            enableCameraBtn.disabled = true;
            enableCameraBtn.style.background = '#4CAF50';
        }
        if (cameraStatus) {
            cameraStatus.innerHTML =
                '<span class="camera-icon">📹</span><span class="camera-text">Camera access granted - Anti-cheat active</span>';
        }

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
        
        cameraInitializationInProgress = false;
        return true;
    } catch (error) {
        console.error('Camera access denied:', error);
        if (cameraStatus) {
            cameraStatus.innerHTML =
                '<span class="camera-icon">❌</span><span class="camera-text">Camera access denied - Required to prevent cheating</span>';
        }
        if (enableCameraBtn) enableCameraBtn.textContent = 'Retry Camera Access';
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
    const nameFilled = playerNameInput && playerNameInput.value.trim();
    if (!startBtn) return;
    startBtn.textContent = 'Enter In Peace';
    startBtn.disabled = !nameFilled;
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

// Camera event listeners (welcome camera UI may be hidden — keep listener optional)
if (enableCameraBtn) {
    enableCameraBtn.addEventListener('click', requestCameraAccess);
}

// Initialize button state on page load
updateStartButtonState();

// Monitor camera status during gameplay
function monitorCameraStatus() {
    if (gameState.cameraStream) {
        const tracks = gameState.cameraStream.getTracks();
        const activeTracks = tracks.filter(track => track.readyState === 'live');
        
        if (activeTracks.length === 0) {
            if (gameCameraStatus) {
                gameCameraStatus.textContent = 'Camera Disconnected';
                gameCameraStatus.style.color = '#ff4444';
            }
            gameState.cameraEnabled = false;
            
            // Notify admin of camera disconnection
            try { 
                if (socket) socket.emit('camera-status', { 
                    name: gameState.playerName, 
                    connected: false 
                }); 
            } catch(_) {}
            
            // Could add additional logic here to pause game or show warning
        } else if (gameCameraStatus) {
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
function showLobbyScreen(skipGuidebookCheck) {
    if (
        !skipGuidebookCheck &&
        typeof window.openGuidebookCinematic === 'function' &&
        !sessionStorage.getItem('angelic_guidebook_seen')
    ) {
        window.openGuidebookCinematic(function guidebookDoneLobby() {
            try {
                sessionStorage.setItem('angelic_guidebook_seen', '1');
            } catch (_) {}
            showLobbyScreen(true);
        });
        return;
    }

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
            refreshPowerUpChargeLabels();

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
            currentLevel: 1,
            level1Wins: gameState.wins || 0,
            roundCount: gameState.roundCount || 0,
            theme: 'luxury',
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

function showActivationBanner(text, icon) {
    const banner = document.getElementById('activation-banner');
    if (!banner) return;
    const iconEl = banner.querySelector('.activation-banner__icon');
    const textEl = banner.querySelector('.activation-banner__text');
    if (iconEl && icon) iconEl.textContent = icon;
    if (textEl) textEl.textContent = text;
    banner.classList.remove('is-visible');
    void banner.offsetWidth;
    banner.classList.add('is-visible');
}

function refreshPowerUpChargeLabels() {
    const sidebar = document.getElementById('powerup-sidebar');
    if (!sidebar) return;
    const hintCard = sidebar.querySelector('[data-powerup="hint-pulse"]');
    const shakeCard = sidebar.querySelector('[data-powerup="board-shake"]');
    const standCard = sidebar.querySelector('[data-powerup="last-stand"]');
    if (hintCard) {
        const el = hintCard.querySelector('.pu-charge');
        if (el) el.textContent = `${gameState.hintPulseCharges} Charges`;
        const btn = hintCard.querySelector('.pu-btn');
        if (btn) btn.disabled = gameState.hintPulseCharges <= 0 || !gameState.gameActive;
    }
    if (shakeCard) {
        const el = shakeCard.querySelector('.pu-charge');
        if (el) el.textContent = `${gameState.boardShakeCharges} Charge · Level 1`;
        const btn = shakeCard.querySelector('.pu-btn');
        if (btn) btn.disabled = gameState.boardShakeCharges <= 0 || !gameState.gameActive;
    }
    if (standCard) {
        const el = standCard.querySelector('.pu-charge');
        if (el) el.textContent = `${gameState.lastStandCharges} Charge · Level 1`;
        const btn = standCard.querySelector('.pu-btn');
        if (btn) btn.disabled = gameState.lastStandCharges <= 0 || !gameState.gameActive;
    }
    document.querySelectorAll('.bb-card[data-powerup="hint-pulse"] .bb-charge').forEach((n) => {
        n.textContent = String(Math.max(0, gameState.hintPulseCharges));
    });
    document.querySelectorAll('.bb-card[data-powerup="board-shake"] .bb-charge').forEach((n) => {
        n.textContent = String(Math.max(0, gameState.boardShakeCharges));
    });
    document.querySelectorAll('.bb-card[data-powerup="last-stand"] .bb-charge').forEach((n) => {
        n.textContent = String(Math.max(0, gameState.lastStandCharges));
    });
}

function pickHintCellForHuman() {
    const board = gameState.board;
    const mark =
        gameState.mode === 'pvp' && gameState.pvpRole
            ? gameState.pvpRole
            : 'X';
    const opp = mark === 'X' ? 'O' : 'X';
    let move = AngelicAI_Level1.findWinningMove(board, mark);
    if (move !== null) return move;
    move = AngelicAI_Level1.findWinningMove(board, opp);
    if (move !== null) return move;
    return AngelicAI_Level1.basicPriorityMove(board);
}

function activateHintPulseFromUi() {
    if (!gameState.gameActive || gameState.hintPulseCharges <= 0) return;
    gameState.hintPulseCharges--;
    refreshPowerUpChargeLabels();
    cells.forEach((cell) => cell.classList.remove('hint-pulse'));
    let idx = null;
    try {
        idx = pickHintCellForHuman();
    } catch (_) {
        idx = null;
    }
    if (idx === null || idx === undefined || gameState.board[idx] !== '') {
        const empty = gameState.board.findIndex((v) => v === '');
        idx = empty === -1 ? null : empty;
    }
    if (idx !== null && idx !== undefined && cells[idx]) {
        cells[idx].classList.add('hint-pulse');
    }
    showActivationBanner('Hint Pulse — strongest line glows gold', '💡');
    if (messageBox) {
        messageBox.textContent = 'Hint Pulse: follow the golden cell.';
    }
}

function activateBoardShakeFromUi() {
    if (!gameState.gameActive || gameState.boardShakeCharges <= 0) return;
    gameState.boardShakeCharges--;
    refreshPowerUpChargeLabels();
    shuffleBoardContents();
    const boardEl = document.querySelector('.game-board');
    if (boardEl) {
        boardEl.classList.remove('shake-board');
        void boardEl.offsetWidth;
        boardEl.classList.add('shake-board');
        window.setTimeout(() => boardEl.classList.remove('shake-board'), 550);
    }
    showActivationBanner('Board Shake — the grid remaps', '🌊');
    if (messageBox) {
        messageBox.textContent = 'Board Shake: positions remapped; marks kept.';
    }
}

function activateLastStandFromUi() {
    if (!gameState.gameActive || gameState.lastStandCharges <= 0) return;
    gameState.lastStandCharges--;
    gameState.lastStandPending = true;
    refreshPowerUpChargeLabels();
    showActivationBanner('Last Stand armed — one reprieve if the AI finishes you', '⚡');
    if (messageBox) {
        messageBox.textContent = 'Last Stand: if the AI wins this exchange, you get one reprieve.';
    }
}

function wirePowerUpSidebarActivations() {
    const sidebar = document.getElementById('powerup-sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('.pu-card[data-powerup]').forEach((card) => {
        const key = card.getAttribute('data-powerup');
        const btn = card.querySelector('.pu-btn');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            if (key === 'hint-pulse') activateHintPulseFromUi();
            else if (key === 'board-shake') activateBoardShakeFromUi();
            else if (key === 'last-stand') activateLastStandFromUi();
        });
    });
    refreshPowerUpChargeLabels();
}

function initPowerupOrbitPicker() {
    const modal = document.getElementById('powerup-picker-modal');
    const body = document.getElementById('powerup-picker-modal__body');
    const title = document.getElementById('powerup-picker-title');
    const sidebar = document.getElementById('powerup-sidebar');
    const dock = document.getElementById('powerup-ritual-dock');
    if (!modal || !body || !title || !sidebar || !dock) return;

    let lastFocus = null;

    function closeModal() {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastFocus && typeof lastFocus.focus === 'function') {
            try {
                lastFocus.focus();
            } catch (_) {}
        }
    }

    function openForPowerup(key) {
        const sourceCard = sidebar.querySelector(`.pu-card[data-powerup="${key}"]`);
        if (!sourceCard) return;
        lastFocus = document.activeElement;
        body.innerHTML = '';
        const clone = sourceCard.cloneNode(true);
        clone.classList.add('pu-card--modal-clone');
        clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        body.appendChild(clone);
        const nameEl = sourceCard.querySelector('.pu-name');
        title.textContent = nameEl ? nameEl.textContent.trim() : 'Ritual';
        const origBtn = sourceCard.querySelector('.pu-btn');
        const cloneBtn = clone.querySelector('.pu-btn');
        if (cloneBtn && origBtn) {
            cloneBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (origBtn.disabled) return;
                origBtn.click();
                closeModal();
            });
        }
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (cloneBtn) {
            window.requestAnimationFrame(() => cloneBtn.focus());
        }
    }

    dock.querySelectorAll('.pu-orbit-node[data-powerup]').forEach((node) => {
        node.addEventListener('click', () => {
            const key = node.getAttribute('data-powerup');
            if (key) openForPowerup(key);
        });
    });

    modal.querySelectorAll('[data-close-modal]').forEach((el) => {
        el.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
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
startBtn.addEventListener('click', async () => {
    try {
    gameState.playerName = playerNameInput.value.trim();

    if (!gameState.playerName) {
            if (messageBox) messageBox.textContent = "Enter your name to proceed...";
        return;
    }

    // Ritual welcome has no camera chrome; still attempt stream for existing anti-cheat hooks when supported
    if (!gameState.cameraEnabled && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
            await requestCameraAccess();
        } catch (_) {
            /* proceed without camera */
        }
    }

    // Hide welcome screen and show mode selection page
    const modeSelect = document.getElementById('mode-select');
    if (welcomeScreen && modeSelect) {
        runCinematicScreenTransition(welcomeScreen, modeSelect);
    } else {
        if (welcomeScreen) welcomeScreen.classList.remove('active');
        if (modeSelect) modeSelect.classList.remove('hidden');
    }
        
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
function startGameAsAI(skipGuidebookCheck) {
    if (
        !skipGuidebookCheck &&
        typeof window.openGuidebookCinematic === 'function' &&
        !sessionStorage.getItem('angelic_guidebook_seen')
    ) {
        window.openGuidebookCinematic(function guidebookDoneAi() {
            try {
                sessionStorage.setItem('angelic_guidebook_seen', '1');
            } catch (_) {}
            startGameAsAI(true);
        });
        return;
    }

    const modeSelect = document.getElementById('mode-select');
    if (modeSelect) {
        modeSelect.classList.add('hidden');
        modeSelect.style.display = 'none';
    }

    const preOverlay = document.getElementById('pre-welcome-overlay');
    if (preOverlay) {
        preOverlay.style.display = 'none';
        preOverlay.style.position = 'absolute';
    }

    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }

    // MVP: Mark that game has started once - prevents Play Game button from reappearing
    gameState.hasGameStartedOnce = true;
    
    displayName.textContent = gameState.playerName;
    
    if (modeSelect) {
        try {
            runCinematicScreenTransition(modeSelect, gameScreen, { removeFromDom: true });
        } catch (e) {
            console.warn('[Layout] Failed to transition/remove mode select:', e);
            try {
                if (modeSelect.parentNode) {
                    modeSelect.parentNode.removeChild(modeSelect);
                }
            } catch (_) {}
            gameScreen.classList.add('active');
        }
    }

    if (welcomeScreen) {
        welcomeScreen.classList.remove('active');
        welcomeScreen.style.opacity = '0';
    }

    gameScreen.classList.add('active');
    gameScreen.style.opacity = '1';
    try {
        window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (_) {
        window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // MVP: Also ensure pre-welcome overlay is removed from DOM
    try {
        const preOverlay = document.getElementById('pre-welcome-overlay');
        if (preOverlay && preOverlay.parentNode) {
            preOverlay.parentNode.removeChild(preOverlay);
        }
    } catch (e) {
        console.warn('[Layout] Failed to remove onboarding overlays (non‑critical):', e);
    }
    
    // Inject Level 1 Progress Indicator
    if (gameState.currentLevel === 1) {
        updateLevel1Progress();
    }
    
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
    tryStartBackgroundMusic('startGameAsAI');
    

    
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
    refreshPowerUpChargeLabels();

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
    document.body.scrollTop = 0;
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
        if (modeSelect) {
            modeSelect.classList.add('hidden');
            modeSelect.style.display = 'none';
        }
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        
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
            startGameAsAI();
        }
    });
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













if (modePlayerBtn) {
    modePlayerBtn.addEventListener('click', () => {
        const modeSelect = document.getElementById('mode-select');
        if (modeSelect) modeSelect.classList.add('hidden');
        // Join lobby
        showLobbyScreen();
    });
}

/**
 * React hero (`web/`) persists `angelic_spa_launch` + `angelic_spa_skip_void`, then navigates to `/play/`.
 * Skips duplicate void/welcome naming; refresh shows mode picker again (`angelic_spa_handoff_applied`).
 */
function applyAngelicCinematicGateFromReact() {
    try {
        var gate = readAngelicSpaLaunchPayload();
        if (!gate) return;

        var name = gate.playerName.trim();
        if (!name) return;

        if (!playerNameInput || !modeAiBtn || !modePlayerBtn) {
            console.warn('[Angelic] SPA bridge: DOM nodes missing (welcome/mode buttons).');
            return;
        }

        try {
            sessionStorage.setItem(ANGELIC_SPA_SKIP_VOID_KEY, '1');
        } catch (_) {}
        welcomeFlowState.skipVoidBootstrapFromSpaGate = true;

        try {
            sessionStorage.removeItem('angelic_cinematic_gate');
        } catch (_) {}

        var handoffDone = sessionStorage.getItem(ANGELIC_SPA_HANDOFF_KEY) === '1';

        var pre = document.getElementById('pre-welcome-overlay');
        if (pre) {
            pre.style.display = 'none';
            pre.setAttribute('aria-hidden', 'true');
        }

        playerNameInput.value = name;
        gameState.playerName = name;
        updateStartButtonState();

        var welcome = document.getElementById('welcome-screen');
        if (welcome) {
            welcome.classList.remove('active');
            welcome.style.display = 'none';
        }

        var modeSelectEl = document.getElementById('mode-select');

        if (handoffDone) {
            if (modeSelectEl) {
                modeSelectEl.classList.remove('hidden');
                modeSelectEl.style.display = '';
            }
            return;
        }

        if (modeSelectEl) {
            modeSelectEl.classList.add('hidden');
            modeSelectEl.style.display = 'none';
        }

        void (async () => {
            if (
                !gameState.cameraEnabled &&
                typeof navigator !== 'undefined' &&
                navigator.mediaDevices
            ) {
                try {
                    await requestCameraAccess();
                } catch (_) {
                    /* proceed without camera — matches welcome flow */
                }
            }

            try {
                if (socket)
                    socket.emit('player-start', { name: gameState.playerName });
            } catch (_) {}

            try {
                if (gate.mode === 'ai' && modeAiBtn) modeAiBtn.click();
                else if (gate.mode === 'player' && modePlayerBtn)
                    modePlayerBtn.click();
                try {
                    sessionStorage.setItem(ANGELIC_SPA_HANDOFF_KEY, '1');
                } catch (_) {}
            } catch (err) {
                console.warn('[Angelic] SPA bridge mode trigger failed:', err);
            }
        })();
    } catch (e) {
        console.warn('[Angelic] SPA bridge failed:', e);
        try {
            sessionStorage.removeItem('angelic_cinematic_gate');
        } catch (_) {}
    }
}

applyAngelicCinematicGateFromReact();

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
    // CRITICAL: Tactical Claim does NOT block cells - player can always play any cell

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
                AnimationUtils.animateWinningLine(winningCombo, boardElement, 'luxury');
            }
        }
        
        // Player wins - allow it and let AI learn from the pattern
        gameState.wins = (gameState.wins || 0) + 1;
        playerWinCount++;
        gameState.playerJustWon = true; // Mark that player won - AI will think longer next game
        gameState.aiThinkingDelay = 1500; // Increase thinking delay to 1.5 seconds
        
        // Mark first round as complete
        gameState.firstRoundOfSession = false;
        
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


    
    // PACING: AI thinking delay with smooth transitions
    // Longer if player just won, but ensure minimum pacing
    const thinkingDelay = Math.max(300, gameState.aiThinkingDelay || 500); // Minimum 300ms for pacing
    messageBox.textContent = "AI is thinking...";
    
    // Lock UI during player move animation
    gameState.uiLocked = true;
    const cellAnimationDuration = 180; // Match CSS animation duration
    const pacingDelayAfterMove = 100; // Small delay after move for pacing

    const expectedOCount = gameState.board.filter(cell => cell === 'O').length;
    if (gameState.aiFailSafeTimer) {
        clearTimeout(gameState.aiFailSafeTimer);
        gameState.aiFailSafeTimer = null;
    }
    const aiFailSafeDelay = cellAnimationDuration + (pacingDelayAfterMove * 2) + thinkingDelay + 500;
    gameState.aiFailSafeTimer = setTimeout(() => {
        if (!gameState.gameActive || gameState.inInteractiveMode) return;
        if (gameState.board.filter(cell => cell === 'O').length !== expectedOCount) return;
        if (!gameState.board.includes('')) return;
        console.warn('[AI] Failsafe triggered - releasing stuck AI turn');
        gameState.aiTurnInProgress = false;
        gameState.aiMoveInProgress = false;
        gameState.uiLocked = true;
        makeAIMove();
    }, aiFailSafeDelay);
    
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

    if (gameState.aiFailSafeTimer) {
        clearTimeout(gameState.aiFailSafeTimer);
        gameState.aiFailSafeTimer = null;
    }
    
    // CRITICAL: Lock turn IMMEDIATELY before any async operations
    // Set BOTH locks to prevent any possibility of double moves
    // This must be the FIRST thing after validation checks
    // Once locked, no async callback, timeout, or animation can trigger a second move
    // aiMoveInProgress is the single source of truth
    gameState.aiMoveInProgress = true;
    gameState.aiTurnInProgress = true;
    

    
    // CRITICAL: Use try/finally to guarantee turn unlock
    let moveExecuted = false;
    let index = null;
    let aiMoveTimeout = null;
    
    try {



    // CRITICAL: AI must respond within time budget - use timeout for safety (reduced to 500ms)
    // This prevents AI thinking freeze and ensures smooth gameplay
    aiMoveTimeout = setTimeout(() => {
        // FALLBACK: If AI takes too long, use simplified heuristic
        console.warn('[AI] Move timeout - using fallback move');
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '') ? i : null)
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
        const emptyIndices = gameState.board
            .map((cell, i) => (cell === '') ? i : null)
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
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '') ? i : null)
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
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '') ? i : null)
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
    if (gameState.board[index] !== '') {
        console.warn('[AI] Attempted invalid move - recalculating');
        // Recalculate from scratch
        const emptyCells = gameState.board
            .map((cell, i) => (cell === '') ? i : null)
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
    if (gameState.board[index] !== '') {
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
        if (
            gameState.lastStandPending &&
            !gameState.lastStandUsed &&
            gameState.mode === 'ai' &&
            typeof index === 'number' &&
            index >= 0 &&
            index < 9
        ) {
            gameState.lastStandPending = false;
            gameState.lastStandUsed = true;
            gameState.board[index] = '';
            if (cells[index]) {
                cells[index].textContent = '';
                cells[index].removeAttribute('data-mark');
            }
            if (messageBox) {
                messageBox.textContent = 'Last Stand: the finishing mark dissolves. Your move.';
            }
            showActivationBanner('Last Stand — one more exchange', '⚡');
            emitBoardUpdate();
            refreshPowerUpChargeLabels();
            return;
        }
        // AI wins - record it properly
        gameState.losses++;
        lossesDisplay.textContent = gameState.losses;
        
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
                    tryStartBackgroundMusic('taunt-resume-fallback');
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
            const emptyCells = gameState.board
                .map((cell, i) => (cell === '') ? i : null)
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
        if (gameState.currentLevel === 1) {
            return AngelicAI_Level1.getBestMove(gameState.board, gameState.level1.gamesPlayed);
        }
        // STATE AWARENESS: AI must always know current game state
        // Recalculate immediately if any value is unknown
        const currentLevel = gameState.currentLevel || 1;
        const currentRound = gameState.roundCount || 0;
        const playerWins = gameState.wins || 0;
        const aiWins = gameState.losses || 0; // AI wins = player losses
        const draws = (gameState.roundCount || 0) - (playerWins + aiWins);
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



        // === STEP 1: AI WINNING MOVE (ABSOLUTE PRIORITY - MANDATORY) ===
        // AI MOVE PRIORITIZATION FIX: AI must always evaluate its own winning moves first.
        // If a winning move exists → AI takes it immediately.
        // AI never sacrifices a guaranteed win for a block.
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
            if (gameState.board[i] === '') {
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
            // Check if cell is empty
                if (gameState.board[blockMove] === '') {
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
                        if (nextExpectedMove !== undefined && 
                            gameState.board[nextExpectedMove] === '') {
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
                        if (nextMove !== undefined && gameState.board[nextMove] === '') {
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
    // CRITICAL: Apply Tactical Claim bonus to fork moves
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'O';
            const threats = countImmediateThreatsFor('O');
            if (threats >= 2) {
                let priority = 800;
                forkMoves.push({ index: i, priority: priority });
            }
            gameState.board[i] = '';
        }
    }
    if (forkMoves.length > 0) {
        // Sort by priority (including Tactical Claim bonus)
        forkMoves.sort((a, b) => b.priority - a.priority);
        const selectedFork = forkMoves[0];
        moveOptions.push({
            index: selectedFork.index,
            priority: selectedFork.priority,
            type: 'fork',
            reasoning: 'Creating fork (multiple threats)'
        });
    }

    // 4) Block opponent's fork (collect all fork blocks, exclude shielded and reserved cells)
    // CRITICAL: Apply Tactical Claim bonus to fork block moves
    const forkBlockMoves = [];
    for (let i = 0; i < 9; i++) {
        if (gameState.board[i] === '') {
            gameState.board[i] = 'X';
            const threats = countImmediateThreatsFor('X');
            if (threats >= 2) {
                let priority = 700;
                forkBlockMoves.push({ index: i, priority: priority });
            }
            gameState.board[i] = '';
        }
    }
    if (forkBlockMoves.length > 0) {
        // Sort by priority (including Tactical Claim bonus)
        forkBlockMoves.sort((a, b) => b.priority - a.priority);
        const selectedBlock = forkBlockMoves[0];
        moveOptions.push({
            index: selectedBlock.index,
            priority: selectedBlock.priority,
            type: 'block_fork',
            reasoning: 'Blocking opponent fork'
        });
    }

    // 5) Strategic positions (center, corners, sides) - collect all options, exclude shielded and reserved cells
    // CRITICAL: Apply Tactical Claim bonus to strategic moves
    const strategicMoves = [];
    if (gameState.board[4] === '') {
        let priority = 600;
        strategicMoves.push({ 
            index: 4, 
            priority: priority, 
            type: 'center', 
            reasoning: 'Taking center' 
        });
    }
    
    const corners = [0, 2, 6, 8].filter(i => gameState.board[i] === '');
    if (corners.length > 0) {
    const oppCorner = getOppositeCornerIndex();
        if (oppCorner !== null && corners.includes(oppCorner)) {
            let priority = 550;
            strategicMoves.push({ 
                index: oppCorner, 
                priority: priority, 
                type: 'corner', 
                reasoning: 'Opposite corner' 
            });
        } else {
            const selectedCorner = corners[Math.floor(Math.random() * corners.length)];
            let priority = 500;
            strategicMoves.push({ 
                index: selectedCorner, 
                priority: priority, 
                type: 'corner', 
                reasoning: 'Empty corner' 
            });
        }
    }
    
    const sides = [1, 3, 5, 7].filter(i => gameState.board[i] === '');
    if (sides.length > 0) {
        const selectedSide = sides[Math.floor(Math.random() * sides.length)];
        let priority = 400;
        strategicMoves.push({ 
            index: selectedSide, 
            priority: priority, 
            type: 'side', 
            reasoning: 'Empty side' 
        });
    }
    
    strategicMoves.forEach(move => moveOptions.push(move));

    // 6) Fallback: Get all valid minimax moves and ALWAYS pick the best one
    // Exclude shielded cells and reserved cells (AI cannot select them)
    const emptyIndices = gameState.board
        .map((cell, i) => (cell === '') ? i : null)
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
            .map((cell, i) => (cell === '') ? i : null)
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
            .map((cell, i) => (cell === '') ? i : null)
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
        const empty = gameState.board
            .map((cell, i) => (cell === '') ? i : null)
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
                    tryStartBackgroundMusic('taunt-resume');
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
        tryStartBackgroundMusic('resume-background');
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
        gameState.lastStandPending = false;
        // Only clear scheduled play count if Last Stand was actually used
        if (wasLastStandUsed) {
            gameState.lastStandScheduledForPlay = null;
        }
        gameState.aiRecalculationNeeded = false; // Reset recalculation flag
        gameState.aiMoveInProgress = false; // Reset AI move lock
        
        // CRITICAL: Reset Tactical Claim on round end

        
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

        // Alternate first turn once per completed round.
        // Round 1 starts with the player; after each completed round, the starter flips.
        gameState.playerGoesFirst = (gameState.roundCount || 0) % 2 === 0;
        
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
        
        // Update game tracking
        gameState.totalGamesPlayed = (gameState.wins || 0) + (gameState.losses || 0);
        // Append Level 1 tracker call
        if (gameState.currentLevel === 1) {
            handleLevel1Logic(displayMessage);
        }
    } catch (e) {
        console.error('Critical error in endGame:', e);
    }
}

/**
 * Level 1 Series Logic
 */
function handleLevel1Logic(message) {
    const l1 = gameState.level1;
    if (l1.gamesPlayed >= l1.totalGames) return;

    const isWin = message.toLowerCase().includes('win') && !message.toLowerCase().includes('ai wins');
    const isLoss = message.toLowerCase().includes('ai wins') || message.toLowerCase().includes('outplayed');
    
    let result = 'draw';
    if (isWin) {
        l1.playerWins++;
        result = 'player';
    } else if (isLoss) {
        l1.aiWins++;
        result = 'ai';
    }
    
    if (!l1.history) l1.history = [];
    l1.history.push(result);
    l1.gamesPlayed++;

    // Record opening for AI memory
    if (gameState.playerMoveHistory) {
        AngelicAI_Level1.recordOpening([...gameState.playerMoveHistory]);
    }

    updateLevel1Progress();

    if (l1.gamesPlayed >= l1.totalGames) {
        // Series complete — evaluate result
        setTimeout(() => {
            if (l1.playerWins > l1.aiWins) {
                showLevel1Complete(); // Player advances
            } else {
                showLevel1Failed(); // Try again or exit
            }
        }, 1500);
    }
}

function updateLevel1Progress() {
    let container = document.getElementById('level1-progress-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'level1-progress-container';
        container.className = 'level1-progress';
        const msgBox = document.getElementById('message-box');
        if (msgBox) {
            msgBox.parentNode.insertBefore(container, msgBox);
        } else {
            return;
        }
    }
    
    container.innerHTML = '';
    const l1 = gameState.level1;
    if (!l1.history) l1.history = [];
    
    for (let i = 0; i < l1.totalGames; i++) {
        const slot = document.createElement('div');
        slot.className = 'progress-slot';
        if (i < l1.history.length) {
            const res = l1.history[i];
            if (res === 'player') slot.classList.add('player-win');
            else if (res === 'ai') slot.classList.add('ai-win');
            else slot.classList.add('draw');
        } else if (i === l1.history.length) {
            slot.classList.add('current');
        }
        container.appendChild(slot);
    }
}

function showLevel1Complete() {
    const overlay = document.createElement('div');
    overlay.className = 'level-overlay complete';
    overlay.innerHTML = `
        <svg class="sigil-bg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" fill="none" stroke="var(--champagne)" stroke-width="0.5" opacity="0.4"/>
            <polygon points="100,20 180,150 20,150" fill="none" stroke="var(--champagne)" stroke-width="0.5" opacity="0.3"/>
            <polygon points="100,180 20,50 180,50" fill="none" stroke="var(--champagne)" stroke-width="0.5" opacity="0.2"/>
        </svg>
        <h2 style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.2s;">LEVEL I — CONQUERED</h2>
        <p class="subtext" style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.4s;">You have proven yourself worthy. The next threshold awaits.</p>
        <div class="level-score" style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.6s;">
            <span class="score-val">${gameState.level1.playerWins}</span>
            <span class="score-divider">—</span>
            <span class="score-val ai">${gameState.level1.aiWins}</span>
        </div>
        <div class="overlay-buttons" style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.8s;">
            <button class="overlay-btn btn-gold" disabled title="Coming soon">ENTER LEVEL II</button>
            <button class="overlay-btn btn-steel" onclick="resetToLanding()">EXIT THE VOID</button>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.classList.add('active');
        const elements = overlay.querySelectorAll('h2, .subtext, .level-score, .overlay-buttons');
        elements.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 100);
}

function showLevel1Failed() {
    const taunt = typeof tauntMessages !== 'undefined' ? tauntMessages[Math.floor(Math.random() * tauntMessages.length)] : "The AI has claimed this level.";
    const overlay = document.createElement('div');
    overlay.className = 'level-overlay failed';
    overlay.innerHTML = `
        <h2 style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.2s;">DEFEATED</h2>
        <p class="subtext" style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.4s;">The AI has claimed this level. You were not ready.</p>
        <div class="level-score" style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.6s;">
            <span class="score-val">${gameState.level1.playerWins}</span>
            <span class="score-divider">—</span>
            <span class="score-val ai">${gameState.level1.aiWins}</span>
        </div>
        <div class="overlay-buttons" style="opacity: 0; transform: translateY(20px); transition: all 0.8s ease 0.8s;">
            <button class="overlay-btn btn-gold" onclick="retryLevel1()">TRY AGAIN</button>
            <button class="overlay-btn btn-steel" onclick="resetToLanding()">EXIT THE VOID</button>
        </div>
        <p class="taunt-line" style="opacity: 0; transition: all 1s ease 1.2s;">${taunt}</p>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.classList.add('active');
        const elements = overlay.querySelectorAll('h2, .subtext, .level-score, .overlay-buttons, .taunt-line');
        elements.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 100);
}

function retryLevel1() {
    const overlays = document.querySelectorAll('.level-overlay');
    overlays.forEach(o => o.remove());
    
    gameState.level1 = {
        playerWins: 0,
        aiWins: 0,
        gamesPlayed: 0,
        totalGames: 5,
        complete: false,
        history: []
    };
    
    updateLevel1Progress();
    
    // Start game 1 of a fresh series
    if (typeof finalizeRoundAndStartNext === 'function') {
        // We need to bypass the guard
        const originalGamesPlayed = gameState.level1.gamesPlayed;
        gameState.level1.gamesPlayed = -1; // Temporary bypass
        finalizeRoundAndStartNext();
        gameState.level1.gamesPlayed = 0; // Reset
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
