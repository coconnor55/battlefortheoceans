// src/classes/Ship.js (v0.1.3)
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

  hit(damage = 1.0) {
    this.damage += damage; // Accumulate total damage
    return damage; // For external tracking
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
