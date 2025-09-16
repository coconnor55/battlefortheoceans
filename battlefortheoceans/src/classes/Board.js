// src/classes/Board.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.1.16"

class Board {
  constructor(rows, cols, terrain) {
    if (!terrain || !Array.isArray(terrain) || terrain.length !== rows || terrain.some(row => !Array.isArray(row) || row.length !== cols)) {
      throw new Error('Board: Terrain array must match rows x cols dimensions');
    }
    
    this.rows = rows;
    this.cols = cols;
    
    // Create grid with individual cell objects (not shared references)
    this.grid = Array(rows).fill().map(() =>
      Array(cols).fill().map(() => ({
        terrain: null,
        ship: null,        // Reference to Ship object (not ship state)
        owner: null,       // 'player' or 'opponent' (who placed ship here)
        shotResult: null   // 'hit', 'miss', null (last shot result at this cell)
      }))
    );
    
    // Set terrain for each cell individually
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.grid[row][col].terrain = terrain[row][col];
      }
    }
    
    console.log('Board: Created board', { rows, cols, gridCreated: true });
  }

  /**
   * Place a ship on the board
   */
  placeShip(ship, owner) {
    if (!ship || !ship.cells || !ship.isPlaced) {
      console.warn('Board: Cannot place unplaced ship', { ship: ship?.name });
      return false;
    }

    // Validate placement
    if (!this.canPlaceShip(ship)) {
      console.warn('Board: Invalid ship placement', { ship: ship.name, cells: ship.cells });
      return false;
    }

    // Place ship references on board
    ship.cells.forEach(({ row, col }) => {
      this.grid[row][col].ship = ship;
      this.grid[row][col].owner = owner;
      console.log(`Board: Placed ${ship.name} at ${String.fromCharCode(65 + col)}${row + 1}`);
    });

    console.log('Board: Ship placed successfully', { ship: ship.name, cellCount: ship.cells.length, owner });
    return true;
  }

  /**
   * Check if a ship can be placed on the board
   */
  canPlaceShip(ship) {
    if (!ship.cells || !Array.isArray(ship.cells) || ship.cells.length === 0) {
      console.warn('Board: Ship has no cells defined', { ship: ship.name });
      return false;
    }
    
    return ship.cells.every(({ row, col }) => {
      // Check bounds
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
        console.warn('Board: Ship placement out of bounds', { row, col, ship: ship.name });
        return false;
      }
      
      const cell = this.grid[row][col];
      
      // Check terrain exclusions
      if (cell.terrain === 'excluded') {
        console.warn('Board: Ship placement on excluded terrain', { row, col, ship: ship.name });
        return false;
      }
      
      // Check terrain compatibility
      if (!ship.terrain.includes(cell.terrain)) {
        console.warn('Board: Ship terrain restriction violated', {
          row, col,
          shipTerrain: ship.terrain,
          cellTerrain: cell.terrain,
          ship: ship.name
        });
        return false;
      }
      
      // Check if cell is already occupied
      if (cell.ship !== null) {
        console.warn('Board: Cell already occupied', {
          row, col,
          occupiedBy: cell.ship.name,
          attemptedBy: ship.name
        });
        return false;
      }
      
      return true;
    });
  }

  /**
   * Process an attack at specific coordinates
   */
  receiveAttack(row, col, attacker = 'unknown') {
    // Validate coordinates
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      console.warn('Board: Attack coordinates out of bounds', { row, col });
      return 'invalid';
    }

    const cell = this.grid[row][col];
    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;

    // Check for excluded terrain
    if (cell.terrain === 'excluded') {
      console.warn('Board: Attack on excluded terrain', { row, col });
      return 'invalid';
    }

    // Check if there's a ship at this location
    if (cell.ship === null) {
      // Miss
      cell.shotResult = 'miss';
      console.log(`Board: Miss at ${cellName} by ${attacker}`);
      return 'miss';
    }

    // There's a ship here - delegate to the ship for hit processing
    const ship = cell.ship;
    const hitResult = ship.hit(row, col);
    
    if (!hitResult) {
      // Cell already hit
      console.log(`Board: Already hit ${cellName} (${ship.name}) by ${attacker}`);
      return 'already-hit';
    }

    // Successful hit
    cell.shotResult = 'hit';
    
    if (ship.isSunk()) {
      console.log(`Board: SUNK - ${ship.name} at ${cellName} by ${attacker}`);
      return 'sunk';
    } else {
      console.log(`Board: HIT - ${ship.name} at ${cellName} by ${attacker}`);
      return 'hit';
    }
  }

  /**
   * Get ship at specific coordinates
   */
  getShipAt(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return null;
    }
    return this.grid[row][col].ship;
  }

  /**
   * Check if a cell has been shot at
   */
  wasAttacked(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return false;
    }
    return this.grid[row][col].shotResult !== null;
  }

  /**
   * Get shot result at coordinates
   */
  getShotResult(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return null;
    }
    return this.grid[row][col].shotResult;
  }

  /**
   * Get all ships on the board
   */
  getAllShips() {
    const ships = new Set();
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const ship = this.grid[row][col].ship;
        if (ship) {
          ships.add(ship);
        }
      }
    }
    
    return Array.from(ships);
  }

  /**
   * Get ships by owner
   */
  getShipsByOwner(owner) {
    return this.getAllShips().filter(ship => ship.owner === owner);
  }

  /**
   * Get board state for specific player (hides opponent ships)
   */
  getPlayerView(playerId) {
    return this.grid.map(row =>
      row.map(cell => ({
        terrain: cell.terrain,
        hasOwnShip: cell.ship && cell.owner === playerId,
        hasEnemyShip: cell.ship && cell.owner !== playerId && cell.ship.isSunk(), // Only show sunk enemy ships
        shotResult: cell.shotResult,
        owner: cell.ship ? cell.owner : null
      }))
    );
  }

  /**
   * Get complete board state (debug/admin view)
   */
  getFullState() {
    return this.grid.map(row =>
      row.map(cell => ({
        terrain: cell.terrain,
        ship: cell.ship ? {
          id: cell.ship.id,
          name: cell.ship.name,
          owner: cell.ship.owner,
          hitCount: cell.ship.hitCount,
          isSunk: cell.ship.isSunk()
        } : null,
        owner: cell.owner,
        shotResult: cell.shotResult
      }))
    );
  }

  /**
   * Clear all shots (keep ships)
   */
  clearShots() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col].shotResult = null;
      }
    }
    
    // Reset ship damage
    this.getAllShips().forEach(ship => ship.reset());
  }

  /**
   * Clear everything (ships and shots)
   */
  clear() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col].ship = null;
        this.grid[row][col].owner = null;
        this.grid[row][col].shotResult = null;
      }
    }
  }

  /**
   * Legacy compatibility methods (deprecated)
   */
  getPublicState() {
    console.warn('Board.getPublicState() is deprecated, use getPlayerView()');
    return this.getPlayerView('unknown');
  }

  getCellStyle(userId) {
    console.warn('Board.getCellStyle() is deprecated, use getPlayerView()');
    return (row, col) => this.getPlayerView(userId)[row][col];
  }

  getPlayerBoard(userId) {
    console.warn('Board.getPlayerBoard() is deprecated, use getPlayerView()');
    return this.getPlayerView(userId);
  }
}

export default Board;
// EOF
