// src/classes/AiPlayer.js v0.4.0
// Copyright(c) 2025, Clint H. O'Connor
// Simplified strategy-based AI - skill levels removed

import Player from './Player.js';

const version = "v0.4.0"; // Removed skill levels, removed quartering, simplified hunt modes

export class AiPlayer extends Player {
  constructor(id, name, strategy = 'random', difficulty = 1.0) {
    super(id, name, 'ai', difficulty);
    
    this.strategy = strategy;
    
    // AI memory system
    this.memory = {
      hits: new Map(),
      misses: new Set(),
      targetQueue: [],
      huntDirection: null,
      huntLine: null,
      huntHits: [],
      checkerboard: new Set()
    };
    
    console.log(`AiPlayer ${name} created with strategy: ${strategy}, difficulty: ${difficulty}`);
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

  getAvailableTargets(gameInstance) {
    const targets = [];
    const rows = gameInstance.eraConfig.rows;
    const cols = gameInstance.eraConfig.cols;
    
    console.log(`[AI DEBUG] Board dimensions: ${rows}x${cols}`);
    console.log(`[AI DEBUG] AI missed shots: ${this.missedShots.size}`);
    console.log(`[AI DEBUG] Current turn: ${gameInstance.currentTurn}`);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (gameInstance.isValidAttack(row, col, this)) {
          targets.push({ row, col });
        }
      }
    }
    
    console.log(`[AI DEBUG] Available targets found: ${targets.length}`);
    return targets;
  }

  selectTarget(availableTargets, gameInstance) {
    // Hunt mode for strategies with it (not random)
    if (this.strategy !== 'random' && this.hasActiveHunt()) {
      const huntTarget = this.continueHunt(availableTargets, gameInstance);
      if (huntTarget) {
        console.log(`AI ${this.name} (${this.strategy}): Hunt mode - targeting ${huntTarget.row},${huntTarget.col}`);
        return huntTarget;
      }
    }

    // Base strategy selection
    switch (this.strategy) {
      case 'random':
        return this.selectRandom(availableTargets);
        
      case 'methodical_random':
        return this.selectMethodicalRandom(availableTargets, gameInstance);
        
      case 'methodical_optimal':
        return this.selectMethodicalOptimal(availableTargets, gameInstance);
        
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
    // Initialize checkerboard pattern if needed
    if (this.memory.checkerboard.size === 0) {
      for (let row = 0; row < gameInstance.eraConfig.rows; row++) {
        for (let col = 0; col < gameInstance.eraConfig.cols; col++) {
          if ((row + col) % 2 === 0) {
            this.memory.checkerboard.add(`${row},${col}`);
          }
        }
      }
    }

    // Prefer checkerboard squares
    const checkerboardTargets = availableTargets.filter(target =>
      this.memory.checkerboard.has(`${target.row},${target.col}`)
    );

    if (checkerboardTargets.length > 0) {
      return checkerboardTargets[Math.floor(Math.random() * checkerboardTargets.length)];
    }

    // Fall back to random if checkerboard exhausted
    return this.selectRandom(availableTargets);
  }

  selectMethodicalOptimal(availableTargets, gameInstance) {
    // Phase 1: Target 4-cell grid (finds 4+ cell ships)
    const phase1Targets = availableTargets.filter(target =>
      (target.row % 4 === 0) && (target.col % 4 === 0)
    );
    
    if (phase1Targets.length > 0) {
      return phase1Targets[Math.floor(Math.random() * phase1Targets.length)];
    }

    // Phase 2: Fall back to checkerboard
    return this.selectMethodicalRandom(availableTargets, gameInstance);
  }

  selectAggressive(availableTargets, gameInstance) {
    // Score targets based on center distance and proximity to hits
    const scoredTargets = availableTargets.map(target => ({
      ...target,
      score: this.calculateTargetValue(target, gameInstance)
    }));

    // Sort by score and pick from top candidates
    scoredTargets.sort((a, b) => b.score - a.score);
    const topCandidates = scoredTargets.slice(0, Math.min(3, scoredTargets.length));
    
    return topCandidates[Math.floor(Math.random() * topCandidates.length)];
  }

  calculateTargetValue(target, gameInstance) {
    let score = 1;
    
    // Center bias - radiate outward from center
    const centerRow = gameInstance.eraConfig.rows / 2;
    const centerCol = gameInstance.eraConfig.cols / 2;
    const distanceFromCenter = Math.abs(target.row - centerRow) + Math.abs(target.col - centerCol);
    score += Math.max(0, 10 - distanceFromCenter);

    // Bonus for cells adjacent to known hits
    for (const [hitKey] of this.memory.hits) {
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

    // Determine direction if we have 2+ hits
    if (this.memory.huntHits.length >= 2 && !this.memory.huntDirection) {
      this.determineHuntDirection();
    }

    // Follow direction if established
    if (this.memory.huntDirection && this.memory.huntLine) {
      const directionalTarget = this.getDirectionalTarget(validTargets, gameInstance);
      if (directionalTarget) {
        console.log(`AI ${this.name}: Following ${this.memory.huntDirection} direction`);
        return directionalTarget;
      }
    }

    // Filter invalid targets from queue
    this.memory.targetQueue = this.memory.targetQueue.filter(target =>
      validTargets.has(`${target.row},${target.col}`)
    );

    // Use queued targets
    if (this.memory.targetQueue.length > 0) {
      return this.memory.targetQueue.shift();
    }
    
    return null;
  }

  determineHuntDirection() {
    if (this.memory.huntHits.length < 2) return;

    // Sort hits to establish line
    const hits = [...this.memory.huntHits].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const first = hits[0];
    const second = hits[1];

    // Determine if horizontal or vertical
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

    // Filter queue to only targets on the established line
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

    // Sort hits along the line
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

    // Add targets at both ends of the line
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

      // Hunt mode behavior varies by strategy
      if (this.strategy !== 'random') {
        if (result.result === 'hit') {
          this.memory.huntHits.push({ row: target.row, col: target.col });
          
          // methodical_optimal and aggressive: Add 4-adjacent on first hit
          if ((this.strategy === 'methodical_optimal' || this.strategy === 'aggressive')
              && this.memory.huntHits.length === 1) {
            this.addAdjacentTargets(target.row, target.col, gameInstance);
            console.log(`AI ${this.name} (${this.strategy}): First hit! Added adjacent targets`);
          }
          // methodical_random: Only directional tracking (no adjacent on first hit)
          else if (this.memory.huntHits.length >= 2) {
            this.determineHuntDirection();
          }
        }
        else if (result.result === 'sunk') {
          // aggressive: Search 6-cell area around sunken ship for nested vessels
          if (this.strategy === 'aggressive') {
            this.searchAroundSunkenShip(gameInstance);
          }
          
          this.resetHuntMode();
          console.log(`AI ${this.name} (${this.strategy}): Ship sunk! Hunt mode reset`);
        }
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
      if (gameInstance.isValidAttack(target.row, target.col, this)) {
        const key = `${target.row},${target.col}`;
        const alreadyQueued = this.memory.targetQueue.some(t =>
          t.row === target.row && t.col === target.col
        );
        
        if (!this.memory.hits.has(key) && !alreadyQueued) {
          this.memory.targetQueue.push(target);
        }
      }
    }
    
    console.log(`AI ${this.name}: Hunt queue now has ${this.memory.targetQueue.length} targets`);
  }

  searchAroundSunkenShip(gameInstance) {
    // Aggressive strategy: 6-cell pattern around all hunt hits to find nested ships
    const searchArea = new Set();
    
    for (const hit of this.memory.huntHits) {
      // All 6 surrounding cells (excluding diagonals for now)
      const nearby = [
        { row: hit.row - 1, col: hit.col },
        { row: hit.row + 1, col: hit.col },
        { row: hit.row, col: hit.col - 1 },
        { row: hit.row, col: hit.col + 1 },
        { row: hit.row - 2, col: hit.col },
        { row: hit.row + 2, col: hit.col },
        { row: hit.row, col: hit.col - 2 },
        { row: hit.row, col: hit.col + 2 }
      ];

      for (const target of nearby) {
        const key = `${target.row},${target.col}`;
        if (gameInstance.isValidAttack(target.row, target.col, this)
            && !this.memory.hits.has(key)) {
          searchArea.add(key);
        }
      }
    }

    // Add unique targets to queue
    for (const key of searchArea) {
      const [row, col] = key.split(',').map(Number);
      const alreadyQueued = this.memory.targetQueue.some(t =>
        t.row === row && t.col === col
      );
      
      if (!alreadyQueued) {
        this.memory.targetQueue.push({ row, col });
      }
    }

    console.log(`AI ${this.name}: Searching around sunken ship - ${searchArea.size} new targets`);
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
      targetQueue: [],
      huntDirection: null,
      huntLine: null,
      huntHits: [],
      checkerboard: new Set()
    };
    console.log(`AI ${this.name} memory reset for new game`);
  }

  getAIStats() {
    return {
      strategy: this.strategy,
      difficulty: this.difficulty,
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
