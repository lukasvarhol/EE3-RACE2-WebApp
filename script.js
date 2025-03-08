let mazeContainer = document.querySelector(".maze-container");
let svgNS = "http://www.w3.org/2000/svg";

let current;
let previous; // Add a variable to keep track of the previous tile
let barcodeSVG; // Variable to store the barcode SVG
let continueGeneration = true; // Flag to control maze generation

class Maze {
    constructor(rows, columns) {
        this.rows = rows;
        this.columns = columns;
        this.cellSize = this.calculateCellSize(); // Calculate cell size based on window width
        this.grid = [];
        this.stack = [];
        this.svg = document.createElementNS(svgNS, "svg");
        this.updateSvgSize();
        this.svg.setAttribute("viewBox", `0 0 ${this.columns * this.cellSize} ${this.rows * this.cellSize}`);
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        mazeContainer.innerHTML = "";

        // Define the clipping path
        const clipPath = document.createElementNS(svgNS, "clipPath");
        clipPath.setAttribute("id", "clip");
        this.rect = document.createElementNS(svgNS, "rect");
        this.updateClipRectSize();
        clipPath.appendChild(this.rect);
        this.svg.appendChild(clipPath);

        // Apply the clipping path to the SVG
        this.svg.setAttribute("clip-path", "url(#clip)");

        mazeContainer.appendChild(this.svg);

        // Create groups for the floor tiles, wall tiles, and barcode tiles
        this.floorGroup = document.createElementNS(svgNS, "g");
        this.floorGroup.setAttribute("class", "floor-group");
        this.svg.appendChild(this.floorGroup);

        this.barcodeGroup = document.createElementNS(svgNS, "g");
        this.barcodeGroup.setAttribute("class", "barcode-group");
        this.svg.appendChild(this.barcodeGroup);

        this.wallGroup = document.createElementNS(svgNS, "g");
        this.wallGroup.setAttribute("class", "wall-group");
        this.svg.appendChild(this.wallGroup);

        // Load the sprite sheet
        fetch('images/sprite-sheet.svg').then(response => response.text()).then(spriteSheetData => {
            const div = document.createElement('div');
            div.style.display = "none";
            div.innerHTML = spriteSheetData;
            document.body.appendChild(div);

            this.setup();
            this.draw();
        });

    }

    updateClipRectSize() {
        this.rect.setAttribute("width", (this.columns * this.cellSize + 4));
        this.rect.setAttribute("height", (this.rows * this.cellSize + 4));
    }

    updateSvgSize() {
        // Update the SVG size based on the calculated cell size
        this.svg.setAttribute("width", this.columns * this.cellSize);
        this.svg.setAttribute("height", this.rows * this.cellSize);
        this.updateClipRectSize(); // Update the clipping rectangle size
    }

    calculateCellSize() {
        // Calculate the cell size based on the window width
        const maxWidth = window.innerWidth - 250;
        const maxHeight = window.innerHeight - 50;
        const cellSize = Math.ceil(Math.min(maxWidth / this.columns, maxHeight / this.rows));
        document.documentElement.style.setProperty('--cell-size', `${cellSize}px`); // Update CSS variable
        return cellSize;
    }

    updateSvgSize() {
        // Update the SVG size based on the calculated cell size
        this.svg.setAttribute("width", this.columns * this.cellSize);
        this.svg.setAttribute("height", this.rows * this.cellSize);
    }

    setup() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            let row = [];
            for (let c = 0; c < this.columns; c++) {
                let cell = new Cell(r, c, this.grid, this.cellSize, this.floorGroup, this.wallGroup, this.barcodeGroup);
                row.push(cell);
                cell.showInitial(); // Show initial "Full" sprite
            }
            this.grid.push(row);
        }
        // Choose a random starting point
        this.startRow = Math.floor(Math.random() * this.rows);
        this.startCol = Math.floor(Math.random() * this.columns);
        current = this.grid[this.startRow][this.startCol];
        current.markAsStartingTile(); // Mark the starting tile
        previous = null; // Initialize the previous tile as null
        this.barcodeCount = 0; // Initialize barcode count
    }

    draw() {
        if (!continueGeneration) return; // Abort if generation is stopped

        if (previous) {
            // Assign a barcode if we haven't reached the target count and the tile is "horizontal" or "vertical"
            if ((previous.getSpriteId() === "horizontal" || previous.getSpriteId() === "vertical") && this.barcodeCount < 5 && Math.random() < 0.1) {
                previous.addBarcode();
                this.barcodeCount++;
            }

            previous.update(); // Update the previous tile
            previous.removeHighlight(); // Remove highlight from the previous tile
        }
        current.visited = true;
        current.show();
        current.highlight(); // Highlight the current tile

        let next = current.checkNeighbours();
        if (next) {
            next.visited = true;
            this.stack.push(current);
            current.removeWall(current, next);
            previous = current; // Set the previous tile
            current = next;
        } else if (this.stack.length > 0) {
            previous = current; // Set the previous tile
            current = this.stack.pop();
        } else {
            current.removeHighlight(); // Remove highlight from the last tile
            current = null; // Set current to null to remove highlight
            return;
        }

        setTimeout(() => {
            this.updateSvgSize(); // Update SVG size after drawing
            this.draw();
        }, 400 / ((this.columns) * (this.rows)) ** 0.5);
    }

    saveMaze() {
        const mazeData = {
            rows: this.rows,
            columns: this.columns,
            grid: this.grid.map(row => row.map(cell => ({
                visited: cell.visited,
                walls: cell.walls,
                barcode: cell.hasBarcode
            })))
        };
        const blob = new Blob([JSON.stringify(mazeData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'maze.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    loadMaze() {
        continueGeneration = false; // Stop the previous maze generation
        const savedMaze = localStorage.getItem('savedMaze');
        if (savedMaze) {
            const mazeData = JSON.parse(savedMaze);
            this.rows = mazeData.rows;
            this.columns = mazeData.columns;
            this.cellSize = this.calculateCellSize(); // Calculate the cell size based on the new dimensions
            this.updateSvgSize(); // Update SVG size based on the new dimensions
            this.grid = mazeData.grid.map((row, rIdx) => row.map((cellData, cIdx) => {
                const cell = new Cell(rIdx, cIdx, this.grid, this.cellSize, this.floorGroup, this.wallGroup, this.barcodeGroup);
                cell.visited = cellData.visited;
                cell.walls = cellData.walls;
                cell.hasBarcode = cellData.barcode;
                return cell;
            }));
            this.clearMaze(); // Clear the previous maze
            this.drawLoadedMaze();
        }
    }

    clearMaze() {
        this.floorGroup.innerHTML = "";
        this.wallGroup.innerHTML = "";
        this.barcodeGroup.innerHTML = "";
    }

    drawLoadedMaze() {
        this.grid.forEach(row => row.forEach(cell => {
            cell.clearTile(); // Clear the existing tiles
            cell.show(); // Show the correct sprite
            if (cell.hasBarcode) {
                cell.addBarcode(); // Add barcode if the cell has one
            }
        }));
    }
}

class Cell {
    constructor(rowNum, colNum, parentGrid, cellSize, floorGroup, wallGroup, barcodeGroup) {
        this.rowNum = rowNum;
        this.colNum = colNum;
        this.parentGrid = parentGrid;
        this.cellSize = cellSize;
        this.floorGroup = floorGroup;
        this.wallGroup = wallGroup;
        this.barcodeGroup = barcodeGroup;
        this.visited = false;
        this.walls = { top: true, right: true, bottom: true, left: true };
        this.hasBarcode = false; // Add a flag to check if the cell has a barcode
    }

    checkNeighbours() {
        let grid = this.parentGrid;
        let row = this.rowNum;
        let col = this.colNum;
        let neighbours = [];

        let top = row > 0 ? grid[row - 1][col] : undefined;
        let right = col < grid[0].length - 1 ? grid[row][col + 1] : undefined;
        let bottom = row < grid.length - 1 ? grid[row + 1][col] : undefined;
        let left = col > 0 ? grid[row][col - 1] : undefined;

        if (top && !top.visited) neighbours.push(top);
        if (right && !right.visited) neighbours.push(right);
        if (bottom && !bottom.visited) neighbours.push(bottom);
        if (left && !left.visited) neighbours.push(left);

        return neighbours.length ? neighbours[Math.floor(Math.random() * neighbours.length)] : undefined;
    }

    removeWall(cell1, cell2) {
        let x = cell1.colNum - cell2.colNum;
        if (x === 1) {
            cell1.walls.left = false;
            cell2.walls.right = false;
        } else if (x === -1) {
            cell1.walls.right = false;
            cell2.walls.left = false;
        }

        let y = cell1.rowNum - cell2.rowNum;
        if (y === 1) {
            cell1.walls.top = false;
            cell2.walls.bottom = false;
        } else if (y === -1) {
            cell1.walls.bottom = false;
            cell2.walls.top = false;
        }
    }

    showInitial() {
        let x = this.colNum * this.cellSize;
        let y = this.rowNum * this.cellSize;

        // Initial "Full" sprite
        let group = document.createElementNS(svgNS, "g");
        group.setAttribute("transform", `translate(${x}, ${y})`);

        let use = document.createElementNS(svgNS, "use");
        use.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#Full`);
        use.setAttribute("width", this.cellSize);
        use.setAttribute("height", this.cellSize);
        use.setAttribute("transform", `scale(${this.cellSize / 250})`);
        use.setAttribute("class", "tile wall-tile");

        group.appendChild(use);
        this.wallGroup.appendChild(group);
    }

    show() {
        let x = this.colNum * this.cellSize;
        let y = this.rowNum * this.cellSize;
    
        // Floor tile
        let floor = document.createElementNS(svgNS, "rect");
        floor.setAttribute("x", x);
        floor.setAttribute("y", y);
        floor.setAttribute("width", this.cellSize);
        floor.setAttribute("height", this.cellSize);
        floor.setAttribute("class", "tile floor-tile");
        this.floorGroup.appendChild(floor);
    
        // Ensure the starting tile retains its unique color
        if (this.rowNum === this.parentGrid[0][0].parentGrid.startRow && this.colNum === this.parentGrid[0][0].parentGrid.startCol) {
            floor.classList.add("starting-tile");
        }
    
        // Determine which sprite to use based on the walls
        let id = this.getSpriteId();
        this.drawWall(id, x, y);
    }
    

    update() {
        // Clear the current tile
        this.clearTile();

        // Show the tile again
        this.show();
    }

    clearTile(removeHighlight = true) {
        let x = this.colNum * this.cellSize;
        let y = this.rowNum * this.cellSize;
    
        // Clear the floor tile without removing the starting-tile class
        let floorTiles = this.floorGroup.querySelectorAll(`rect[x="${x}"][y="${y}"]`);
        floorTiles.forEach(tile => {
            if (!tile.classList.contains("starting-tile")) {
                this.floorGroup.removeChild(tile);
            }
        });
    
        // Clear the wall tile
        let wallTiles = this.wallGroup.querySelectorAll(`g[transform="translate(${x}, ${y})"]`);
        wallTiles.forEach(tile => this.wallGroup.removeChild(tile));
    
        // Clear the barcode tile
        let barcodeTiles = this.barcodeGroup.querySelectorAll(`g[transform="translate(${x}, ${y})"]`);
        barcodeTiles.forEach(tile => this.barcodeGroup.removeChild(tile));
    
        // Optionally remove highlight from the tile
        if (removeHighlight) {
            this.removeHighlight();
        }
    }

    getSpriteId() {
        let walls = this.walls;
        let id = "Full";
        if (walls.top && walls.right && walls.bottom && walls.left) id = "Full";
        else if (!walls.top && !walls.right && walls.bottom && !walls.left) id = "T-from-top";
        else if (!walls.top && !walls.right && !walls.bottom && walls.left) id = "T-from-right";
        else if (walls.top && !walls.right && !walls.bottom && !walls.left) id = "T-from-bottom";
        else if (!walls.top && walls.right && !walls.bottom && !walls.left) id = "T-from-left";
        else if (!walls.top && !walls.right && walls.bottom && walls.left) id = "bottom-left";
        else if (walls.top && !walls.right && !walls.bottom && walls.left) id = "top-left";
        else if (walls.top && walls.right && !walls.bottom && !walls.left) id = "top-right";
        else if (!walls.top && walls.right && walls.bottom && !walls.left) id = "bottom-right";
        else if (walls.top && !walls.right && walls.bottom && !walls.left) id = "horizontal";
        else if (!walls.top && walls.right && !walls.bottom && walls.left) id = "vertical";
        else if (walls.top && !walls.right && walls.bottom && walls.left) id = "dead-end-left";
        else if (walls.top && walls.right && walls.bottom && !walls.left) id = "dead-end-right";
        else if (!walls.top && walls.right && walls.bottom && walls.left) id = "dead-end-bottom";
        else if (walls.top && walls.right && !walls.bottom && walls.left) id = "dead-end-top";
        else id = "cross";
        return id;
    }

    drawWall(id, x, y) {
        let group = document.createElementNS(svgNS, "g");
        group.setAttribute("transform", `translate(${x}, ${y})`);

        let use = document.createElementNS(svgNS, "use");
        use.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${id}`);
        use.setAttribute("width", this.cellSize);
        use.setAttribute("height", this.cellSize);
        use.setAttribute("transform", `scale(${this.cellSize / 250})`);
        use.setAttribute("class", "tile wall-tile"); // Add the CSS class here

        group.appendChild(use);
        this.wallGroup.appendChild(group);

        requestAnimationFrame(() => {
            use.classList.add("visible");
        });
    }

    highlight() {
        let x = this.colNum * this.cellSize;
        let y = this.rowNum * this.cellSize;

        // Highlight the current tile
        let tiles = this.wallGroup.querySelectorAll(`g[transform="translate(${x}, ${y})"] use`);
        tiles.forEach(tile => tile.classList.add("current-tile"));
    }

    removeHighlight() {
        let x = this.colNum * this.cellSize;
        let y = this.rowNum * this.cellSize;

        // Remove highlight from the previous tile
        let tiles = this.wallGroup.querySelectorAll(`g[transform="translate(${x}, ${y})"] use`);
        tiles.forEach(tile => tile.classList.remove("current-tile"));
    }

    addBarcode() {
        if (this.hasBarcode) return; // Prevent adding a barcode if one already exists

        let x = this.colNum * this.cellSize + this.cellSize / 2;
        let y = this.rowNum * this.cellSize + this.cellSize / 2;

        // Create group for the barcode
        let group = document.createElementNS(svgNS, "g");
        group.setAttribute("transform", `translate(${x}, ${y})`);

        // Generate the barcode SVG
        const barcodeValue = Math.random().toString(2).substring(2, 10).padStart(8, '0'); // Generate a random 8-bit binary string
        let barcode = generateBarcodeSVG(barcodeValue, this.cellSize);
        
        // Check if the tile is "vertical" and rotate the barcode if necessary
        let transform = `translate(-${this.cellSize / 2}, -${this.cellSize / 2})`;
        if (this.getSpriteId() === "vertical") {
            transform += ` rotate(90, ${this.cellSize / 2}, ${this.cellSize / 2})`;
        }
        barcode.setAttribute("width", this.cellSize);
        barcode.setAttribute("height", this.cellSize);
        barcode.setAttribute("transform", transform);
        barcode.setAttribute("class", "barcode-tile");

        // Add event listener to show the pop-up with the barcode value
        barcode.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent the click event from propagating to the window
            showBarcodePopup(barcodeValue, event.clientX, event.clientY);
        });

        group.appendChild(barcode);
        this.barcodeGroup.appendChild(group); // Append to barcodeGroup

        requestAnimationFrame(() => {
            barcode.classList.add("visible");
        });

        this.hasBarcode = true; // Set the flag to true
    }


    markAsStartingTile() {
        let x = this.colNum * this.cellSize;
        let y = this.rowNum * this.cellSize;
    
        // Add a starting tile class to the floor tile
        let floorTiles = this.floorGroup.querySelectorAll(`rect[x="${x}"][y="${y}"]`);
        floorTiles.forEach(tile => {
            tile.classList.add("starting-tile");
            this.floorGroup.appendChild(tile); // Move the tile to the end to keep it on top
        });
    }
}

function generateNewMaze() {
    continueGeneration = false; // Stop the previous maze generation
    newMaze.clearMaze(); // Clear the previous maze
    continueGeneration = true; // Reset the flag to allow new maze generation
    newMaze = new Maze(6, 8); // Generate a new maze
}

let newMaze = new Maze(6, 8);

function resizeSVG() {
    const svg = document.querySelector(".maze-container svg");
    if (svg) {
        const cellSize = newMaze.calculateCellSize(); // Calculate the cell size based on the window width
        svg.setAttribute("width", cellSize * newMaze.columns);
        svg.setAttribute("height", cellSize * newMaze.rows);
        newMaze.cellSize = cellSize;

        // Update SVG size based on the new dimensions
        newMaze.updateSvgSize();

        // Redraw the maze with the updated cell size
        newMaze.grid.forEach(row => row.forEach(cell => {
            cell.clearTile(); // Clear the existing tiles
        }));

        // Show the wall and floor tiles again
        newMaze.grid.forEach(row => row.forEach(cell => {
            cell.showInitial(); // Show initial "Full" sprite
            cell.show(); // Show the correct sprite
        }));
    }
}


function generateBarcodeSVG(value, cellSize) {
    if (value.length !== 8 || !/^[01]+$/.test(value)) {
        throw new Error("The barcode value must be an 8-bit binary string.");
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", cellSize);
    svg.setAttribute("height", cellSize);
    svg.setAttribute("viewBox", "0 0 100 100");

    const barWidth = 100 / 8; // Each bar is an eighth of the total width
    for (let i = 0; i < value.length; i++) {
        const color = value[i] === '1' ? "#aaa" : 'transparent';
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("width", barWidth);
        rect.setAttribute("height", "100");
        rect.setAttribute("x", i * barWidth);
        rect.setAttribute("fill", color);
        rect.setAttribute("class", "barcode-tile"); // Add the class here
        svg.appendChild(rect);
    }

    return svg;
}

function showBarcodePopup(value, x, y) {
    // Check if a pop-up already exists and remove it
    const existingPopup = document.querySelector('.barcode-popup');
    if (existingPopup) {
        document.body.removeChild(existingPopup);
    }

    const popup = document.createElement('div');
    popup.classList.add('barcode-popup');
    popup.innerHTML = `
        <div class="barcode-popup-content">
            <p>${value}</p>
        </div>
    `;
    document.body.appendChild(popup);

    // Adjust the position to ensure the popup is within the screen bounds
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let popupX = x;
    let popupY = y - popupHeight - 10;

    if (popupX + popupWidth > screenWidth) {
        popupX = screenWidth - popupWidth - 10;
    }
    if (popupX < 10) {
        popupX = 10;
    }
    if (popupY < 10) {
        popupY = y + 10;
    }

    popup.style.left = `${popupX}px`;
    popup.style.top = `${popupY}px`;

    // Close the pop-up when clicking outside of the popup
    window.addEventListener('click', (event) => {
        if (!popup.contains(event.target)) {
            document.body.removeChild(popup);
        }
    }, { once: true }); // Ensure the event listener is only triggered once
}
// Resize on load and when the window resizes
window.addEventListener("load", resizeSVG);

// Listen to resize events to handle zoom changes
window.addEventListener("resize", resizeSVG);

// Listen to zoom events to handle zoom changes
window.addEventListener("zoom", resizeSVG);