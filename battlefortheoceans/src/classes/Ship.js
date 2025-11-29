// src/classes/Ship.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.2.3";
/**
 * v0.2.3: Torpedoes from era config
 * - Torpedoes now read from era config munitions.torpedoes instead of hardcoded
 * - Only submarines get torpedoes (based on class)
 * - Initial torpedo count stored for reset()
 *
 * v0.2.2: Torpedo System
 * - Added 'torpedoes' property (from era config for submarines, 0 for others)
 * - Added getTorpedoes() and useTorpedo() methods
 * - Torpedoes are lost when submarine is sunk
 *
 * v0.2.1: Progressive Fog of War System
 * - Added 'hitCount' tracking for reveal stages
 * - Added getRevealLevel() method (hidden/hit/size-hint/critical/sunk)
 * - Added getSizeCategory() method (small/medium/large)
 * - Added getMaxHealth() method for health percentage calculations
 * - receiveHit() now increments hitCount
 *
 * v0.2.0: Defense Modifier System
 * - Added 'shipClass' parameter to constructor (required)
 * - Added 'class' property for ship classification
 * - Added 'defense' property (damage reduction multiplier)
 * - getDefenseModifier() calculates defense based on ship class:
 *   - Submarine: 0.67 (33% damage reduction - hard to hit due to depth)
 *   - Battleship: 0.83 (17% damage reduction - heavy armor)
 *   - All others: 1.0 (standard - no defense bonus)
 * - Defense works with attack/defense boosts (multiplicative)
 */

class Ship {
    // Ship is a battle unit that has a name, size (1-5 cells), and allowed terrain (could be cannon on land too).  Each cell has health, initially 1.0, and can go negative if receiving a high power (>1.0) shot or a partial shot (e.g. 0.1) followed by a full (1.0) shot.  The ship is sunk when its total health drops to 0. Allowed ships are defined in the era-config file for a game. [FUTURE] A Ship can be captured (random chance) when its health falls to zero.  In this instance, a ship is reset with a random health between 50% and 75% and fires 50% power shots.  This, of course, messes up player maps because the ship disappears after being sunk and then reappears as a new ship.
    
  constructor(name, size, terrain, shipClass, torpedoes = 0) {
    // Validate required shipClass parameter
    if (!shipClass) {
      throw new Error(`Ship ${name} missing required 'shipClass' parameter`);
    }
    
    // Use crypto.randomUUID() for guaranteed uniqueness
    this.id = `ship-${crypto.randomUUID()}`;
    this.name = name;
    this.size = size;
    this.terrain = terrain; // allowed terrain types array
    this.class = shipClass; // Ship classification for defense calculations
    
    // Defense modifier (damage reduction)
    this.defense = this.getDefenseModifier();
    
    // Ship state
    this.isPlaced = false;
    this.health = Array(size).fill(1.0); // Array of floats, 1.0 = undamaged, can go negative for overkill
    this.sunkAt = null; // timestamp when ship was sunk (initially null)
    
    // Fog of War tracking
    this.hitCount = 0; // Number of times this ship has been hit (for progressive reveal)
    
    // Torpedo tracking (only for submarines, from era config)
    // Store initial count for reset()
    this.initialTorpedoes = this.class.toLowerCase() === 'submarine' ? torpedoes : 0;
    this.torpedoes = this.initialTorpedoes;
  }

  /**
   * Calculate defense modifier based on ship class
   * Defense multiplier is applied to incoming damage
   * Lower = tougher (takes less damage)
   *
   * @returns {number} - Defense multiplier (0.67 to 1.0)
   */
  getDefenseModifier() {
    switch (this.class.toLowerCase()) {
      case 'submarine':
        // Hard to hit due to depth uncertainty (33% damage reduction)
        return 0.67;
      
      case 'battleship':
        // Heavy armor plating (17% damage reduction)
        return 0.83;
      
      case 'carrier':
      case 'cruiser':
      case 'destroyer':
      case 'pt boat':
      default:
        // Standard defense (no bonus)
        return 1.0;
    }
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
      this.hitCount++; // Increment for fog of war reveal
      console.log(`Ship ${this.name} hit at index ${index} (health: ${this.health[index].toFixed(2)}, hitCount: ${this.hitCount})`);
    } else {
      console.log(`Ship ${this.name} hit at index ${index} - already destroyed (no additional damage)`);
    }

    // Check if ship is now sunk
    if (this.isSunk() && !this.sunkAt) {
      this.sunkAt = Date.now();
      // When submarine is sunk, torpedoes are lost
      if (this.class.toLowerCase() === 'submarine') {
        this.torpedoes = 0;
      }
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
   * Get maximum possible health for this ship
   * Used for calculating health percentage for fog of war reveals
   * @returns {number} - Maximum health (size * 1.0)
   */
  getMaxHealth() {
    return this.size * 1.0;
  }

  /**
   * Get current health percentage (0.0 to 1.0)
   * Used for determining critical damage threshold
   * @returns {number} - Health percentage (0.0 = dead, 1.0 = perfect)
   */
  getHealthPercent() {
    return this.getHealth();
  }

  /**
   * Get size category for fog of war hints
   * @returns {string} - 'small' (2 cells), 'medium' (3 cells), 'large' (4-5 cells)
   */
  getSizeCategory() {
    if (this.size <= 2) return 'small';
    if (this.size === 3) return 'medium';
    return 'large'; // 4-5 cells
  }

  /**
   * Get fog of war reveal level based on damage taken
   * Progressive reveal stages:
   * - 'hidden': No hits yet (not revealed to attacker)
   * - 'hit': 1 hit (attacker knows "something" is here)
   * - 'size-hint': 2+ hits (attacker knows size category)
   * - 'critical': <50% health (attacker knows ship class)
   * - 'sunk': Ship destroyed (full reveal)
   *
   * @returns {string} - Reveal level
   */
  getRevealLevel() {
    // Sunk ships are fully revealed
    if (this.isSunk()) return 'sunk';
    
    // Critical damage (<50% HP) reveals ship class
    const healthPercent = this.getHealthPercent();
    if (healthPercent < 0.5) return 'critical';
    
    // Second hit reveals size hint
    if (this.hitCount >= 2) return 'size-hint';
    
    // First hit reveals "something" is here
    if (this.hitCount >= 1) return 'hit';
    
    // No hits yet - hidden
    return 'hidden';
  }

  /**
   * Check if this ship is completely sunk
   * @returns {boolean} - True if health <= 0 OR sunkAt !== null
   */
  isSunk() {
    return this.getHealth() <= 0 || this.sunkAt !== null;
  }
  
  /**
   * Get remaining torpedoes (only for submarines)
   * @returns {number} - Number of torpedoes remaining
   */
  getTorpedoes() {
    return this.torpedoes || 0;
  }
  
  /**
   * Use a torpedo (decrement count)
   * @returns {boolean} - True if torpedo was used, false if none available
   */
  useTorpedo() {
    if (this.torpedoes > 0) {
      this.torpedoes--;
      return true;
    }
    return false;
  }

  /**
   * Reset ship to initial state
   */
  reset() {
    this.isPlaced = false;
    this.health = Array(this.size).fill(1.0);
    this.sunkAt = null;
    this.hitCount = 0; // Reset fog of war tracking
    // Reset torpedoes to initial count from era config
    this.torpedoes = this.initialTorpedoes;
  }

  /**
   * Create ship from config object
   * UPDATED: Now requires 'class' property in config
   * UPDATED: Accepts era config to read torpedoes from munitions.torpedoes
   * @param {Object} config - Ship configuration object
   * @param {Object} eraConfig - Era configuration (optional, for torpedoes)
   * @returns {Ship} - New Ship instance
   */
  static fromConfig(config, eraConfig = null) {
    if (!config.class) {
      throw new Error(`Ship config missing required 'class' property: ${JSON.stringify(config)}`);
    }
    
    // Get torpedoes from era config (only for submarines)
    let torpedoes = 0;
    if (config.class.toLowerCase() === 'submarine' && eraConfig?.munitions?.torpedoes) {
      torpedoes = eraConfig.munitions.torpedoes;
    }
    
    return new Ship(config.name, config.size, config.terrain, config.class, torpedoes);
  }
}

export default Ship;
// EOF
