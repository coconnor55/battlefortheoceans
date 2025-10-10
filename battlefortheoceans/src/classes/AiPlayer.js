// src/classes/AiPlayer.js v0.5.0
// Copyright(c) 2025, Clint H. O'Connor
// v0.5.0: MAJOR OVERHAUL - Fixed all strategies and hunt modes
//         - Novice (0.7x): Random only, no hunt
//         - Methodical Random (1.0x): Checkerboard + basic hunt (reverse on line)
//         - Methodical Optimal (1.4x): Row-offset 4x4 grid + perpendicular hunt
//         - Aggressive (1.6x): Radiating rings + recursive perpendicular hunt
//         - AI-Hunt (1.8x): Probability heat map + advanced recursive hunt
//         Fixed hunt mode: proper reversal, perpendicular searches, recursion
// v0.4.9: Updated to match Game.js 4-state attack results

import Player from './Player.js';

const version = "v0.5.1";

export class AiPlayer extends Player {
  constructor(id, name, strategy = 'random', difficulty = 1.0) {
    super(id, name, 'ai', difficulty);
    
    this.strategy = strategy;
    
    // AI memory system
    this.memory = {
      hits: new Map(),          // Hit locations for hunt mode
      targetQueue: [],          // Queued targets from hunt mode
      huntDirection: null,      // 'horizontal' or 'vertical'
      huntLine: null,           // { row: X } or { col: Y }
      huntHits: [],            // Hits in current hunt
      huntReversed: false,      // Has hunt reversed direction?
      perpendicularDone: false, // Has perpendicular search been done?
      checkerboard: new Set(),  // For methodical strategies
      phase: 'primary',         // 'primary' or 'secondary' for multi-phase strategies
      aggressiveRings: [],      // Ring distances for aggressive strategy
      heatMap: null,            // Probability map for ai-hunt
      recursiveHunt: []         // Stack for recursive hunt mode
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
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (gameInstance.board?.isValidCoordinate(row, col) && this.canShootAt(row, col)) {
          targets.push({ row, col });
        }
      }
    }
    
    return targets;
  }

  selectTarget(availableTargets, gameInstance) {
    // Hunt mode for all strategies except random/novice
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
    // Initialize checkerboard on first use
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

    // Fallback to random if checkerboard exhausted
    return this.selectRandom(availableTargets);
  }

  selectMethodicalOptimal(availableTargets, gameInstance) {
    // Phase 1: Row-offset 4x4 grid pattern
    // Row 0: cols 0,4,8,12...
    // Row 1: cols 1,5,9,13...
    // Row 2: cols 2,6,10,14...
    // Row 3: cols 3,7,11,15...
    if (this.memory.phase === 'primary') {
      const phase1Targets = availableTargets.filter(target => {
        const offset = target.row % 4;
        return (target.col % 4 === offset);
      });
      
      if (phase1Targets.length > 0) {
        return phase1Targets[Math.floor(Math.random() * phase1Targets.length)];
      }

      // Phase 1 complete, switch to phase 2
      console.log(`AI ${this.name} (methodical_optimal): Switching to secondary phase (checkerboard)`);
      this.memory.phase = 'secondary';
    }

    // Phase 2: Remaining checkerboard pattern
    return this.selectMethodicalRandom(availableTargets, gameInstance);
  }

  selectAggressive(availableTargets, gameInstance) {
    const centerRow = Math.floor(gameInstance.eraConfig.rows / 2);
    const centerCol = Math.floor(gameInstance.eraConfig.cols / 2);

    // Phase 1: Row-offset 4x4 grid, radiating from center
    if (this.memory.phase === 'primary') {
      const phase1Targets = availableTargets.filter(target => {
        const offset = target.row % 4;
        return (target.col % 4 === offset);
      }).map(t => ({
        ...t,
        distance: Math.abs(t.row - centerRow) + Math.abs(t.col - centerCol)
      })).sort((a, b) => a.distance - b.distance);

      if (phase1Targets.length > 0) {
        // Pick from closest ring
        const minDistance = phase1Targets[0].distance;
        const closestRing = phase1Targets.filter(t => t.distance === minDistance);
        return closestRing[Math.floor(Math.random() * closestRing.length)];
      }

      // Phase 1 complete, switch to phase 2
      console.log(`AI ${this.name} (aggressive): Switching to secondary phase (checkerboard)`);
      this.memory.phase = 'secondary';
    }

    // Phase 2: Random checkerboard
    return this.selectMethodicalRandom(availableTargets, gameInstance);
  }

  selectAIHunt(availableTargets, gameInstance) {
    // Initialize or update heat map
    if (!this.memory.heatMap) {
      this.memory.heatMap = this.createHeatMap(gameInstance);
    } else {
      this.updateHeatMap(gameInstance);
    }

    // Find highest probability targets
    let maxProb = -1;
    const bestTargets = [];

    for (const target of availableTargets) {
      const prob = this.memory.heatMap[target.row]?.[target.col] || 0;
      if (prob > maxProb) {
        maxProb = prob;
        bestTargets.length = 0;
        bestTargets.push(target);
      } else if (prob === maxProb) {
        bestTargets.push(target);
      }
    }

    if (bestTargets.length > 0) {
      return bestTargets[Math.floor(Math.random() * bestTargets.length)];
    }

    // Fallback to checkerboard if heat map fails
    return this.selectMethodicalRandom(availableTargets, gameInstance);
  }

  createHeatMap(gameInstance) {
    const rows = gameInstance.eraConfig.rows;
    const cols = gameInstance.eraConfig.cols;
    const heatMap = Array(rows).fill(0).map(() => Array(cols).fill(0));

    // Get remaining ship sizes from opponent
    const opponent = gameInstance.players.find(p => p.id !== this.id);
    if (!opponent) return heatMap;

    const remainingShips = opponent.ships.filter(s => !s.isSunk());
    const shipSizes = remainingShips.map(s => s.length);

    // Calculate probability for each cell based on possible ship placements
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!this.canShootAt(row, col)) continue;

        let probability = 0;

        // Check horizontal placements
        for (const size of shipSizes) {
          for (let startCol = Math.max(0, col - size + 1); startCol <= col && startCol + size <= cols; startCol++) {
            if (this.canPlaceShipSegment(row, startCol, size, 'horizontal', gameInstance)) {
              probability += 1;
            }
          }
        }

        // Check vertical placements
        for (const size of shipSizes) {
          for (let startRow = Math.max(0, row - size + 1); startRow <= row && startRow + size <= rows; startRow++) {
            if (this.canPlaceShipSegment(startRow, col, size, 'vertical', gameInstance)) {
              probability += 1;
            }
          }
        }

        heatMap[row][col] = probability;
      }
    }

    return heatMap;
  }

  canPlaceShipSegment(startRow, startCol, size, orientation, gameInstance) {
    for (let i = 0; i < size; i++) {
      const row = orientation === 'vertical' ? startRow + i : startRow;
      const col = orientation === 'horizontal' ? startCol + i : startCol;
      
      if (!gameInstance.board?.isValidCoordinate(row, col) || !this.canShootAt(row, col)) {
        return false;
      }
    }
    return true;
  }

  updateHeatMap(gameInstance) {
    // Boost probabilities around known hits
    for (const [key, hitData] of this.memory.hits) {
      const [row, col] = key.split(',').map(Number);
      
      // Boost adjacent cells
      const adjacent = [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 }
      ];

      for (const adj of adjacent) {
        if (this.memory.heatMap[adj.row]?.[adj.col] !== undefined) {
          this.memory.heatMap[adj.row][adj.col] *= 2;
        }
      }
    }
  }

  hasActiveHunt() {
    return this.memory.huntHits.length > 0 ||
           this.memory.targetQueue.length > 0 ||
           this.memory.recursiveHunt.length > 0;
  }

  continueHunt(availableTargets, gameInstance) {
    const validTargets = new Set(
      availableTargets.map(t => `${t.row},${t.col}`)
    );

    // Detect direction after 2+ hits
    if (this.memory.huntHits.length >= 2 && !this.memory.huntDirection) {
      this.determineHuntDirection();
    }

    // Follow directional hunt
    if (this.memory.huntDirection && this.memory.huntLine) {
      const directionalTarget = this.getDirectionalTarget(validTargets, gameInstance);
      if (directionalTarget) {
        console.log(`AI ${this.name}: Following ${this.memory.huntDirection} direction${this.memory.huntReversed ? ' (reversed)' : ''}`);
        return directionalTarget;
      } else {
        // Hit a dead end
        if (!this.memory.huntReversed) {
          // First dead end - reverse direction
          this.memory.huntReversed = true;
          console.log(`AI ${this.name}: Reversing hunt direction`);
          const reversedTarget = this.getDirectionalTarget(validTargets, gameInstance);
          if (reversedTarget) {
            return reversedTarget;
          }
          // Reversed direction also hit dead end immediately - fall through to perpendicular
        }
        
        // Both directions exhausted, search perpendicular (for methodical_optimal, aggressive, ai-hunt)
        if (!this.memory.perpendicularDone &&
            (this.strategy === 'methodical_optimal' || this.strategy === 'aggressive' || this.strategy === 'ai-hunt')) {
          this.searchPerpendicular(gameInstance);
          this.memory.perpendicularDone = true;
        }
      }
    }

    // Process queued targets
    this.memory.targetQueue = this.memory.targetQueue.filter(target =>
      validTargets.has(`${target.row},${target.col}`)
    );

    if (this.memory.targetQueue.length > 0) {
      return this.memory.targetQueue.shift();
    }

    // Check recursive hunt stack (for aggressive/ai-hunt)
    if (this.memory.recursiveHunt.length > 0 &&
        (this.strategy === 'aggressive' || this.strategy === 'ai-hunt')) {
      const recursiveState = this.memory.recursiveHunt.pop();
      this.memory.huntHits = recursiveState.huntHits;
      this.memory.huntDirection = recursiveState.huntDirection;
      this.memory.huntLine = recursiveState.huntLine;
      this.memory.huntReversed = recursiveState.huntReversed;
      console.log(`AI ${this.name}: Resuming recursive hunt`);
      return this.continueHunt(availableTargets, gameInstance);
    }
    
    // No valid hunt targets, reset
    this.resetHuntMode();
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

    if (this.memory.huntDirection === 'horizontal') {
      // If not reversed, extend right; if reversed, extend left
      if (!this.memory.huntReversed) {
        const target = { row: this.memory.huntLine.row, col: lastHit.col + 1 };
        if (validTargets.has(`${target.row},${target.col}`)) {
          return target;
        }
      } else {
        const target = { row: this.memory.huntLine.row, col: firstHit.col - 1 };
        if (validTargets.has(`${target.row},${target.col}`)) {
          return target;
        }
      }
    } else {
      // If not reversed, extend down; if reversed, extend up
      if (!this.memory.huntReversed) {
        const target = { row: lastHit.row + 1, col: this.memory.huntLine.col };
        if (validTargets.has(`${target.row},${target.col}`)) {
          return target;
        }
      } else {
        const target = { row: firstHit.row - 1, col: this.memory.huntLine.col };
        if (validTargets.has(`${target.row},${target.col}`)) {
          return target;
        }
      }
    }

    return null;
  }

  searchPerpendicular(gameInstance) {
    if (this.memory.huntHits.length === 0) return;

    const perpendicularTargets = [];

    for (const hit of this.memory.huntHits) {
      const candidates = [];
      
      if (this.memory.huntDirection === 'horizontal') {
        // Search perpendicular (vertical)
        candidates.push({ row: hit.row - 1, col: hit.col });
        candidates.push({ row: hit.row + 1, col: hit.col });
      } else {
        // Search perpendicular (horizontal)
        candidates.push({ row: hit.row, col: hit.col - 1 });
        candidates.push({ row: hit.row, col: hit.col + 1 });
      }

      for (const candidate of candidates) {
        if (gameInstance.board?.isValidCoordinate(candidate.row, candidate.col) &&
            this.canShootAt(candidate.row, candidate.col)) {
          
          // For aggressive strategy, add every other perpendicular cell
          if (this.strategy === 'aggressive' || this.strategy === 'ai-hunt') {
            perpendicularTargets.push(candidate);
          }
          // For methodical_optimal, add one random perpendicular
          else if (this.strategy === 'methodical_optimal' && Math.random() < 0.5) {
            perpendicularTargets.push(candidate);
            break; // Only one random perpendicular
          }
        }
      }
    }

    // Add to queue
    for (const target of perpendicularTargets) {
      const alreadyQueued = this.memory.targetQueue.some(t =>
        t.row === target.row && t.col === target.col
      );
      
      if (!alreadyQueued) {
        this.memory.targetQueue.push(target);
      }
    }

    console.log(`AI ${this.name} (${this.strategy}): Added ${perpendicularTargets.length} perpendicular targets`);
  }

  processAttackResult(target, result, gameInstance) {
    const key = `${target.row},${target.col}`;
    
    if (result.result === 'hit' || result.result === 'destroyed') {
      // Record the hit (both 'hit' and 'destroyed' are successful hits)
      const shipInfo = result.ships && result.ships.length > 0 ? result.ships[0] : null;
      this.memory.hits.set(key, {
        shipId: shipInfo?.ship?.id,
        shipName: shipInfo?.ship?.name,
        timestamp: Date.now()
      });

      if (this.strategy !== 'random') {
        // Check if any ships fully sank using the ship's isSunk() method
        const anySunk = result.ships && result.ships.some(s => s.ship.isSunk());
        
        if (anySunk) {
          // Ship fully sunk - reset hunt mode
          console.log(`AI ${this.name}: Ship sunk! Resetting hunt mode`);
          this.resetHuntMode();
        } else {
          // Ship hit but not sunk - activate/continue hunt mode
          // Check if this is a perpendicular hit (for recursive hunting)
          const isPerpendicularHit = this.memory.huntDirection &&
            this.isPerpendicularToCurrentHunt(target);

          if (isPerpendicularHit &&
              (this.strategy === 'aggressive' || this.strategy === 'ai-hunt')) {
            // Save current hunt state and start recursive hunt
            console.log(`AI ${this.name}: Perpendicular hit! Starting recursive hunt`);
            this.memory.recursiveHunt.push({
              huntHits: [...this.memory.huntHits],
              huntDirection: this.memory.huntDirection,
              huntLine: this.memory.huntLine,
              huntReversed: this.memory.huntReversed
            });
            
            // Start new hunt from perpendicular hit
            this.memory.huntHits = [{ row: target.row, col: target.col }];
            this.memory.huntDirection = null;
            this.memory.huntLine = null;
            this.memory.huntReversed = false;
            this.memory.perpendicularDone = false;
          } else {
            // Normal hunt continuation or new hunt
            this.memory.huntHits.push({ row: target.row, col: target.col });
          }
          
          // Add 4-adjacent on first hit of current hunt
          if (this.memory.huntHits.length === 1) {
            this.addAdjacentTargets(target.row, target.col, gameInstance);
            console.log(`AI ${this.name}: First hit! Added 4-adjacent targets`);
          }
        }
      }
      
      console.log(`AI ${this.name}: ${result.result.toUpperCase()} at ${target.row},${target.col}`);
    }
    else if (result.result === 'miss') {
      console.log(`AI ${this.name}: MISS at ${target.row},${target.col}`);
    }
  }

  isPerpendicularToCurrentHunt(target) {
    if (!this.memory.huntDirection || !this.memory.huntLine) return false;

    if (this.memory.huntDirection === 'horizontal') {
      // Check if target is on a different row but same col as a hunt hit
      return this.memory.huntHits.some(hit =>
        hit.col === target.col && hit.row !== target.row
      );
    } else {
      // Check if target is on a different col but same row as a hunt hit
      return this.memory.huntHits.some(hit =>
        hit.row === target.row && hit.col !== target.col
      );
    }
  }

  addAdjacentTargets(row, col, gameInstance) {
    const adjacent = [
      { row: row - 1, col: col },
      { row: row + 1, col: col },
      { row: row, col: col - 1 },
      { row: row, col: col + 1 }
    ];

    // For ai-hunt, also add diagonals
    if (this.strategy === 'ai-hunt') {
      adjacent.push(
        { row: row - 1, col: col - 1 },
        { row: row - 1, col: col + 1 },
        { row: row + 1, col: col - 1 },
        { row: row + 1, col: col + 1 }
      );
    }

    for (const target of adjacent) {
      if (gameInstance.board?.isValidCoordinate(target.row, target.col) &&
          this.canShootAt(target.row, target.col)) {
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

  resetHuntMode() {
    this.memory.targetQueue = [];
    this.memory.huntDirection = null;
    this.memory.huntLine = null;
    this.memory.huntHits = [];
    this.memory.huntReversed = false;
    this.memory.perpendicularDone = false;
    this.memory.recursiveHunt = [];
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
      huntReversed: false,
      perpendicularDone: false,
      checkerboard: new Set(),
      phase: 'primary',
      aggressiveRings: [],
      heatMap: null,
      recursiveHunt: []
    };
    console.log(`AI ${this.name} memory reset for new game`);
  }

  getAIStats() {
    return {
      strategy: this.strategy,
      difficulty: this.difficulty,
      hits: this.memory.hits.size,
      misses: this.misses,
      activeTargets: this.memory.targetQueue.length,
      huntDirection: this.memory.huntDirection,
      huntHits: this.memory.huntHits.length,
      phase: this.memory.phase,
      recursiveDepth: this.memory.recursiveHunt.length
    };
  }
}

export default AiPlayer;
// EOF
