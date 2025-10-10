// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import Fleet from './Fleet.js';
import Alliance from './Alliance.js';
import Message from './Message.js';

const version = "v0.9.0";
/**
 * v0.9.0: Phase 4 Refactor - COMPLETE CLEANUP
 * - Removed shipOwnership Map (players own their ships via shipPlacements)
 * - Removed playerFleets Map (players own their fleet via setFleet)
 * - Removed getShipCells() method (use player.getShipCells() instead)
 * - Removed Board.rebuildCellHealthCache() call (cache removed from Board)
 * - Simplified registerShipPlacement() - no more dual-write, just player.shipPlacements
 * - Game now delegates all ship/placement data to Player objects
 * - Ship health computed on-demand from player.fleet, not cached
 *
 * v0.8.4: Phase 4 Refactor - VISUALIZER REMOVED (not used by any renderer)
 * - Removed Visualizer.js import and instance
 * - Updated recordDontShoot() calls (renamed from recordMiss)
 * - Fixed turn progression: 'destroyed' continues turn if turn_on_hit enabled
 * - dontShoot now includes both misses AND destroyed cells
 */

// Environment-aware CDN path
const SOUND_BASE_URL = process.env.REACT_APP_GAME_CDN || '';

class Game {
  constructor(eraConfig, gameMode = 'turnBased') {
    if (!eraConfig.game_rules) {
      throw new Error(`Era "${eraConfig.name}" is missing game_rules configuration`);
    }
    
    const requiredRules = ['turn_required', 'turn_on_hit', 'turn_on_miss'];
    const missingRules = requiredRules.filter(rule => eraConfig.game_rules[rule] === undefined);
    
    if (missingRules.length > 0) {
      throw new Error(`Era "${eraConfig.name}" missing game rules: ${missingRules.join(', ')}`);
    }

    this.id = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.eraConfig = eraConfig;
    this.gameMode = gameMode;
    
    this.state = 'setup';
    this.currentTurn = 0;
    this.currentPlayerIndex = 0;
    
    this.players = [];
    this.board = null;
    this.winner = null;
    
    this.alliances = new Map();
    this.playerAlliances = new Map();
    
    this.gameRules = { ...eraConfig.game_rules };
    this.message = new Message(this, eraConfig);
    
    this.actionQueue = [];
    this.isProcessingAction = false;
    this.animationSettings = {
      shotAnimation: 500,
      resultAnimation: 300,
      soundDelay: 200,
      speedFactor: 1.0,
      gameOverDelay: 6000
    };
    
    this.gameLog = [];
    this.startTime = null;
    this.endTime = null;
    this.turnTimeout = null;
    this.maxTurnTime = 30000;
    this.uiUpdateCallback = null;
    this.gameEndCallback = null;
    this.battleBoardRef = null;
    this.humanPlayerId = null;
    this.lastAttackResult = null;
    
    // Boost system (for future weapon upgrades)
    this.boosts = {};
    
    // Sound system
    this.soundEnabled = true;
    this.soundEffects = {};
    this.soundLoadErrors = [];
    this.initializeSounds();
    
    console.log(`[Game ${this.id}] Game created: ${this.id}, Mode: ${gameMode}`);
  }

  initializeSounds() {
    const soundFiles = {
      cannonBlast: 'cannon-blast.mp3',
      incomingWhistle: 'incoming-whistle.mp3',
      explosionBang: 'explosion-bang.mp3',
      splash: 'splash.mp3',
      sinkingShip: 'sinking-ship.mp3',
      victoryFanfare: 'victory-fanfare.mp3',
      funeralMarch: 'funeral-march.mp3'
    };

    Object.entries(soundFiles).forEach(([key, filename]) => {
      try {
        const fullPath = `${SOUND_BASE_URL}/sounds/${filename}`;
        const audio = new Audio(fullPath);
        audio.preload = 'auto';
        audio.load();
        this.soundEffects[key] = audio;
      } catch (error) {
        this.soundLoadErrors.push(key);
      }
    });
  }

  playSound(soundType, delay = 0) {
    if (!this.soundEnabled) return;
    
    setTimeout(() => {
      const audio = this.soundEffects[soundType];
      if (audio && audio.readyState >= 2) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }, delay);
  }

  toggleSound(enabled) {
    this.soundEnabled = enabled;
  }

  queueAction(action) {
    this.actionQueue.push(action);
    if (!this.isProcessingAction) {
      this.processNextAction();
    }
  }

  async processNextAction() {
    if (this.actionQueue.length === 0) {
      this.isProcessingAction = false;
      return;
    }
    
    this.isProcessingAction = true;
    const action = this.actionQueue.shift();
    
    try {
      await this.executeActionWithTiming(action);
      if (action.onComplete) {
        action.onComplete();
      }
    } catch (error) {
      console.error(`[ACTION QUEUE] Error:`, error);
    }
    
    setTimeout(() => this.processNextAction(), 0);
  }

  async executeActionWithTiming(action) {
    const { type, player, target } = action;
    
    if (type === 'ai_attack') {
      this.playSound('cannonBlast');
      this.notifyOpponentShot(target.row, target.col, 'firing');
      await this.delay(this.animationSettings.shotAnimation * this.animationSettings.speedFactor);
      
      const result = this.receiveAttack(target.row, target.col, player);
      
      this.notifyOpponentShot(target.row, target.col, result.result);
      await this.delay(this.animationSettings.resultAnimation * this.animationSettings.speedFactor);
      
      if (player.processAttackResult) {
        player.processAttackResult(target, result, this);
      }
      
      return result;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateAnimationSettings(settings) {
    this.animationSettings = { ...this.animationSettings, ...settings };
  }

  setUIUpdateCallback(callback) {
    this.uiUpdateCallback = callback;
  }

  setGameEndCallback(callback) {
    this.gameEndCallback = callback;
  }

  setBattleBoardRef(ref) {
    this.battleBoardRef = ref;
  }

  setHumanPlayerId(playerId) {
    this.humanPlayerId = playerId;
  }

  notifyUIUpdate() {
    if (this.uiUpdateCallback) {
      this.uiUpdateCallback();
    }
  }

  notifyGameEnd() {
    if (this.gameEndCallback) {
      this.gameEndCallback();
    }
  }

  notifyOpponentShot(row, col, result) {
    if (this.battleBoardRef?.current?.recordOpponentShot) {
      this.battleBoardRef.current.recordOpponentShot(row, col, result);
    }
  }

  /**
   * v0.9.0: Phase 4 - Players own their fleets, simplified
   * v0.8.0: Give player fleet reference via setFleet()
   * Players are persistent entities that survive individual games
   *
   * @param {Player} player - Existing Player object (HumanPlayer or AiPlayer)
   * @param {string} allianceName - Alliance name to join
   * @returns {Player} - The player object (for chaining)
   */
  addPlayer(player, allianceName) {
    if (this.players.length >= (this.eraConfig.max_players || 2)) {
      throw new Error(`Maximum ${this.eraConfig.max_players || 2} players allowed`);
    }

    // Reset player for new game (clears stats, placements, dontShoot)
    player.reset();

    // Give player the board reference if it already exists
    if (this.board) {
      player.setBoard(this.board);
    }

    // Alliance assignment
    if (!allianceName) {
      throw new Error(`Alliance name required for player ${player.name}`);
    }
    
    const alliance = Array.from(this.alliances.values()).find(a => a.name === allianceName);
    if (!alliance) {
      throw new Error(`Alliance not found: ${allianceName}`);
    }
    
    alliance.addPlayer(player);
    this.playerAlliances.set(player.id, alliance.id);
    
    // Create fleet for this game and give to player
    const fleet = Fleet.fromEraConfig(player.id, this.eraConfig, allianceName);
    player.setFleet(fleet);
    
    this.players.push(player);
    
    // Track human player ID
    if (player.type === 'human') {
      this.humanPlayerId = player.id;
    }
    
    this.battleLog(`${player.name}${player.type === 'ai' ? ' (ai)' : ''} joins the game`);
    
    return player;
  }

  initializeAlliances() {
    if (!this.eraConfig.alliances) {
      console.warn('No alliances defined in era config');
      return;
    }

    this.eraConfig.alliances.forEach(allianceConfig => {
      const alliance = Alliance.fromConfig(allianceConfig, null);
      this.alliances.set(alliance.id, alliance);
    });
  }

  /**
   * v0.8.0: Renamed from canAttack() with inverted logic for clarity
   * Check if two players are in the same alliance (including same player)
   *
   * @param {string} player1Id - First player ID
   * @param {string} player2Id - Second player ID
   * @returns {boolean} - True if same player or same alliance
   */
  isSameAlliance(player1Id, player2Id) {
    // Same player = same "alliance"
    if (player1Id === player2Id) return true;
    
    const alliance1 = this.playerAlliances.get(player1Id);
    const alliance2 = this.playerAlliances.get(player2Id);
    
    return alliance1 === alliance2;
  }

  calculateDamage(firingPlayer, targetPlayer, baseDamage = 0.5) {
    let finalDamage = baseDamage;

    // Apply attack boost if firing player has one
    const attackBoost = this.boosts?.[firingPlayer.id]?.attack || 0;
    if (attackBoost > 0) {
      finalDamage *= (1 + attackBoost);
    }

    // Apply defense boost if target player has one
    const defenseBoost = this.boosts?.[targetPlayer.id]?.defense || 0;
    if (defenseBoost > 0) {
      finalDamage *= (1 - defenseBoost);
    }

    return Math.max(0, finalDamage);
  }

  /**
   * v0.9.0: Phase 4 - Uses player.shipPlacements exclusively (no Board.cellContents)
   * v0.8.4: Phase 4 Refactor - Updated to use recordDontShoot()
   * v0.8.3: 4-STATE ATTACK RESULTS
   * Returns: 'hit', 'destroyed', 'all_destroyed', 'miss'
   *
   * @param {number} row - Row coordinate
   * @param {number} col - Column coordinate
   * @param {Player} firingPlayer - Player making the attack
   * @param {number} damage - Base damage amount (default 1.0)
   * @returns {Object} - {result: string, ships: [...], damage: number}
   */
  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    console.log(`[TARGETING] Called by ${firingPlayer.name} (${firingPlayer.type}) at ${row},${col}`);

    // 1. VALIDATE COORDINATES
    if (!this.board?.isValidCoordinate(row, col)) {
      const result = { result: 'invalid', ships: [] };
      this.lastAttackResult = result;
      return result;
    }

    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    
    // 2. FIND ALL ENEMY SHIPS AT THIS LOCATION (using player.shipPlacements)
    const liveTargets = [];
    const deadTargets = [];
    
    for (const targetPlayer of this.players) {
      // Skip if same alliance (includes self)
      if (this.isSameAlliance(firingPlayer.id, targetPlayer.id)) {
        continue;
      }
      
      // Check if this enemy has a ship at this location
      const placement = targetPlayer.getShipAt(row, col);
      if (!placement) {
        continue; // No ship here for this enemy
      }
      
      // Get the actual ship from the player's fleet
      const ship = targetPlayer.getShip(placement.shipId);
      if (!ship) {
        continue; // Ship not found (shouldn't happen)
      }
      
      // Check if this cell is alive or dead
      if (ship.health[placement.cellIndex] > 0) {
        // LIVE target
        liveTargets.push({
          player: targetPlayer,
          ship: ship,
          cellIndex: placement.cellIndex
        });
      } else {
        // DEAD target (already destroyed)
        deadTargets.push({
          player: targetPlayer,
          ship: ship,
          cellIndex: placement.cellIndex
        });
      }
    }
    
    // 3. DETERMINE INITIAL STATE
    const totalTargets = liveTargets.length + deadTargets.length;
    
    // 3a. MISS - No ships at this cell
    if (totalTargets === 0) {
      console.log(`[TARGETING] MISS - no ships at ${cellName}`);
      this.playSound('splash');
      firingPlayer.misses++;
      firingPlayer.recordDontShoot(row, col);
      
      this.message.post(this.message.types.MISS, {
        attacker: firingPlayer,
        position: cellName
      }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
      
      this.battleLog(`t${this.currentTurn}-Miss at ${cellName} by ${firingPlayer.name}`, 'miss');
      
      const result = { result: 'miss', ships: [] };
      this.lastAttackResult = result;
      return result;
    }
    
    // 3b. ALL_DESTROYED - Only dead ships at this cell (wasted shot)
    if (liveTargets.length === 0 && deadTargets.length > 0) {
      console.log(`[TARGETING] ALL_DESTROYED - wasted shot on dead cells at ${cellName}`);
      
      // No stats update, no sounds, no visual change
      const result = { result: 'all_destroyed', ships: [] };
      this.lastAttackResult = result;
      return result;
    }
    
    // 3c. HIT - At least one live ship at this cell
    console.log(`[TARGETING] HIT - ${liveTargets.length} live ships at ${cellName}`);
    this.playSound('incomingWhistle');
    this.playSound('explosionBang', 500);
    
    const hitResults = [];
    
    // 4. PROCESS HITS ON LIVE TARGETS
    for (const target of liveTargets) {
      const { player: targetPlayer, ship, cellIndex } = target;
      
      // Calculate and apply damage
      const finalDamage = this.calculateDamage(firingPlayer, targetPlayer, damage);
      const shipHealth = ship.receiveHit(cellIndex, finalDamage);
      
      const shipNowSunk = ship.isSunk();
      
      hitResults.push({
        ship: ship,
        player: targetPlayer,
        damage: finalDamage,
        shipHealth: shipHealth,
        shipSunk: shipNowSunk
      });
      
      // Individual ship sunk message
      if (shipNowSunk) {
        this.playSound('sinkingShip');
        this.message.post(this.message.types.SUNK, {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          position: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
        
        firingPlayer.sunk++;
        
        // Score with difficulty multiplier (only once per ship)
        const multiplier = (firingPlayer.type === 'human' && targetPlayer.type === 'ai')
          ? (targetPlayer.difficulty || 1.0)
          : 1.0;
        firingPlayer.score += Math.round(10 * multiplier);
        
        console.log(`[Game ${this.id}] ${firingPlayer.name} sunk ${targetPlayer.name}'s ${ship.name}: 10 * ${multiplier} = ${Math.round(10 * multiplier)} points`);
        
        this.battleLog(`t${this.currentTurn}-SUNK: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`, 'sunk');
      } else {
        // Hit but not sunk
        this.message.post(this.message.types.HIT, {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          position: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
        
        this.battleLog(`t${this.currentTurn}-HIT: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`, 'hit');
      }
    }
    
    // 5. UPDATE FIRING PLAYER STATS (both 'hit' and 'destroyed' award points)
    firingPlayer.hits++;
    firingPlayer.hitsDamage += hitResults.reduce((sum, h) => sum + h.damage, 0);
    
    // Score for hitting (once per cell, regardless of stacked ships)
    const multiplier = (firingPlayer.type === 'human' && hitResults[0]?.player?.type === 'ai')
      ? (hitResults[0].player.difficulty || 1.0)
      : 1.0;
    firingPlayer.score += Math.round(1 * multiplier);
    
    console.log(`[Game ${this.id}] ${firingPlayer.name} hit at ${cellName}: 1 * ${multiplier} = ${Math.round(1 * multiplier)} points`);
    
    // 6. CHECK IF CELL NOW FULLY DESTROYED (transition from 'hit' to 'destroyed')
    // After applying damage, check if ALL ships at cell are now dead
    let stillAliveAtCell = false;
    for (const target of liveTargets) {
      if (target.ship.health[target.cellIndex] > 0) {
        stillAliveAtCell = true;
        break;
      }
    }
    
    const cellNowFullyDestroyed = !stillAliveAtCell;
    
    // 7. DETERMINE FINAL RESULT
    // 'hit' = live cells remain, 'destroyed' = just killed last live cell
    const resultType = cellNowFullyDestroyed ? 'destroyed' : 'hit';
    
    // 8. MARK DESTROYED CELLS IN DONTSHOOT
    if (resultType === 'destroyed') {
      firingPlayer.recordDontShoot(row, col);
      console.log(`[TARGETING] Marked ${cellName} as dontShoot (destroyed)`);
    }
    
    // 9. RETURN RESULT
    const result = {
      result: resultType,
      ships: hitResults,
      damage,
      cellFullyDestroyed: cellNowFullyDestroyed
    };
    this.lastAttackResult = result;
    
    console.log(`[TARGETING] Final result: ${resultType}`);
    return result;
  }
  
  /**
   * v0.9.0: Phase 4 - Simplified, writes only to player.shipPlacements
   * No more dual-write to Board.cellContents
   */
  registerShipPlacement(ship, shipCells, orientation, playerId) {
    console.log(`[GAME] Attempting to place ${ship.name} for player ${playerId}`);
    
    // Validate board bounds and terrain
    if (!this.board.canPlaceShip(shipCells, ship.terrain)) {
      console.warn(`[GAME] Ship placement failed board validation (bounds/terrain)`);
      return false;
    }
    
    // Check for overlap with player's OWN ships (using player.shipPlacements)
    const player = this.getPlayer(playerId);
    if (!player) {
      console.warn(`[GAME] Player ${playerId} not found`);
      return false;
    }
    
    for (const cell of shipCells) {
      if (player.hasShipAt(cell.row, cell.col)) {
        console.warn(`[GAME] Player ${playerId} cannot overlap own ships at ${cell.row},${cell.col}`);
        return false;
      }
    }
    
    console.log(`[GAME] Placement validated, registering ${ship.name}`);
    
    // Write to player's shipPlacements map
    for (let i = 0; i < shipCells.length; i++) {
      const cell = shipCells[i];
      player.placeShip(cell.row, cell.col, ship.id, i);
    }
    
    return true;
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  setBoard(board) {
    this.board = board;

    console.log(`[BOARD] setBoard called - Players count: ${this.players.length}`);

    // Give all existing players the board reference
    this.players.forEach(player => {
      console.log(`[BOARD] Setting board for player: ${player.name}, had board: ${!!player.board}`);
      player.setBoard(board);
      console.log(`[BOARD] Player ${player.name} now has board: ${!!player.board}`);
    });
  }

  async startGame() {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players to start game');
    }
    
    if (!this.board) {
      this.board = new Board(this.eraConfig.rows, this.eraConfig.cols, this.eraConfig.terrain);
    }

    // Safety check - ensure all players have board reference
    this.players.forEach(player => {
      if (!player.board) {
        player.setBoard(this.board);
      }
    });

    // Place AI ships
    for (const player of this.players) {
      if (!player.fleet) {
        throw new Error(`Player ${player.name} has no fleet`);
      }
      
      if (player.type === 'ai' && !player.fleet.isPlaced()) {
        await this.autoPlaceShips(player);
      }
    }

    this.state = 'playing';
    this.startTime = new Date();
    this.currentPlayerIndex = 0;
    
    this.message.post(this.message.types.GAME_START, {
      eraName: this.eraConfig.name,
      players: this.players
    }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
    
    this.battleLog('Game started');
    this.postTurnMessage();
    this.checkAndTriggerAITurn();
    
    return true;
  }

  postTurnMessage() {
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      this.message.post(this.message.types.TURN, {
        player: currentPlayer,
        turnNumber: this.currentTurn
      }, [this.message.channels.UI]);
    }
  }

  async autoPlaceShips(player) {
    if (!player.fleet) {
      throw new Error(`[GAME] Player ${player.name} has no fleet`);
    }

    await player.autoPlaceShips(this, player.fleet);
    
    console.log(`[GAME] All ships placed for ${player.name}, final UI notification`);
    this.notifyUIUpdate();
  }
    
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  processPlayerAction(action, data) {
    const currentPlayer = this.getCurrentPlayer();
    
    if (action === 'attack') {
      return this.processAttack(currentPlayer, data.row, data.col);
    }
    
    throw new Error(`Unknown action: ${action}`);
  }

  processAttack(attacker, row, col) {
    if (this.state !== 'playing') {
      throw new Error('Game is not in playing state');
    }

    if (!this.isValidAttack(row, col, attacker)) {
      throw new Error('Invalid attack position');
    }

    if (attacker.type === 'human') {
      this.playSound('cannonBlast');
    }

    const result = this.receiveAttack(row, col, attacker);
    
    if (this.checkGameEnd()) {
      this.endGame();
      return result;
    }
    
    // Both 'hit' and 'destroyed' continue turn if turn_on_hit enabled
    const wasHit = (result.result === 'hit' || result.result === 'destroyed');
    this.handleTurnProgression(wasHit);
    
    return result;
  }
  
  checkGameEnd() {
    const activeAlliances = Array.from(this.alliances.values()).filter(alliance => {
      if (alliance.players.length === 0) return false;
      
      return alliance.players.some(player => {
        return !player.isDefeated();
      });
    });

    if (activeAlliances.length <= 1) {
      if (activeAlliances.length === 1) {
        const winningAlliance = activeAlliances[0];
        const survivingPlayers = winningAlliance.players.filter(player => {
          return !player.isDefeated();
        });
        this.winner = survivingPlayers[0] || winningAlliance.players[0];
        this.winningAlliance = winningAlliance;
      } else {
        this.winner = null;
        this.winningAlliance = null;
      }
      
      return true;
    }
    
    return false;
  }

  handleTurnProgression(wasHit) {
    if (!this.gameRules.turn_required) {
      return;
    }
    
    const shouldContinue = (wasHit && this.gameRules.turn_on_hit) ||
                         (!wasHit && this.gameRules.turn_on_miss);
    
    if (!shouldContinue) {
      this.nextTurn();
      this.checkAndTriggerAITurn();
    } else {
      this.checkAndTriggerAITurn();
    }
  }

  async checkAndTriggerAITurn() {
    if (this.state !== 'playing') return;
    
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer?.type === 'ai') {
      try {
        await this.executeAITurnQueued(currentPlayer);
      } catch (error) {
        console.error(`[GAME] AI turn failed for ${currentPlayer.name}:`, error);
        if (this.checkGameEnd()) {
          this.endGame();
        }
      }
    }
  }

  async executeAITurnQueued(aiPlayer) {
    if (!aiPlayer.makeMove) {
      throw new Error(`AI Player ${aiPlayer.name} missing makeMove method`);
    }
    
    const aiDecision = aiPlayer.makeMove(this);
    
    if (!aiDecision) {
      throw new Error(`AI Player ${aiPlayer.name} returned no move decision`);
    }
    
    this.queueAction({
      type: 'ai_attack',
      player: aiPlayer,
      target: aiDecision,
      onComplete: () => {
        if (this.checkGameEnd()) {
          this.endGame();
          return;
        }
        
        // Both 'hit' and 'destroyed' continue turn if turn_on_hit enabled
        const wasHit = (this.lastAttackResult?.result === 'hit' ||
                       this.lastAttackResult?.result === 'destroyed');
        
        this.handleTurnProgression(wasHit);
        this.notifyUIUpdate();
      }
    });
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentTurn++;
    
    this.postTurnMessage();
  }

  isValidAttack(row, col, firingPlayer) {
    if (!this.board) return false;
    
    // Only check if coordinate is valid on the board
    // Player manages their own dontShoot tracking via canShootAt()
    return this.board.isValidCoordinate(row, col);
  }
  
  endGame() {
    this.state = 'finished';
    this.endTime = new Date();
    
    if (this.battleBoardRef?.current?.captureBoard) {
      console.log(`[Game ${this.id}] Capturing final board state`);
      this.finalBoardImage = this.battleBoardRef.current.captureBoard();
      if (this.finalBoardImage) {
        console.log(`[Game ${this.id}] Board captured successfully (${this.finalBoardImage.length} bytes)`);
      }
    }
      
    const humanPlayer = this.players.find(p => p.id === this.humanPlayerId);
    const humanWon = this.winner && humanPlayer && this.winner.id === humanPlayer.id;
    
    if (humanWon) {
      console.log(`[Game ${this.id}] Human victory - playing fanfare in 1 second`);
      this.playSound('victoryFanfare', 1000);
    } else {
      console.log(`[Game ${this.id}] Human defeat - playing funeral march in 1 second`);
      this.playSound('funeralMarch', 1000);
    }
    
    this.message.post(this.message.types.GAME_END, {
      winner: this.winner,
      gameStats: this.getGameStats()
    }, [this.message.channels.CONSOLE, this.message.channels.UI, this.message.channels.LOG]);
    
    if (this.winner) {
      this.battleLog(`Game ended: ${this.winner.name} wins!`, 'victory');
    } else {
      this.battleLog('Game ended: Draw', 'draw');
    }

    this.cleanupTemporaryAlliances();
    
    console.log(`[Game ${this.id}] Delaying transition to OverPage by ${this.animationSettings.gameOverDelay}ms`);
    setTimeout(() => {
      console.log(`[Game ${this.id}] Notifying game end to CoreEngine`);
      this.notifyGameEnd();
    }, this.animationSettings.gameOverDelay);
  }

  cleanupTemporaryAlliances() {
    const temporaryAlliances = Array.from(this.alliances.values()).filter(alliance => !alliance.owner);
    
    temporaryAlliances.forEach(alliance => {
      this.alliances.delete(alliance.id);
    });

    this.playerAlliances.forEach((allianceId, playerId) => {
      if (!this.alliances.has(allianceId)) {
        this.playerAlliances.delete(playerId);
      }
    });
  }

  reset() {
    this.state = 'setup';
    this.currentTurn = 0;
    this.currentPlayerIndex = 0;
    this.winner = null;
    this.startTime = null;
    this.endTime = null;
    this.gameLog = [];
    
    this.actionQueue = [];
    this.isProcessingAction = false;
    this.lastAttackResult = null;
    
    if (this.board) {
      this.board.clear();
    }
    
    if (this.message) {
      this.message.clear();
    }
    
    this.players.forEach(player => {
      if (player.fleet) {
        player.fleet.ships.forEach(ship => ship.reset());
      }
      player.reset();
    });
  }

  getGameStats() {
    const duration = this.endTime ?
      Math.floor((this.endTime - this.startTime) / 1000) :
      Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
    
    const playerStats = this.players.map(player => {
      const fleet = player.fleet;
      
      return {
        name: player.name,
        type: player.type,
        difficulty: player.difficulty,
        shots: player.shots,
        hits: player.hits,
        misses: player.misses,
        sunk: player.sunk,
        hitsDamage: player.hitsDamage,
        accuracy: player.accuracy,
        averageDamage: player.averageDamage,
        damagePerShot: player.damagePerShot,
        shipsRemaining: fleet ? fleet.ships.filter(s => !s.isSunk()).length : 0,
        score: player.score
      };
    });

    return {
      gameId: this.id,
      duration: duration,
      totalTurns: this.currentTurn,
      winner: this.winner?.name || null,
      state: this.state,
      players: playerStats
    };
  }

  battleLog(message, type = 'info') {
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const timestamp = new Date().toISOString();
    
    const entry = {
      timestamp,
      elapsed: elapsed.toFixed(1),
      turn: this.currentTurn,
      message: `[BATTLE] ${message}`,
      type: type
    };
    
    this.gameLog.push(entry);
    console.log(`[GAME] ${this.id} | ${message}`);
  }
}

export default Game;
// EOF
