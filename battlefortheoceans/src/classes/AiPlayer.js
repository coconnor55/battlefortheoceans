// src/classes/AiPlayer.js
// Copyright(c) 2025, Clint H. O'Connor

import Player from './Player.js';

const version = "v0.1.3"

class AiPlayer extends Player {
  constructor(id, name, strategy = 'random', difficulty = 1.0) {
    super(id, name, 'ai');
    
    // AI-specific properties
    this.strategy = strategy;
    this.difficulty = difficulty; // 0.0 to 1.0+ (can exceed 1.0 for superhuman)
    this.reactionTime = this.calculateReactionTime();
    
    // AI memory and state
    this.memory = {
      targetHits: new Map(), // Remember where we hit ships
      probabilities: new Map(), // Track likely ship locations
      lastTargets: [], // Recent targets
      huntMode: false, // Currently hunting a damaged ship
      huntTarget: null, // Ship being hunted
      avoidedCells: new Set() // Cells to avoid
    };
    
    // Strategy configuration
    this.strategyConfig = this.getStrategyConfig();
    
    console.log(`AiPlayer ${this.name} created with strategy: ${strategy} (difficulty: ${difficulty})`);
  }

  /**
   * Main AI move method - called by useGameState
   */
  async makeMove(gameInstance) {
    if (!gameInstance || gameInstance.state !== 'playing') {
      throw new Error(`AiPlayer ${this.name}: Cannot make move - invalid game state`);
    }

    try {
      // Simulate AI thinking time
      await this.simulateThinking();
      
      // Find available targets (other players who aren't eliminated)
      const availableTargets = gameInstance.players.filter(player => {
        if (player.id === this.id) return false; // Can't target self
        
        // Check if player has a fleet and it's not defeated
        const fleet = gameInstance.playerFleets.get(player.id);
        if (!fleet) return false;
        
        // Player is valid target if their fleet isn't defeated
        return !fleet.isDefeated() && !player.isEliminated;
      });
      
      if (availableTargets.length === 0) {
        console.error(`AiPlayer ${this.name}: No available targets found`);
        console.error('All players:', gameInstance.players.map(p => ({
          id: p.id,
          name: p.name,
          eliminated: p.isEliminated,
          hasFleet: !!gameInstance.playerFleets.get(p.id)
        })));
        throw new Error(`AiPlayer ${this.name}: No available targets`);
      }
      
      // Select target and coordinates
      const targetSelection = await this.selectTarget(gameInstance, availableTargets);
      const { player: targetPlayer, row, col } = targetSelection;
      
      // Execute attack through game instance
      const attackResult = await gameInstance.processPlayerAction('attack', { row, col });
      
      // Update AI memory with attack result
      this.processAttackResult(targetPlayer, row, col, attackResult);
      
      console.log(`AiPlayer ${this.name}: Attacked ${targetPlayer.name} at ${String.fromCharCode(65 + col)}${row + 1} - ${attackResult.result}`);
      
      return attackResult;
      
    } catch (error) {
      console.error(`AiPlayer ${this.name}: Move failed:`, error);
      throw error;
    }
  }

  /**
   * AI target selection with strategy implementation
   */
  async selectTarget(gameInstance, availableTargets) {
    const target = this.pickTarget(availableTargets, gameInstance);
    const coordinates = this.selectCoordinates(target, gameInstance);
    
    // Update AI memory
    this.memory.lastTargets.push({
      target: target.id,
      ...coordinates,
      timestamp: Date.now()
    });
    if (this.memory.lastTargets.length > 10) {
      this.memory.lastTargets.shift();
    }
    
    console.log(`AiPlayer ${this.name} selected target: ${target.name} at ${String.fromCharCode(65 + coordinates.col)}${coordinates.row + 1}`);
    
    return { player: target, ...coordinates };
  }

  /**
   * Pick target player based on strategy
   */
  pickTarget(availableTargets, gameInstance) {
    if (availableTargets.length === 0) {
      throw new Error(`AiPlayer ${this.name}: No available targets`);
    }
    
    if (availableTargets.length === 1) {
      return availableTargets[0];
    }
    
    switch (this.strategy) {
      case 'aggressive':
        // Target player with most ships remaining
        return availableTargets.reduce((best, current) => {
          const currentFleet = gameInstance.playerFleets.get(current.id);
          const bestFleet = gameInstance.playerFleets.get(best.id);
          const currentAlive = currentFleet ? currentFleet.ships.filter(s => !s.isSunk()).length : 0;
          const bestAlive = bestFleet ? bestFleet.ships.filter(s => !s.isSunk()).length : 0;
          return currentAlive > bestAlive ? current : best;
        });
        
      case 'opportunistic':
        // Target player with most damaged ships
        return availableTargets.reduce((best, current) => {
          const currentFleet = gameInstance.playerFleets.get(current.id);
          const bestFleet = gameInstance.playerFleets.get(best.id);
          const currentDamaged = currentFleet ? currentFleet.ships.filter(ship => ship.hitCount > 0 && !ship.isSunk()).length : 0;
          const bestDamaged = bestFleet ? bestFleet.ships.filter(ship => ship.hitCount > 0 && !ship.isSunk()).length : 0;
          return currentDamaged > bestDamaged ? current : best;
        });
        
      case 'defensive':
        // Target weakest player (fewest ships)
        return availableTargets.reduce((weakest, current) => {
          const currentFleet = gameInstance.playerFleets.get(current.id);
          const weakestFleet = gameInstance.playerFleets.get(weakest.id);
          const currentAlive = currentFleet ? currentFleet.ships.filter(s => !s.isSunk()).length : 0;
          const weakestAlive = weakestFleet ? weakestFleet.ships.filter(s => !s.isSunk()).length : 0;
          return currentAlive < weakestAlive ? current : weakest;
        });
        
      case 'random':
      default:
        return availableTargets[Math.floor(Math.random() * availableTargets.length)];
    }
  }

  /**
   * Select coordinates to attack based on strategy and memory
   */
  selectCoordinates(target, gameInstance) {
    const boardSize = {
      rows: gameInstance.eraConfig.rows,
      cols: gameInstance.eraConfig.cols
    };
    
    // If we're hunting a specific ship, continue the hunt
    if (this.memory.huntMode && this.memory.huntTarget) {
      const huntCoords = this.continueHunt(target, boardSize, gameInstance);
      if (huntCoords) {
        return huntCoords;
      } else {
        // Hunt failed, exit hunt mode
        this.memory.huntMode = false;
        this.memory.huntTarget = null;
      }
    }
    
    // Apply strategy-specific coordinate selection
    switch (this.strategy) {
      case 'methodical_hunting':
        return this.methodicalHunting(target, boardSize, gameInstance);
        
      case 'aggressive_targeting':
        return this.aggressiveTargeting(target, boardSize, gameInstance);
        
      case 'random_shots':
      default:
        return this.randomTargeting(target, boardSize, gameInstance);
    }
  }

  /**
   * Continue hunting a damaged ship
   */
  continueHunt(target, boardSize, gameInstance) {
    const targetId = target.id;
    const hits = this.memory.targetHits.get(targetId) || [];
    
    if (hits.length === 0) {
      return null;
    }
    
    // Find adjacent cells to hit areas
    const adjacentCells = [];
    hits.forEach(({ row, col }) => {
      const neighbors = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 }
      ];
      
      neighbors.forEach(neighbor => {
        if (this.isValidTarget(neighbor, targetId, boardSize, gameInstance)) {
          adjacentCells.push(neighbor);
        }
      });
    });
    
    if (adjacentCells.length > 0) {
      return adjacentCells[Math.floor(Math.random() * adjacentCells.length)];
    }
    
    return null;
  }

  /**
   * Methodical hunting pattern (checkerboard, then systematic)
   */
  methodicalHunting(target, boardSize, gameInstance) {
    const targetId = target.id;
    
    // First pass: checkerboard pattern
    for (let row = 0; row < boardSize.rows; row++) {
      for (let col = 0; col < boardSize.cols; col++) {
        if ((row + col) % 2 === 0 && this.isValidTarget({ row, col }, targetId, boardSize, gameInstance)) {
          return { row, col };
        }
      }
    }
    
    // Second pass: fill in gaps
    for (let row = 0; row < boardSize.rows; row++) {
      for (let col = 0; col < boardSize.cols; col++) {
        if (this.isValidTarget({ row, col }, targetId, boardSize, gameInstance)) {
          return { row, col };
        }
      }
    }
    
    // Fallback to random if no methodical targets
    return this.randomTargeting(target, boardSize, gameInstance);
  }

  /**
   * Aggressive targeting (focus on high-probability areas)
   */
  aggressiveTargeting(target, boardSize, gameInstance) {
    const targetId = target.id;
    
    // Target center areas first (ships often placed there)
    const centerRow = Math.floor(boardSize.rows / 2);
    const centerCol = Math.floor(boardSize.cols / 2);
    
    const centerTargets = [];
    for (let r = centerRow - 2; r <= centerRow + 2; r++) {
      for (let c = centerCol - 2; c <= centerCol + 2; c++) {
        if (this.isValidTarget({ row: r, col: c }, targetId, boardSize, gameInstance)) {
          const distance = Math.abs(r - centerRow) + Math.abs(c - centerCol);
          centerTargets.push({ row: r, col: c, distance });
        }
      }
    }
    
    if (centerTargets.length > 0) {
      centerTargets.sort((a, b) => a.distance - b.distance);
      return { row: centerTargets[0].row, col: centerTargets[0].col };
    }
    
    return this.randomTargeting(target, boardSize, gameInstance);
  }

  /**
   * Random targeting with intelligence
   */
  randomTargeting(target, boardSize, gameInstance) {
    const targetId = target.id;
    const attempts = [];
    
    // Generate valid random coordinates
    for (let attempt = 0; attempt < 100; attempt++) {
      const row = Math.floor(Math.random() * boardSize.rows);
      const col = Math.floor(Math.random() * boardSize.cols);
      
      if (this.isValidTarget({ row, col }, targetId, boardSize, gameInstance)) {
        attempts.push({ row, col });
      }
    }
    
    if (attempts.length > 0) {
      return attempts[Math.floor(Math.random() * attempts.length)];
    }
    
    // Emergency fallback: find any valid target
    for (let row = 0; row < boardSize.rows; row++) {
      for (let col = 0; col < boardSize.cols; col++) {
        if (this.isValidTarget({ row, col }, targetId, boardSize, gameInstance)) {
          return { row, col };
        }
      }
    }
    
    throw new Error(`AiPlayer ${this.name}: No valid targets found for ${target.name}`);
  }

  /**
   * Check if coordinates are a valid target
   */
  isValidTarget({ row, col }, targetId, boardSize, gameInstance) {
    // Check bounds
    if (row < 0 || row >= boardSize.rows || col < 0 || col >= boardSize.cols) {
      return false;
    }
    
    // Check terrain if available
    if (gameInstance.eraConfig.terrain &&
        gameInstance.eraConfig.terrain[row] &&
        gameInstance.eraConfig.terrain[row][col] === 'excluded') {
      return false;
    }
    
    // Check if already targeted (use game's attack validation)
    if (!gameInstance.isValidAttack(row, col)) {
      return false;
    }
    
    // Check if already attacked by this AI
    const cellKey = `${targetId}-${row}-${col}`;
    if (this.memory.avoidedCells.has(cellKey)) {
      return false;
    }
    
    return true;
  }

  /**
   * React to successful hits (update memory and enter hunt mode)
   */
  onAttacked(attacker, attackResult) {
    super.onAttacked(attacker, attackResult);
    
    // AI learning: remember who attacked us and how
    if (attackResult.result === 'hit' || attackResult.result === 'sunk') {
      console.log(`AiPlayer ${this.name}: Learning from attack by ${attacker.name}`);
      // Could implement counter-attack strategies here
    }
  }

  /**
   * Process the result of our own attacks (update AI memory)
   */
  processAttackResult(target, row, col, result) {
    const targetId = target.id;
    const cellKey = `${targetId}-${row}-${col}`;
    
    // Mark cell as attacked
    this.memory.avoidedCells.add(cellKey);
    
    if (result.result === 'hit' || result.result === 'sunk') {
      // Remember successful hits
      if (!this.memory.targetHits.has(targetId)) {
        this.memory.targetHits.set(targetId, []);
      }
      this.memory.targetHits.get(targetId).push({
        row,
        col,
        result: result.result
      });
      
      // Enter hunt mode if we hit something and it's not sunk
      if (result.result === 'hit') {
        this.memory.huntMode = true;
        this.memory.huntTarget = result.ships?.[0]?.ship || null;
        console.log(`AiPlayer ${this.name}: Entering hunt mode`);
      } else if (result.result === 'sunk') {
        // Ship sunk, exit hunt mode
        this.memory.huntMode = false;
        this.memory.huntTarget = null;
        console.log(`AiPlayer ${this.name}: Ship sunk, exiting hunt mode`);
      }
    }
  }

  /**
   * Calculate AI reaction time based on difficulty
   */
  calculateReactionTime() {
    // Harder AI thinks faster, easier AI thinks slower
    const baseTime = 500; // 0.5 seconds
    const difficultyMultiplier = Math.max(0.1, 2.0 - this.difficulty);
    return baseTime * difficultyMultiplier;
  }

  /**
   * Simulate AI thinking time
   */
  async simulateThinking() {
    const thinkTime = this.reactionTime + Math.random() * 500;
    return new Promise(resolve => setTimeout(resolve, thinkTime));
  }

  /**
   * Get strategy-specific configuration
   */
  getStrategyConfig() {
    switch (this.strategy) {
      case 'aggressive':
        return { huntPersistence: 0.8, riskTaking: 0.9, centerBias: 0.7 };
      case 'defensive':
        return { huntPersistence: 0.3, riskTaking: 0.2, centerBias: 0.3 };
      case 'methodical_hunting':
        return { huntPersistence: 0.9, riskTaking: 0.5, centerBias: 0.4 };
      case 'random_shots':
        return { huntPersistence: 0.1, riskTaking: 0.8, centerBias: 0.5 };
      default:
        return { huntPersistence: 0.5, riskTaking: 0.5, centerBias: 0.5 };
    }
  }

  /**
   * Get AI-specific status
   */
  getAIStatus() {
    return {
      ...this.getStats(),
      strategy: this.strategy,
      difficulty: this.difficulty,
      reactionTime: this.reactionTime,
      memoryStats: {
        targetsRemembered: this.memory.targetHits.size,
        huntMode: this.memory.huntMode,
        avoidedCells: this.memory.avoidedCells.size
      }
    };
  }

  /**
   * Reset AI memory for new game
   */
  reset() {
    super.reset();
    
    this.memory = {
      targetHits: new Map(),
      probabilities: new Map(),
      lastTargets: [],
      huntMode: false,
      huntTarget: null,
      avoidedCells: new Set()
    };
    
    console.log(`AiPlayer ${this.name} memory reset for new game`);
  }

  /**
   * Serialize AI-specific data
   */
  serialize() {
    return {
      ...super.serialize(),
      strategy: this.strategy,
      difficulty: this.difficulty,
      aiStatus: this.getAIStatus()
    };
  }
}

export default AiPlayer;
// EOF
