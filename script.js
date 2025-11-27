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
    let level = 0;
    let linesCleared = 0;
    let isPlaying = false;
    let currentPiece;
    let nextPiece;
    let gameLoop;
    const initialSpeed = 500;
    const speedIncrement = 50;

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
        
        draw();
    }

    async function lockAndResetPiece() {
        lockPiece();
        await removeCompletedLines(); // Now an async function
        
        currentPiece = nextPiece;
        nextPiece = createNewPiece();
        drawNextPiece();

        // Check for game over
        if (checkCollision()) {
            gameOver();
        }
    }

    function movePiece(dx, dy) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        if (checkCollision()) {
            currentPiece.x -= dx;
            currentPiece.y -= dy;
            // If the piece can't move down, it has landed
            if (dy > 0) {
                lockAndResetPiece();
            }
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
        return new Promise(resolve => {
            let linesToRemove = [];
            for (let y = 0; y < ROWS; y++) {
                if (board[y].every(value => value !== 0)) {
                    linesToRemove.push(y);
                }
            }

            if (linesToRemove.length === 0) {
                return resolve();
            }

            // --- Animation Step ---
            clearInterval(gameLoop); // Pause game loop for animation
            
            let blinkCount = 0;
            const blinkInterval = setInterval(() => {
                blinkCount++;
                linesToRemove.forEach(y => {
                    for (let x = 0; x < COLS; x++) {
                        // Toggle color for blinking effect
                        const color = blinkCount % 2 === 1 ? '#ffffff' : (PIECES[board[y][x] - 1]?.color || '#333');
                        context.fillStyle = color;
                        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                });

                if (blinkCount >= 3) { // Blink 3 times
                    clearInterval(blinkInterval);
                    
                    // --- Actual Removal Step ---
                    for (let i = linesToRemove.length - 1; i >= 0; i--) {
                        const y = linesToRemove[i];
                        board.splice(y, 1);
                    }
                    for (let i = 0; i < linesToRemove.length; i++) {
                        board.unshift(Array(COLS).fill(0));
                    }

                    // --- Update Score & Level ---
                    score += linesToRemove.length * 100 * linesToRemove.length;
                    linesCleared += linesToRemove.length;
                    
                    const newLevel = Math.floor(linesCleared / 10);
                    if (newLevel > level) {
                        level = newLevel;
                    }
                    
                    scoreElement.textContent = score;
                    draw(); // Redraw board after removal
                    
                    updateSpeed(); // This will restart the gameLoop
                    resolve();
                }
            }, 100);
        });
    }

    function updateSpeed() {
        const newSpeed = Math.max(100, initialSpeed - level * speedIncrement);
        if (gameLoop) {
            clearInterval(gameLoop);
            gameLoop = setInterval(update, newSpeed);
        }
    }

    function startGame() {
        isPlaying = true;
        board = createEmptyBoard();
        score = 0;
        level = 0;
        linesCleared = 0;
        scoreElement.textContent = score;
        
        currentPiece = createNewPiece();
        nextPiece = createNewPiece();
        drawNextPiece();

        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(update, initialSpeed);

        startButton.textContent = "重新开始";
        document.addEventListener('keydown', handleKeyPress);
    }

    function gameOver() {
        isPlaying = false;
        clearInterval(gameLoop);

        // --- Game Over Animation ---
        // Highlight the final piece that caused the game over
        drawMatrix(currentPiece.shape, { x: currentPiece.x, y: currentPiece.y }, '#d32f2f'); // Highlight in red
        
        setTimeout(() => {
            // Dark overlay
            context.fillStyle = 'rgba(0, 0, 0, 0.75)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // "Game Over" text
            context.font = '30px "Noto Sans SC"';
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.fillText('游戏结束', canvas.width / 2, canvas.height / 2);
        }, 300); // Short delay to show the highlighted piece

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
