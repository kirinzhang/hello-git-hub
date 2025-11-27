document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tetris-canvas');
    const context = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const startButton = document.getElementById('start-button');
    const nextCanvas = document.getElementById('next-piece-canvas');
    const nextContext = nextCanvas.getContext('2d');

    // --- Game Constants ---
    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;
    const NEXT_PIECE_CANVAS_SIZE = 4;

    // --- Game Board & State ---
    let board = createEmptyBoard();
    let score = 0;
    let isPlaying = false;
    let currentPiece;
    let nextPiece;
    let gameLoop;

    // Tetrominoes and their colors
    const PIECES = [
        { shape: [[1, 1, 1, 1]], color: '#3498db' }, // I
        { shape: [[1, 1, 0], [0, 1, 1]], color: '#e74c3c' }, // Z
        { shape: [[0, 1, 1], [1, 1, 0]], color: '#2ecc71' }, // S
        { shape: [[1, 1, 1], [0, 1, 0]], color: '#9b59b6' }, // T
        { shape: [[1, 1], [1, 1]], color: '#f1c40f' }, // O
        { shape: [[1, 0, 0], [1, 1, 1]], color: '#e67e22' }, // L
        { shape: [[0, 0, 1], [1, 1, 1]], color: '#1abc9c' }  // J
    ];

    // --- Core Functions ---

    function createEmptyBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function createNewPiece() {
        const index = Math.floor(Math.random() * PIECES.length);
        const pieceData = PIECES[index];
        return {
            shape: pieceData.shape,
            color: pieceData.color,
            x: Math.floor(COLS / 2) - Math.floor(pieceData.shape[0].length / 2),
            y: 0
        };
    }

    // --- Drawing Functions ---

    function draw() {
        // Clear board
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#f8f9fa';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw placed pieces
        drawMatrix(board, { x: 0, y: 0 });
        // Draw current falling piece
        drawMatrix(currentPiece.shape, { x: currentPiece.x, y: currentPiece.y }, currentPiece.color);
    }
    
    function drawMatrix(matrix, offset, color = null) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const blockColor = color || PIECES[value - 1]?.color || '#333';
                    context.fillStyle = blockColor;
                    context.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    context.strokeRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });
    }

    function drawNextPiece() {
        nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        const shape = nextPiece.shape;
        const color = nextPiece.color;
        const blockSize = nextCanvas.width / NEXT_PIECE_CANVAS_SIZE;
        
        const offsetX = (NEXT_PIECE_CANVAS_SIZE - shape[0].length) / 2;
        const offsetY = (NEXT_PIECE_CANVAS_SIZE - shape.length) / 2;

        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    nextContext.fillStyle = color;
                    nextContext.fillRect(
                        (x + offsetX) * blockSize, 
                        (y + offsetY) * blockSize, 
                        blockSize, 
                        blockSize
                    );
                     nextContext.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    nextContext.strokeRect(
                        (x + offsetX) * blockSize, 
                        (y + offsetY) * blockSize, 
                        blockSize, 
                        blockSize
                    );
                }
            });
        });
    }
    
    // --- Game Logic ---

    function update() {
        if (!isPlaying) return;

        movePiece(0, 1); // Move down

        if (checkCollision()) {
            // Revert move and lock piece
            currentPiece.y--;
            lockPiece();
            removeCompletedLines();
            
            // Spawn new piece
            currentPiece = nextPiece;
            nextPiece = createNewPiece();
            drawNextPiece();

            // Check for game over
            if (checkCollision()) {
                gameOver();
            }
        }
        
        draw();
    }

    function movePiece(dx, dy) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        if (checkCollision()) {
            currentPiece.x -= dx;
            currentPiece.y -= dy;
        }
    }

    function rotatePiece() {
        const shape = currentPiece.shape;
        const newShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
        
        const originalX = currentPiece.x;
        currentPiece.shape = newShape;

        // Wall kick logic
        let offset = 1;
        while (checkCollision()) {
            currentPiece.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > newShape[0].length) {
                // Rotation failed, revert
                currentPiece.shape = shape;
                currentPiece.x = originalX;
                return;
            }
        }
    }
    
    function checkCollision() {
        const { shape, x, y } = currentPiece;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col] !== 0) {
                    const newX = x + col;
                    const newY = y + row;
                    if (
                        newX < 0 || newX >= COLS || newY >= ROWS ||
                        (board[newY] && board[newY][newX] !== 0)
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function lockPiece() {
        const { shape, x, y, color } = currentPiece;
        const pieceIndex = PIECES.findIndex(p => p.color === color) + 1;
        shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value !== 0) {
                    board[y + r][x + c] = pieceIndex;
                }
            });
        });
    }

    function removeCompletedLines() {
        let linesRemoved = 0;
        outer: for (let y = ROWS - 1; y >= 0; y--) {
            for (let x = 0; x < COLS; x++) {
                if (board[y][x] === 0) {
                    continue outer;
                }
            }
            
            // Line is full
            const removedRow = board.splice(y, 1)[0].fill(0);
            board.unshift(removedRow);
            linesRemoved++;
            y++; // Check the new line at this position
        }

        // Update score
        if (linesRemoved > 0) {
            score += linesRemoved * 100 * linesRemoved; // Bonus for multiple lines
            scoreElement.textContent = score;
        }
    }

    function startGame() {
        isPlaying = true;
        board = createEmptyBoard();
        score = 0;
        scoreElement.textContent = score;
        
        currentPiece = createNewPiece();
        nextPiece = createNewPiece();
        drawNextPiece();

        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(update, 500);

        startButton.textContent = "重新开始";
        document.addEventListener('keydown', handleKeyPress);
    }

    function gameOver() {
        isPlaying = false;
        clearInterval(gameLoop);
        context.fillStyle = 'rgba(0, 0, 0, 0.75)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = '30px "Noto Sans SC"';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('游戏结束', canvas.width / 2, canvas.height / 2);
        
        startButton.textContent = "开始游戏";
        document.removeEventListener('keydown', handleKeyPress);
    }
    
    // --- Event Handlers ---

    function handleKeyPress(event) {
        if (!isPlaying) return;

        switch (event.key) {
            case 'ArrowLeft':
                movePiece(-1, 0);
                break;
            case 'ArrowRight':
                movePiece(1, 0);
                break;
            case 'ArrowDown':
                movePiece(0, 1);
                // TODO: Add score for manual drop
                break;
            case 'ArrowUp':
                rotatePiece();
                break;
        }
        draw(); // Redraw immediately after input
    }
    
    startButton.addEventListener('click', startGame);
    
    // Initial draw to show an empty board
    context.fillStyle = '#f8f9fa';
    context.fillRect(0, 0, canvas.width, canvas.height);
});
