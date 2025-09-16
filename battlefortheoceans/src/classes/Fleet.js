// src/classes/Fleet.js
// Copyright(c) 2025, Clint H. O'Connor

import Ship from './Ship.js';

const version = "v0.1.0"

class Fleet {
  constructor(owner, shipConfigs = []) {
    this.owner = owner; // 'player', 'opponent', or userId
    this.ships = [];
    this.createdAt = Date.now();
    
    // Create ships from configs
    this.addShipsFromConfigs(shipConfigs);
  }

  /**
   * Add ships from configuration array
   */
  addShipsFromConfigs(shipConfigs) {
    shipConfigs.forEach(config => {
      const ship = Ship.fromConfig(config, this.owner);
      this.ships.push(ship);
    });
    
    console.log(`Fleet for ${this.owner} created with ${this.ships.length} ships:`,
                this.ships.map(s => `${s.name}(${s.size})`).join(', '));
  }

  /**
   * Add an existing ship to the fleet
   */
  addShip(ship) {
    if (!(ship instanceof Ship)) {
      throw new Error('Fleet.addShip() requires a Ship instance');
    }
    
    ship.owner = this.owner;
    this.ships.push(ship);
  }

  /**
   * Get ship by ID
   */
  getShip(shipId) {
    return this.ships.find(ship => ship.id === shipId);
  }

  /**
   * Get ship by name (first match)
   */
  getShipByName(name) {
    return this.ships.find(ship => ship.name === name);
  }

  /**
   * Find ship at specific coordinates
   */
  getShipAtCell(row, col) {
    return this.ships.find(ship => ship.occupiesCell(row, col));
  }

  /**
   * Get all ships that have been placed on the board
   */
  getPlacedShips() {
    return this.ships.filter(ship => ship.isPlaced);
  }

  /**
   * Get all ships that haven't been placed yet
   */
  getUnplacedShips() {
    return this.ships.filter(ship => !ship.isPlaced);
  }

  /**
   * Get all ships that have been sunk
   */
  getSunkShips() {
    return this.ships.filter(ship => ship.isSunk());
  }

  /**
   * Get all ships that are still afloat (placed but not sunk)
   */
  getAfloatShips() {
    return this.ships.filter(ship => ship.isPlaced && !ship.isSunk());
  }

  /**
   * Check if all ships have been placed
   */
  isFullyDeployed() {
    return this.ships.length > 0 && this.ships.every(ship => ship.isPlaced);
  }

  /**
   * Check if the fleet is defeated (all ships sunk)
   */
  isDefeated() {
    const placedShips = this.getPlacedShips();
    return placedShips.length > 0 && placedShips.every(ship => ship.isSunk());
  }

  /**
   * Attempt to hit the fleet at coordinates
   */
  receiveAttack(row, col) {
    const targetShip = this.getShipAtCell(row, col);
    
    if (!targetShip) {
      console.log(`Fleet ${this.owner}: Miss at ${String.fromCharCode(65 + col)}${row + 1}`);
      return { result: 'miss', ship: null };
    }

    const wasAlreadySunk = targetShip.isSunk();
    const hitSuccessful = targetShip.hit(row, col);
    
    if (!hitSuccessful) {
      // Already hit this cell
      console.log(`Fleet ${this.owner}: Already hit ${String.fromCharCode(65 + col)}${row + 1}`);
      return { result: 'already-hit', ship: targetShip };
    }

    const isNowSunk = targetShip.isSunk();
    const result = isNowSunk && !wasAlreadySunk ? 'sunk' : 'hit';
    
    console.log(`Fleet ${this.owner}: ${result.toUpperCase()} - ${targetShip.name} at ${String.fromCharCode(65 + col)}${row + 1}`);
    
    return {
      result,
      ship: targetShip,
      wasAlreadySunk,
      isNowSunk
    };
  }

  /**
   * Get fleet statistics
   */
  getStats() {
    const placed = this.getPlacedShips();
    const sunk = this.getSunkShips();
    const afloat = this.getAfloatShips();
    
    return {
      total: this.ships.length,
      placed: placed.length,
      sunk: sunk.length,
      afloat: afloat.length,
      totalCells: this.ships.reduce((sum, ship) => sum + ship.size, 0),
      hitCells: this.ships.reduce((sum, ship) => sum + ship.hitCount, 0),
      isFullyDeployed: this.isFullyDeployed(),
      isDefeated: this.isDefeated()
    };
  }

  /**
   * Reset all ships to initial state
   */
  reset() {
    this.ships.forEach(ship => ship.reset());
    console.log(`Fleet ${this.owner} reset - all ships unplaced and undamaged`);
  }

  /**
   * Get detailed fleet status for debugging
   */
  getDetailedStatus() {
    return {
      owner: this.owner,
      createdAt: new Date(this.createdAt).toISOString(),
      stats: this.getStats(),
      ships: this.ships.map(ship => ship.getStatus())
    };
  }

  /**
   * Validate fleet configuration against era rules
   */
  validateConfiguration(eraConfig) {
    const errors = [];
    
    // Check ship count matches era config
    if (this.ships.length !== eraConfig.ships.length) {
      errors.push(`Ship count mismatch: expected ${eraConfig.ships.length}, got ${this.ships.length}`);
    }
    
    // Check each ship type and size
    eraConfig.ships.forEach(expectedShip => {
      const actualShip = this.ships.find(ship =>
        ship.name === expectedShip.name && ship.size === expectedShip.size
      );
      
      if (!actualShip) {
        errors.push(`Missing ship: ${expectedShip.name} (${expectedShip.size} cells)`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create fleet from era configuration
   */
  static fromEraConfig(owner, eraConfig) {
    const fleetConfig = owner === 'player' ? eraConfig.playerfleet : eraConfig.opponentfleet;
    
    if (!fleetConfig || !fleetConfig.ships) {
      throw new Error(`No fleet configuration found for ${owner} in era config`);
    }
    
    return new Fleet(owner, fleetConfig.ships);
  }

  /**
   * Iterator support for foreach loops
   */
  [Symbol.iterator]() {
    return this.ships[Symbol.iterator]();
  }

  /**
   * Get ship count
   */
  get length() {
    return this.ships.length;
  }
}

export default Fleet;
// EOF
