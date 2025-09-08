// src/classes/Ship.js (v0.1.0.0)
// Copyright(c) 2025, Clint H. O'Connor

export class Ship {
  constructor(name, size, terrain) {
    this.name = name;
    this.size = size;
    this.terrain = terrain;
    this.cells = [];
    this.hits = 0;
    this.isSunk = false;
  }

  hit() {
    this.hits += 1;
    this.isSunk = this.hits >= this.size;
    return this.isSunk ? 'sunk' : 'hit';
  }
}

// EOF - EOF - EOF
