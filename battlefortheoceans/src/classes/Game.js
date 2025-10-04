// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import AiPlayer from './AiPlayer.js';
import Fleet from './Fleet.js';
import Alliance from './Alliance.js';
import Visualizer from './Visualizer.js';
import Message from './Message.js';

const version = "v0.4.9";

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

  addPlayer(id, type = 'human', name = 'Player', allianceName = null, strategy = null, skillLevel = null, difficulty = 1.0) {
    if (this.players.length >= (this.eraConfig.max_players || 2)) {
      throw new Error(`Maximum ${this.eraConfig.max_players || 2} players allowed`);
    }

    let player;
    if (type === 'ai') {
      player = new AiPlayer(id, name, strategy || 'random', skillLevel || 'novice', difficulty);
    } else {
      player = new HumanPlayer(id, name);
      this.humanPlayerId = id;
    }

    if (!allianceName) {
      throw new Error(`Alliance name required for player ${name}`);
    }
    
    const alliance = Array.from(this.alliances.values()).find(a => a.name === allianceName);
    if (!alliance) {
      throw new Error(`Alliance not found: ${allianceName}`);
    }
    
    alliance.addPlayer(player);
    this.playerAlliances.set(player.id, alliance.id);
    
    const fleet = Fleet.fromEraConfig(player.id, this.eraConfig, allianceName);
    
    this.players.push(player);
    this.playerFleets.set(player.id, fleet);
    
    this.battleLog(`${name}${type === 'ai' ? ' (ai)' : ''} joins the game`);
    
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

  canAttack(firingPlayerId, targetPlayerId) {
    if (firingPlayerId === targetPlayerId) return false;
    
    const firingAlliance = this.playerAlliances.get(firingPlayerId);
    const targetAlliance = this.playerAlliances.get(targetPlayerId);
    
    return firingAlliance !== targetAlliance;
  }

  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    if (!this.board?.isValidCoordinate(row, col)) {
      const result = { result: 'invalid', ships: [] };
      this.lastAttackResult = result;
      return result;
    }

    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    const cellData = this.board.getShipDataAt(row, col);
    
    const enemyShips = cellData.filter(shipData => {
      const targetPlayerId = this.shipOwnership.get(shipData.shipId);
      return this.canAttack(firingPlayer.id, targetPlayerId);
    });
    
    if (enemyShips.length === 0) {
      this.playSound('splash');
      firingPlayer.misses++;
      firingPlayer.recordMiss(row, col);
      
      this.message.post(this.message.types.MISS, {
        attacker: firingPlayer,
        position: cellName
      }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
      
      this.battleLog(`t${this.currentTurn}-Miss at ${cellName} by ${firingPlayer.name}`, 'miss');
      
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
      
      const finalDamage = this.calculateDamage(firingPlayer, targetPlayer, damage);
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
        
        if (firingPlayer.type === 'human' && targetPlayer.type === 'ai') {
          const multiplier = targetPlayer.difficulty || 1.0;
          firingPlayer.score += Math.round(10 * multiplier);
          console.log(`[Game ${this.id}] ${firingPlayer.name} sunk ${targetPlayer.name}'s ship: 10 * ${multiplier} = ${Math.round(10 * multiplier)} points`);
        } else {
          firingPlayer.score += 10;
        }
        
        this.battleLog(`t${this.currentTurn}-SUNK: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`, 'sunk');
      } else {
        this.message.post(this.message.types.HIT, {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          position: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
        
        if (firingPlayer.type === 'human' && targetPlayer.type === 'ai') {
          const multiplier = targetPlayer.difficulty || 1.0;
          firingPlayer.score += multiplier;
          console.log(`[Game ${this.id}] ${firingPlayer.name} hit ${targetPlayer.name}'s ship: 1 * ${multiplier} = ${multiplier} points`);
        } else {
          firingPlayer.score += 1;
        }
        
        this.battleLog(`t${this.currentTurn}-HIT: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`, 'hit');
      }
    }
    
    if (hitResults.length > 0) {
      firingPlayer.hits++;
      firingPlayer.hitsDamage += hitResults.reduce((sum, h) => sum + h.damage, 0);
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
    
    const result = { result: resultType, ships: hitResults, damage };
    this.lastAttackResult = result;
    return result;
  }

  calculateDamage(firingPlayer, targetPlayer, baseDamage) {
    return Math.max(0, baseDamage);
  }

  registerShipPlacement(ship, shipCells, orientation, playerId) {
    this.shipOwnership.set(ship.id, playerId);
    
    if (this.board) {
      return this.board.registerShipPlacement(ship, shipCells);
    }
    
    return false;
  }

  getShipCells(shipId) {
    if (!this.board) return [];
    return this.board.getShipCells(shipId);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  setBoard(board) {
    this.board = board;
    this.visualizer = new Visualizer(this.eraConfig.rows, this.eraConfig.cols);
  }

  async startGame() {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players to start game');
    }
    
    if (!this.board) {
      this.board = new Board(this.eraConfig.rows, this.eraConfig.cols, this.eraConfig.terrain);
      this.visualizer = new Visualizer(this.eraConfig.rows, this.eraConfig.cols);
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
    const fleet = this.playerFleets.get(player.id);
    if (!fleet) return;

    console.log(`[Game ${this.id}] Auto-placing ships for ${player.name}`);

    for (const ship of fleet.ships) {
      if (ship.isPlaced) continue;
      
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 100) {
        const startCell = this.board.getRandomEmptyCell();
        if (!startCell) {
          throw new Error(`No empty cells available for ${ship.name}`);
        }
        
        const horizontal = Math.random() > 0.5;

        const cells = [];
        for (let i = 0; i < ship.size; i++) {
          const cellRow = horizontal ? startCell.row : startCell.row + i;
          const cellCol = horizontal ? startCell.col + i : startCell.col;
          cells.push({ row: cellRow, col: cellCol });
        }

        const registered = this.registerShipPlacement(
          ship,
          cells,
          horizontal ? 'horizontal' : 'vertical',
          player.id
        );
        
        if (registered) {
          ship.place();
          placed = true;
          
          console.log(`[Game ${this.id}] Placed ${ship.name}, notifying UI`);
          this.notifyUIUpdate();
        }
        
        attempts++;
      }

      if (!placed) {
        throw new Error(`Failed to place ${ship.name} for ${player.name}`);
      }
    }
    
    console.log(`[Game ${this.id}] All ships placed for ${player.name}, final UI notification`);
    this.notifyUIUpdate();
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // v0.4.9: SYNCHRONOUS - removed async, returns result immediately
  processPlayerAction(action, data) {
    const currentPlayer = this.getCurrentPlayer();
    
    if (action === 'attack') {
      return this.processAttack(currentPlayer, data.row, data.col);
    }
    
    throw new Error(`Unknown action: ${action}`);
  }

  // v0.4.9: SYNCHRONOUS - removed async, returns result immediately
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
    
    this.handleTurnProgression(result.result === 'hit' || result.result === 'sunk');
    
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
        console.error(`[Game] AI turn failed for ${currentPlayer.name}:`, error);
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
    
    this.postTurnMessage();
  }

  isValidAttack(row, col, firingPlayer) {
    if (!this.board) return false;
    
    if (!this.board.isValidCoordinate(row, col)) return false;
    
    if (firingPlayer && firingPlayer.hasMissedAt(row, col)) return false;
    
    const cellData = this.board.getShipDataAt(row, col);
    
    if (cellData.length === 0) return true;
    
    return cellData.some(shipData => {
      const targetPlayerId = this.shipOwnership.get(shipData.shipId);
      const fleet = this.playerFleets.get(targetPlayerId);
      if (!fleet) return false;
      
      const ship = fleet.ships.find(s => s.id === shipData.shipId);
      if (!ship) return false;
      
      return ship.health[shipData.cellIndex] > 0;
    });
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
    console.log(`[Game ${this.id}] ${message}`);
  }
}

export default Game;
// EOF
