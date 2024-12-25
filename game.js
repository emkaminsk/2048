class Game2048 {
    constructor() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.setupGame();
        this.setupEventListeners();
    }

    setupGame() {
        this.createGrid();
        this.addNewTile();
        this.addNewTile();
        this.updateGrid();
    }

    createGrid() {
        const gridContainer = document.querySelector('.grid');
        for (let i = 0; i < 16; i++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            gridContainer.appendChild(cell);
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleInput(e));
        document.getElementById('new-game').addEventListener('click', () => this.resetGame());
    }

    handleInput(e) {
        let moved = false;
        switch(e.key) {
            case 'ArrowUp':
                moved = this.moveUp();
                break;
            case 'ArrowDown':
                moved = this.moveDown();
                break;
            case 'ArrowLeft':
                moved = this.moveLeft();
                break;
            case 'ArrowRight':
                moved = this.moveRight();
                break;
            default:
                return;
        }

        if (moved) {
            this.addNewTile();
            this.updateGrid();
            if (this.isGameOver()) {
                alert('Game Over! Your score: ' + this.score);
            }
        }
    }

    moveLeft() {
        return this.move((row) => {
            const newRow = row.filter(cell => cell !== 0);
            for (let i = 0; i < newRow.length - 1; i++) {
                if (newRow[i] === newRow[i + 1]) {
                    newRow[i] *= 2;
                    this.score += newRow[i];
                    newRow.splice(i + 1, 1);
                }
            }
            while (newRow.length < 4) newRow.push(0);
            return newRow;
        });
    }

    moveRight() {
        return this.move((row) => {
            const newRow = row.filter(cell => cell !== 0);
            for (let i = newRow.length - 1; i > 0; i--) {
                if (newRow[i] === newRow[i - 1]) {
                    newRow[i] *= 2;
                    this.score += newRow[i];
                    newRow.splice(i - 1, 1);
                    i--;
                }
            }
            while (newRow.length < 4) newRow.unshift(0);
            return newRow;
        });
    }

    moveUp() {
        return this.move((col) => {
            const newCol = col.filter(cell => cell !== 0);
            for (let i = 0; i < newCol.length - 1; i++) {
                if (newCol[i] === newCol[i + 1]) {
                    newCol[i] *= 2;
                    this.score += newCol[i];
                    newCol.splice(i + 1, 1);
                }
            }
            while (newCol.length < 4) newCol.push(0);
            return newCol;
        }, true);
    }

    moveDown() {
        return this.move((col) => {
            const newCol = col.filter(cell => cell !== 0);
            for (let i = newCol.length - 1; i > 0; i--) {
                if (newCol[i] === newCol[i - 1]) {
                    newCol[i] *= 2;
                    this.score += newCol[i];
                    newCol.splice(i - 1, 1);
                    i--;
                }
            }
            while (newCol.length < 4) newCol.unshift(0);
            return newCol;
        }, true);
    }

    move(moveFunction, isVertical = false) {
        const oldGrid = JSON.stringify(this.grid);
        
        if (isVertical) {
            for (let col = 0; col < 4; col++) {
                const column = this.grid.map(row => row[col]);
                const newColumn = moveFunction(column);
                for (let row = 0; row < 4; row++) {
                    this.grid[row][col] = newColumn[row];
                }
            }
        } else {
            for (let row = 0; row < 4; row++) {
                this.grid[row] = moveFunction([...this.grid[row]]);
            }
        }

        return oldGrid !== JSON.stringify(this.grid);
    }

    addNewTile() {
        const emptyCells = [];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (this.grid[i][j] === 0) {
                    emptyCells.push({x: i, y: j});
                }
            }
        }

        if (emptyCells.length > 0) {
            const {x, y} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.grid[x][y] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    updateGrid() {
        const cells = document.querySelectorAll('.cell');
        document.getElementById('score').textContent = this.score;

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                const value = this.grid[i][j];
                const cell = cells[i * 4 + j];
                cell.textContent = value || '';
                cell.className = 'cell' + (value ? ` tile-${value}` : '');
            }
        }
    }

    isGameOver() {
        // Check for empty cells
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (this.grid[i][j] === 0) return false;
            }
        }

        // Check for possible merges
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                const current = this.grid[i][j];
                if ((j < 3 && current === this.grid[i][j + 1]) ||
                    (i < 3 && current === this.grid[i + 1][j])) {
                    return false;
                }
            }
        }

        return true;
    }

    resetGame() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.addNewTile();
        this.addNewTile();
        this.updateGrid();
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game2048();
}); 