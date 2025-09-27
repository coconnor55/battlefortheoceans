// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import AiPlayer from './AiPlayer.js';
import Fleet from './Fleet.js';
import Alliance from './Alliance.js';
import Visualizer from './Visualizer.js';
import Message from './Message.js';

const version = "v0.3.4";

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
    this.visualizer = null;
    this.winner = null;
    
    this.alliances = new Map();
    this.playerAlliances = new Map();
    this.shipOwnership = new Map();
    this.playerFleets = new Map();
    
    this.gameRules = { ...eraConfig.game_rules };
    this.message = new Message(this, eraConfig);
    
    this.actionQueue = [];
    this.isProcessingAction = false;
    this.animationSettings = {
      shotAnimation: 500,
      resultAnimation: 300,
      soundDelay: 200,
      speedFactor: 1.0
    };
    
    // CRITICAL: Initialize gameLog BEFORE sound system
    this.gameLog = [];
    this.startTime = null;
    this.endTime = null;
    this.turnTimeout = null;
    this.maxTurnTime = 30000;
    this.uiUpdateCallback = null;
    this.gameEndCallback = null; // ADDED: Callback for game end
    this.battleBoardRef = null;
    this.humanPlayerId = null;
    this.lastAttackResult = null;
    
    // Sound system - initialize AFTER gameLog
    this.soundEnabled = true;
    this.soundEffects = {};
    this.soundLoadErrors = [];
    this.initializeSounds();
    
    this.log(`Game created: ${this.id}, Mode: ${gameMode}`);
    this.message.post(this.message.types.SYSTEM, {
      message: `Game initialized: ${eraConfig.name}`
    }, [this.message.channels.LOG]);
  }

  initializeSounds() {
    const soundFiles = {
      cannonBlast: 'cannon-blast.mp3',
      incomingWhistle: 'incoming-whistle.mp3',
      explosionBang: 'explosion-bang.mp3',
      splash: 'splash.mp3',
        sinkingShip: 'sinking-ship.mp3'
    };

    Object.entries(soundFiles).forEach(([key, filename]) => {
      try {
        const fullPath = `${SOUND_BASE_URL}/sounds/${filename}`;
        console.log(`[SOUND] Loading ${key} from: ${fullPath}`);
        
        const audio = new Audio(fullPath);
        audio.preload = 'auto';
        
        audio.addEventListener('canplaythrough', () => {
          console.log(`[SOUND] ${key} loaded successfully`);
        });
        
        audio.addEventListener('error', (e) => {
          console.warn(`[SOUND] Failed to load ${key}, game will continue without this sound`);
          this.soundLoadErrors.push(key);
        });
        
        audio.load();
        this.soundEffects[key] = audio;
      } catch (error) {
        console.warn(`[SOUND] Exception loading ${filename}, game will continue without this sound:`, error);
        this.soundLoadErrors.push(key);
      }
    });

    if (this.soundLoadErrors.length > 0) {
      console.warn(`[SOUND] ${this.soundLoadErrors.length} sound(s) failed to load: ${this.soundLoadErrors.join(', ')}`);
    }

    this.log('Sound system initialized');
  }

  playSound(soundType, delay = 0) {
    if (!this.soundEnabled) {
      return;
    }
    
    setTimeout(() => {
      const audio = this.soundEffects[soundType];
      if (audio && audio.readyState >= 2) { // Check if audio is loaded
        audio.currentTime = 0;
        audio.play().catch(err => {
          // Silently fail - autoplay blocked or file unavailable
          console.debug(`[SOUND] ${soundType} play failed (this is normal if user hasn't interacted yet)`);
        });
      }
    }, delay);
  }

  toggleSound(enabled) {
    this.soundEnabled = enabled;
    this.log(`Sound ${enabled ? 'enabled' : 'disabled'}`);
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
      console.error(`[ACTION QUEUE] Error processing action:`, error);
    }
    
    setTimeout(() => this.processNextAction(), 0);
  }

  async executeActionWithTiming(action) {
    const { type, player, target } = action;
    
    if (type === 'ai_attack') {
      // AI fires cannon
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

  static validateEraConfig(eraConfig) {
    const errors = [];
    
    if (!eraConfig.name) errors.push('Missing era name');
    if (!eraConfig.rows || !eraConfig.cols) errors.push('Missing board dimensions');
    if (!eraConfig.terrain) errors.push('Missing terrain configuration');
    if (!eraConfig.ships) errors.push('Missing ship configuration');
    
    if (!eraConfig.game_rules) {
      errors.push('Missing game_rules configuration');
    } else {
      const requiredRules = ['turn_required', 'turn_on_hit', 'turn_on_miss'];
      const missingRules = requiredRules.filter(rule =>
        eraConfig.game_rules[rule] === undefined
      );
      if (missingRules.length > 0) {
        errors.push(`Missing game rules: ${missingRules.join(', ')}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
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
      this.log('Notifying CoreEngine of game end');
      this.gameEndCallback();
    }
  }

  notifyOpponentShot(row, col, result) {
    if (this.battleBoardRef?.current?.recordOpponentShot) {
      this.battleBoardRef.current.recordOpponentShot(row, col, result);
    }
  }

  addPlayer(id, type = 'human', name = 'Player', allianceName = null, strategy = null, skillLevel = null) {
    if (this.players.length >= (this.eraConfig.max_players || 2)) {
      throw new Error(`Maximum ${this.eraConfig.max_players || 2} players allowed`);
    }

    let player;
    if (type === 'ai') {
      player = new AiPlayer(id, name, strategy || 'random', skillLevel || 'novice');
    } else {
      player = new HumanPlayer(id, name);
      this.humanPlayerId = id;
    }

    if (!allianceName) {
      throw new Error(`Alliance name required for player ${name}`);
    }
    
    const fleet = Fleet.fromEraConfig(player.id, this.eraConfig, allianceName);
    
    this.players.push(player);
    this.playerFleets.set(player.id, fleet);
    
    this.log(`Player added: ${name} (${type}) with ${fleet.count} ships from ${allianceName} alliance`);
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
      this.log(`Alliance created: ${alliance.name}`);
    });
  }

  assignPlayerToAlliance(playerId, allianceName, owner = false) {
    const alliance = Array.from(this.alliances.values()).find(a => a.name === allianceName);
    
    if (!alliance) {
      throw new Error(`Alliance not found: ${allianceName}`);
    }

    const player = this.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    if (owner) {
      alliance.changeOwner(playerId);
      this.log(`Player ${player.name} is now owner of alliance ${alliance.name}`);
    }

    alliance.addPlayer(player);
    this.playerAlliances.set(playerId, alliance.id);
    
    this.log(`Player ${player.name} assigned to alliance ${alliance.name}`);
    return true;
  }

  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    const attackStart = Date.now();
    
    if (row < 0 || row >= this.eraConfig.rows || col < 0 || col >= this.eraConfig.cols) {
      const result = { result: 'invalid', ships: [] };
      this.lastAttackResult = result;
      return result;
    }

    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    const cellData = this.board ? this.board.getShipDataAt(row, col) : [];
    
    const enemyShips = cellData.filter(shipData => {
      const targetPlayerId = this.shipOwnership.get(shipData.shipId);
      return this.canAttack(firingPlayer.id, targetPlayerId);
    });
    
    const targetPlayer = enemyShips.length > 0 ? this.getPlayer(this.shipOwnership.get(enemyShips[0].shipId)) : null;
    const finalDamage = targetPlayer ? this.calculateDamage(firingPlayer, targetPlayer, damage) : 0;
    
    if (enemyShips.length === 0) {
      // Miss - play splash sound
      this.playSound('splash');
      
      firingPlayer.misses++;
      
      this.message.post(this.message.types.MISS, {
        attacker: firingPlayer,
        position: cellName
      }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
      
      this.log(`Miss at ${cellName} by ${firingPlayer.name}`);
      
      if (this.board) {
        this.board.recordShot(row, col, firingPlayer, 'miss');
      }
      
      if (this.visualizer) {
        this.visualizer.updateCellVisuals(row, col, [], firingPlayer, 'miss');
      }
      
      const result = { result: 'miss', ships: [] };
      this.lastAttackResult = result;
      return result;
    }

    // Hit - play incoming whistle and explosion
    this.playSound('incomingWhistle');
    this.playSound('explosionBang', 500);

    const hitResults = [];
    let resultType = 'hit';

    for (const shipData of enemyShips) {
      const { shipId, cellIndex } = shipData;
      const targetPlayerId = this.shipOwnership.get(shipId);
      const targetPlayer = this.getPlayer(targetPlayerId);
      const fleet = this.playerFleets.get(targetPlayerId);
      
      if (!targetPlayer || !fleet) continue;

      const ship = fleet.ships.find(s => s.id === shipId);
      if (!ship) continue;
      
      const shipHealth = ship.receiveHit(cellIndex, finalDamage);
      
      const result = ship.isSunk() ? 'sunk' : 'hit';
      hitResults.push({
        ship: ship,
        player: targetPlayer,
        result: result,
        damage: finalDamage,
        shipHealth: shipHealth
      });
      
      if (result === 'sunk') {
          this.playSound('sinkingShip');
        this.message.post(this.message.types.SUNK, {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          position: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
        resultType = 'sunk';
        
        firingPlayer.sunk++;
        firingPlayer.score += 10;
      } else {
        this.message.post(this.message.types.HIT, {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          position: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
        
        firingPlayer.score += 1;
      }
      
      this.log(`${result.toUpperCase()}: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`);
      
      if (this.gameRules.ship_capture && ship.isSunk()) {
        const captureRoll = Math.random();
        if (captureRoll <= this.gameRules.capture_chance) {
          this.handleShipCapture(ship, firingPlayer, targetPlayer);
        }
      }
    }
    
    if (hitResults.length > 0) {
      firingPlayer.hits++;
      firingPlayer.hitsDamage += finalDamage;
    }
    
    if (this.board) {
      this.board.recordShot(row, col, firingPlayer, resultType);
    }
    
    if (this.visualizer) {
      this.visualizer.updateCellVisuals(row, col, hitResults, firingPlayer, resultType);
      
      hitResults.forEach(({ ship, player }) => {
        if (ship.isSunk()) {
          const shipCells = this.getShipCells(ship.id);
          if (shipCells.length > 0) {
            const isPlayerShip = (player.id === this.humanPlayerId);
            this.visualizer.updateShipSunk(shipCells, player.id, isPlayerShip);
          }
        }
      });
    }
    
    const result = { result: resultType, ships: hitResults, damage: finalDamage };
    this.lastAttackResult = result;
    return result;
  }

  canAttack(firingPlayerId, targetPlayerId) {
    if (firingPlayerId === targetPlayerId) return false;
    
    const firingAlliance = this.playerAlliances.get(firingPlayerId);
    const targetAlliance = this.playerAlliances.get(targetPlayerId);
    
    if (firingAlliance === targetAlliance) {
      return false;
    }
    
    return true;
  }

  calculateDamage(firingPlayer, targetPlayer, baseDamage) {
    let finalDamage = baseDamage;
    return Math.max(0, finalDamage);
  }

  handleShipCapture(sunkShip, firingPlayer, targetPlayer) {
    if (!this.gameRules.ship_capture) return;
    
    const firingFleet = this.playerFleets.get(firingPlayer.id);
    const targetFleet = this.playerFleets.get(targetPlayer.id);
    
    if (firingFleet && targetFleet) {
      if (targetFleet.removeShip(sunkShip)) {
        sunkShip.reset();
        if (firingFleet.addShip(sunkShip)) {
          this.shipOwnership.set(sunkShip.id, firingPlayer.id);
          this.log(`Ship captured: ${sunkShip.name} by ${firingPlayer.name}`);
        }
      }
    }
  }

  registerShipPlacement(ship, shipCells, orientation, playerId) {
    this.shipOwnership.set(ship.id, playerId);
    
    if (this.board) {
      const registered = this.board.registerShipPlacement(ship, shipCells);
      if (registered) {
        return true;
      }
    }
    
    return false;
  }

  getShipCells(shipId) {
    if (!this.board) {
      return [];
    }
    return this.board.getShipCells(shipId);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  setBoard(board) {
    this.board = board;
    this.visualizer = new Visualizer(this.eraConfig.rows, this.eraConfig.cols);
    this.log('Board and visualizer set for game');
  }

  async startGame() {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players to start game');
    }
    
    if (!this.board) {
      this.board = new Board(this.eraConfig.rows, this.eraConfig.cols, this.eraConfig.terrain);
      this.visualizer = new Visualizer(this.eraConfig.rows, this.eraConfig.cols);
      this.log('New board and visualizer created');
    }

    for (const player of this.players) {
      const fleet = this.playerFleets.get(player.id);
      if (!fleet) {
        throw new Error(`Player ${player.name} has no fleet`);
      }
      
      if (player.type === 'ai' && !fleet.isPlaced()) {
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
    
    this.log('Game started');
    
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
    const fleet = this.playerFleets.get(player.id);
    if (!fleet) return;

    for (const ship of fleet.ships) {
      if (ship.isPlaced) continue;
      
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 100) {
        const row = Math.floor(Math.random() * this.eraConfig.rows);
        const col = Math.floor(Math.random() * this.eraConfig.cols);
        const horizontal = Math.random() > 0.5;

        const cells = [];
        for (let i = 0; i < ship.size; i++) {
          const cellRow = horizontal ? row : row + i;
          const cellCol = horizontal ? col + i : col;
          cells.push({ row: cellRow, col: cellCol });
        }
        
        const isValid = cells.every(cell =>
          cell.row >= 0 && cell.row < this.eraConfig.rows &&
          cell.col >= 0 && cell.col < this.eraConfig.cols &&
          this.eraConfig.terrain[cell.row][cell.col] !== 'excluded'
        );

        if (isValid) {
          try {
            const registered = this.registerShipPlacement(
              ship,
              cells,
              horizontal ? 'horizontal' : 'vertical',
              player.id
            );
            
            if (registered) {
              ship.place();
              placed = true;
              this.log(`${player.name}: Placed ${ship.name} at ${row},${col} ${horizontal ? 'H' : 'V'}`);
            }
          } catch (error) {
            ship.reset();
          }
        }
        
        attempts++;
      }

      if (!placed) {
        throw new Error(`Failed to place ${ship.name} for ${player.name}`);
      }
    }
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  async processPlayerAction(action, data) {
    const currentPlayer = this.getCurrentPlayer();
    
    if (action === 'attack') {
      return await this.processAttack(currentPlayer, data.row, data.col);
    }
    
    throw new Error(`Unknown action: ${action}`);
  }

  async processAttack(attacker, row, col) {
    if (this.state !== 'playing') {
      throw new Error('Game is not in playing state');
    }

    if (!this.isValidAttack(row, col)) {
      throw new Error('Invalid attack position');
    }

    // Human fires cannon
    if (attacker.type === 'human') {
      this.playSound('cannonBlast');
    }

    const result = this.receiveAttack(row, col, attacker);
    
    // Handle turn progression (which may trigger AI turn)
    this.handleTurnProgression(result.result === 'hit' || result.result === 'sunk');
    
    // Game end check happens in AI's onComplete callback, not here
    // This prevents premature game end before AI fires
    
    return result;
  }

  checkGameEnd() {
    const activeAlliances = Array.from(this.alliances.values()).filter(alliance => {
      if (alliance.players.length === 0) return false;
      
      return alliance.players.some(player => {
        const fleet = this.playerFleets.get(player.id);
        return fleet && !fleet.isDefeated();
      });
    });

    if (activeAlliances.length <= 1) {
      if (activeAlliances.length === 1) {
        const winningAlliance = activeAlliances[0];
        const survivingPlayers = winningAlliance.players.filter(player => {
          const fleet = this.playerFleets.get(player.id);
          return fleet && !fleet.isDefeated();
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
        console.error(`AI turn failed for ${currentPlayer.name}:`, error);
        this.nextTurn();
        this.checkAndTriggerAITurn();
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
        // CRITICAL: Check game end AFTER AI shot completes
        if (this.checkGameEnd()) {
          this.endGame();
          return;
        }
        
        // Only continue turn progression if game isn't over
        this.handleTurnProgression(
          this.lastAttackResult?.result === 'hit' ||
          this.lastAttackResult?.result === 'sunk'
        );
        
        this.notifyUIUpdate();
      }
    });
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentTurn++;
    
    const currentPlayer = this.getCurrentPlayer();
    this.log(`Turn ${this.currentTurn}: ${currentPlayer.name}'s turn`);
    
    this.postTurnMessage();
  }

  isValidAttack(row, col) {
    if (row < 0 || row >= this.eraConfig.rows) return false;
    if (col < 0 || col >= this.eraConfig.cols) return false;
    
    if (this.eraConfig.terrain[row][col] === 'excluded') return false;
    
    return true;
  }

  endGame() {
    this.state = 'finished';
    this.endTime = new Date();
    
    this.message.post(this.message.types.GAME_END, {
      winner: this.winner,
      gameStats: this.getGameStats()
    }, [this.message.channels.CONSOLE, this.message.channels.UI, this.message.channels.LOG]);
    
    if (this.winner) {
      this.log(`Game ended: ${this.winner.name} wins!`);
    } else {
      this.log('Game ended: Draw');
    }

    this.cleanupTemporaryAlliances();
    
    // CRITICAL FIX: Notify CoreEngine to trigger state transition
    // This calls the callback that dispatches OVER event: play → over
    this.notifyGameEnd();
  }

  cleanupTemporaryAlliances() {
    const temporaryAlliances = Array.from(this.alliances.values()).filter(alliance => !alliance.owner);
    
    temporaryAlliances.forEach(alliance => {
      this.alliances.delete(alliance.id);
      this.log(`Temporary alliance ${alliance.name} dissolved after game end`);
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
    
    this.shipOwnership.clear();
    
    if (this.board) {
      this.board.clear();
    }
    
    if (this.visualizer) {
      this.visualizer.clearAll();
    }
    
    if (this.message) {
      this.message.clear();
    }
    
    this.players.forEach(player => {
      const fleet = this.playerFleets.get(player.id);
      if (fleet) fleet.ships.forEach(ship => ship.reset());
      player.reset();
    });
    
    this.log('Game reset');
  }

  getGameStats() {
    const duration = this.endTime ?
      Math.floor((this.endTime - this.startTime) / 1000) :
      Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
    
    const playerStats = this.players.map(player => {
      const fleet = this.playerFleets.get(player.id);
      
      return {
        name: player.name,
        type: player.type,
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

  log(message) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      turn: this.currentTurn,
      message,
      type: 'game'
    };
    
    this.gameLog.push(entry);
    console.log(`[Game ${this.id}] ${message}`);
  }
}

export default Game;
// EOF
