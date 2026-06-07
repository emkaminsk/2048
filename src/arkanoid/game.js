'use strict';

const TILE_W = 32;
const TILE_H = 14;
const TILE_GAP = 3;
const TILE_OFF_X = (360 - (10 * TILE_W + 9 * TILE_GAP)) / 2;
const TILE_OFF_Y = 40;

const PADDLE_Y = 450;
const PADDLE_H = 12;
const PADDLE_NORMAL_W = 80;
const PADDLE_WIDE_W = 160;
const PADDLE_SPEED = 5;
const BALL_R = 7;
const BALL_BASE_SPEED = 4.4;
const BALL_MAX_SPEED = 8.8;
const WIDE_DURATION = 30000; // ms
const LIVES_START = 3;

const PROB_WIDE = 0.007;
const PROB_LIFE = 0.005;

// Single-character color codes used in level text files
const TILE_COLORS = {
    R: ['#ff1744', '#ff6090'],
    O: ['#ff6d00', '#ffab40'],
    Y: ['#ffd600', '#ffee58'],
    G: ['#00c853', '#69f0ae'],
    B: ['#2979ff', '#82b1ff'],
    P: ['#d500f9', '#ea80fc'],
    W: ['#eceff1', '#ffffff'],
    C: ['#00bcd4', '#80deea'],
};

// Level files loaded in order from the levels/ subdirectory
const LEVEL_FILES = [
    'levels/level1.txt',
    'levels/level2.txt',
    'levels/level3.txt',
    'levels/level4.txt',
    'levels/level5.txt',
];

class ArkanoidGame {
    constructor() {
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');
        this.scoreEl = document.getElementById('score');
        this.livesEl = document.getElementById('lives-display');
        this.levelEl = document.getElementById('level-display');
        this.overlay = document.getElementById('overlay');
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayMsg = document.getElementById('overlay-msg');
        this.btnPlayAgain = document.getElementById('play-again');
        this.btnNextLevel = document.getElementById('next-level');

        this.btnPlayAgain.addEventListener('click', () => this.init(this._levelIdx));
        this.btnNextLevel.addEventListener('click', () => this.init((this._levelIdx + 1) % LEVEL_FILES.length));

        this._levelIdx = 0;
        this._bindControls();
        this.init(0);
    }

    async init(levelIdx = 0) {
        this._levelIdx = levelIdx;
        this.score = 0;
        this.lives = LIVES_START;
        this.bonuses = [];
        this.paddleX = (360 - PADDLE_NORMAL_W) / 2;
        this.paddleW = PADDLE_NORMAL_W;
        this.paddleTargetW = PADDLE_NORMAL_W;
        this.wideEnd = 0;
        this.launched = false;
        this.keys = { left: false, right: false };
        this.movingLeft = false;
        this.movingRight = false;

        this.tiles = await this._loadLevel(levelIdx);
        this.totalTiles = this.tiles.length;

        this._resetBall();
        this._updateHUD();
        this._hideOverlay();
        if (this._raf) cancelAnimationFrame(this._raf);
        this._last = null;
        this._raf = requestAnimationFrame(ts => this._loop(ts));
    }

    // ── level loading ──────────────────────────────────────────────────────────

    async _loadLevel(idx) {
        const url = LEVEL_FILES[idx];
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return this._parseLevelText(await resp.text());
        } catch (e) {
            console.warn(`Could not load ${url}: ${e.message}. Falling back to classic layout.`);
            return this._classicTiles();
        }
    }

    // Parse a level text file into an array of tile objects.
    // Each non-comment line is a row; each character is a column.
    // See levels/README.txt for the full format description.
    _parseLevelText(text) {
        const tiles = [];
        const rows = text.split('\n')
            .map(l => l.replace(/\r$/, ''))
            .filter(l => !l.startsWith('#') && l.trim() !== '');

        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const ch = rows[r][c].toUpperCase();
                if (ch === '.' || ch === ' ') continue;
                if (!TILE_COLORS[ch]) continue;
                tiles.push({
                    x: TILE_OFF_X + c * (TILE_W + TILE_GAP),
                    y: TILE_OFF_Y + r * (TILE_H + TILE_GAP),
                    color: ch,
                    alive: true,
                    flash: 0,
                });
            }
        }
        return tiles;
    }

    // Hardcoded fallback if a level file cannot be fetched
    _classicTiles() {
        const rows = ['R', 'O', 'Y', 'G', 'B', 'P'];
        const tiles = [];
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < 10; c++) {
                tiles.push({
                    x: TILE_OFF_X + c * (TILE_W + TILE_GAP),
                    y: TILE_OFF_Y + r * (TILE_H + TILE_GAP),
                    color: rows[r],
                    alive: true,
                    flash: 0,
                });
            }
        }
        return tiles;
    }

    _resetBall() {
        this.ballX = 360 / 2;
        this.ballY = PADDLE_Y - BALL_R - 2;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        this.ballVX = BALL_BASE_SPEED * Math.cos(angle);
        this.ballVY = BALL_BASE_SPEED * Math.sin(angle);
        this.launched = false;
        this._readyTimer = 1500;
    }

    // ── main loop ──────────────────────────────────────────────────────────────

    _loop(ts) {
        const dt = this._last ? Math.min(ts - this._last, 50) : 16;
        this._last = ts;
        this._update(dt);
        this._draw();
        this._raf = requestAnimationFrame(t => this._loop(t));
    }

    _update(dt) {
        if (!this.launched) {
            this._readyTimer -= dt;
            if (this._readyTimer <= 0) this.launched = true;
        }

        if (this.wideEnd > 0 && Date.now() > this.wideEnd) {
            this.wideEnd = 0;
            this.paddleTargetW = PADDLE_NORMAL_W;
        }
        this.paddleW += (this.paddleTargetW - this.paddleW) * 0.15;

        const moving  = this.keys.left  || this.movingLeft;
        const movingR = this.keys.right || this.movingRight;
        if (moving)  this.paddleX = Math.max(0, this.paddleX - PADDLE_SPEED);
        if (movingR) this.paddleX = Math.min(360 - this.paddleW, this.paddleX + PADDLE_SPEED);

        if (!this.launched) {
            this.ballX = this.paddleX + this.paddleW / 2;
            this.ballY = PADDLE_Y - BALL_R - 2;
            return;
        }

        this.ballX += this.ballVX;
        this.ballY += this.ballVY;

        if (this.ballX - BALL_R < 0)   { this.ballX = BALL_R;       this.ballVX =  Math.abs(this.ballVX); }
        if (this.ballX + BALL_R > 360) { this.ballX = 360 - BALL_R; this.ballVX = -Math.abs(this.ballVX); }
        if (this.ballY - BALL_R < 0)   { this.ballY = BALL_R;       this.ballVY =  Math.abs(this.ballVY); }

        if (
            this.ballVY > 0 &&
            this.ballY + BALL_R >= PADDLE_Y &&
            this.ballY + BALL_R <= PADDLE_Y + PADDLE_H + 2 &&
            this.ballX >= this.paddleX - BALL_R &&
            this.ballX <= this.paddleX + this.paddleW + BALL_R
        ) {
            const hit = (this.ballX - (this.paddleX + this.paddleW / 2)) / (this.paddleW / 2);
            const angle = hit * 1.1 - Math.PI / 2;
            const speed = Math.min(Math.hypot(this.ballVX, this.ballVY), BALL_MAX_SPEED);
            this.ballVX = speed * Math.cos(angle);
            this.ballVY = speed * Math.sin(angle);
            this.ballY = PADDLE_Y - BALL_R - 1;
        }

        for (const t of this.tiles) {
            if (!t.alive) continue;
            const closestX = Math.max(t.x, Math.min(this.ballX, t.x + TILE_W));
            const closestY = Math.max(t.y, Math.min(this.ballY, t.y + TILE_H));
            const dx = this.ballX - closestX;
            const dy = this.ballY - closestY;
            if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

            t.alive = false;
            t.flash = 6;
            this.score += 10;
            this._updateHUD();
            this._bounceTileEdge(t, dx, dy);
            this._maybeDropBonus(t);
        }

        // Gradually speed up the ball as more tiles are cleared
        const tilesDestroyed = this.totalTiles - this.tiles.filter(t => t.alive).length;
        const speedUp = Math.floor(tilesDestroyed / 20) * 0.3;
        const currentSpeed = Math.hypot(this.ballVX, this.ballVY);
        const targetSpeed  = Math.min(BALL_BASE_SPEED + speedUp, BALL_MAX_SPEED);
        if (Math.abs(currentSpeed - targetSpeed) > 0.05) {
            const scale = targetSpeed / currentSpeed;
            this.ballVX *= scale;
            this.ballVY *= scale;
        }

        for (const b of this.bonuses) {
            b.y += b.vy;
            if (
                b.y + 8 >= PADDLE_Y &&
                b.y <= PADDLE_Y + PADDLE_H + 8 &&
                b.x + 10 >= this.paddleX &&
                b.x - 10 <= this.paddleX + this.paddleW
            ) {
                this._applyBonus(b.type);
                b.dead = true;
            }
            if (b.y > 490) b.dead = true;
        }
        this.bonuses = this.bonuses.filter(b => !b.dead);

        if (this.ballY - BALL_R > 490) {
            this.lives--;
            this._updateHUD();
            if (this.lives <= 0) {
                this._showOverlay('lose', 'Game Over', `Score: <span>${this.score}</span>`, false);
            } else {
                this._resetBall();
            }
        }

        if (this.tiles.every(t => !t.alive)) {
            const isLast = this._levelIdx === LEVEL_FILES.length - 1;
            if (isLast) {
                this._showOverlay('win', 'You Win!', `All levels complete!<br>Score: <span>${this.score}</span>`, false);
            } else {
                this._showOverlay('win', `Level ${this._levelIdx + 1} Clear!`, `Score: <span>${this.score}</span>`, true);
            }
        }
    }

    _bounceTileEdge(t, dx, dy) {
        if (Math.abs(dx) < Math.abs(dy)) {
            this.ballVY = dy < 0 ? -Math.abs(this.ballVY) : Math.abs(this.ballVY);
        } else {
            this.ballVX = dx < 0 ? -Math.abs(this.ballVX) : Math.abs(this.ballVX);
        }
    }

    _maybeDropBonus(tile) {
        const r = Math.random();
        if (r < PROB_WIDE) {
            this.bonuses.push({ x: tile.x + TILE_W / 2, y: tile.y + TILE_H / 2, vy: 2, type: 'wide', dead: false });
        } else if (r < PROB_WIDE + PROB_LIFE) {
            this.bonuses.push({ x: tile.x + TILE_W / 2, y: tile.y + TILE_H / 2, vy: 2, type: 'life', dead: false });
        }
    }

    _applyBonus(type) {
        if (type === 'wide') {
            this.paddleTargetW = PADDLE_WIDE_W;
            this.wideEnd = Date.now() + WIDE_DURATION;
        } else if (type === 'life') {
            this.lives = Math.min(this.lives + 1, 9);
            this._updateHUD();
        }
    }

    // ── drawing ────────────────────────────────────────────────────────────────

    _draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 360, 480);

        ctx.strokeStyle = '#0f0f22';
        ctx.lineWidth = 1;
        for (let x = 0; x <= 360; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 480); ctx.stroke();
        }
        for (let y = 0; y <= 480; y += 30) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
        }

        this._drawTiles(ctx);
        this._drawBonuses(ctx);
        this._drawPaddle(ctx);
        this._drawBall(ctx);
        this._drawWidebar(ctx);

        if (!this.launched && this._readyTimer > 0) {
            ctx.fillStyle = '#ffffff44';
            ctx.font = '13px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('TAP or SPACE to launch', 180, PADDLE_Y - 20);
        }
    }

    _drawTiles(ctx) {
        for (const t of this.tiles) {
            if (!t.alive && t.flash <= 0) continue;
            const [base, light] = t.flash > 0 ? ['#ffffff', '#ffffff'] : TILE_COLORS[t.color];
            const alpha = t.flash > 0 ? t.flash / 6 : 1;
            if (t.flash > 0) t.flash--;

            ctx.globalAlpha = alpha;
            const grad = ctx.createLinearGradient(t.x, t.y, t.x, t.y + TILE_H);
            grad.addColorStop(0, light);
            grad.addColorStop(1, base);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(t.x, t.y, TILE_W, TILE_H, 3);
            ctx.fill();

            ctx.shadowColor = base;
            ctx.shadowBlur = 6;
            ctx.strokeStyle = light;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    _drawBonuses(ctx) {
        for (const b of this.bonuses) {
            const color = b.type === 'wide' ? '#00e5ff' : '#ff4081';
            const label = b.type === 'wide' ? '↔' : '♥';

            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;

            ctx.fillStyle = color + '33';
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(b.x - 12, b.y - 8, 24, 16, 4);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = 'bold 11px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, b.x, b.y);
            ctx.restore();
        }
    }

    _drawPaddle(ctx) {
        const w = this.paddleW;
        const x = this.paddleX;
        const isWide = this.paddleTargetW === PADDLE_WIDE_W || w > PADDLE_NORMAL_W + 2;
        const color = isWide ? '#ffd700' : '#00e5ff';

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        const grad = ctx.createLinearGradient(x, PADDLE_Y, x, PADDLE_Y + PADDLE_H);
        grad.addColorStop(0, isWide ? '#ffe57a' : '#80f4ff');
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, PADDLE_Y, w, PADDLE_H, 6);
        ctx.fill();
        ctx.restore();
    }

    _drawBall(ctx) {
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        const grad = ctx.createRadialGradient(this.ballX - 2, this.ballY - 2, 1, this.ballX, this.ballY, BALL_R);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#a0e0ff');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.ballX, this.ballY, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawWidebar(ctx) {
        if (this.wideEnd <= 0) return;
        const frac = Math.max(0, this.wideEnd - Date.now()) / WIDE_DURATION;
        const barY = PADDLE_Y + PADDLE_H + 4;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, barY, 360, 3);
        const grad = ctx.createLinearGradient(0, 0, 360 * frac, 0);
        grad.addColorStop(0, '#ffd700');
        grad.addColorStop(1, '#ff6d00');
        ctx.fillStyle = grad;
        ctx.fillRect(0, barY, 360 * frac, 3);
    }

    // ── HUD ────────────────────────────────────────────────────────────────────

    _updateHUD() {
        this.scoreEl.textContent = this.score;
        this.levelEl.textContent = this._levelIdx + 1;
        this.livesEl.innerHTML = Array.from({ length: this.lives }, () => '<div class="life-icon"></div>').join('');
    }

    _showOverlay(type, title, msg, showNextLevel) {
        this.overlay.className = `overlay ${type}`;
        this.overlayTitle.textContent = title;
        this.overlayMsg.innerHTML = msg;
        this.btnNextLevel.style.display = showNextLevel ? '' : 'none';
        this.btnPlayAgain.textContent   = showNextLevel ? 'Restart' : 'Play Again';
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    }

    _hideOverlay() {
        this.overlay.className = 'overlay hidden';
    }

    // ── controls ───────────────────────────────────────────────────────────────

    _bindControls() {
        document.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft')  this.keys.left  = true;
            if (e.key === 'ArrowRight') this.keys.right = true;
            if (e.key === ' ' && !this.launched) { this.launched = true; e.preventDefault(); }
        });
        document.addEventListener('keyup', e => {
            if (e.key === 'ArrowLeft')  this.keys.left  = false;
            if (e.key === 'ArrowRight') this.keys.right = false;
        });

        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            const cx = (e.clientX - rect.left) * (360 / rect.width);
            this.paddleX = Math.max(0, Math.min(360 - this.paddleW, cx - this.paddleW / 2));
        });
        this.canvas.addEventListener('click', () => { if (!this.launched) this.launched = true; });

        let touchStartX = null;
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            if (!this.launched) this.launched = true;
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            if (touchStartX === null) return;
            const rect = this.canvas.getBoundingClientRect();
            const cx = (e.touches[0].clientX - rect.left) * (360 / rect.width);
            this.paddleX = Math.max(0, Math.min(360 - this.paddleW, cx - this.paddleW / 2));
        }, { passive: false });
        this.canvas.addEventListener('touchend', () => { touchStartX = null; });

        const btnLeft  = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const setLeft  = v => { this.movingLeft  = v; };
        const setRight = v => { this.movingRight = v; };

        btnLeft.addEventListener('touchstart',  e => { e.preventDefault(); setLeft(true);  }, { passive: false });
        btnLeft.addEventListener('touchend',    e => { e.preventDefault(); setLeft(false); }, { passive: false });
        btnLeft.addEventListener('touchcancel', e => { e.preventDefault(); setLeft(false); }, { passive: false });
        btnRight.addEventListener('touchstart',  e => { e.preventDefault(); setRight(true);  }, { passive: false });
        btnRight.addEventListener('touchend',    e => { e.preventDefault(); setRight(false); }, { passive: false });
        btnRight.addEventListener('touchcancel', e => { e.preventDefault(); setRight(false); }, { passive: false });

        btnLeft.addEventListener('mousedown',  () => setLeft(true));
        btnLeft.addEventListener('mouseup',    () => setLeft(false));
        btnLeft.addEventListener('mouseleave', () => setLeft(false));
        btnRight.addEventListener('mousedown',  () => setRight(true));
        btnRight.addEventListener('mouseup',    () => setRight(false));
        btnRight.addEventListener('mouseleave', () => setRight(false));
    }
}

window.addEventListener('DOMContentLoaded', () => { window._arkanoid = new ArkanoidGame(); });
