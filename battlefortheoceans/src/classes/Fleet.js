// src/classes/Fleet.js
// Copyright(c) 2025, Clint H. O'Connor

import Ship from './Ship.js';

const version = "v0.1.6";

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
   */
  addShips(config) {
    if (!Array.isArray(config)) {
      throw new Error('Fleet.addShips() requires a ships configuration array');
    }
    
    config.forEach(shipConfig => {
      const ship = Ship.fromConfig(shipConfig);
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
    fleet.addShips(alliance.ships);
    
    return fleet;
  }

  /**
   * Get ship count
   */
  get count() {
    return this.ships.length;
  }
}

export default Fleet;
// EOF
