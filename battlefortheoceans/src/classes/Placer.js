// src/classes/Placer.js (v0.1.4)
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED: Do not modify without confirmation

class Placer {
  constructor(board, fleetConfig, userId) {
    this.board = board;
    this.userId = userId;
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
    this.currentShip.cells = [];
    this.currentShip.start = { row, col };
    Debug.log('v0.1.4', 'Placement started', { row, col, ship: ship.name });
    return true;
  }
  swipe(row, col, direction) {
    if (!this.currentShip || !this.currentShip.start) return false;
    const startRow = this.currentShip.start.row;
    const startCol = this.currentShip.start.col;
    const dr = direction === 'horizontal' ? 0 : 1;
    const dc = direction === 'horizontal' ? 1 : 0;
    const cells = [];
    for (let i = 0; i < this.currentShip.size; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      if (r >= 0 && r < this.board.rows && c >= 0 && c < this.board.cols) {
        cells.push({ row: r, col: c });
      } else {
        Debug.warn('v0.1.4', 'Swipe out of bounds', { row: r, col: c, ship: this.currentShip.name });
        return false;
      }
    }
    if (cells.length !== this.currentShip.size) {
      Debug.warn('v0.1.4', 'Invalid swipe length', { expected: this.currentShip.size, got: cells.length });
      return false;
    }
    if (!cells.every(cell => this.board.grid[cell.row][cell.col].terrain !== 'excluded' && this.currentShip.terrain.includes(this.board.grid[cell.row][cell.col].terrain))) {
      Debug.warn('v0.1.4', 'Invalid terrain for swipe', { cells, terrain: this.currentShip.terrain });
      return false;
    }
    if (cells.some(cell => this.board.grid[cell.row][cell.col].state !== 'empty')) {
      Debug.warn('v0.1.4', 'Swipe overlaps existing ship', { cells });
      return false;
    }
    this.currentShip.cells = cells;
    Debug.log('v0.1.4', 'Swipe validated', { cells, ship: this.currentShip.name });
    return true;
  }
  confirmPlacement() {
    if (this.currentShip && this.currentShip.cells.length === this.currentShip.size) {
      if (this.board.placeShip(this.currentShip, this.userId)) {
        this.placedShips.push(this.currentShip);
        this.currentShip = null;
        Debug.log('v0.1.4', 'Placement confirmed', { ship: this.currentShip?.name });
        return true;
      }
    }
    return false;
  }
  isComplete() {
    return this.fleet.every(ship => this.placedShips.includes(ship));
  }
}

export default Placer;

// EOF - EOF - EOF
