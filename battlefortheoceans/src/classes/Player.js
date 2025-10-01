// src/classes/Player.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.4.0";

class Player {
  constructor(id, name, playerType = 'human') {
    // Core identity
    this.id = id;
    this.name = name;
    this.type = playerType;
    
    // STATISTICS (initialized here, updated by Game.js)
    this.hits = 0; // successful shots that hit ships
    this.misses = 0; // shots that missed
    this.sunk = 0; // ships sunk by this player
    this.hitsDamage = 0.0; // cumulative damage dealt
    this.score = 0; // calculated game score
    
    // MISS TRACKING (v0.4.0)
    // Each player maintains their own map of water cells they've shot at
    // Ship cells are handled by Game.isValidAttack() checking ship health
    this.missedShots = new Set(); // "row,col" of water/land cells this player has targeted
    
    console.log(`Player ${name} created (${playerType})`);
  }

  /**
   * Check if this player has already missed at these coordinates
   * v0.4.0: New method for per-player miss tracking
   */
  hasMissedAt(row, col) {
    return this.missedShots.has(`${row},${col}`);
  }

  /**
   * Record that this player has missed at these coordinates
   * v0.4.0: Called by Game when result is 'miss'
   */
  recordMiss(row, col) {
    this.missedShots.add(`${row},${col}`);
  }

  /**
   * Get all coordinates this player has missed at
   * v0.4.0: New method for debugging/UI
   */
  getMissedShots() {
    return Array.from(this.missedShots).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
  }

  // Computed properties (getters)
  get shots() {
    return this.hits + this.misses;
  }

  get accuracy() {
    return this.shots > 0 ? ((this.hits / this.shots) * 100).toFixed(1) : 0;
  }

  get averageDamage() {
    return this.hits > 0 ? (this.hitsDamage / this.hits).toFixed(2) : 0;
  }

  get damagePerShot() {
    return this.shots > 0 ? (this.hitsDamage / this.shots).toFixed(2) : 0;
  }

  /**
   * Check if player can play (has fleet, etc.)
   */
  canPlay() {
    return true;
  }

  /**
   * Reset player statistics for new game
   */
  reset() {
    this.hits = 0;
    this.misses = 0;
    this.sunk = 0;
    this.hitsDamage = 0.0;
    this.score = 0;
    this.missedShots.clear();
    console.log(`Player ${this.name} reset for new game`);
  }

  /**
   * Get player statistics summary
   */
  getStats() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      shots: this.shots,
      hits: this.hits,
      misses: this.misses,
      sunk: this.sunk,
      hitsDamage: this.hitsDamage,
      score: this.score,
      accuracy: parseFloat(this.accuracy),
      averageDamage: parseFloat(this.averageDamage),
      damagePerShot: parseFloat(this.damagePerShot)
    };
  }
}

export default Player;
// EOF
