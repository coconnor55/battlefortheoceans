// src/classes/AiPlayer.js
// Copyright(c) 2025, Clint H. O'Connor
// Strategy-based AI with instant decisions and action queuing

import Player from './Player.js';

const version = "v0.2.3";

export class AiPlayer extends Player {
  constructor(id, name, strategy = 'random', skillLevel = 'novice') {
    super(id, name, 'ai');
    
    this.strategy = strategy;
    this.skillLevel = skillLevel;
    
    // AI memory system
    this.memory = {
      hits: new Map(),           // row,col -> ship data
      misses: new Set(),         // Set of "row,col" strings
      activeHunts: new Map(),    // shipId -> hunt data
      probabilities: new Map(),  // row,col -> probability score
      targetQueue: [],           // Priority targets to check
      checkerboard: new Set(),   // Methodical targeting pattern
      quarters: []               // Quartering strategy state
    };
    
    console.log(`AiPlayer ${name} created with strategy: ${strategy}, skill: ${skillLevel}`);
  }

  /**
   * Make move instantly - no delays, pure decision making
   */
  makeMove(gameInstance) {
    if (!gameInstance || !gameInstance.board) {
      console.error('AiPlayer.makeMove: Invalid game instance');
      return null;
    }

    const availableTargets = this.getAvailableTargets(gameInstance);
    if (availableTargets.length === 0) {
      console.error('AiPlayer.makeMove: No available targets');
      return null;
    }

    const target = this.selectTarget(availableTargets, gameInstance);
    return { row: target.row, col: target.col };
  }

  /**
   * Get all valid attack positions
   */
  getAvailableTargets(gameInstance) {
    const targets = [];
    const board = gameInstance.board;
    
    for (let row = 0; row < board.rows; row++) {
      for (let col = 0; col < board.cols; col++) {
        if (board.isValidAttackTarget(row, col)) {
          targets.push({ row, col });
        }
      }
    }
    return targets;
  }

  /**
   * Strategy-based target selection
   */
  selectTarget(availableTargets, gameInstance) {
    // Check for active hunts first (unless novice)
    if (this.skillLevel !== 'novice' && this.hasActiveHunt()) {
      const huntTarget = this.continueHunt(availableTargets);
      if (huntTarget) return huntTarget;
    }

    // Apply primary strategy
    switch (this.strategy) {
      case 'random':
        return this.selectRandom(availableTargets);
        
      case 'methodical_random':
        return this.selectMethodicalRandom(availableTargets, gameInstance);
        
      case 'methodical_optimal':
        return this.selectMethodicalOptimal(availableTargets, gameInstance);
        
      case 'quartering':
        return this.selectQuartering(availableTargets, gameInstance);
        
      case 'aggressive':
        return this.selectAggressive(availableTargets, gameInstance);
        
      default:
        return this.selectRandom(availableTargets);
    }
  }

  /**
   * Random targeting
   */
  selectRandom(availableTargets) {
    return availableTargets[Math.floor(Math.random() * availableTargets.length)];
  }

  /**
   * Methodical Random - every other square (checkerboard) in random order
   */
  selectMethodicalRandom(availableTargets, gameInstance) {
    // Build checkerboard pattern if not exists
    if (this.memory.checkerboard.size === 0) {
      for (let row = 0; row < gameInstance.board.rows; row++) {
        for (let col = 0; col < gameInstance.board.cols; col++) {
          // Checkerboard pattern - every other square
          if ((row + col) % 2 === 0) {
            this.memory.checkerboard.add(`${row},${col}`);
          }
        }
      }
    }

    // Find checkerboard targets still available
    const checkerboardTargets = availableTargets.filter(target =>
      this.memory.checkerboard.has(`${target.row},${target.col}`)
    );

    if (checkerboardTargets.length > 0) {
      return checkerboardTargets[Math.floor(Math.random() * checkerboardTargets.length)];
    }

    // Fallback to remaining squares
    return this.selectRandom(availableTargets);
  }

  /**
   * Methodical Optimal - every 4th square first (big ships), then fill in
   */
  selectMethodicalOptimal(availableTargets, gameInstance) {
    // Phase 1: Every 4th square (finds carriers/battleships)
    const phase1Targets = availableTargets.filter(target =>
      (target.row % 4 === 0) && (target.col % 4 === 0)
    );
    
    if (phase1Targets.length > 0) {
      return phase1Targets[Math.floor(Math.random() * phase1Targets.length)];
    }

    // Phase 2: Every other square (finds remaining ships)
    return this.selectMethodicalRandom(availableTargets, gameInstance);
  }

  /**
   * Quartering strategy - divide and conquer
   */
  selectQuartering(availableTargets, gameInstance) {
    const board = gameInstance.board;
    
    // Initialize quarters if needed
    if (this.memory.quarters.length === 0) {
      this.memory.quarters = [
        { minRow: 0, maxRow: Math.floor(board.rows/2), minCol: 0, maxCol: Math.floor(board.cols/2), active: true },
        { minRow: 0, maxRow: Math.floor(board.rows/2), minCol: Math.floor(board.cols/2), maxCol: board.cols, active: false },
        { minRow: Math.floor(board.rows/2), maxRow: board.rows, minCol: 0, maxCol: Math.floor(board.cols/2), active: false },
        { minRow: Math.floor(board.rows/2), maxRow: board.rows, minCol: Math.floor(board.cols/2), maxCol: board.cols, active: false }
      ];
    }

    // Find current active quarter
    const activeQuarter = this.memory.quarters.find(q => q.active);
    if (activeQuarter) {
      const quarterTargets = availableTargets.filter(target =>
        target.row >= activeQuarter.minRow && target.row < activeQuarter.maxRow &&
        target.col >= activeQuarter.minCol && target.col < activeQuarter.maxCol
      );

      if (quarterTargets.length > 0) {
        // Use methodical pattern within quarter
        return this.selectMethodicalOptimal(quarterTargets, gameInstance);
      } else {
        // Move to next quarter
        activeQuarter.active = false;
        const nextQuarter = this.memory.quarters.find(q => !q.active);
        if (nextQuarter) nextQuarter.active = true;
      }
    }

    // Fallback to methodical
    return this.selectMethodicalOptimal(availableTargets, gameInstance);
  }

  /**
   * Aggressive strategy - focus on high-value targets
   */
  selectAggressive(availableTargets, gameInstance) {
    // Calculate probability scores for each target
    const scoredTargets = availableTargets.map(target => ({
      ...target,
      score: this.calculateTargetValue(target, gameInstance)
    }));

    // Sort by score and pick from top candidates
    scoredTargets.sort((a, b) => b.score - a.score);
    const topCandidates = scoredTargets.slice(0, Math.min(3, scoredTargets.length));
    
    return topCandidates[Math.floor(Math.random() * topCandidates.length)];
  }

  /**
   * Calculate target value for aggressive strategy
   */
  calculateTargetValue(target, gameInstance) {
    let score = 1;
    
    // Higher value for center positions (more likely to hit)
    const centerRow = gameInstance.board.rows / 2;
    const centerCol = gameInstance.board.cols / 2;
    const distanceFromCenter = Math.abs(target.row - centerRow) + Math.abs(target.col - centerCol);
    score += Math.max(0, 10 - distanceFromCenter);

    // Bonus for adjacent to known hits
    for (const [hitKey, hitData] of this.memory.hits) {
      const [hitRow, hitCol] = hitKey.split(',').map(Number);
      const distance = Math.abs(target.row - hitRow) + Math.abs(target.col - hitCol);
      if (distance === 1) score += 20; // Adjacent to hit
    }

    return score;
  }

  /**
   * Check if AI has active ship hunts
   */
  hasActiveHunt() {
    return this.memory.targetQueue.length > 0;
  }

  /**
   * Continue hunting around known hits
   */
  continueHunt(availableTargets) {
    while (this.memory.targetQueue.length > 0) {
      const target = this.memory.targetQueue.shift();
      const targetAvailable = availableTargets.find(t =>
        t.row === target.row && t.col === target.col
      );
      
      if (targetAvailable) {
        return targetAvailable;
      }
    }
    return null;
  }

  /**
   * Process attack result and update AI memory
   */
  processAttackResult(target, result, gameInstance) {
    const key = `${target.row},${target.col}`;
    
    if (result.isHit) {
      // Record hit
      this.memory.hits.set(key, {
        shipId: result.shipId,
        shipName: result.shipName,
        cellIndex: result.cellIndex,
        timestamp: Date.now()
      });

      // Add adjacent targets to hunt queue (unless novice)
      if (this.skillLevel !== 'novice') {
        this.addAdjacentTargets(target.row, target.col, gameInstance);
      }

      console.log(`AI ${this.name}: Hit ${result.shipName} at ${target.row},${target.col}`);
    } else {
      // Record miss
      this.memory.misses.add(key);
      console.log(`AI ${this.name}: Miss at ${target.row},${target.col}`);
    }
  }

  /**
   * Add adjacent cells to hunt queue
   */
  addAdjacentTargets(row, col, gameInstance) {
    const adjacent = [
      { row: row - 1, col: col },     // North
      { row: row + 1, col: col },     // South
      { row: row, col: col - 1 },     // West
      { row: row, col: col + 1 }      // East
    ];

    for (const target of adjacent) {
      if (gameInstance.board.isValidAttackTarget(target.row, target.col)) {
        const key = `${target.row},${target.col}`;
        if (!this.memory.hits.has(key) && !this.memory.misses.has(key)) {
          // Add to front of queue for immediate targeting
          this.memory.targetQueue.unshift(target);
        }
      }
    }
  }

  /**
   * Reset AI memory for new game
   */
  reset() {
    super.reset();
    this.memory = {
      hits: new Map(),
      misses: new Set(),
      activeHunts: new Map(),
      probabilities: new Map(),
      targetQueue: [],
      checkerboard: new Set(),
      quarters: []
    };
    console.log(`AI ${this.name} memory reset for new game`);
  }

  /**
   * Get AI statistics for debugging
   */
  getAIStats() {
    return {
      strategy: this.strategy,
      skillLevel: this.skillLevel,
      hits: this.memory.hits.size,
      misses: this.memory.misses.size,
      activeTargets: this.memory.targetQueue.length
    };
  }
}

export default AiPlayer;

// EOF
