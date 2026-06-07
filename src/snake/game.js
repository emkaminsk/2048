class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');

        this.GRID = 17;                                   // cells per side
        this.CELL = this.canvas.width / this.GRID;        // pixel size of a cell
        this.BASE_SPEED = 150;                            // ms per step at start
        this.MIN_SPEED = 70;                              // fastest step interval

        this.bestEl = document.getElementById('best');
        this.scoreEl = document.getElementById('score');
        this.messageEl = document.getElementById('message');
        this.pauseBtn = document.getElementById('pause');

        this.best = Number(localStorage.getItem('snakeBest') || 0);
        this.bestEl.textContent = this.best;

        this.timer = null;
        this.reset();
        this.setupEventListeners();
        this.draw();
    }

    reset() {
        const mid = Math.floor(this.GRID / 2);
        // Start as a length-3 snake heading right (head first).
        this.snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid },
        ];
        this.direction = { x: 1, y: 0 };
        this.pendingDirection = { x: 1, y: 0 };
        this.score = 0;
        this.state = 'idle';                              // idle | running | paused | over
        this.scoreEl.textContent = '0';
        this.placeFood();
        this.stopLoop();
        this.pauseBtn.disabled = true;
        this.pauseBtn.textContent = 'Pause';
        this.showMessage('Snake', 'Press an arrow key or tap to start');
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKey(e));
        document.getElementById('new-game').addEventListener('click', () => {
            this.hideGameOver();
            this.reset();
            this.draw();
        });
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        document.getElementById('play-again').addEventListener('click', () => {
            this.hideGameOver();
            this.reset();
            this.draw();
            this.start({ x: 1, y: 0 });
        });
        this.setupTouchListeners();
    }

    setupTouchListeners() {
        let startX = 0;
        let startY = 0;
        let tracking = false;

        this.canvas.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            tracking = true;
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            // Keep the page from scrolling while swiping on the board.
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (!tracking) return;
            tracking = false;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;

            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
                // A tap (no real swipe) starts a fresh game heading right.
                if (this.state === 'idle') this.start({ x: 1, y: 0 });
                return;
            }

            if (Math.abs(dx) > Math.abs(dy)) {
                this.queueDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
            } else {
                this.queueDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
            }
        }, { passive: true });
    }

    handleKey(e) {
        const map = {
            ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
            ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
        };

        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (this.state === 'idle') this.start(this.pendingDirection);
            else this.togglePause();
            return;
        }

        const dir = map[e.key];
        if (!dir) return;
        e.preventDefault();

        if (this.state === 'idle') {
            this.start(dir);
        } else if (this.state === 'running') {
            this.queueDirection(dir);
        }
    }

    queueDirection(dir) {
        // Ignore reversals straight back onto the neck.
        if (dir.x === -this.direction.x && dir.y === -this.direction.y) return;
        this.pendingDirection = dir;
    }

    start(dir) {
        if (this.state === 'running') return;
        this.queueDirection(dir);
        this.state = 'running';
        this.hideMessage();
        this.pauseBtn.disabled = false;
        this.pauseBtn.textContent = 'Pause';
        this.scheduleStep();
    }

    togglePause() {
        if (this.state === 'running') {
            this.state = 'paused';
            this.stopLoop();
            this.pauseBtn.textContent = 'Resume';
            this.showMessage('Paused', 'Press space or tap Resume');
        } else if (this.state === 'paused') {
            this.state = 'running';
            this.hideMessage();
            this.pauseBtn.textContent = 'Pause';
            this.scheduleStep();
        }
    }

    currentSpeed() {
        // Speed up as the snake grows, down to a floor.
        return Math.max(this.MIN_SPEED, this.BASE_SPEED - this.score * 4);
    }

    scheduleStep() {
        this.stopLoop();
        this.timer = setTimeout(() => this.step(), this.currentSpeed());
    }

    stopLoop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    step() {
        if (this.state !== 'running') return;

        this.direction = this.pendingDirection;
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y,
        };

        // Wall collision (classic Nokia rules).
        if (head.x < 0 || head.x >= this.GRID || head.y < 0 || head.y >= this.GRID) {
            return this.gameOver();
        }
        // Self collision (the tail cell is free this tick unless we grow).
        const willGrow = head.x === this.food.x && head.y === this.food.y;
        const body = willGrow ? this.snake : this.snake.slice(0, -1);
        if (body.some((seg) => seg.x === head.x && seg.y === head.y)) {
            return this.gameOver();
        }

        this.snake.unshift(head);
        if (willGrow) {
            this.score += 1;
            this.scoreEl.textContent = this.score;
            this.placeFood();
        } else {
            this.snake.pop();
        }

        this.draw();
        this.scheduleStep();
    }

    placeFood() {
        const free = [];
        for (let x = 0; x < this.GRID; x++) {
            for (let y = 0; y < this.GRID; y++) {
                if (!this.snake.some((seg) => seg.x === x && seg.y === y)) {
                    free.push({ x, y });
                }
            }
        }
        if (free.length === 0) {
            // Board full — a win; treat as game over with a full score.
            this.food = null;
            return this.gameOver();
        }
        this.food = free[Math.floor(Math.random() * free.length)];
    }

    gameOver() {
        this.state = 'over';
        this.stopLoop();
        this.pauseBtn.disabled = true;
        if (this.score > this.best) {
            this.best = this.score;
            this.bestEl.textContent = this.best;
            localStorage.setItem('snakeBest', String(this.best));
        }
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('game-over-overlay').classList.remove('hidden');
    }

    hideGameOver() {
        document.getElementById('game-over-overlay').classList.add('hidden');
    }

    showMessage(title, hint) {
        this.messageEl.querySelector('.message-title').textContent = title;
        this.messageEl.querySelector('.message-hint').textContent = hint;
        this.messageEl.classList.remove('hidden');
    }

    hideMessage() {
        this.messageEl.classList.add('hidden');
    }

    cell(x, y, color, inset) {
        const pad = inset || 1;
        const px = x * this.CELL + pad;
        const py = y * this.CELL + pad;
        const size = this.CELL - pad * 2;
        const ctx = this.ctx;
        ctx.fillStyle = color;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(px, py, size, size, Math.max(2, this.CELL * 0.18));
            ctx.fill();
        } else {
            ctx.fillRect(px, py, size, size);
        }
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // LCD background.
        ctx.fillStyle = '#aebd8a';
        ctx.fillRect(0, 0, w, h);

        // Faint grid lines for the dot-matrix feel.
        ctx.strokeStyle = 'rgba(43, 58, 31, 0.08)';
        ctx.lineWidth = 1;
        for (let i = 1; i < this.GRID; i++) {
            const p = i * this.CELL;
            ctx.beginPath();
            ctx.moveTo(p, 0);
            ctx.lineTo(p, h);
            ctx.moveTo(0, p);
            ctx.lineTo(w, p);
            ctx.stroke();
        }

        // Food (a red apple-ish dot).
        if (this.food) {
            this.cell(this.food.x, this.food.y, '#d64545', 3);
        }

        // Snake — bright green head, darker green body.
        this.snake.forEach((seg, i) => {
            this.cell(seg.x, seg.y, i === 0 ? '#3a8d2c' : '#2b6b1f', 1);
        });
    }
}

window.addEventListener('load', () => new SnakeGame());
