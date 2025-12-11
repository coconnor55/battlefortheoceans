// src/classes/CombatResolver.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.2: Fixed video event type detection
//         - Changed to use targetPlayer.isHuman getter instead of ID comparison
//         - Now correctly identifies when player's ship is sunk vs opponent's ship
//         - Fixes issue where same video was playing for both events
//         - Uses Player.isHuman property for consistency with Player class API
// v0.1.1: added totalDamage calculation
// v0.1.0: Extracted from Game.js v0.8.3
//         - receiveAttack() - 214 lines of combat resolution
//         - calculateDamage() - damage calculation with boosts
//         - processAttack() - attack validation and flow
//         - registerShipPlacement() - ship placement validation
//         - isValidAttack() - coordinate validation
//         - Reduces Game.js by ~300 lines

import MessageHelper from '../utils/MessageHelper';

const version = "v0.1.2";

/**
 * CombatResolver
 * 
 * Handles all combat mechanics for the Game class.
 * Extracted from Game.js to reduce file size and improve maintainability.
 * 
 * Responsibilities:
 * - Attack processing and validation
 * - Damage calculation with boosts
 * - Ship placement validation
 * - Hit/miss/sunk logic
 * - Progressive fog of war reveals
 * 
 * @example
 * const resolver = new CombatResolver(game);
 * const result = resolver.receiveAttack(5, 7, firingPlayer);
 */
class CombatResolver {
  constructor(game) {
    if (!game) {
      throw new Error('CombatResolver requires Game instance');
    }
    
    this.game = game;
    this.log('CombatResolver initialized');
  }
  
  /**
   * Calculate final damage with boosts and ship defense
   * 
   * @param {Player} firingPlayer - Attacking player
   * @param {Player} targetPlayer - Defending player
   * @param {Ship} targetShip - Ship being hit
   * @param {number} baseDamage - Base damage (default 1.0)
   * @returns {number} Final damage after all modifiers
   */
  calculateDamage(firingPlayer, targetPlayer, targetShip, baseDamage = 1.0) {
    let finalDamage = baseDamage;

    // Apply attacker boost
    const attackBoost = this.game.boosts?.[firingPlayer.id]?.attack || 0;
    if (attackBoost > 0) {
      finalDamage *= (1 + attackBoost);
    }

    // Apply defender boost
    const defenseBoost = this.game.boosts?.[targetPlayer.id]?.defense || 0;
    if (defenseBoost > 0) {
      finalDamage *= (1 - defenseBoost);
    }

    // Apply ship-specific defense
    if (targetShip?.defense) {
      finalDamage *= targetShip.defense;
      console.log(`[DAMAGE] Ship ${targetShip.name} (${targetShip.class}) defense: ${targetShip.defense}x`);
    }

    const result = Math.max(0, finalDamage);
    
    if (attackBoost > 0 || defenseBoost > 0 || targetShip?.defense !== 1.0) {
      console.log(`[DAMAGE] ${baseDamage.toFixed(2)} base -> ${finalDamage.toFixed(3)} final (attack: ${(1 + attackBoost).toFixed(2)}x, defense: ${(1 - defenseBoost).toFixed(2)}x, ship: ${targetShip?.defense?.toFixed(2) || 1.0}x)`);
    }

    return result;
  }
  
  /**
   * Process an attack at the specified coordinates
   * Main combat resolution method - handles targeting, damage, scoring, messages
   * 
   * @param {number} row - Target row
   * @param {number} col - Target column
   * @param {Player} firingPlayer - Player making the attack
   * @param {number} damage - Base damage (default 1.0)
   * @returns {Object} Attack result {result, ships, damage, cellFullyDestroyed}
   */
  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    const cellKey = `${row},${col}`;
    console.log(`[TARGETING] receiveAttack called by ${firingPlayer.name} at ${cellKey}, canShootAt=${firingPlayer.canShootAt(row, col)}, isDontShoot=${firingPlayer.isDontShoot(row, col)}`);

    // Validate coordinates
    if (!this.game.board?.isValidCoordinate(row, col)) {
      console.log(`[TARGETING] INVALID coordinates ${row},${col}`);
      const result = { result: 'invalid', ships: [] };
      this.game.lastAttackResult = result;
      return result;
    }

    const cellName = MessageHelper.formatCell(row, col);
    
    // Find all targets at this cell (multi-fleet support)
    const liveTargets = [];
    const deadTargets = [];
    
    for (const targetPlayer of this.game.players) {
      // Skip same alliance
      if (this.game.isSameAlliance(firingPlayer.id, targetPlayer.id)) {
        continue;
      }
      
      const placement = targetPlayer.getShipAt(row, col);
      if (!placement) {
        continue;
      }
      
      const ship = targetPlayer.getShip(placement.shipId);
      if (!ship) {
        continue;
      }
      
      // Categorize as live or dead
      if (ship.health[placement.cellIndex] > 0) {
        liveTargets.push({
          player: targetPlayer,
          ship: ship,
          cellIndex: placement.cellIndex
        });
      } else {
        deadTargets.push({
          player: targetPlayer,
          ship: ship,
          cellIndex: placement.cellIndex
        });
      }
    }
    
    const totalTargets = liveTargets.length + deadTargets.length;
    
    // MISS - no ships at cell
    if (totalTargets === 0) {
      console.log(`[TARGETING] MISS - no ships at ${cellName}`);
      this.game.playSound('splash');
      firingPlayer.misses++;
      firingPlayer.recordDontShoot(row, col);
      // Misses are NOT shared with alliance members - they need to discover empty cells themselves
      
      this.game.message.post('attack_miss', {
        attacker: firingPlayer,
        cell: cellName
      }, [this.game.message.channels.CONSOLE, this.game.message.channels.LOG]);
      
      this.game.battleLog(`t${this.game.currentTurn}-Miss at ${cellName} by ${firingPlayer.name}`, 'miss');
      
      const result = { result: 'miss', ships: [] };
      this.game.lastAttackResult = result;
      return result;
    }
    
    // ALL_DESTROYED - wasted shot on dead cells
    if (liveTargets.length === 0 && deadTargets.length > 0) {
      console.log(`[TARGETING] ALL_DESTROYED - wasted shot on dead cells at ${cellName}`);
      firingPlayer.recordDontShoot(row, col);
      console.log(`[TARGETING] ${firingPlayer.name} marked ${cellName} as dontShoot (all_destroyed)`);
      
      // Also mark for all alliance members
      const firingAlliance = this.game.playerAlliances.get(firingPlayer.id);
      for (const player of this.game.players) {
        if (player.id !== firingPlayer.id && this.game.playerAlliances.get(player.id) === firingAlliance) {
          player.recordDontShoot(row, col);
          console.log(`[TARGETING] ${player.name} (alliance) also marked ${cellName} as dontShoot (all_destroyed)`);
        }
      }
      
      const result = { result: 'all_destroyed', ships: [] };
      this.game.lastAttackResult = result;
      return result;
    }
    
    // HIT - process all live targets at cell
    console.log(`[TARGETING] HIT - ${liveTargets.length} live ships at ${cellName}`);
    this.game.playSound('incomingWhistle');
    this.game.playSound('explosionBang', 500);
    
    const hitResults = [];
    
    for (const target of liveTargets) {
      const { player: targetPlayer, ship, cellIndex } = target;
      
      // Calculate and apply damage
      const finalDamage = this.calculateDamage(firingPlayer, targetPlayer, ship, damage);
      const shipHealth = ship.receiveHit(cellIndex, finalDamage);
      
      const shipNowSunk = ship.isSunk();
      const revealLevel = ship.getRevealLevel();
      
      hitResults.push({
        ship: ship,
        player: targetPlayer,
        damage: finalDamage,
        shipHealth: shipHealth,
        shipSunk: shipNowSunk,
        revealLevel: revealLevel
      });
      
      // Handle ship sunk
      if (shipNowSunk) {
        this.game.playSound('sinkingShip');
        this.game.message.post('ship_sunk', {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          shipClass: ship.class,
          cell: cellName
        }, [this.game.message.channels.CONSOLE, this.game.message.channels.LOG]);
        
        firingPlayer.sunk++;
        
        // Score calculation (difficulty multiplier)
        const multiplier = (firingPlayer.type === 'human' && targetPlayer.type === 'ai')
          ? (targetPlayer.difficulty || 1.0)
          : 1.0;
        firingPlayer.score += Math.round(10 * multiplier);
        
        console.log(`[Game ${this.game.id}] ${firingPlayer.name} sunk ${targetPlayer.name}'s ${ship.name}: 10 * ${multiplier} = ${Math.round(10 * multiplier)} points`);
        
        this.game.battleLog(`t${this.game.currentTurn}-SUNK: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`, 'sunk');
        
        // v0.8.2: Only trigger ship sunk callback if game won't end
        // Check if target player is now defeated (might end game)
        const targetWillBeDefeated = targetPlayer.fleet.ships.every(s => s.isSunk());
        
        // Check if this would end the game (all opponents defeated)
        let gameWillEnd = false;
        if (targetWillBeDefeated) {
          const activeAlliances = Array.from(this.game.alliances.values()).filter(alliance => {
            if (alliance.players.length === 0) return false;
            return alliance.players.some(player => {
              // Simulate what checkGameEnd() will see
              if (player.id === targetPlayer.id) return false; // This player is defeated
              return !player.isDefeated();
            });
          });
          gameWillEnd = activeAlliances.length <= 1;
        }
        
        // Only trigger video if game won't end (let victory/defeat video play instead)
        if (this.game.onShipSunk && !gameWillEnd) {
          // Check if the target player is the human player to determine video type
          const eventType = targetPlayer.isHuman ? 'player' : 'opponent';
          this.game.onShipSunk(eventType, {
            ship: ship,
            attacker: firingPlayer,
            target: targetPlayer,
            cell: cellName
          });
        } else if (gameWillEnd) {
          console.log(`[Game ${this.game.id}] Skipping ship sunk video - game will end (victory/defeat will play instead)`);
        }
      } else {
        // Ship damaged but not sunk - progressive fog of war messaging
        let messageType;
        const messageContext = {
          attacker: firingPlayer,
          target: targetPlayer,
          cell: cellName,
          opponent: targetPlayer.name
        };
        
        if (revealLevel === 'critical') {
          messageType = 'attack_hit_critical';
          messageContext.shipClass = ship.class;
          messageContext.shipName = ship.name;
        } else if (revealLevel === 'size-hint') {
          const sizeCategory = ship.getSizeCategory();
          messageType = `attack_hit_size_${sizeCategory}`;
          messageContext.sizeCategory = sizeCategory;
        } else {
          // revealLevel === 'hit' or 'hidden' - show unknown message
          messageType = 'attack_hit_unknown';
        }
        
        this.game.message.post(messageType, messageContext,
          [this.game.message.channels.CONSOLE, this.game.message.channels.LOG]);
        
        this.game.battleLog(`t${this.game.currentTurn}-HIT: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name} [${revealLevel}]`, 'hit');
      }
    }
    
    // Update firing player stats
      const totalDamageDealt = hitResults.reduce((sum, h) => sum + h.damage, 0);
    firingPlayer.hits++;
    firingPlayer.hitsDamage += hitResults.reduce((sum, h) => sum + h.damage, 0);
      firingPlayer.totalDamage = (firingPlayer.totalDamage || 0) + totalDamageDealt;
    
    // Score for hit (difficulty multiplier)
    const multiplier = (firingPlayer.type === 'human' && hitResults[0]?.player?.type === 'ai')
      ? (hitResults[0].player.difficulty || 1.0)
      : 1.0;
    firingPlayer.score += Math.round(1 * multiplier);
    
    console.log(`[Game ${this.game.id}] ${firingPlayer.name} hit at ${cellName}: 1 * ${multiplier} = ${Math.round(1 * multiplier)} points`);
    
    // Check if cell is fully destroyed (all ships at cell are dead)
    let stillAliveAtCell = false;
    for (const target of liveTargets) {
      if (target.ship.health[target.cellIndex] > 0) {
        stillAliveAtCell = true;
        break;
      }
    }
    
    const cellNowFullyDestroyed = !stillAliveAtCell;
    const resultType = cellNowFullyDestroyed ? 'destroyed' : 'hit';
    
    // Mark destroyed cells so AI won't shoot there again
    // All players in the same alliance should also record it
    if (resultType === 'destroyed') {
      firingPlayer.recordDontShoot(row, col);
      console.log(`[TARGETING] ${firingPlayer.name} marked ${cellName} as dontShoot (destroyed)`);
      
      // Also mark for all alliance members
      const firingAlliance = this.game.playerAlliances.get(firingPlayer.id);
      for (const player of this.game.players) {
        if (player.id !== firingPlayer.id && this.game.playerAlliances.get(player.id) === firingAlliance) {
          player.recordDontShoot(row, col);
          console.log(`[TARGETING] ${player.name} (alliance) also marked ${cellName} as dontShoot`);
        }
      }
    }
    
    const result = {
      result: resultType,
      ships: hitResults,
      damage,
      cellFullyDestroyed: cellNowFullyDestroyed
    };
    this.game.lastAttackResult = result;
    
    console.log(`[TARGETING] Final result: ${resultType}`);
    return result;
  }
  
  /**
   * Validate and register ship placement
   * 
   * @param {Ship} ship - Ship to place
   * @param {Array} shipCells - Array of {row, col} cells
   * @param {number} orientation - Ship orientation (0, 90, 180, 270)
   * @param {string} playerId - Player ID
   * @returns {boolean} Success/failure
   */
  registerShipPlacement(ship, shipCells, orientation, playerId) {
    // Find player first
    const player = this.game.getPlayer(playerId);
    console.log(`[GAME] Attempting to place ${ship.name} for player ${player?.name || playerId}`);
    
    // Validate board boundaries and terrain
    if (!this.game.board.canPlaceShip(shipCells, ship.terrain)) {
      // Detailed failure logging
      const playerName = player?.name || playerId;
      console.warn(`[GAME] ${playerName}: ${ship.name} placement FAILED - cells:`, shipCells);
      console.warn(`[GAME] ${playerName}: ${ship.name} requires terrain:`, ship.terrain);
      
      // Check each cell individually to find the problem
      shipCells.forEach(({ row, col }) => {
        const inBounds = this.game.board.isValidCoordinate(row, col);
        const terrain = inBounds ? this.game.board.terrain[row][col] : 'OUT_OF_BOUNDS';
        const terrainOk = ship.terrain.includes(terrain);
        console.warn(`[GAME]   Cell ${row},${col}: terrain=${terrain}, inBounds=${inBounds}, terrainOk=${terrainOk}`);
      });
      
      return false;
    }
    if (!player) {
      console.warn(`[GAME] Player ${playerId} not found`);
      return false;
    }
    
    // Check for overlaps with player's own ships
    for (const cell of shipCells) {
      if (player.hasShipAt(cell.row, cell.col)) {
        console.warn(`[GAME] Player ${playerId} cannot overlap own ships at ${cell.row},${cell.col}`);
        return false;
      }
    }
    
    console.log(`[GAME] Placement validated, registering ${ship.name} (${orientation})`);
    
    // Register placement with player
    for (let i = 0; i < shipCells.length; i++) {
      const cell = shipCells[i];
      player.placeShip(cell.row, cell.col, ship.id, i, orientation);
    }
    
    return true;
  }
  
  /**
   * Process attack with full game flow (validation, damage, turn progression)
   * 
   * @param {Player} attacker - Attacking player
   * @param {number} row - Target row
   * @param {number} col - Target column
   * @returns {Object} Attack result
   */
  processAttack(attacker, row, col) {
    if (this.game.state !== 'playing') {
      throw new Error('Game is not in playing state');
    }

    if (!this.isValidAttack(row, col, attacker)) {
      throw new Error('Invalid attack position');
    }

    // Play attack sound for human players
    if (attacker.type === 'human') {
      this.game.playSound('cannonBlast');
    }

    // Execute attack
    const result = this.receiveAttack(row, col, attacker);
    
    // Check if game ended
    if (this.game.checkGameEnd()) {
      this.game.endGame();
      return result;
    }
    
    // Handle turn progression
    const wasHit = (result.result === 'hit' || result.result === 'destroyed');
    this.game.handleTurnProgression(wasHit);
    
    return result;
  }
  
  /**
   * Validate attack coordinates
   * 
   * @param {number} row - Target row
   * @param {number} col - Target column
   * @param {Player} firingPlayer - Player making the attack
   * @returns {boolean} True if valid attack
   */
  isValidAttack(row, col, firingPlayer) {
    if (!this.game.board) return false;
    
    return this.game.board.isValidCoordinate(row, col);
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CombatResolver ${version}] ${message}`);
  }
}

export default CombatResolver;
// EOF
