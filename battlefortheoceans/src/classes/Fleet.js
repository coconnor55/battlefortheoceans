// src/classes/Fleet.js
// Copyright(c) 2025, Clint H. O'Connor

import Ship from './Ship.js';

const version = "v0.1.4"

class Fleet {
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
   * Create fleet from era configuration
   */
  static fromEraConfig(owner, eraConfig) {
    const fleet = new Fleet(owner);
    
    // Look for ships config in era
    const shipsConfig = eraConfig.ships || eraConfig.playerfleet?.ships || eraConfig.opponentfleet?.ships;
    
    if (!shipsConfig) {
      throw new Error(`No ships configuration found in era config for ${owner}`);
    }
    
    fleet.addShips(shipsConfig);
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
