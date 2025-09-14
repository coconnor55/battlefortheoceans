// src/classes/Ship.js (v0.1.4)
// Copyright(c) 2025, Clint H. O’Connor
// LOCKED: Do not modify without confirmation

class Ship {
  constructor(name, size, terrain) {
    this.name = name;
    this.size = size;
    this.terrain = terrain;
    this.cells = []; // Set by Placer, tracks { row, col }
    this.start = null;
    this.damage = 0; // Total damage across all cells
  }

  hit(damage = 1.0, row, col) {
      const cell = this.cells.find(c => c.row === row && c.col === col);
      if (cell) {
        if (cell.damage >= 1.0) {
          console.warn('Ship (v0.1.4): No further hits on cell', { row, col, currentDamage: cell.damage, attemptedDamage: damage });
          return 0; // No additional damage
        }
        cell.damage += damage;
        this.damage += damage;
        return damage; // Successful damage applied
      }
      return 0; // No cell found
  }

  resetDamage() {
    this.damage = 0; // Reset on placement
  }

  isSunk() {
    return this.damage > this.size; // External sunk check
  }

  getDamage() {
    return this.damage; // Expose total damage for external use
  }
}

export default Ship;

// EOF - EOF - EOF
