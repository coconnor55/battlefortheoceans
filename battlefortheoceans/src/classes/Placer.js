// src/classes/Placer.js (v0.1.6)
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED: Do not modify without confirmation

import Ship from './Ship';
import Debug from '../utils/Debug';

class Placer {
  constructor(board, fleetConfig, userId) {
    this.board = board;
    this.userId = userId;
    this.fleet = fleetConfig.map(cfg => new Ship(cfg.name, cfg.size, cfg.terrain));
    this.currentShip = null;
    this.placedShips = [];
    
    // New state for tap-swipe interaction
    this.dragState = {
      isActive: false,
      startCell: null,
      currentCell: null,
      previewCells: [],
      isValid: false,
      direction: null
    };
  }

  getCurrentShip() {
    return this.currentShip || this.fleet.find(ship => !this.placedShips.includes(ship));
  }

  // Start drag interaction
  startDrag(row, col) {
    const ship = this.getCurrentShip();
    if (!ship) return false;

    this.currentShip = ship;
    this.dragState = {
      isActive: true,
      startCell: { row, col },
      currentCell: { row, col },
      previewCells: [{ row, col }],
      isValid: this.isValidCell(row, col, ship),
      direction: null
    };

    Debug.log('v0.1.6', 'Drag started', { row, col, ship: ship.name });
    return true;
  }

  // Update drag position and calculate preview
  updateDrag(row, col) {
    if (!this.dragState.isActive || !this.currentShip) return false;

    this.dragState.currentCell = { row, col };
    
    // Calculate direction based on drag distance
    const startRow = this.dragState.startCell.row;
    const startCol = this.dragState.startCell.col;
    const deltaRow = Math.abs(row - startRow);
    const deltaCol = Math.abs(col - startCol);
    
    // Determine direction (prefer the axis with more movement)
    const direction = deltaCol > deltaRow ? 'horizontal' : 'vertical';
    this.dragState.direction = direction;
    
    // Calculate preview cells for ship placement
    const previewCells = this.calculateShipCells(startRow, startCol, direction, this.currentShip.size);
    this.dragState.previewCells = previewCells;
    
    // Validate the placement
    this.dragState.isValid = this.validatePreviewCells(previewCells, this.currentShip);
    
    Debug.log('v0.1.6', 'Drag updated', {
      row, col, direction,
      previewCells: previewCells.length,
      isValid: this.dragState.isValid
    });
    
    return true;
  }

  // Calculate ship cells based on start position and direction
  calculateShipCells(startRow, startCol, direction, size) {
    const cells = [];
    const dr = direction === 'horizontal' ? 0 : 1;
    const dc = direction === 'horizontal' ? 1 : 0;
    
    for (let i = 0; i < size; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      cells.push({ row: r, col: c });
    }
    
    return cells;
  }

  // Validate preview cells
  validatePreviewCells(cells, ship) {
    return cells.every(cell => this.isValidCell(cell.row, cell.col, ship));
  }

  // Check if a single cell is valid for ship placement
  isValidCell(row, col, ship) {
    // Bounds check
    if (row < 0 || row >= this.board.rows || col < 0 || col >= this.board.cols) {
      return false;
    }
    
    // Terrain check
    const cell = this.board.grid[row][col];
    if (cell.terrain === 'excluded') return false;
    if (!ship.terrain.includes(cell.terrain)) return false;
    
    // Occupancy check
    return cell.state === 'empty' && cell.userId === null;
  }

  // Confirm the current drag as a placed ship
  confirmPlacement() {
    if (!this.dragState.isActive || !this.dragState.isValid || !this.currentShip) {
      Debug.warn('v0.1.6', 'Cannot confirm invalid placement');
      return false;
    }

    // Set ship cells and place on board
    this.currentShip.cells = [...this.dragState.previewCells];
    this.currentShip.start = this.dragState.startCell;
    
    if (this.board.placeShip(this.currentShip, this.userId)) {
      this.placedShips.push(this.currentShip);
      this.clearDragState();
      Debug.log('v0.1.6', 'Ship placement confirmed', { ship: this.currentShip.name });
      this.currentShip = null;
      return true;
    }
    
    return false;
  }

  // Cancel current drag
  cancelDrag() {
    Debug.log('v0.1.6', 'Drag cancelled');
    this.clearDragState();
  }

  // Clear drag state
  clearDragState() {
    this.dragState = {
      isActive: false,
      startCell: null,
      currentCell: null,
      previewCells: [],
      isValid: false,
      direction: null
    };
  }

  // Get current drag state for rendering
  getDragState() {
    return { ...this.dragState };
  }

  isComplete() {
    return this.fleet.every(ship => this.placedShips.includes(ship));
  }

  // Legacy methods for backward compatibility
  startPlacement(row, col) {
    return this.startDrag(row, col);
  }

  swipe(row, col, direction) {
    this.updateDrag(row, col);
    return this.dragState.isValid;
  }
}

export default Placer;

// EOF - EOF - EOF
