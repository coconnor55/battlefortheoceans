// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import Fleet from './Fleet.js';
import Alliance from './Alliance.js';
import Message from './Message.js';
import CombatResolver from './CombatResolver.js';
import SoundManager from '../utils/SoundManager.js';
import GameLifecycleManager from './GameLifecycleManager.js';

const version = "v0.8.8";
/**
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
      fireAnimationClearDelay: 3000, // Wait for fire to clear
      gameOverDelay: 2000 // After snapshot, shorter delay
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
    
    // Combat resolver (v0.8.4)
    this.combatResolver = new CombatResolver(this);
    
    // Sound manager (v0.8.5)
    this.soundManager = new SoundManager();
    
    // Lifecycle manager (v0.8.6)
    this.lifecycleManager = new GameLifecycleManager(this);
    
    console.log(`[GAME] ${this.id} Game created: ${this.id}, Mode: ${gameMode}`);
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
      const fleet = Fleet.fromShipArray(player.id, ships, allianceName);
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
    
    // Advance turn (munitions consume turn)
    this.handleTurnProgression();
    
    return true;
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
