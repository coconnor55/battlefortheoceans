// src/classes/Player.js
// Copyright(c) 2025, Clint H. O'Connor

import Fleet from './Fleet.js';

const version = "v0.1.4"

class Player {
  constructor(id, name, playerType = 'human') {
    this.id = id;
    this.name = name;
    this.type = playerType; // 'human', 'ai'
    
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
   * Take a shot at coordinates (to be overridden by subclasses)
   */
  async selectTarget(gameState, availableTargets) {
    throw new Error('Player.selectTarget() must be implemented by subclass');
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
   * Mark player as eliminated
   */
  eliminate() {
    this.isEliminated = true;
    this.isActive = false;
    this.eliminatedAt = Date.now();
    console.log(`Player ${this.name} eliminated`);
  }

  /**
   * Check if player can still play (requires gameInstance for fleet access)
   */
  canPlay(gameInstance = null) {
    if (!this.isActive || this.isEliminated) {
      return false;
    }
    
    // If no gameInstance provided, assume player can play (basic check)
    if (!gameInstance) {
      return true;
    }
    
    // Check fleet status through gameInstance
    const fleet = gameInstance.playerFleets.get(this.id);
    return fleet && !fleet.isDefeated();
  }

  /**
   * Get player statistics (requires gameInstance for fleet status)
   */
  getStats(gameInstance = null) {
    const accuracy = this.shotsFired > 0 ? (this.shotsHit / this.shotsFired) * 100 : 0;
    const survivalTime = (this.eliminatedAt || Date.now()) - this.joinedAt;
    
    // Get fleet status if gameInstance provided
    let fleetStatus = null;
    if (gameInstance) {
      const fleet = gameInstance.playerFleets.get(this.id);
      fleetStatus = fleet ? fleet.getStats() : null;
    }
    
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
      fleetStatus: fleetStatus
    };
  }

  /**
   * Get available targets for this player (requires gameInstance for fleet status)
   */
  getAvailableTargets(allPlayers, gameInstance = null) {
    return allPlayers.filter(player => {
      if (player.id === this.id) return false; // Can't target self
      
      // Basic check without fleet status
      if (!gameInstance) {
        return player.isActive && !player.isEliminated;
      }
      
      // Full check with fleet status
      return player.canPlay(gameInstance);
    });
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
    
    console.log(`Player ${this.name} reset for new game`);
  }

  /**
   * Serialize player data for network/storage (requires gameInstance for fleet data)
   */
  serialize(gameInstance = null) {
    // Get fleet status if gameInstance provided
    let fleetData = null;
    if (gameInstance) {
      const fleet = gameInstance.playerFleets.get(this.id);
      fleetData = fleet ? fleet.getDetailedStatus() : null;
    }
    
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      color: this.color,
      stats: this.getStats(gameInstance),
      fleet: fleetData
    };
  }

  /**
   * Create appropriate player subclass from data
   * Note: Dynamic imports used to avoid circular dependency
   */
  static async fromData(data) {
    switch (data.type) {
      case 'ai':
        const AiPlayer = (await import('./AiPlayer.js')).default;
        return new AiPlayer(data.id, data.name, data.strategy || 'random');
      case 'human':
      default:
        const HumanPlayer = (await import('./HumanPlayer.js')).default;
        return new HumanPlayer(data.id, data.name);
    }
  }


}

export default Player;
// EOF
