// src/classes/AiPlayer.js v0.4.9
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.9: CRITICAL FIX - Updated to match Game.js 4-state attack results
//         'hit' = live cells remain
//         'destroyed' = just killed last live cell
//         'all_destroyed' = wasted shot on dead cells (targeting bug)
//         'miss' = water/land
//         'invalid' = out of bounds
// v0.4.7: Removed memory.misses - redundant with Player.dontShootMap
//         Player stats (this.hits, this.misses) used for scoring only
//         dontShootMap used for targeting logic only
// v0.4.6: Fixed this.missedShots reference (should be this.memory.misses)
// v0.4.5: Updated for 3-state attack results (hit/all_sunk/miss)
// v0.4.4: CRITICAL FIX - Handle alreadyDestroyed ships correctly
// v0.4.3: AI added its own hunt strategy
// v0.4.2: Fixed aggressive strategy - x4 radiating pattern, then x2 backfill
// v0.4.1: Player-owned targeting - uses canShootAt()
// v0.4.0: Simplified strategy-based AI - skill levels removed

import Player from './Player.js';

const version = "v0.4.9";

export class AiPlayer extends Player {
  constructor(id, name, strategy = 'random', difficulty = 1.0) {
    super(id, name, 'ai', difficulty);
    
    this.strategy = strategy;
    
    // AI memory system (targeting intelligence only)
    // Shot history tracked in Player.dontShootMap
    // Hit/miss stats tracked in Player.hits/misses
    this.memory = {
      hits: new Map(),          // Hit locations for hunt mode
      targetQueue: [],          // Queued targets from hunt mode
      huntDirection: null,      // 'horizontal' or 'vertical'
      huntLine: null,           // { row: X } or { col: Y }
      huntHits: [],            // Hits in current hunt
      checkerboard: new Set(),  // For methodical_random strategy
      aggressivePhase: 'x4',    // For aggressive strategy
      aggressiveRings: []       // For aggressive strategy
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
    console.log(`[AI DEBUG] Current turn: ${gameInstance.currentTurn}`);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (gameInstance.board?.isValidCoordinate(row, col) && this.canShootAt(row, col)) {
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
        
      case 'ai-hunt':
        return this.selectAIHunt(availableTargets, gameInstance);
        
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

  selectAggressive(availableTargets, gameInstance) {
    const centerRow = Math.floor(gameInstance.eraConfig.rows / 2);
    const centerCol = Math.floor(gameInstance.eraConfig.cols / 2);

    if (this.memory.aggressivePhase === 'x4') {
      const x4Targets = availableTargets.filter(target =>
        (target.row % 4 === 0) && (target.col % 4 === 0)
      );

      if (x4Targets.length > 0) {
        const targetsByDistance = x4Targets.map(t => ({
          ...t,
          distance: Math.abs(t.row - centerRow) + Math.abs(t.col - centerCol)
        })).sort((a, b) => a.distance - b.distance);

        const currentDistance = targetsByDistance[0].distance;
        const currentRing = targetsByDistance.filter(t => t.distance === currentDistance);
        
        console.log(`AI ${this.name} (aggressive): x4 phase, ring distance ${currentDistance}, ${currentRing.length} targets`);
        return currentRing[Math.floor(Math.random() * currentRing.length)];
      }

      console.log(`AI ${this.name} (aggressive): Switching to x2 backfill phase`);
      this.memory.aggressivePhase = 'x2';
    }

    if (this.memory.aggressivePhase === 'x2') {
      const x2Targets = availableTargets.filter(target =>
        (target.row + target.col) % 2 === 0
      );

      if (x2Targets.length > 0) {
        console.log(`AI ${this.name} (aggressive): x2 phase, ${x2Targets.length} targets`);
        return x2Targets[Math.floor(Math.random() * x2Targets.length)];
      }

      console.log(`AI ${this.name} (aggressive): Switching to cleanup phase`);
      this.memory.aggressivePhase = 'cleanup';
    }

    console.log(`AI ${this.name} (aggressive): Cleanup phase`);
    return this.selectRandom(availableTargets);
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

  /**
   * v0.4.9: Updated to match Game.js 4-state attack results
   * Process attack result and update AI memory
   *
   * Game.receiveAttack() returns one of 5 states:
   * - 'hit': Live ships at cell, continue hunting
   * - 'destroyed': Just killed last live cell (all ships now dead here)
   * - 'all_destroyed': Wasted shot on already-dead cells (shouldn't happen)
   * - 'miss': Water/land miss
   * - 'invalid': Out of bounds (shouldn't happen)
   *
   * @param {Object} target - {row, col} coordinates attacked
   * @param {Object} result - Attack result from Game.receiveAttack()
   * @param {Game} gameInstance - Game instance reference
   */
  processAttackResult(target, result, gameInstance) {
    const key = `${target.row},${target.col}`;
    
    if (result.result === 'hit') {
      // Live ships at cell - continue hunting
      const shipInfo = result.ships && result.ships.length > 0 ? result.ships[0] : null;
      this.memory.hits.set(key, {
        shipId: shipInfo?.ship?.id,
        shipName: shipInfo?.ship?.name,
        timestamp: Date.now()
      });

      if (this.strategy !== 'random') {
        this.memory.huntHits.push({ row: target.row, col: target.col });
        
        // methodical_optimal and aggressive: Add 4-adjacent on first hit
        if ((this.strategy === 'methodical_optimal' || this.strategy === 'aggressive')
            && this.memory.huntHits.length === 1) {
          this.addAdjacentTargets(target.row, target.col, gameInstance);
          console.log(`AI ${this.name} (${this.strategy}): First hit! Added adjacent targets`);
        }
        // methodical_random: Only directional tracking
        else if (this.memory.huntHits.length >= 2) {
          this.determineHuntDirection();
        }
      }
      
      console.log(`AI ${this.name}: HIT at ${target.row},${target.col} - live ships remain`);
    }
    else if (result.result === 'destroyed') {
      // Just killed last live cell at this location
      // dontShootMap already updated by Game.js via recordDontShoot()
      console.log(`AI ${this.name}: DESTROYED at ${target.row},${target.col} - all ships now dead`);
      
      // If we were hunting, check if ship(s) just sank
      if (this.strategy !== 'random' && result.ships && result.ships.length > 0) {
        const anySunk = result.ships.some(s => s.shipSunk);
        if (anySunk) {
          // aggressive: Search for clustered ships
          if (this.strategy === 'aggressive') {
            this.searchForClusteredShips(gameInstance);
          }
          
          this.resetHuntMode();
          console.log(`AI ${this.name} (${this.strategy}): Ship(s) sunk! Hunt mode reset`);
        }
      }
    }
    else if (result.result === 'all_destroyed') {
      // Wasted shot on already-dead cells (shouldn't happen with proper targeting)
      console.error(`AI ${this.name}: ALL_DESTROYED at ${target.row},${target.col} - targeting bug (shot dead cells)`);
      console.error(`AI ${this.name}: canShootAt should have prevented this!`);
      // Don't update memory - this is an error condition
    }
    else if (result.result === 'miss') {
      // True water/land miss
      // dontShootMap already updated by Game.js via recordDontShoot()
      console.log(`AI ${this.name}: MISS at ${target.row},${target.col}`);
    }
    else if (result.result === 'invalid') {
      // Out of bounds (shouldn't happen with proper coordinate validation)
      console.error(`AI ${this.name}: INVALID coordinate ${target.row},${target.col} - targeting bug`);
      console.error(`AI ${this.name}: getAvailableTargets should have prevented this!`);
      // Don't update memory - this is an error condition
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
      if (gameInstance.board?.isValidCoordinate(target.row, target.col) && this.canShootAt(target.row, target.col)) {
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

  searchForClusteredShips(gameInstance) {
    const huntArea = new Set();
    
    const hits = [...this.memory.huntHits].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    if (hits.length === 0) return;

    const firstHit = hits[0];
    const lastHit = hits[hits.length - 1];
    const isHorizontal = firstHit.row === lastHit.row;

    if (isHorizontal) {
      huntArea.add(`${firstHit.row},${firstHit.col - 1}`);
      huntArea.add(`${lastHit.row},${lastHit.col + 1}`);
      
      for (const hit of hits) {
        if (Math.random() < 0.4) {
          huntArea.add(`${hit.row - 1},${hit.col}`);
          huntArea.add(`${hit.row + 1},${hit.col}`);
        }
      }
    } else {
      huntArea.add(`${firstHit.row - 1},${firstHit.col}`);
      huntArea.add(`${lastHit.row + 1},${lastHit.col}`);
      
      for (const hit of hits) {
        if (Math.random() < 0.4) {
          huntArea.add(`${hit.row},${hit.col - 1}`);
          huntArea.add(`${hit.row},${hit.col + 1}`);
        }
      }
    }

    for (const key of huntArea) {
      const [row, col] = key.split(',').map(Number);
      
      if (gameInstance.board?.isValidCoordinate(row, col)
          && this.canShootAt(row, col)
          && !this.memory.hits.has(key)) {
        
        const alreadyQueued = this.memory.targetQueue.some(t =>
          t.row === row && t.col === col
        );
        
        if (!alreadyQueued) {
          this.memory.targetQueue.push({ row, col });
        }
      }
    }

    console.log(`AI ${this.name} (aggressive): Searching for clustered ships - ${this.memory.targetQueue.length} targets queued`);
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
      targetQueue: [],
      huntDirection: null,
      huntLine: null,
      huntHits: [],
      checkerboard: new Set(),
      aggressivePhase: 'x4',
      aggressiveRings: []
    };
    console.log(`AI ${this.name} memory reset for new game`);
  }

  getAIStats() {
    return {
      strategy: this.strategy,
      difficulty: this.difficulty,
      hits: this.memory.hits.size,
      misses: this.misses, // Use Player stat (updated by Game.js)
      activeTargets: this.memory.targetQueue.length,
      huntDirection: this.memory.huntDirection,
      huntHits: this.memory.huntHits.length,
      aggressivePhase: this.memory.aggressivePhase
    };
  }
}

export default AiPlayer;
// EOF
