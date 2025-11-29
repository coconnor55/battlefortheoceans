// src/classes/Fleet.js
// Copyright(c) 2025, Clint H. O'Connor

import Ship from './Ship.js';

const version = "v0.2.1";
/**
 * v0.2.1: Pass era config to Ship.fromConfig for torpedoes
 *         - addShips() now accepts eraConfig parameter
 *         - fromEraConfig() and fromShipArray() pass era config through
 *
 * v0.2.0: Added fromShipArray() for multi-fleet combat (Pirates of the Gulf)
 *         Allows creating fleet from specific ship array instead of entire alliance
 */

class Fleet {
    // Fleet is a battle group consisting of ships and owned by a player.  The fleet is defeated when the last ship has been sunk, eliminating the player from the game. A defeated fleet cannot capture a ship.
    
  constructor(owner) {
    this.owner = owner; // playerID (required)
    this.ships = []; // array of Ship objects
    this.createdAt = Date.now();
  }

  /**
   * Add a captured ship (only if fleet not defeated)
   */
  addShip(ship) {
    if (this.isDefeated()) {
      console.warn(`Cannot add ship to defeated fleet ${this.owner}`);
      return false;
    }
    
    if (!(ship instanceof Ship)) {
      throw new Error('Fleet.addShip() requires a Ship instance');
    }
    
    this.ships.push(ship);
    return true;
  }

  /**
   * Remove a captured ship (may result in immediate defeat)
   */
  removeShip(ship) {
    const index = this.ships.indexOf(ship);
    if (index === -1) return false;
    
    this.ships.splice(index, 1);
    return true;
  }

  /**
   * Bulk add ships from era configuration
   * @param {Array} config - Array of ship configuration objects
   * @param {Object} eraConfig - Era configuration (optional, for torpedoes)
   */
  addShips(config, eraConfig = null) {
    if (!Array.isArray(config)) {
      throw new Error('Fleet.addShips() requires a ships configuration array');
    }
    
    config.forEach(shipConfig => {
      const ship = Ship.fromConfig(shipConfig, eraConfig);
      this.ships.push(ship);
    });
  }

  /**
   * Check if fleet is defeated - all ships sunk OR no ships in fleet
   */
  isDefeated() {
    return this.ships.length === 0 || this.ships.every(ship => ship.isSunk());
  }

  /**
   * Check if all ships are placed - boolean AND of all ships[].isPlaced
   */
  isPlaced() {
    return this.ships.length > 0 && this.ships.every(ship => ship.isPlaced);
  }

  /**
   * Get fleet's overall health - sum of ships[].getHealth() / total ships
   */
  getHealth() {
    if (this.ships.length === 0) return 0.0;
    return this.ships.reduce((sum, ship) => sum + ship.getHealth(), 0) / this.ships.length;
  }

  /**
   * Create fleet from era configuration with alliance-specific ships
   */
  static fromEraConfig(owner, eraConfig, allianceName) {
    const fleet = new Fleet(owner);
    
    // Find the alliance and get its ships
    const alliance = eraConfig.alliances?.find(a => a.name === allianceName);
    
    if (!alliance) {
      throw new Error(`Alliance "${allianceName}" not found in era config`);
    }
    
    if (!alliance.ships || !Array.isArray(alliance.ships)) {
      throw new Error(`Alliance "${allianceName}" has no ships configuration`);
    }
    
    if (alliance.ships.length === 0) {
      throw new Error(`Alliance "${allianceName}" has empty ships array`);
    }
    
    console.log(`Creating fleet for ${owner} with alliance ${allianceName}: ${alliance.ships.length} ships`);
    fleet.addShips(alliance.ships, eraConfig);
    
    return fleet;
  }

  /**
   * Create fleet from specific ship array (for multi-fleet combat like Pirates)
   * v0.2.0: New method for assigning specific ships to AI captains
   * @param {string} owner - Player ID
   * @param {Array} ships - Array of ship configs from pirate_fleets[].ships
   * @param {string} allianceName - Alliance name for logging
   * @param {Object} eraConfig - Era configuration (optional, for torpedoes)
   * @returns {Fleet} - Fleet instance with specific ships
   */
  static fromShipArray(owner, ships, allianceName = 'Pirates', eraConfig = null) {
    const fleet = new Fleet(owner);
    
    if (!Array.isArray(ships) || ships.length === 0) {
      throw new Error(`Fleet.fromShipArray() requires non-empty ships array`);
    }
    
    console.log(`Creating fleet for ${owner} with ${ships.length} specific ships (${allianceName})`);
    fleet.addShips(ships, eraConfig);
    
    return fleet;
  }

  /**
   * Get ship count
   */
  get count() {
    return this.ships.length;
  }

  /**
   * Get fleet statistics
   */
  getStats() {
    return {
      owner: this.owner,
      totalShips: this.ships.length,
      shipsAfloat: this.ships.filter(s => !s.isSunk()).length,
      shipsSunk: this.ships.filter(s => s.isSunk()).length,
      isDefeated: this.isDefeated(),
      isPlaced: this.isPlaced(),
      averageHealth: this.getHealth()
    };
  }
}

export default Fleet;
// EOF
