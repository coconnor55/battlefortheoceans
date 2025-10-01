// src/classes/AiPlayer.js
// Copyright(c) 2025, Clint H. O'Connor
// Strategy-based AI with instant decisions and directional hunt mode

import Player from './Player.js';

const version = "v0.3.0";

export class AiPlayer extends Player {
  constructor(id, name, strategy = 'random', skillLevel = 'novice') {
    super(id, name, 'ai');
    
    this.strategy = strategy;
    this.skillLevel = skillLevel;
    
    // AI memory system
    this.memory = {
      hits: new Map(),
      misses: new Set(),
      activeHunts: new Map(),
      probabilities: new Map(),
      targetQueue: [],
      huntDirection: null,
      huntLine: null,
      huntHits: [],
      checkerboard: new Set(),
      quarters: []
    };
    
    console.log(`AiPlayer ${name} created with strategy: ${strategy}, skill: ${skillLevel}`);
  }

  makeMove(gameInstance) {
    if (!gameInstance) {
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
   * Get all valid attack positions for this AI player
   * v0.3.0: FIXED - Now passes this AI player to isValidAttack() for per-player miss tracking
   */
  getAvailableTargets(gameInstance) {
    const targets = [];
    const rows = gameInstance.eraConfig.rows;
    const cols = gameInstance.eraConfig.cols;
    
    console.log(`[AI DEBUG] Board dimensions: ${rows}x${cols}`);
    console.log(`[AI DEBUG] AI missed shots: ${this.missedShots.size}`);
    console.log(`[AI DEBUG] Current turn: ${gameInstance.currentTurn}`);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Game.isValidAttack() now checks:
        // 1. Valid coordinate (bounds + terrain)
        // 2. This player hasn't missed here
        // 3. No ship OR ship cell has health > 0
        if (gameInstance.isValidAttack(row, col, this)) {
          targets.push({ row, col });
        }
      }
    }
    
    console.log(`[AI DEBUG] Available targets found: ${targets.length}`);
    return targets;
  }

  selectTarget(availableTargets, gameInstance) {
    if (this.skillLevel !== 'novice' && this.hasActiveHunt()) {
      const huntTarget = this.continueHunt(availableTargets, gameInstance);
      if (huntTarget) {
        console.log(`AI ${this.name} (${this.skillLevel}): Hunt mode - targeting ${huntTarget.row},${huntTarget.col}`);
        return huntTarget;
      }
    }

    if (this.skillLevel === 'expert') {
      const centerTarget = this.selectCenterConcentration(availableTargets, gameInstance);
      if (centerTarget && Math.random() < 0.3) {
        return centerTarget;
      }
    }

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

  selectRandom(availableTargets) {
    return availableTargets[Math.floor(Math.random() * availableTargets.length)];
  }

  selectMethodicalRandom(availableTargets, gameInstance) {
    if (this.memory.checkerboard.size === 0) {
      for (let row = 0; row < gameInstance.eraConfig.rows; row++) {
        for (let col = 0; col < gameInstance.eraConfig.cols; col++) {
          if ((row + col) % 2 === 0) {
            this.memory.checkerboard.add(`${row},${col}`);
          }
        }
      }
    }

    const checkerboardTargets = availableTargets.filter(target =>
      this.memory.checkerboard.has(`${target.row},${target.col}`)
    );

    if (checkerboardTargets.length > 0) {
      return checkerboardTargets[Math.floor(Math.random() * checkerboardTargets.length)];
    }

    return this.selectRandom(availableTargets);
  }

  selectMethodicalOptimal(availableTargets, gameInstance) {
    const phase1Targets = availableTargets.filter(target =>
      (target.row % 4 === 0) && (target.col % 4 === 0)
    );
    
    if (phase1Targets.length > 0) {
      return phase1Targets[Math.floor(Math.random() * phase1Targets.length)];
    }

    return this.selectMethodicalRandom(availableTargets, gameInstance);
  }

  selectCenterConcentration(availableTargets, gameInstance) {
    const centerRow = Math.floor(gameInstance.eraConfig.rows / 2);
    const centerCol = Math.floor(gameInstance.eraConfig.cols / 2);
    
    const centerTargets = availableTargets
      .map(target => ({
        ...target,
        distance: Math.abs(target.row - centerRow) + Math.abs(target.col - centerCol)
      }))
      .filter(target => target.distance <= 3)
      .sort((a, b) => a.distance - b.distance);
    
    if (centerTargets.length > 0) {
      const closestDistance = centerTargets[0].distance;
      const closestTargets = centerTargets.filter(t => t.distance === closestDistance);
      return closestTargets[Math.floor(Math.random() * closestTargets.length)];
    }
    
    return null;
  }

  selectQuartering(availableTargets, gameInstance) {
    const board = gameInstance.board;
    
    if (this.memory.quarters.length === 0) {
      this.memory.quarters = [
        { minRow: 0, maxRow: Math.floor(board.rows/2), minCol: 0, maxCol: Math.floor(board.cols/2), active: true },
        { minRow: 0, maxRow: Math.floor(board.rows/2), minCol: Math.floor(board.cols/2), maxCol: board.cols, active: false },
        { minRow: Math.floor(board.rows/2), maxRow: board.rows, minCol: 0, maxCol: Math.floor(board.cols/2), active: false },
        { minRow: Math.floor(board.rows/2), maxRow: board.rows, minCol: Math.floor(board.cols/2), maxCol: board.cols, active: false }
      ];
    }

    const activeQuarter = this.memory.quarters.find(q => q.active);
    if (activeQuarter) {
      const quarterTargets = availableTargets.filter(target =>
        target.row >= activeQuarter.minRow && target.row < activeQuarter.maxRow &&
        target.col >= activeQuarter.minCol && target.col < activeQuarter.maxCol
      );

      if (quarterTargets.length > 0) {
        return this.selectMethodicalOptimal(quarterTargets, gameInstance);
      } else {
        activeQuarter.active = false;
        const nextQuarter = this.memory.quarters.find(q => !q.active);
        if (nextQuarter) nextQuarter.active = true;
      }
    }

    return this.selectMethodicalOptimal(availableTargets, gameInstance);
  }

  selectAggressive(availableTargets, gameInstance) {
    const scoredTargets = availableTargets.map(target => ({
      ...target,
      score: this.calculateTargetValue(target, gameInstance)
    }));

    scoredTargets.sort((a, b) => b.score - a.score);
    const topCandidates = scoredTargets.slice(0, Math.min(3, scoredTargets.length));
    
    return topCandidates[Math.floor(Math.random() * topCandidates.length)];
  }

  calculateTargetValue(target, gameInstance) {
    let score = 1;
    
    const centerRow = gameInstance.eraConfig.rows / 2;
    const centerCol = gameInstance.eraConfig.cols / 2;
    const distanceFromCenter = Math.abs(target.row - centerRow) + Math.abs(target.col - centerCol);
    score += Math.max(0, 10 - distanceFromCenter);

    for (const [hitKey, hitData] of this.memory.hits) {
      const [hitRow, hitCol] = hitKey.split(',').map(Number);
      const distance = Math.abs(target.row - hitRow) + Math.abs(target.col - hitCol);
      if (distance === 1) score += 20;
    }

    return score;
  }

  hasActiveHunt() {
    return this.memory.huntHits.length > 0 || this.memory.targetQueue.length > 0;
  }

  continueHunt(availableTargets, gameInstance) {
    const validTargets = new Set(
      availableTargets.map(t => `${t.row},${t.col}`)
    );

    if (this.memory.huntHits.length >= 2 && !this.memory.huntDirection) {
      this.determineHuntDirection();
    }

    if (this.memory.huntDirection && this.memory.huntLine) {
      const directionalTarget = this.getDirectionalTarget(validTargets, gameInstance);
      if (directionalTarget) {
        console.log(`AI ${this.name}: Following ${this.memory.huntDirection} direction`);
        return directionalTarget;
      }
    }

    this.memory.targetQueue = this.memory.targetQueue.filter(target =>
      validTargets.has(`${target.row},${target.col}`)
    );

    if (this.memory.targetQueue.length > 0) {
      return this.memory.targetQueue.shift();
    }
    
    return null;
  }

  determineHuntDirection() {
    if (this.memory.huntHits.length < 2) return;

    const hits = [...this.memory.huntHits].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const first = hits[0];
    const second = hits[1];

    if (first.row === second.row) {
      this.memory.huntDirection = 'horizontal';
      this.memory.huntLine = { row: first.row };
      console.log(`AI ${this.name}: Detected horizontal ship at row ${first.row}`);
    }
    else if (first.col === second.col) {
      this.memory.huntDirection = 'vertical';
      this.memory.huntLine = { col: first.col };
      console.log(`AI ${this.name}: Detected vertical ship at col ${first.col}`);
    }

    if (this.memory.huntDirection) {
      this.memory.targetQueue = this.memory.targetQueue.filter(target => {
        if (this.memory.huntDirection === 'horizontal') {
          return target.row === this.memory.huntLine.row;
        } else {
          return target.col === this.memory.huntLine.col;
        }
      });
    }
  }

  getDirectionalTarget(validTargets, gameInstance) {
    if (!this.memory.huntDirection || !this.memory.huntLine) return null;

    const hits = [...this.memory.huntHits].sort((a, b) => {
      if (this.memory.huntDirection === 'horizontal') {
        return a.col - b.col;
      } else {
        return a.row - b.row;
      }
    });

    const firstHit = hits[0];
    const lastHit = hits[hits.length - 1];

    const candidates = [];

    if (this.memory.huntDirection === 'horizontal') {
      const leftTarget = { row: this.memory.huntLine.row, col: firstHit.col - 1 };
      if (validTargets.has(`${leftTarget.row},${leftTarget.col}`)) {
        candidates.push(leftTarget);
      }
      
      const rightTarget = { row: this.memory.huntLine.row, col: lastHit.col + 1 };
      if (validTargets.has(`${rightTarget.row},${rightTarget.col}`)) {
        candidates.push(rightTarget);
      }
    } else {
      const upTarget = { row: firstHit.row - 1, col: this.memory.huntLine.col };
      if (validTargets.has(`${upTarget.row},${upTarget.col}`)) {
        candidates.push(upTarget);
      }
      
      const downTarget = { row: lastHit.row + 1, col: this.memory.huntLine.col };
      if (validTargets.has(`${downTarget.row},${downTarget.col}`)) {
        candidates.push(downTarget);
      }
    }

    return candidates.length > 0 ? candidates[0] : null;
  }

  processAttackResult(target, result, gameInstance) {
    const key = `${target.row},${target.col}`;
    
    if (result.result === 'hit' || result.result === 'sunk') {
      const shipInfo = result.ships && result.ships.length > 0 ? result.ships[0] : null;
      this.memory.hits.set(key, {
        shipId: shipInfo?.ship?.id,
        shipName: shipInfo?.ship?.name,
        timestamp: Date.now()
      });

      if (this.skillLevel !== 'novice') {
        if (result.result === 'hit') {
          this.memory.huntHits.push({ row: target.row, col: target.col });
          
          if (this.memory.huntHits.length === 1) {
            this.addAdjacentTargets(target.row, target.col, gameInstance);
            console.log(`AI ${this.name} (${this.skillLevel}): First hit! Added adjacent targets`);
          } else {
            this.determineHuntDirection();
          }
        } else if (result.result === 'sunk') {
          this.resetHuntMode();
          console.log(`AI ${this.name} (${this.skillLevel}): Ship sunk! Resetting hunt mode`);
        }
      } else {
        console.log(`AI ${this.name} (novice): Hit! Continuing random targeting`);
      }
    } else {
      this.memory.misses.add(key);
      console.log(`AI ${this.name}: Miss at ${target.row},${target.col}`);
    }
  }

  addAdjacentTargets(row, col, gameInstance) {
    const adjacent = [
      { row: row - 1, col: col },
      { row: row + 1, col: col },
      { row: row, col: col - 1 },
      { row: row, col: col + 1 }
    ];

    for (const target of adjacent) {
      // Game.isValidAttack() handles all validation including miss tracking
      if (gameInstance.isValidAttack(target.row, target.col, this)) {
        const key = `${target.row},${target.col}`;
        const alreadyQueued = this.memory.targetQueue.some(t =>
          t.row === target.row && t.col === target.col
        );
        
        // Only check if not already in our hunt queue and not a known hit
        if (!this.memory.hits.has(key) && !alreadyQueued) {
          this.memory.targetQueue.push(target);
        }
      }
    }
    
    console.log(`AI ${this.name}: Hunt queue now has ${this.memory.targetQueue.length} targets`);
  }

  resetHuntMode() {
    this.memory.targetQueue = [];
    this.memory.huntDirection = null;
    this.memory.huntLine = null;
    this.memory.huntHits = [];
    console.log(`AI ${this.name}: Hunt mode reset`);
  }

  reset() {
    super.reset();
    this.memory = {
      hits: new Map(),
      misses: new Set(),
      activeHunts: new Map(),
      probabilities: new Map(),
      targetQueue: [],
      huntDirection: null,
      huntLine: null,
      huntHits: [],
      checkerboard: new Set(),
      quarters: []
    };
    console.log(`AI ${this.name} memory reset for new game`);
  }

  getAIStats() {
    return {
      strategy: this.strategy,
      skillLevel: this.skillLevel,
      hits: this.memory.hits.size,
      misses: this.memory.misses.size,
      activeTargets: this.memory.targetQueue.length,
      huntDirection: this.memory.huntDirection,
      huntHits: this.memory.huntHits.length
    };
  }
}

export default AiPlayer;
// EOF
