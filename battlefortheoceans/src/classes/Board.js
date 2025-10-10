// src/classes/Board.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.0: Phase 4 Refactor - COMPLETE CLEANUP
//         Removed cellContents (replaced by player.shipPlacements)
//         Removed cellHealthCache (computed from player.fleet on demand)
//         Removed registerShipPlacement, getShipDataAt, getShipCells, updateCellHealthCache, rebuildCellHealthCache
//         Board now ONLY handles: dimensions, terrain, excluded cells, and coordinate validation
//         Board is now a pure geometric/terrain data structure with no game state

const version = "v0.4.0";

class Board {
  constructor(rows, cols, terrain) {
    if (!terrain || !Array.isArray(terrain) || terrain.length !== rows) {
      throw new Error('Board: Invalid terrain array');
    }
    
    this.rows = rows;
    this.cols = cols;
    this.terrain = terrain;
    
    console.log('Board: Created', { rows, cols });
  }

  /**
   * Check if coordinates are valid (within bounds and not excluded)
   */
  isValidCoordinate(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    if (this.terrain[row][col] === 'excluded') return false;
    return true;
  }

  /**
   * Check if a ship can be placed at the given cells
   * Validates bounds and terrain compatibility only
   * Note: Overlap checking is now done by Game.registerShipPlacement() using player.shipPlacements
   */
  canPlaceShip(shipCells, shipTerrain) {
    if (!shipCells || shipCells.length === 0) return false;
    
    return shipCells.every(({ row, col }) => {
      // Check bounds
      if (!this.isValidCoordinate(row, col)) return false;
      
      // Check terrain compatibility
      if (!shipTerrain.includes(this.terrain[row][col])) return false;
      
      return true;
    });
  }

  /**
   * Check if coordinates are valid for attacking
   * (Just validates coordinates, doesn't track shots)
   */
  isValidAttackTarget(row, col) {
    return this.isValidCoordinate(row, col);
  }

  /**
   * Clear board state (for game reset)
   * Note: Board no longer stores game state, but keeping method for API compatibility
   */
  clear() {
    // Nothing to clear anymore - board only holds terrain
    console.log('Board: Cleared (no state to clear)');
  }

  /**
   * Get board statistics
   */
  getStats() {
    return {
      dimensions: { rows: this.rows, cols: this.cols },
      totalCells: this.rows * this.cols,
      version
    };
  }

  /**
   * Get a random valid cell (for AI ship placement)
   */
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

  /**
   * Get a random empty cell
   * Note: Since Board no longer tracks ship placements, caller must check player.shipPlacements
   * This now just returns a random valid cell
   */
  getRandomEmptyCell() {
    return this.getRandomValidCell();
  }
}

export default Board;
// EOF
