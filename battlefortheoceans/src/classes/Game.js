// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import Fleet from './Fleet.js';
import Alliance from './Alliance.js';
import Message from './Message.js';
import CombatResolver from './CombatResolver.js';
import SoundManager from '../utils/SoundManager.js';
import GameLifecycleManager from './GameLifecycleManager.js';

const version = "v0.8.14";
/**
 * v0.8.14: Removed gameMode parameter - game is always turn-based
 *          - Constructor now takes (eraConfig, gameConfig) instead of (eraConfig, gameMode, gameConfig)
 *          - Removed this.gameMode property
 * v0.8.13: [Previous version notes retained]
 * v0.8.12: Torpedo path calculation fixed - stops at first enemy ship, land/excluded, or 10 cells
 *          - calculateLinePath now stops when encountering enemy ship, land, or excluded terrain
 *          - Path length is counted up to first blocking cell (enemy ship/land/excluded) or 10 cells max
 *          - Red line rendering now correctly draws to the calculated path length
 *
 * v0.8.11: Torpedo stops at land/excluded cells - no explosion
 *          - calculateLinePath stops when encountering land or excluded terrain
 *          - fireTorpedo does not apply damage if torpedo stopped at land/excluded
 *          - Red line rendering stops at the last water cell before land/excluded
 * v0.8.10: Skip animation delays when speedFactor is 0 (instant mode for autoplay)
 *          - When speedFactor === 0, animations are skipped entirely
 *          - Allows autoplay to proceed without waiting for animations
 *          - speedFactor can now be 0 (instant) or > 0 (scaled delays)
 * v0.8.9: Added animation speed factor safety
 * - animationSettings now default speedFactor to 1.0
 * - executeActionWithTiming guards against undefined/invalid speed factors
 * - updateAnimationSettings normalizes speedFactor overrides
 * v0.8.8: Renamed resources to munitions for better semantics
 * - Renamed this.resources → this.munitions (star shells, scatter shot are munitions, not resources)
 * - Renamed initializeResources() → initializeMunitions()
 * - Renamed handleStarShellFired() → fireMunition(munitionType, row, col)
 * - More extensible for future munition types (flares, torpedoes, depth charges)
 * - Era configs should change "resources" to "munitions" as well
 * v0.8.7: Added resource management and statistics methods from CoreEngine
 * - Added this.resources to constructor for star shells, scatter shot
 * - Added initializeResources() to set resource counts
 * - Added handleStarShellFired() - game logic for star shell consumption
 * - Added getPlayerStats() - aggregate player statistics for UI
 * - Game logic now centralized in Game.js, not CoreEngine
 * v0.8.6: Refactored to use GameLifecycleManager utility class
 * - Extracted ~131 lines of lifecycle logic to GameLifecycleManager.js
 * - checkGameEnd(), endGame(), cleanupTemporaryAlliances(), reset() now in GameLifecycleManager
 * - Game.js delegates lifecycle methods to lifecycleManager
 * - Reduced Game.js from 695 lines to ~564 lines
 * v0.8.5: Refactored to use SoundManager utility class
 * - Extracted ~40 lines of sound logic to SoundManager.js
 * - initializeSounds(), playSound(), toggleSound() now in SoundManager
 * - Game.js delegates sound methods to soundManager
 * - Reduced Game.js from 726 lines to ~686 lines
 * v0.8.4: Refactored to use CombatResolver utility class
 * - Extracted ~300 lines of combat logic to CombatResolver.js
 * - receiveAttack(), calculateDamage(), processAttack(), registerShipPlacement(), isValidAttack()
 * - Game.js now delegates combat methods to combatResolver
 * - Reduced Game.js from 1002 lines to ~700 lines
 * v0.8.3: Added onGameOver callback for synchronous victory/defeat video triggers
 * - Follows same pattern as onShipSunk (v0.8.1)
 * - Calls callback immediately when game ends, before delays
 * - Passes event type ('victory' or 'defeat') and game details
 * - Eliminates need for useEffect monitoring in React
 * v0.8.2: Skip ship sunk video if it's the winning/losing shot
 * - Checks if game will end before triggering onShipSunk callback
 * - Prevents conflict between sunkopponent and victory videos
 * - Only victory/defeat video plays when game ends
 * v0.8.1: Added onShipSunk callback for synchronous video triggers
 * - Game calls callback immediately when ship sinks in receiveAttack()
 * - Passes event type ('player' or 'opponent') and ship details
 * - Eliminates need for polling/monitoring in React
 * v0.8.0: Added addPlayerWithFleet() for multi-fleet combat
 * - Allows assigning specific ships to AI captains (Pirates of the Gulf)
 * - Keeps addPlayer() unchanged for Traditional/Midway compatibility
 * v0.7.6: Fixed board snapshot timing
 * - Snapshot now taken AFTER fire animations clear (2s delay)
 * - Prevents fire emoji from appearing in final board image
 * - Sequence: endGame() → wait 2s → capture → wait 4s → notify
 * v0.7.5: Pass orientation to player.placeShip() for rendering
 * v0.7.4: Fixed fallback message type
 * v0.7.3: Progressive Fog of War Integration
 */

class Game {
  constructor(eraConfig, gameConfig = null) {
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
    this.gameConfig = gameConfig;
    
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
      fireAnimationClearDelay: 3000, // Wait for fire to clear
      gameOverDelay: 2000, // After snapshot, shorter delay
      speedFactor: 1
    };
    
    this.gameLog = [];
    this.startTime = null;
    this.endTime = null;
    this.turnTimeout = null;
    this.maxTurnTime = 30000;
    this.uiUpdateCallback = null;
    this.gameEndCallback = null;
    this.onShipSunk = null; // v0.8.1: Callback for ship sunk events
    this.onGameOver = null; // v0.8.3: Callback for game over events
    this.battleBoardRef = null;
    this.humanPlayerId = null;
    this.lastAttackResult = null;
    
    // Boost system (for future weapon upgrades)
    this.boosts = {};
    
    // v0.8.8: Munitions management (star shells, scatter shot, etc.)
    this.munitions = {
      starShells: 0,
      scatterShot: 0
    };
    
    // Torpedo path for rendering (set when torpedo is fired)
    this.torpedoPath = null;
    
    // Combat resolver (v0.8.4)
    this.combatResolver = new CombatResolver(this);
    
    // Sound manager (v0.8.5)
    this.soundManager = new SoundManager();
    
    // Lifecycle manager (v0.8.6)
    this.lifecycleManager = new GameLifecycleManager(this);
    
    console.log(`[GAME] ${this.id} Game created: ${this.id}`);
  }

  playSound(soundType, delay = 0) {
    this.soundManager.playSound(soundType, delay);
  }

  toggleSound(enabled) {
    this.soundManager.toggleSound(enabled);
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
      const speedFactor = Number.isFinite(this.animationSettings.speedFactor) && this.animationSettings.speedFactor >= 0
        ? this.animationSettings.speedFactor
        : 1;
    
    // Skip animation delays when speedFactor is 0 (instant mode for autoplay)
    const skipAnimations = speedFactor === 0;
    
    if (type === 'ai_attack') {
      this.playSound('cannonBlast');
      this.notifyOpponentShot(target.row, target.col, 'firing');
      
      // Only delay if not skipping animations
      if (!skipAnimations) {
        await this.delay(this.animationSettings.shotAnimation * speedFactor);
      }
      
      const result = this.receiveAttack(target.row, target.col, player);
      
      this.notifyOpponentShot(target.row, target.col, result.result);
      
      // Only delay if not skipping animations
      if (!skipAnimations) {
        await this.delay(this.animationSettings.resultAnimation * speedFactor);
      }
      
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
      const normalizedSettings = { ...settings };
      if (Object.prototype.hasOwnProperty.call(normalizedSettings, 'speedFactor')) {
        const parsed = Number(normalizedSettings.speedFactor);
        // Allow 0 (instant mode) or any positive number
        normalizedSettings.speedFactor =
          Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
      }
      this.animationSettings = { ...this.animationSettings, ...normalizedSettings };
  }

  setUIUpdateCallback(callback) {
    this.uiUpdateCallback = callback;
  }

  setGameEndCallback(callback) {
    this.gameEndCallback = callback;
  }

  setOnShipSunk(callback) {
    this.onShipSunk = callback;
  }

  setOnGameOver(callback) {
    this.onGameOver = callback;
  }

  setBattleBoardRef(ref) {
    this.battleBoardRef = ref;
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

  addPlayer(player, allianceName) {
    if (this.players.length >= (this.eraConfig.max_players || 2)) {
      throw new Error(`Maximum ${this.eraConfig.max_players || 2} players allowed`);
    }

    player.reset();

    if (this.board) {
      player.setBoard(this.board);
    }

    if (!allianceName) {
      throw new Error(`Alliance name required for player ${player.name}`);
    }
    
    const alliance = Array.from(this.alliances.values()).find(a => a.name === allianceName);
    if (!alliance) {
      throw new Error(`Alliance not found: ${allianceName}`);
    }
    
    alliance.addPlayer(player);
    this.playerAlliances.set(player.id, alliance.id);
    
    const fleet = Fleet.fromEraConfig(player.id, this.eraConfig, allianceName);
    player.setFleet(fleet);
    
    this.players.push(player);
    
    if (player.type === 'human') {
      this.humanPlayerId = player.id;
    }
    
    this.battleLog(`${player.name}${player.type === 'ai' ? ' (ai)' : ''} joins the game`);
    
    return player;
  }
    
    /**
     * Add player with specific fleet (for multi-fleet combat like Pirates)
     * v0.8.0: New method for assigning specific ships to AI captains
     * @param {Player} player - Player instance
     * @param {string} allianceName - Alliance name
     * @param {Array} ships - Array of ship configs
     * @returns {Player} - The added player
     */
    addPlayerWithFleet(player, allianceName, ships) {
      if (this.players.length >= (this.eraConfig.max_players || 2)) {
        throw new Error(`Maximum ${this.eraConfig.max_players || 2} players allowed`);
      }

      player.reset();

      if (this.board) {
        player.setBoard(this.board);
      }

      if (!allianceName) {
        throw new Error(`Alliance name required for player ${player.name}`);
      }
      
      const alliance = Array.from(this.alliances.values()).find(a => a.name === allianceName);
      if (!alliance) {
        throw new Error(`Alliance not found: ${allianceName}`);
      }
      
      alliance.addPlayer(player);
      this.playerAlliances.set(player.id, alliance.id);
      
      // KEY DIFFERENCE: Create fleet from specific ships array instead of alliance config
      const fleet = Fleet.fromShipArray(player.id, ships, allianceName, this.eraConfig);
      player.setFleet(fleet);
      
      this.players.push(player);
      
      if (player.type === 'human') {
        this.humanPlayerId = player.id;
      }
      
      this.battleLog(`${player.name}${player.type === 'ai' ? ' (ai)' : ''} joins ${allianceName} with ${ships.length} ships`);
      
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

  isSameAlliance(player1Id, player2Id) {
    if (player1Id === player2Id) return true;
    
    const alliance1 = this.playerAlliances.get(player1Id);
    const alliance2 = this.playerAlliances.get(player2Id);
    
    return alliance1 === alliance2;
  }

  calculateDamage(firingPlayer, targetPlayer, targetShip, baseDamage = 1.0) {
    return this.combatResolver.calculateDamage(firingPlayer, targetPlayer, targetShip, baseDamage);
  }

  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    return this.combatResolver.receiveAttack(row, col, firingPlayer, damage);
  }
  
  registerShipPlacement(ship, shipCells, orientation, playerId) {
    return this.combatResolver.registerShipPlacement(ship, shipCells, orientation, playerId);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  setBoard(board) {
    this.board = board;

    console.log(`[BOARD] setBoard called - Players count: ${this.players.length}`);

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

    this.players.forEach(player => {
      if (!player.board) {
        player.setBoard(this.board);
      }
    });

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
    
    // Notify UI that game state has changed (message system will update turn message)
    this.notifyUIUpdate();
    
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
    return this.combatResolver.processAttack(attacker, row, col);
  }
  
  checkGameEnd() {
    return this.lifecycleManager.checkGameEnd();
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
    console.log(`[GAME] checkAndTriggerAITurn: currentPlayerIndex=${this.currentPlayerIndex}, currentPlayer=${currentPlayer?.name}, type=${currentPlayer?.type}, players=${this.players.map(p => p.name).join(',')}`);
    
    if (currentPlayer?.type === 'ai') {
      console.log(`[GAME] Executing AI turn for ${currentPlayer.name}`);
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
      console.error(`[GAME] AI Player ${aiPlayer.name} missing makeMove method`);
      throw new Error(`AI Player ${aiPlayer.name} missing makeMove method`);
    }
    
    let aiDecision;
    try {
      aiDecision = aiPlayer.makeMove(this);
      console.log(`[GAME] AI ${aiPlayer.name} makeMove returned:`, aiDecision);
    } catch (error) {
      console.error(`[GAME] AI ${aiPlayer.name} makeMove threw error:`, error);
      throw error;
    }
    
    if (!aiDecision) {
      console.error(`[GAME] AI Player ${aiPlayer.name} returned no move decision (null/undefined)`);
      throw new Error(`AI Player ${aiPlayer.name} returned no move decision`);
    }
    
    if (typeof aiDecision.row !== 'number' || typeof aiDecision.col !== 'number') {
      console.error(`[GAME] AI Player ${aiPlayer.name} returned invalid decision:`, aiDecision);
      throw new Error(`AI Player ${aiPlayer.name} returned invalid target coordinates`);
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
        
        const wasHit = (this.lastAttackResult?.result === 'hit' ||
                       this.lastAttackResult?.result === 'destroyed');
        
        this.handleTurnProgression(wasHit);
        this.notifyUIUpdate();
      }
    });
  }

  nextTurn() {
    const oldIndex = this.currentPlayerIndex;
    const oldPlayer = this.players[oldIndex];
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentTurn++;
    const newPlayer = this.players[this.currentPlayerIndex];
    
    console.log(`[GAME] nextTurn: ${oldPlayer?.name} (index ${oldIndex}) -> ${newPlayer?.name} (index ${this.currentPlayerIndex}), turn ${this.currentTurn}`);
    
    this.postTurnMessage();
  }

  isValidAttack(row, col, firingPlayer) {
    return this.combatResolver.isValidAttack(row, col, firingPlayer);
  }
  
  endGame() {
    this.lifecycleManager.endGame();
  }

  cleanupTemporaryAlliances() {
    this.lifecycleManager.cleanupTemporaryAlliances();
  }

  reset() {
    this.lifecycleManager.reset();
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

  // v0.8.8: Munitions management methods
  initializeMunitions(starShells = 0, scatterShot = 0) {
    this.munitions.starShells = starShells;
    this.munitions.scatterShot = scatterShot;
    console.log(`[GAME] ${this.id} Munitions initialized:`, this.munitions);
  }

  fireMunition(munitionType, row, col) {
    if (this.state !== 'playing') {
      console.log(`[GAME] ${this.id} Munition blocked - game not active`);
      return false;
    }
    
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer?.type !== 'human') {
      console.log(`[GAME] ${this.id} Munition blocked - not human turn`);
      return false;
    }
    
    // Validate munition type and availability
    const munitionKey = munitionType === 'starShell' ? 'starShells' :
                        munitionType === 'scatterShot' ? 'scatterShot' : null;
    
    if (!munitionKey || !this.munitions || this.munitions[munitionKey] <= 0) {
      console.log(`[GAME] ${this.id} ${munitionType} blocked - none remaining`);
      return false;
    }
    
    console.log(`[GAME] ${this.id} ${munitionType} fired at (${row}, ${col})`);
    
    // Decrement munition count
    this.munitions[munitionKey] = Math.max(0, this.munitions[munitionKey] - 1);
    
    // Handle scatter shot damage pattern (3x3, damage from config)
    if (munitionType === 'scatterShot') {
      const scatterDamage = this.gameConfig?.munitions_damage?.scatter_shot ?? 0.1;
      const hitCells = [];
      
      // 3x3 pattern centered on target cell
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const targetRow = row + dr;
          const targetCol = col + dc;
          
          // Validate coordinates
          if (this.board?.isValidCoordinate(targetRow, targetCol)) {
            // Apply damage to this cell
            const attackResult = this.receiveAttack(targetRow, targetCol, currentPlayer, scatterDamage);
            if (attackResult && attackResult.result !== 'invalid') {
              hitCells.push({ row: targetRow, col: targetCol, result: attackResult });
            }
          }
        }
      }
      
      console.log(`[GAME] ${this.id} Scatter shot hit ${hitCells.length} cells`);
      
      // Update last attack result with scatter shot summary
      let anyHit = false;
      if (hitCells.length > 0) {
        anyHit = hitCells.some(h => h.result.result === 'hit' || h.result.result === 'destroyed');
        const anyDestroyed = hitCells.some(h => h.result.result === 'destroyed');
        
        this.lastAttackResult = {
          result: anyDestroyed ? 'destroyed' : (anyHit ? 'hit' : 'miss'),
          ships: hitCells.flatMap(h => h.result.ships || []),
          scatterCells: hitCells
        };
      } else {
        this.lastAttackResult = { result: 'miss', ships: [] };
      }
      
      // Notify UI update
      this.notifyUIUpdate();
      
      // Advance turn (munitions consume turn, but respect turn_on_hit rules)
      this.handleTurnProgression(anyHit);
      return true;
    }
    
    // Advance turn (star shells and other munitions consume turn)
    this.handleTurnProgression();
    
    return true;
  }
  
  /**
   * Fire a torpedo from a submarine
   * Finds a submarine with torpedoes, calculates path to target, applies damage to first hit
   * @param {number} targetRow - Target row
   * @param {number} targetCol - Target column
   * @returns {boolean} Success
   */
  fireTorpedo(targetRow, targetCol) {
    if (this.state !== 'playing') {
      console.log(`[GAME] ${this.id} Torpedo blocked - game not active`);
      return false;
    }
    
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer?.type !== 'human') {
      console.log(`[GAME] ${this.id} Torpedo blocked - not human turn`);
      return false;
    }
    
    // Find a submarine with torpedoes available
    let submarine = null;
    let submarinePosition = null;
    
    if (currentPlayer.fleet?.ships) {
      for (const ship of currentPlayer.fleet.ships) {
        if (ship.class?.toLowerCase() === 'submarine' && 
            !ship.isSunk() && 
            ship.getTorpedoes() > 0) {
          // Find submarine position
          for (let row = 0; row < this.board.rows; row++) {
            for (let col = 0; col < this.board.cols; col++) {
              const placement = currentPlayer.getShipAt(row, col);
              if (placement && placement.shipId === ship.id) {
                submarine = ship;
                submarinePosition = { row, col };
                break;
              }
            }
            if (submarine) break;
          }
          if (submarine) break;
        }
      }
    }
    
    if (!submarine || !submarinePosition) {
      console.log(`[GAME] ${this.id} Torpedo blocked - no submarine with torpedoes available`);
      return false;
    }
    
    // Calculate straight line path using Bresenham's line algorithm
    // Path travels up to 10 cells in the direction of the target, but stops at land/excluded/enemy ship
    const path = this.calculateLinePath(
      submarinePosition.row, 
      submarinePosition.col, 
      targetRow, 
      targetCol,
      10, // max range - travel up to 10 cells in target direction
      currentPlayer // firing player - for enemy ship detection
    );
    
    if (path.length === 0) {
      console.log(`[GAME] ${this.id} Torpedo blocked - invalid path`);
      return false;
    }
    
    // Calculate the actual end point (last cell in path)
    // Path now stops at: land/excluded/enemy ship OR 10 cells, whichever comes first
    const actualEnd = path.length > 0 ? path[path.length - 1] : submarinePosition;
    
    // Check if torpedo stopped at land/excluded (path ended early and last cell is not target)
    const stoppedAtLand = path.length < 10 && 
                          actualEnd.row !== targetRow && 
                          actualEnd.col !== targetCol &&
                          (this.board.terrain[actualEnd.row]?.[actualEnd.col] === 'land' ||
                           this.board.terrain[actualEnd.row]?.[actualEnd.col] === 'excluded');
    
    console.log(`[GAME] ${this.id} Torpedo fired from (${submarinePosition.row}, ${submarinePosition.col}) toward (${targetRow}, ${targetCol}), path length: ${path.length}, actual end: (${actualEnd.row}, ${actualEnd.col}), stopped at land: ${stoppedAtLand}`);
    
    // Use torpedo
    submarine.useTorpedo();
    
    // Check if last cell in path contains an enemy ship (path calculation stops at first enemy ship)
    let hitTarget = null;
    let hitCell = null;
    
    if (path.length > 0) {
      const lastCell = path[path.length - 1];
      // Skip the submarine's own position
      if (lastCell.row !== submarinePosition.row || lastCell.col !== submarinePosition.col) {
        // Check for enemy ships at the last cell (where path stopped)
      for (const targetPlayer of this.players) {
        if (this.isSameAlliance(currentPlayer.id, targetPlayer.id)) {
          continue;
        }
        
          const placement = targetPlayer.getShipAt(lastCell.row, lastCell.col);
        if (placement) {
          const ship = targetPlayer.getShip(placement.shipId);
          if (ship && !ship.isSunk() && ship.health[placement.cellIndex] > 0) {
            // Hit! Apply damage
            hitTarget = { player: targetPlayer, ship, cellIndex: placement.cellIndex };
              hitCell = lastCell;
            break;
          }
        }
      }
      }
    }
    
    // Apply damage if target found (only if torpedo didn't stop at land/excluded)
    if (hitTarget && !stoppedAtLand) {
      // Get torpedo damage from config
      const torpedoDamage = this.gameConfig?.munitions_damage?.torpedo ?? 1.0;
      
      const attackResult = this.receiveAttack(
        hitCell.row, 
        hitCell.col, 
        currentPlayer, 
        torpedoDamage
      );
      
      console.log(`[GAME] ${this.id} Torpedo hit at (${hitCell.row}, ${hitCell.col}):`, attackResult);
      
      this.lastAttackResult = attackResult;
    } else if (stoppedAtLand) {
      console.log(`[GAME] ${this.id} Torpedo stopped at land/excluded - no explosion`);
      this.lastAttackResult = { result: 'miss', ships: [] };
    } else {
      console.log(`[GAME] ${this.id} Torpedo missed - no target along path`);
      this.lastAttackResult = { result: 'miss', ships: [] };
    }
    
    // Store torpedo path for rendering
    // End point is the last cell in path (which stops at enemy ship, land/excluded, or maxRange)
    const renderEnd = actualEnd; // Path already stops at correct location (enemy ship/land/excluded/10 cells)
    
    this.torpedoPath = {
      start: submarinePosition,
      end: renderEnd, // End point for rendering (stops at first enemy ship, land/excluded, or 10 cells)
      target: { row: targetRow, col: targetCol }, // Original target (for reference)
      path: path, // Path cells (stops at first blocking cell or maxRange)
      hitCell: hitCell, // Cell where torpedo hit enemy ship (if any)
      stoppedAtLand: stoppedAtLand, // Flag to indicate torpedo stopped at land/excluded
      startTime: Date.now()
    };
    
    // Notify UI update
    this.notifyUIUpdate();
    
    // Advance turn
    this.handleTurnProgression(hitTarget !== null);
    
    return true;
  }
  
  /**
   * Calculate straight line path between two points (Bresenham's line algorithm)
   * Stops at land, excluded cells, or first enemy ship (whichever comes first)
   * Travels up to maxRange cells in the direction of the target
   * @param {number} startRow - Start row
   * @param {number} startCol - Start column
   * @param {number} endRow - End row (target direction, may be beyond range)
   * @param {number} endCol - End column (target direction, may be beyond range)
   * @param {number} maxRange - Maximum range (cells) - travel up to this many cells (default 10)
   * @param {Player} firingPlayer - Player firing the torpedo (optional, for enemy ship detection)
   * @returns {Array} Array of {row, col} cells along the path (stops at land/excluded/enemy ship or maxRange)
   */
  calculateLinePath(startRow, startCol, endRow, endCol, maxRange = 10, firingPlayer = null) {
    const path = [];
    let currentRow = startRow;
    let currentCol = startCol;
    
    const deltaRow = Math.abs(endRow - startRow);
    const deltaCol = Math.abs(endCol - startCol);
    const stepRow = startRow < endRow ? 1 : -1;
    const stepCol = startCol < endCol ? 1 : -1;
    
    let error = deltaCol - deltaRow;
    let distance = 0;
    
    // Travel up to maxRange cells in the target direction, but stop at land/excluded/enemy ship
    while (distance < maxRange) {
      // Check if current cell is valid and not land/excluded
      if (!this.board.isValidCoordinate(currentRow, currentCol)) {
        // Invalid coordinate (out of bounds or excluded) - stop here
        break;
      }
      
      // Check if current cell is land
      const terrain = this.board.terrain[currentRow][currentCol];
      if (terrain === 'land' || terrain === 'excluded') {
        // Hit land or excluded - stop here (don't add to path, don't continue)
        break;
      }
      
      // Check if current cell contains an enemy ship (if firingPlayer is provided)
      if (firingPlayer) {
        let hasEnemyShip = false;
        for (const targetPlayer of this.players) {
          if (this.isSameAlliance(firingPlayer.id, targetPlayer.id)) {
            continue; // Skip same alliance
          }
          
          const placement = targetPlayer.getShipAt(currentRow, currentCol);
          if (placement) {
            const ship = targetPlayer.getShip(placement.shipId);
            if (ship && !ship.isSunk() && ship.health[placement.cellIndex] > 0) {
              // Found enemy ship at this cell - stop here (include this cell in path)
              hasEnemyShip = true;
              break;
            }
          }
        }
        
        if (hasEnemyShip) {
          // Add this cell to path (torpedo hits here) and stop
          path.push({ row: currentRow, col: currentCol });
          break;
        }
      }
      
      // Valid water cell - add to path
      path.push({ row: currentRow, col: currentCol });
      
      // Move to next cell in the direction of the target
      const error2 = 2 * error;
      
      if (error2 > -deltaRow) {
        error -= deltaRow;
        currentCol += stepCol;
      }
      
      if (error2 < deltaCol) {
        error += deltaCol;
        currentRow += stepRow;
      }
      
      distance++;
    }
    
    return path;
  }

  getPlayerStats() {
    if (!this.players || this.players.length === 0) {
      return {
        player: { hits: 0, shots: 0, accuracy: 0 },
        opponent: { hits: 0, shots: 0, accuracy: 0 }
      };
    }
    
    const humanPlayerInGame = this.players.find(p => p.type === 'human');
    const aiPlayers = this.players.filter(p => p.type === 'ai');
    
    // Aggregate opponent stats (supports multi-fleet)
    const opponentAggregateStats = aiPlayers.reduce((acc, ai) => ({
      hits: acc.hits + (ai.hits || 0),
      shots: acc.shots + (ai.shots || 0),
      misses: acc.misses + (ai.misses || 0),
      sunk: acc.sunk + (ai.sunk || 0),
      score: acc.score + (ai.score || 0)
    }), { hits: 0, shots: 0, misses: 0, sunk: 0, score: 0 });
    
    opponentAggregateStats.accuracy = opponentAggregateStats.shots > 0
      ? ((opponentAggregateStats.hits / opponentAggregateStats.shots) * 100).toFixed(1)
      : 0;
    
    return {
      player: {
        hits: humanPlayerInGame?.hits || 0,
        shots: humanPlayerInGame?.shots || 0,
        misses: humanPlayerInGame?.misses || 0,
        sunk: humanPlayerInGame?.sunk || 0,
        accuracy: humanPlayerInGame?.accuracy || 0,
        score: humanPlayerInGame?.score || 0
      },
      opponent: opponentAggregateStats
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
