// src/classes/Board.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.1.17";

class Board {
  constructor(rows, cols, terrain) {
    if (!terrain || !Array.isArray(terrain) || terrain.length !== rows || terrain.some(row => !Array.isArray(row) || row.length !== cols)) {
      throw new Error('Board: Terrain array must match rows x cols dimensions');
    }
    
    this.rows = rows;
    this.cols = cols;
    this.terrain = terrain;
    
    // Ship-based architecture with sparse grid index
    this.ships = new Map(); // shipId -> ship object
    this.hitIndex = new Map(); // "row,col" -> {ships: [shipIds], shots: [{player, result}]}
    this.shotHistory = []; // [{row, col, player, result, timestamp}]
    
    console.log('Board: Created board', { rows, cols, architecture: 'ship-based-sparse' });
  }

  /**
   * Place a ship on the board using ship-based storage
   */
  placeShip(ship, owner) {
    if (!ship || !ship.cells || !ship.isPlaced) {
      console.warn('Board: Cannot place unplaced ship', { ship: ship?.name });
      return false;
    }

    // Validate placement (bounds and terrain only, no collision check)
    if (!this.canPlaceShip(ship)) {
      console.warn('Board: Invalid ship placement', { ship: ship.name, cells: ship.cells });
      return false;
    }

    // Store ship in ship map
    this.ships.set(ship.id, { ship, owner });

    // Update sparse hit index
    ship.cells.forEach(({ row, col }) => {
      const key = `${row},${col}`;
      if (!this.hitIndex.has(key)) {
        this.hitIndex.set(key, { ships: [], shots: [] });
      }
      this.hitIndex.get(key).ships.push(ship.id);
      console.log(`Board: Placed ${ship.name} at ${String.fromCharCode(65 + col)}${row + 1}`);
    });

    console.log('Board: Ship placed successfully', { ship: ship.name, cellCount: ship.cells.length, owner });
    return true;
  }

  /**
   * Check if a ship can be placed (bounds and terrain only)
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
      
      // Check terrain exclusions
      if (this.terrain[row][col] === 'excluded') {
        console.warn('Board: Ship placement on excluded terrain', { row, col, ship: ship.name });
        return false;
      }
      
      // Check terrain compatibility
      if (!ship.terrain.includes(this.terrain[row][col])) {
        console.warn('Board: Ship terrain restriction violated', {
          row, col,
          shipTerrain: ship.terrain,
          cellTerrain: this.terrain[row][col],
          ship: ship.name
        });
        return false;
      }
      
      return true;
    });
  }

  /**
   * Process attack using sparse grid lookup
   */
  receiveAttack(row, col, attacker = 'unknown') {
    // Validate coordinates
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      console.warn('Board: Attack coordinates out of bounds', { row, col });
      return { result: 'invalid', ships: [] };
    }

    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    const key = `${row},${col}`;

    // Check for excluded terrain
    if (this.terrain[row][col] === 'excluded') {
      console.warn('Board: Attack on excluded terrain', { row, col });
      return { result: 'invalid', ships: [] };
    }

    // Check sparse hit index for ships at this location
    const cellData = this.hitIndex.get(key);
    if (!cellData || cellData.ships.length === 0) {
      // Miss - no ships at this location
      if (!cellData) {
        this.hitIndex.set(key, { ships: [], shots: [] });
      }
      this.hitIndex.get(key).shots.push({ attacker, result: 'miss', timestamp: Date.now() });
      this.shotHistory.push({ row, col, attacker, result: 'miss', timestamp: Date.now() });
      
      console.log(`Board: Miss at ${cellName} by ${attacker}`);
      return { result: 'miss', ships: [] };
    }

    // Hit - process all ships at this location
    const hitResults = [];
    let anyNewHits = false;

    cellData.ships.forEach(shipId => {
      const shipData = this.ships.get(shipId);
      if (!shipData) return;

      const ship = shipData.ship;
      const hitResult = ship.hit(row, col);
      
      if (hitResult) {
        anyNewHits = true;
        const result = ship.isSunk() ? 'sunk' : 'hit';
        hitResults.push({ ship, result, owner: shipData.owner });
        
        if (ship.isSunk()) {
          console.log(`Board: SUNK - ${ship.name} at ${cellName} by ${attacker}`);
        } else {
          console.log(`Board: HIT - ${ship.name} at ${cellName} by ${attacker}`);
        }
      }
    });

    if (!anyNewHits) {
      // All ships at this location already hit at this cell
      console.log(`Board: Already hit ${cellName} by ${attacker}`);
      return { result: 'already-hit', ships: hitResults };
    }

    // Record the successful hit
    const overallResult = hitResults.some(r => r.result === 'sunk') ? 'sunk' : 'hit';
    cellData.shots.push({ attacker, result: overallResult, timestamp: Date.now() });
    this.shotHistory.push({ row, col, attacker, result: overallResult, ships: hitResults.length, timestamp: Date.now() });

    return { result: overallResult, ships: hitResults };
  }

  /**
   * Get all ships at specific coordinates
   */
  getShipsAt(row, col) {
    const key = `${row},${col}`;
    const cellData = this.hitIndex.get(key);
    
    if (!cellData) return [];
    
    return cellData.ships.map(shipId => {
      const shipData = this.ships.get(shipId);
      return shipData ? { ship: shipData.ship, owner: shipData.owner } : null;
    }).filter(Boolean);
  }

  /**
   * Check if a cell has been attacked
   */
  wasAttacked(row, col) {
    const key = `${row},${col}`;
    const cellData = this.hitIndex.get(key);
    return cellData ? cellData.shots.length > 0 : false;
  }

  /**
   * Get shot result at coordinates
   */
  getShotResult(row, col) {
    const key = `${row},${col}`;
    const cellData = this.hitIndex.get(key);
    
    if (!cellData || cellData.shots.length === 0) return null;
    
    // Return most recent shot result
    return cellData.shots[cellData.shots.length - 1].result;
  }

  /**
   * Get all ships on the board
   */
  getAllShips() {
    return Array.from(this.ships.values()).map(data => data.ship);
  }

  /**
   * Get ships by owner
   */
  getShipsByOwner(owner) {
    return Array.from(this.ships.values())
      .filter(data => data.owner === owner)
      .map(data => data.ship);
  }

  /**
   * Get player view (hides opponent ships unless sunk)
   */
  getPlayerView(playerId) {
    const view = Array(this.rows).fill().map(() => Array(this.cols).fill().map(() => ({
      terrain: null,
      hasOwnShip: false,
      hasEnemyShip: false,
      shotResult: null,
      ships: []
    })));

    // Set terrain
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        view[row][col].terrain = this.terrain[row][col];
      }
    }

    // Add ship and shot information
    this.hitIndex.forEach((cellData, key) => {
      const [row, col] = key.split(',').map(Number);
      
      // Add own ships
      const ownShips = cellData.ships.filter(shipId => {
        const shipData = this.ships.get(shipId);
        return shipData && shipData.owner === playerId;
      });
      view[row][col].hasOwnShip = ownShips.length > 0;
      
      // Add sunk enemy ships only
      const sunkEnemyShips = cellData.ships.filter(shipId => {
        const shipData = this.ships.get(shipId);
        return shipData && shipData.owner !== playerId && shipData.ship.isSunk();
      });
      view[row][col].hasEnemyShip = sunkEnemyShips.length > 0;
      
      // Add shot result
      if (cellData.shots.length > 0) {
        view[row][col].shotResult = cellData.shots[cellData.shots.length - 1].result;
      }
    });

    return view;
  }

  /**
   * Get complete board state (debug/admin view)
   */
  getFullState() {
    const state = Array(this.rows).fill().map(() => Array(this.cols).fill().map(() => ({
      terrain: null,
      ships: [],
      shots: []
    })));

    // Set terrain
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        state[row][col].terrain = this.terrain[row][col];
      }
    }

    // Add ship and shot data
    this.hitIndex.forEach((cellData, key) => {
      const [row, col] = key.split(',').map(Number);
      
      state[row][col].ships = cellData.ships.map(shipId => {
        const shipData = this.ships.get(shipId);
        return shipData ? {
          id: shipData.ship.id,
          name: shipData.ship.name,
          owner: shipData.owner,
          hitCount: shipData.ship.hitCount,
          isSunk: shipData.ship.isSunk()
        } : null;
      }).filter(Boolean);
      
      state[row][col].shots = cellData.shots;
    });

    return state;
  }

  /**
   * Clear all shots (keep ships)
   */
  clearShots() {
    this.shotHistory = [];
    
    // Reset shots in hit index
    this.hitIndex.forEach(cellData => {
      cellData.shots = [];
    });
    
    // Reset ship damage
    this.getAllShips().forEach(ship => ship.reset());
  }

  /**
   * Clear everything
   */
  clear() {
    this.ships.clear();
    this.hitIndex.clear();
    this.shotHistory = [];
  }

  /**
   * Debug print for placement restrictions
   */
  debugPrint(message) {
    console.log(`[DEBUG Board v${version}]: ${message}`);
  }

  /**
   * Check placement restriction boundaries for large grids
   */
  checkPlacementRestriction(eraConfig, playerId) {
    if (this.rows > 10 || this.cols > 10) {
      this.debugPrint(`Large grid detected (${this.rows}x${this.cols}). Placement restriction: ${eraConfig.game_rules?.placement_restriction || 'none'}`);
      
      if (eraConfig.game_rules?.placement_restriction) {
        const restriction = eraConfig.game_rules.placement_restriction;
        this.debugPrint(`Player ${playerId} ships must fit within ${restriction}x${restriction} area`);
        // TODO: Implement placement area enforcement
      }
    }
  }
}

export default Board;

// EOF
