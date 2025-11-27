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
    const gameSpeed = 500; // a fixed speed for now

    // Tetrominoes and their colors, updated for better aesthetics
    const PIECES = [
        { shape: [[1, 1, 1, 1]], color: '#f08080' }, // I (Light Coral)
        { shape: [[1, 1, 0], [0, 1, 1]], color: '#f4a460' }, // Z (Sandy Brown)
        { shape: [[0, 1, 1], [1, 1, 0]], color: '#98fb98' }, // S (Pale Green)
        { shape: [[1, 1, 1], [0, 1, 0]], color: '#dda0dd' }, // T (Plum)
        { shape: [[1, 1], [1, 1]], color: '#add8e6' }, // O (Light Blue)
        { shape: [[1, 0, 0], [1, 1, 1]], color: '#fafad2' }, // L (Light Goldenrod Yellow)
        { shape: [[0, 0, 1], [1, 1, 1]], color: '#d3d3d3' }  // J (Light Gray)
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
        // Clear board with the new background color from CSS
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw placed pieces
        drawBoard();
        // Draw current falling piece
        if (currentPiece) {
            drawPiece(currentPiece);
        }
    }
    
    function drawBlock(x, y, color) {
        context.fillStyle = color;
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

        // Adding a subtle inner shadow and highlight for a "jelly" effect
        context.fillStyle = 'rgba(255, 255, 255, 0.2)';
        context.fillRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
        
        context.fillStyle = 'rgba(0, 0, 0, 0.1)';
        context.fillRect(x * BLOCK_SIZE + 4, y * BLOCK_SIZE + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);
    }
    
    function drawBoard() {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (board[y][x] !== 0) {
                    const color = PIECES[board[y][x] - 1].color;
                    drawBlock(x, y, color);
                }
            }
        }
    }

    function drawPiece(piece) {
        const { shape, color, x, y } = piece;
        shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value !== 0) {
                    drawBlock(x + c, y + r, color);
                }
            });
        });
    }

    function drawNextPiece() {
        nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        const blockSize = nextCanvas.width / NEXT_PIECE_CANVAS_SIZE;
        const { shape, color } = nextPiece;
        
        const offsetX = (NEXT_PIECE_CANVAS_SIZE - shape[0].length) / 2;
        const offsetY = (NEXT_PIECE_CANVAS_SIZE - shape.length) / 2;

        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    // Using a simplified draw for next piece
                    nextContext.fillStyle = color;
                    nextContext.fillRect(
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
    
    // NEW: The core mechanic!
    async function onPieceLock() {
        // 1. Decomposition: Convert piece to grid data
        const { shape, x, y, color } = currentPiece;
        const pieceIndex = PIECES.findIndex(p => p.color === color) + 1;
        let affectedColumns = new Set();
        
        shape.forEach((row, r) => {
            row.forEach((value, c) => {
                if (value !== 0) {
                    if (y + r >= 0) { // Make sure we're not writing above the board
                        board[y + r][x + c] = pieceIndex;
                        affectedColumns.add(x + c);
                    }
                }
            });
        });

        // 2. Individual Gravity Settle & Animation
        await applyGravity(Array.from(affectedColumns));
        
        // 3. Line Clear Check (with global gravity)
        await removeCompletedLines();
        
        // 4. Spawn new piece
        currentPiece = nextPiece;
        nextPiece = createNewPiece();
        drawNextPiece();

        // 5. Check for game over
        if (checkCollision(currentPiece)) {
            gameOver();
        }
    }

    // NEW: Gravity algorithm
    async function applyGravity(columns) {
        let hasChanges = false;
        for (const x of columns) {
            let writePointer = ROWS - 1;
            for (let readPointer = ROWS - 1; readPointer >= 0; readPointer--) {
                if (board[readPointer][x] !== 0) {
                    if (writePointer !== readPointer) {
                        board[writePointer][x] = board[readPointer][x];
                        board[readPointer][x] = 0;
                        hasChanges = true;
                    }
                    writePointer--;
                }
            }
        }
        
        // Visual feedback for settling
        if (hasChanges) {
            draw();
            // a short pause to make the effect visible
            await new Promise(res => setTimeout(res, 80)); 
        }
    }

    function movePiece(dx, dy) {
        if (!isPlaying) return;
        currentPiece.x += dx;
        currentPiece.y += dy;

        if (checkCollision(currentPiece)) {
            currentPiece.x -= dx;
            currentPiece.y -= dy;
            
            if (dy > 0) { // Piece has landed
                onPieceLock();
            }
        }
    }

    function rotatePiece() {
        if (!isPlaying) return;
        const originalShape = currentPiece.shape;
        const newShape = originalShape[0].map((_, colIndex) => 
            originalShape.map(row => row[colIndex]).reverse()
        );
        
        const originalX = currentPiece.x;
        currentPiece.shape = newShape;

        // Wall kick logic
        let offset = 1;
        while (checkCollision(currentPiece)) {
            currentPiece.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > newShape[0].length + 1) { // Allow more flexible kicks
                currentPiece.shape = originalShape;
                currentPiece.x = originalX;
                return;
            }
        }
    }
    
    function checkCollision(piece) {
        const { shape, x, y } = piece;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] !== 0) {
                    const newX = x + c;
                    const newY = y + r;
                    if (newX < 0 || newX >= COLS || newY >= ROWS || (board[newY] && board[newY][newX] !== 0)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    // UPDATED: Line removal with Global Gravity
    async function removeCompletedLines() {
        let linesToRemove = [];
        for (let y = 0; y < ROWS; y++) {
            if (board[y].every(value => value !== 0)) {
                linesToRemove.push(y);
            }
        }

        if (linesToRemove.length > 0) {
            // Remove the lines
            linesToRemove.forEach(y => {
                board.splice(y, 1);
                board.unshift(Array(COLS).fill(0));
            });

            // Update score
            score += linesToRemove.length * 100 * linesToRemove.length;
            scoreElement.textContent = score;

            // Apply GLOBAL gravity
            const allColumns = Array.from({length: COLS}, (_, i) => i);
            await applyGravity(allColumns);
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
        gameLoop = setInterval(update, gameSpeed);

        startButton.textContent = "重新开始";
        document.addEventListener('keydown', handleKeyPress);
    }

    function gameOver() {
        isPlaying = false;
        clearInterval(gameLoop);

        context.fillStyle = 'rgba(0, 0, 0, 0.75)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 30px var(--font-family)';
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
                score += 1; // Bonus for soft drop
                scoreElement.textContent = score;
                break;
            case 'ArrowUp':
                rotatePiece();
                break;
            case ' ': // Space for hard drop (optional but good UX)
                while(!checkCollision({...currentPiece, y: currentPiece.y + 1})) {
                    currentPiece.y++;
                    score += 2; // Bonus for hard drop
                }
                scoreElement.textContent = score;
                onPieceLock();
                break;
        }
        draw(); // Redraw immediately after input
    }
    
    startButton.addEventListener('click', startGame);
    
    // Initial draw to show the canvas before starting
    draw();
});
