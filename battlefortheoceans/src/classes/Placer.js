// src/classes/Placer.js (v0.1.6 - FIXED)
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED: Do not modify without confirmation

import Ship from './Ship';

class Placer {
  constructor(board, fleetConfig, userId) {
    this.board = board;
    this.userId = userId;
    
    // fleetConfig should be an array of ship configurations
    if (!Array.isArray(fleetConfig)) {
      throw new Error('Placer: fleetConfig must be an array of ship configurations');
    }
    
    this.fleet = fleetConfig.map(cfg => new Ship(cfg.name, cfg.size, cfg.terrain));
    this.currentShip = null;
    this.placedShips = [];
  }

  getCurrentShip() {
    return this.currentShip || this.fleet.find(ship => !this.placedShips.includes(ship));
  }

  startPlacement(row, col) {
    const ship = this.getCurrentShip();
    if (!ship) return false;
    this.currentShip = ship;
    this.currentShip.cells = []; // Clear any existing cells
    this.currentShip.start = { row, col };
    console.log('v0.1.6', 'Placement started', { row, col, ship: ship.name });
    return true;
  }

  // This method is now primarily for validation - PlacerRenderer handles the actual cell calculation
  swipe(row, col, direction) {
    if (!this.currentShip || !this.currentShip.start) return false;
    
    const startRow = this.currentShip.start.row;
    const startCol = this.currentShip.start.col;
    
    // Direction calculation based on swipe
    const dr = direction === 'horizontal' ? 0 : 1;
    const dc = direction === 'horizontal' ? 1 : 0;
    const cells = [];
    
    for (let i = 0; i < this.currentShip.size; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      cells.push({ row: r, col: c });
    }
    
    // Validate all cells are in bounds
    if (!cells.every(cell =>
      cell.row >= 0 && cell.row < this.board.rows &&
      cell.col >= 0 && cell.col < this.board.cols
    )) {
      console.warn('v0.1.6', 'Swipe out of bounds', { cells, ship: this.currentShip.name });
      return false;
    }
    
    // Validate terrain
    if (!cells.every(cell =>
      this.board.grid[cell.row][cell.col].terrain !== 'excluded' &&
      this.currentShip.terrain.includes(this.board.grid[cell.row][cell.col].terrain)
    )) {
      console.warn('v0.1.6', 'Invalid terrain for swipe', { cells, terrain: this.currentShip.terrain });
      return false;
    }
    
    // Validate no overlap with existing ships
    if (cells.some(cell => this.board.grid[cell.row][cell.col].state !== 'empty')) {
      console.warn('v0.1.6', 'Swipe overlaps existing ship', { cells });
      return false;
    }
    
    this.currentShip.cells = cells;
    console.log('v0.1.6', 'Swipe validated', { cells, ship: this.currentShip.name });
    return true;
  }

  // Set ship cells directly (used by PlacerRenderer)
  setShipCells(cells) {
    if (!this.currentShip) return false;
    
    // Validate the cells
    if (!Array.isArray(cells) || cells.length !== this.currentShip.size) {
      console.warn('v0.1.6', 'Invalid cells array', { cells, expectedSize: this.currentShip.size });
      return false;
    }
    
    // Validate all cells are in bounds
    if (!cells.every(cell =>
      cell.row >= 0 && cell.row < this.board.rows &&
      cell.col >= 0 && cell.col < this.board.cols
    )) {
      console.warn('v0.1.6', 'Cells out of bounds', { cells });
      return false;
    }
    
    // Validate terrain
    if (!cells.every(cell =>
      this.board.grid[cell.row][cell.col].terrain !== 'excluded' &&
      this.currentShip.terrain.includes(this.board.grid[cell.row][cell.col].terrain)
    )) {
      console.warn('v0.1.6', 'Invalid terrain for cells', { cells, terrain: this.currentShip.terrain });
      return false;
    }
    
    // Validate no overlap with existing ships
    if (cells.some(cell => this.board.grid[cell.row][cell.col].state !== 'empty')) {
      console.warn('v0.1.6', 'Cells overlap existing ship', { cells });
      return false;
    }
    
    this.currentShip.cells = cells;
    console.log('v0.1.6', 'Ship cells set', { cells, ship: this.currentShip.name });
    return true;
  }

  confirmPlacement() {
    if (!this.currentShip || !this.currentShip.cells || this.currentShip.cells.length !== this.currentShip.size) {
      console.warn('v0.1.6', 'Cannot confirm placement - invalid ship state', {
        hasShip: !!this.currentShip,
        cellCount: this.currentShip?.cells?.length,
        expectedSize: this.currentShip?.size
      });
      return false;
    }

    if (this.board.placeShip(this.currentShip, this.userId)) {
      this.placedShips.push(this.currentShip);
      const placedShip = this.currentShip;
      this.currentShip = null;
      console.log('v0.1.6', 'Placement confirmed', { ship: placedShip.name, cells: placedShip.cells });
      return true;
    } else {
      console.warn('v0.1.6', 'Board rejected ship placement');
      return false;
    }
  }

  isComplete() {
    const complete = this.fleet.every(ship => this.placedShips.includes(ship));
    console.log('v0.1.6', 'Placement complete check', {
      complete,
      placedCount: this.placedShips.length,
      totalCount: this.fleet.length
    });
    return complete;
  }
}

export default Placer;

// EOF - EOF - EOF
