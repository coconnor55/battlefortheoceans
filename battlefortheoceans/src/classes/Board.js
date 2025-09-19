// src/classes/Board.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.1.19";

class Board {
  constructor(rows, cols, terrain) {
    if (!terrain || !Array.isArray(terrain) || terrain.length !== rows || terrain.some(row => !Array.isArray(row) || row.length !== cols)) {
      throw new Error('Board: Terrain array must match rows x cols dimensions');
    }
    
    this.rows = rows;
    this.cols = cols;
    this.terrain = terrain;
    
    // Spatial tracking for board queries
    this.cellContents = new Map(); // "row,col" -> [{shipId, cellIndex}]
    this.shotHistory = []; // [{row, col, player, result, timestamp}]
    
    console.log('Board: Created board', { rows, cols, architecture: 'spatial-logic' });
  }

  /**
   * Validate coordinates are within board bounds
   */
  isValidCoordinate(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  /**
   * Check if terrain at coordinates is excluded
   */
  isExcludedTerrain(row, col) {
    if (!this.isValidCoordinate(row, col)) return true;
    return this.terrain[row][col] === 'excluded';
  }

  /**
   * Get terrain type at coordinates
   */
  getTerrainAt(row, col) {
    if (!this.isValidCoordinate(row, col)) return null;
    return this.terrain[row][col];
  }

  /**
   * Check if a ship can be placed (bounds and terrain only)
   * FIXED: Now accepts position data as parameters instead of reading from ship
   */
  canPlaceShip(shipCells, shipTerrain) {
    if (!shipCells || !Array.isArray(shipCells) || shipCells.length === 0) {
      console.warn('Board: No ship cells provided for placement validation');
      return false;
    }
    
    return shipCells.every(({ row, col }) => {
      // Check bounds
      if (!this.isValidCoordinate(row, col)) {
        console.warn('Board: Ship placement out of bounds', { row, col });
        return false;
      }
      
      // Check terrain exclusions
      if (this.isExcludedTerrain(row, col)) {
        console.warn('Board: Ship placement on excluded terrain', { row, col });
        return false;
      }
      
      // Check terrain compatibility
      if (!shipTerrain.includes(this.terrain[row][col])) {
        console.warn('Board: Ship terrain restriction violated', {
          row, col,
          shipTerrain: shipTerrain,
          cellTerrain: this.terrain[row][col]
        });
        return false;
      }
      
      return true;
    });
  }

  /**
   * Register ship placement for spatial queries (called by GameContext)
   * FIXED: Now accepts position data as parameters instead of reading from ship
   */
  registerShipPlacement(ship, shipCells) {
    console.log(`[Board] Registering ship placement: ${ship.name}`);
    
    // Validate placement first using provided position data
    if (!this.canPlaceShip(shipCells, ship.terrain)) {
      console.warn('Board: Invalid ship placement during registration', { ship: ship.name });
      return false;
    }

    // Register ship cells in spatial mapping using provided position data
    shipCells.forEach((cell, index) => {
      const key = `${cell.row},${cell.col}`;
      
      if (!this.cellContents.has(key)) {
        this.cellContents.set(key, []);
      }
      
      this.cellContents.get(key).push({
        shipId: ship.id,
        cellIndex: index
      });
      
      console.log(`Board: Registered ${ship.name} at ${String.fromCharCode(65 + cell.col)}${cell.row + 1}`);
    });

    console.log('Board: Ship placement registered', { ship: ship.name, cellCount: shipCells.length });
    return true;
  }

  /**
   * Get ship data at specific coordinates (for Game hit resolution)
   */
  getShipDataAt(row, col) {
    if (!this.isValidCoordinate(row, col) || this.isExcludedTerrain(row, col)) {
      return [];
    }

    const key = `${row},${col}`;
    return this.cellContents.get(key) || [];
  }

  /**
   * Check if coordinates are valid for attack
   */
  isValidAttackTarget(row, col) {
    return this.isValidCoordinate(row, col) && !this.isExcludedTerrain(row, col);
  }

  /**
   * Record shot in history (called by Game after hit resolution)
   */
  recordShot(row, col, attacker, result) {
    this.shotHistory.push({
      row,
      col,
      attacker: attacker.name || attacker,
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Get shot history for coordinates
   */
  getShotHistory(row, col) {
    return this.shotHistory.filter(shot => shot.row === row && shot.col === col);
  }

  /**
   * Check if coordinates have been attacked
   */
  wasAttacked(row, col) {
    return this.shotHistory.some(shot => shot.row === row && shot.col === col);
  }

  /**
   * Get most recent shot result at coordinates
   */
  getLastShotResult(row, col) {
    const shots = this.getShotHistory(row, col);
    return shots.length > 0 ? shots[shots.length - 1].result : null;
  }

  /**
   * Get player view of the board (for UI rendering)
   */
  getPlayerView(playerId, playerFleets, shipOwnership) {
    const view = Array(this.rows).fill().map(() => Array(this.cols).fill().map(() => ({
      terrain: null,
      hasOwnShip: false,
      hasEnemyShip: false,
      shotResult: null,
      cellData: []
    })));

    // Set terrain
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        view[row][col].terrain = this.terrain[row][col];
      }
    }

    // Add ship and shot information
    this.cellContents.forEach((cellData, key) => {
      const [row, col] = key.split(',').map(Number);
      
      // Check ship ownership
      cellData.forEach(({ shipId }) => {
        const ownerId = shipOwnership.get(shipId);
        const fleet = playerFleets.get(ownerId);
        const ship = fleet?.ships.find(s => s.id === shipId);
        
        if (ship) {
          if (ownerId === playerId) {
            view[row][col].hasOwnShip = true;
          } else if (ship.isSunk()) {
            // Only show enemy ships if sunk
            view[row][col].hasEnemyShip = true;
          }
        }
      });
      
      // Add shot result
      const lastShot = this.getLastShotResult(row, col);
      if (lastShot) {
        view[row][col].shotResult = lastShot;
      }
    });

    return view;
  }

  /**
   * Get complete board state (admin/debug view)
   */
  getFullState(playerFleets, shipOwnership) {
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
    this.cellContents.forEach((cellData, key) => {
      const [row, col] = key.split(',').map(Number);
      
      state[row][col].ships = cellData.map(({ shipId, cellIndex }) => {
        const ownerId = shipOwnership.get(shipId);
        const fleet = playerFleets.get(ownerId);
        const ship = fleet?.ships.find(s => s.id === shipId);
        
        return ship ? {
          id: ship.id,
          name: ship.name,
          owner: ownerId,
          cellIndex: cellIndex,
          health: ship.health[cellIndex],
          isSunk: ship.isSunk()
        } : null;
      }).filter(Boolean);
      
      state[row][col].shots = this.getShotHistory(row, col);
    });

    return state;
  }

  /**
   * Clear all shot history (keep ship placements)
   */
  clearShots() {
    this.shotHistory = [];
  }

  /**
   * Clear everything including ship placements
   */
  clear() {
    this.cellContents.clear();
    this.shotHistory = [];
  }

  /**
   * Check placement restriction boundaries for large grids
   */
  checkPlacementRestriction(eraConfig, playerId) {
    if (this.rows > 10 || this.cols > 10) {
      console.log(`[Board]: Large grid detected (${this.rows}x${this.cols}). Placement restriction: ${eraConfig.game_rules?.placement_restriction || 'none'}`);
      
      if (eraConfig.game_rules?.placement_restriction) {
        const restriction = eraConfig.game_rules.placement_restriction;
        console.log(`[Board]: Player ${playerId} ships must fit within ${restriction}x${restriction} area`);
        // TODO: Implement placement area enforcement
      }
    }
  }

  /**
   * Get board statistics
   */
  getStats() {
    return {
      dimensions: { rows: this.rows, cols: this.cols },
      totalCells: this.rows * this.cols,
      occupiedCells: this.cellContents.size,
      totalShots: this.shotHistory.length,
      terrainTypes: this.getTerrainStats()
    };
  }

  /**
   * Get terrain distribution statistics
   */
  getTerrainStats() {
    const stats = {};
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const terrain = this.terrain[row][col];
        stats[terrain] = (stats[terrain] || 0) + 1;
      }
    }
    return stats;
  }
}

export default Board;

// EOF
