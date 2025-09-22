// src/classes/Ship.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.1.9"

class Ship {
  constructor(name, size, terrain) {
    this.id = `ship-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.size = size;
    this.terrain = terrain; // allowed terrain types array
    
    // Ship state
    this.isPlaced = false;
    this.health = Array(size).fill(1.0); // Array of floats, 1.0 = undamaged, can go negative for overkill
    this.sunkAt = null; // timestamp when ship was sunk (initially null)
  }

  /**
   * Place ship (called by GameContext after successful Game/Board registration)
   * Ship only needs to know it was placed - Game/Board handle all position mapping
   */
  place() {
    this.isPlaced = true;
    console.log(`Ship ${this.name} placed successfully`);
  }

  /**
   * Receive hit at specific cell index with damage amount
   * FIXED: Allow overkill damage for attack boost monetization
   * @param {number} index - Cell index (0 to size-1)
   * @param {number} damage - Damage amount (default 1.0)
   * @returns {number} - Current health after hit (clamped to 0.0 minimum)
   */
  receiveHit(index, damage = 1.0) {
    if (index < 0 || index >= this.size) {
      console.warn(`Invalid cell index ${index} for ship ${this.name} (size: ${this.size})`);
      return this.getHealth();
    }

    // FIXED: Only apply damage if cell health > 0 (prevent multiple hits on same cell)
    if (this.health[index] > 0) {
      this.health[index] -= damage; // Allow negative health for overkill damage
      console.log(`Ship ${this.name} hit at index ${index} (health: ${this.health[index].toFixed(2)})`);
    } else {
      console.log(`Ship ${this.name} hit at index ${index} - already destroyed (no additional damage)`);
    }

    // Check if ship is now sunk
    if (this.isSunk() && !this.sunkAt) {
      this.sunkAt = Date.now();
      console.log(`Ship ${this.name} SUNK! Total health: ${this.getHealth().toFixed(2)}`);
    }

    return this.getHealth();
  }

  /**
   * Get ship's overall health as percentage (0.0 = destroyed, 1.0 = perfect)
   * FIXED: Sum all health (including negative), then clamp final result
   * @returns {number} - Total health sum divided by size, clamped to 0.0 minimum
   */
  getHealth() {
    const healthSum = this.health.reduce((sum, cellHealth) => sum + cellHealth, 0);
    return Math.max(0, healthSum / this.size);
  }

  /**
   * Check if this ship is completely sunk
   * @returns {boolean} - True if health <= 0 OR sunkAt !== null
   */
  isSunk() {
    return this.getHealth() <= 0 || this.sunkAt !== null;
  }

  /**
   * Reset ship to initial state
   */
  reset() {
    this.isPlaced = false;
    this.health = Array(this.size).fill(1.0);
    this.sunkAt = null;
  }

  /**
   * Create ship from config object
   */
  static fromConfig(config) {
    return new Ship(config.name, config.size, config.terrain);
  }
}

export default Ship;
// EOF
