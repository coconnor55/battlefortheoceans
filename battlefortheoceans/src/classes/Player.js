// src/classes/Player.js
// Copyright(c) 2025, Clint H. O'Connor

import Fleet from './Fleet.js';

const version = "v0.1.0"

class Player {
  constructor(id, name, playerType = 'human') {
    this.id = id;
    this.name = name;
    this.type = playerType; // 'human', 'ai'
    this.fleet = null;
    
    // Game state
    this.isActive = true;
    this.isEliminated = false;
    this.score = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.shipsLost = 0;
    
    // Timestamps
    this.joinedAt = Date.now();
    this.eliminatedAt = null;
    this.lastActionAt = null;
    
    // Player configuration
    this.color = this.generatePlayerColor();
    this.avatar = null;
  }

  /**
   * Assign a fleet to this player
   */
  assignFleet(fleet) {
    if (!(fleet instanceof Fleet)) {
      throw new Error('Player.assignFleet() requires a Fleet instance');
    }
    
    this.fleet = fleet;
    fleet.owner = this.id;
    console.log(`Player ${this.name} assigned fleet with ${fleet.length} ships`);
  }

  /**
   * Create fleet from era configuration
   */
  createFleet(eraConfig) {
    this.fleet = Fleet.fromEraConfig(this.id, eraConfig);
    console.log(`Player ${this.name} created fleet from era config`);
    return this.fleet;
  }

  /**
   * Take a shot at coordinates (to be overridden by subclasses)
   */
  async selectTarget(gameState, availableTargets) {
    throw new Error('Player.selectTarget() must be implemented by subclass');
  }

  /**
   * Process being attacked by another player
   */
  receiveAttack(attacker, row, col) {
    if (!this.fleet) {
      return { result: 'invalid', message: 'No fleet to attack' };
    }

    const attackResult = this.fleet.receiveAttack(row, col);
    
    // Update player stats
    if (attackResult.result !== 'miss') {
      // Track ships lost when they sink
      if (attackResult.result === 'sunk' && !attackResult.wasAlreadySunk) {
        this.shipsLost++;
      }
    }

    // Check if player is eliminated
    if (this.fleet.isDefeated() && !this.isEliminated) {
      this.eliminate();
    }

    // Call reaction method (can be overridden)
    this.onAttacked(attacker, attackResult);
    
    return attackResult;
  }

  /**
   * React to being attacked (can be overridden by subclasses)
   */
  onAttacked(attacker, attackResult) {
    this.lastActionAt = Date.now();
    
    if (attackResult.result === 'hit' || attackResult.result === 'sunk') {
      console.log(`Player ${this.name}: Received ${attackResult.result} from ${attacker.name}`);
    }
  }

  /**
   * Execute a shot (common logic for all player types)
   */
  fireShot(target, row, col) {
    this.shotsFired++;
    this.lastActionAt = Date.now();
    
    const result = target.receiveAttack(this, row, col);
    
    if (result.result === 'hit' || result.result === 'sunk') {
      this.shotsHit++;
      this.score += result.result === 'sunk' ? 10 : 1;
    }
    
    console.log(`Player ${this.name} fired at ${target.name}: ${result.result}`);
    return result;
  }

  /**
   * Mark player as eliminated
   */
  eliminate() {
    this.isEliminated = true;
    this.isActive = false;
    this.eliminatedAt = Date.now();
    console.log(`Player ${this.name} eliminated`);
  }

  /**
   * Check if player can still play
   */
  canPlay() {
    return this.isActive && !this.isEliminated && this.fleet && !this.fleet.isDefeated();
  }

  /**
   * Get player statistics
   */
  getStats() {
    const accuracy = this.shotsFired > 0 ? (this.shotsHit / this.shotsFired) * 100 : 0;
    const survivalTime = (this.eliminatedAt || Date.now()) - this.joinedAt;
    
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      score: this.score,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      accuracy: Math.round(accuracy * 100) / 100,
      shipsLost: this.shipsLost,
      isEliminated: this.isEliminated,
      survivalTime: survivalTime,
      fleetStatus: this.fleet ? this.fleet.getStats() : null
    };
  }

  /**
   * Get available targets for this player (to be customized by game rules)
   */
  getAvailableTargets(allPlayers) {
    return allPlayers.filter(player =>
      player.id !== this.id &&
      player.canPlay()
    );
  }

  /**
   * Generate a unique color for this player
   */
  generatePlayerColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const hash = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * Reset player for new game
   */
  reset() {
    this.score = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.shipsLost = 0;
    this.isActive = true;
    this.isEliminated = false;
    this.eliminatedAt = null;
    this.lastActionAt = null;
    
    if (this.fleet) {
      this.fleet.reset();
    }
    
    console.log(`Player ${this.name} reset for new game`);
  }

  /**
   * Serialize player data for network/storage
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      color: this.color,
      stats: this.getStats(),
      fleet: this.fleet ? this.fleet.getDetailedStatus() : null
    };
  }

  /**
   * Create appropriate player subclass from data
   */
  static fromData(data) {
    switch (data.type) {
      case 'ai':
        return new AIPlayer(data.id, data.name, data.strategy || 'random');
      case 'human':
      default:
        return new HumanPlayer(data.id, data.name);
    }
  }
}

export default Player;
// EOF
