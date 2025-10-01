// src/classes/Board.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.2.4";

class Board {
  constructor(rows, cols, terrain) {
    if (!terrain || !Array.isArray(terrain) || terrain.length !== rows) {
      throw new Error('Board: Invalid terrain array');
    }
    
    this.rows = rows;
    this.cols = cols;
    this.terrain = terrain;
    
    // Spatial tracking
    this.cellContents = new Map(); // "row,col" -> [{shipId, cellIndex}]
    this.shotHistory = []; // [{row, col, player, result, timestamp}]
    
    console.log('Board: Created', { rows, cols });
  }

  isValidCoordinate(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    if (this.terrain[row][col] === 'excluded') return false;
    return true;
  }

  canPlaceShip(shipCells, shipTerrain) {
    if (!shipCells || shipCells.length === 0) return false;
    
    return shipCells.every(({ row, col }) => {
      if (!this.isValidCoordinate(row, col)) return false;
      if (!shipTerrain.includes(this.terrain[row][col])) return false;
      
      const key = `${row},${col}`;
      if (this.cellContents.has(key) && this.cellContents.get(key).length > 0) {
        return false;
      }
      
      return true;
    });
  }

  registerShipPlacement(ship, shipCells) {
    if (!this.canPlaceShip(shipCells, ship.terrain)) {
      return false;
    }

    shipCells.forEach((cell, index) => {
      const key = `${cell.row},${cell.col}`;
      
      if (!this.cellContents.has(key)) {
        this.cellContents.set(key, []);
      }
      
      this.cellContents.get(key).push({
        shipId: ship.id,
        cellIndex: index
      });
    });

    return true;
  }

  getShipDataAt(row, col) {
    const key = `${row},${col}`;
    return this.cellContents.get(key) || [];
  }
    
  getShipCells(shipId) {
    const shipCells = [];
    this.cellContents.forEach((cellData, cellKey) => {
      const [row, col] = cellKey.split(',').map(Number);
      cellData.forEach(({ shipId: cellShipId }) => {
        if (cellShipId === shipId) {
          shipCells.push({ row, col });
        }
      });
    });
    return shipCells;
  }

  isValidAttackTarget(row, col) {
    return this.isValidCoordinate(row, col);
  }

  /**
   * Record shot in history
   */
  recordShot(row, col, attacker, result) {
    this.shotHistory.push({
      row,
      col,
      attacker: attacker.id || attacker,
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
   * Clear shot history (keep ship placements)
   */
  clearShots() {
    this.shotHistory = [];
  }

  /**
   * Clear everything
   */
  clear() {
    this.cellContents.clear();
    this.shotHistory = [];
  }

  /**
   * Get board statistics
   */
  getStats() {
    return {
      dimensions: { rows: this.rows, cols: this.cols },
      totalCells: this.rows * this.cols,
      occupiedCells: this.cellContents.size,
      totalShots: this.shotHistory.length
    };
  }

  getPlayerView(playerId, playerFleets, shipOwnership) {
    const view = Array(this.rows).fill().map(() => Array(this.cols).fill().map(() => ({
      terrain: null,
      hasOwnShip: false,
      hasEnemyShip: false,
      shotResult: null,
      cellData: []
    })));

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        view[row][col].terrain = this.terrain[row][col];
      }
    }

    this.cellContents.forEach((cellData, key) => {
      const [row, col] = key.split(',').map(Number);
      
      cellData.forEach(({ shipId }) => {
        const ownerId = shipOwnership.get(shipId);
        const fleet = playerFleets.get(ownerId);
        const ship = fleet?.ships.find(s => s.id === shipId);
        
        if (ship) {
          if (ownerId === playerId) {
            view[row][col].hasOwnShip = true;
          } else if (ship.isSunk()) {
            view[row][col].hasEnemyShip = true;
          }
        }
      });
      
      const lastShot = this.getLastShotResult(row, col);
      if (lastShot) {
        view[row][col].shotResult = lastShot;
      }
    });

    return view;
  }

  getRandomValidCell() {
    const validCells = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.isValidCoordinate(row, col)) {
          validCells.push({ row, col });
        }
      }
    }
    
    if (validCells.length === 0) return null;
    return validCells[Math.floor(Math.random() * validCells.length)];
  }

  getRandomEmptyCell() {
    const emptyCells = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.isValidCoordinate(row, col)) {
          const key = `${row},${col}`;
          if (!this.cellContents.has(key) || this.cellContents.get(key).length === 0) {
            emptyCells.push({ row, col });
          }
        }
      }
    }
    
    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
}

export default Board;
// EOF
