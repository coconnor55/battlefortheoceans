// src/classes/Ship.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.1.5"

class Ship {
  constructor(name, size, terrain, owner = null) {
    this.id = `ship-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.size = size;
    this.terrain = terrain;
    this.owner = owner; // 'player' or 'opponent' or userId
    
    // Ship placement and state
    this.cells = []; // [{row, col, isHit: false}, ...]
    this.isPlaced = false;
    this.orientation = null; // 'horizontal' or 'vertical'
    
    // Damage tracking
    this.hitCount = 0;
    this.sunkAt = null; // timestamp when ship was sunk
  }

  /**
   * Place the ship on the board with specific cells
   */
  place(cells, orientation = 'horizontal') {
    if (cells.length !== this.size) {
      throw new Error(`Ship ${this.name} requires ${this.size} cells, got ${cells.length}`);
    }
    
    this.cells = cells.map(({row, col}) => ({
      row,
      col,
      isHit: false
    }));
    
    this.isPlaced = true;
    this.orientation = orientation;
    this.hitCount = 0;
    this.sunkAt = null;
    
    console.log(`Ship ${this.name} placed at:`, this.cells.map(c => `${String.fromCharCode(65 + c.col)}${c.row + 1}`).join(', '));
  }

  /**
   * Attempt to hit this ship at specific coordinates
   */
  hit(row, col) {
    if (!this.isPlaced) {
      console.warn(`Attempted to hit unplaced ship ${this.name}`);
      return false;
    }

    const targetCell = this.cells.find(cell => cell.row === row && cell.col === col);
    
    if (!targetCell) {
      // This coordinate is not part of this ship
      return false;
    }

    if (targetCell.isHit) {
      console.warn(`Cell ${row},${col} on ship ${this.name} already hit`);
      return false;
    }

    // Apply hit
    targetCell.isHit = true;
    this.hitCount++;
    
    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    console.log(`Ship ${this.name} hit at ${cellName} (${this.hitCount}/${this.size})`);

    // Check if ship is now sunk
    if (this.isSunk() && !this.sunkAt) {
      this.sunkAt = Date.now();
      console.log(`Ship ${this.name} SUNK!`);
    }

    return true;
  }

  /**
   * Check if this ship is completely sunk
   */
  isSunk() {
    return this.isPlaced && this.hitCount >= this.size;
  }

  /**
   * Get all cells that have been hit
   */
  getHitCells() {
    return this.cells.filter(cell => cell.isHit);
  }

  /**
   * Get all cells that haven't been hit
   */
  getIntactCells() {
    return this.cells.filter(cell => !cell.isHit);
  }

  /**
   * Check if this ship occupies a specific coordinate
   */
  occupiesCell(row, col) {
    return this.cells.some(cell => cell.row === row && cell.col === col);
  }

  /**
   * Get damage percentage (0-1)
   */
  getDamageRatio() {
    return this.isPlaced ? this.hitCount / this.size : 0;
  }

  /**
   * Reset ship to unplaced, undamaged state
   */
  reset() {
    this.cells = [];
    this.isPlaced = false;
    this.orientation = null;
    this.hitCount = 0;
    this.sunkAt = null;
  }

  /**
   * Get ship status for debugging
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      size: this.size,
      owner: this.owner,
      isPlaced: this.isPlaced,
      hitCount: this.hitCount,
      isSunk: this.isSunk(),
      cells: this.cells.map(cell => ({
        position: `${String.fromCharCode(65 + cell.col)}${cell.row + 1}`,
        isHit: cell.isHit
      }))
    };
  }

  /**
   * Validate ship placement against terrain requirements
   */
  canPlaceOnTerrain(boardCells) {
    return this.cells.every(({row, col}) => {
      const boardCell = boardCells[row]?.[col];
      return boardCell &&
             boardCell.terrain !== 'excluded' &&
             this.terrain.includes(boardCell.terrain);
    });
  }

  /**
   * Create ship from config object
   */
  static fromConfig(config, owner = null) {
    return new Ship(config.name, config.size, config.terrain, owner);
  }

  /**
   * Legacy compatibility methods (to be removed after full refactor)
   */
  resetDamage() {
    console.warn('Ship.resetDamage() is deprecated, use Ship.reset()');
    this.reset();
  }

  getDamage() {
    console.warn('Ship.getDamage() is deprecated, use Ship.hitCount');
    return this.hitCount;
  }
}

export default Ship;
// EOF
