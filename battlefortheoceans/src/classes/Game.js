// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import Fleet from './Fleet.js';
import Alliance from './Alliance.js';
import Message from './Message.js';

const version = "v0.7.6";
const version = "v0.8.0";
/**
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
      fireAnimationClearDelay: 3000, // NEW: Wait for fire to clear
      gameOverDelay: 2000 // REDUCED: After snapshot, shorter delay
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
    let finalDamage = baseDamage;

    const attackBoost = this.boosts?.[firingPlayer.id]?.attack || 0;
    if (attackBoost > 0) {
      finalDamage *= (1 + attackBoost);
    }

    const defenseBoost = this.boosts?.[targetPlayer.id]?.defense || 0;
    if (defenseBoost > 0) {
      finalDamage *= (1 - defenseBoost);
    }

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

  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    console.log(`[TARGETING] Called by ${firingPlayer.name} (${firingPlayer.type}) at ${row},${col}`);

    if (!this.board?.isValidCoordinate(row, col)) {
      const result = { result: 'invalid', ships: [] };
      this.lastAttackResult = result;
      return result;
    }

    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    
    const liveTargets = [];
    const deadTargets = [];
    
    for (const targetPlayer of this.players) {
      if (this.isSameAlliance(firingPlayer.id, targetPlayer.id)) {
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
    
    if (totalTargets === 0) {
      console.log(`[TARGETING] MISS - no ships at ${cellName}`);
      this.playSound('splash');
      firingPlayer.misses++;
      firingPlayer.recordDontShoot(row, col);
      
      this.message.post('attack_miss', {
        attacker: firingPlayer,
        cell: cellName
      }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
      
      this.battleLog(`t${this.currentTurn}-Miss at ${cellName} by ${firingPlayer.name}`, 'miss');
      
      const result = { result: 'miss', ships: [] };
      this.lastAttackResult = result;
      return result;
    }
    
    if (liveTargets.length === 0 && deadTargets.length > 0) {
      console.log(`[TARGETING] ALL_DESTROYED - wasted shot on dead cells at ${cellName}`);
      
      const result = { result: 'all_destroyed', ships: [] };
      this.lastAttackResult = result;
      return result;
    }
    
    console.log(`[TARGETING] HIT - ${liveTargets.length} live ships at ${cellName}`);
    this.playSound('incomingWhistle');
    this.playSound('explosionBang', 500);
    
    const hitResults = [];
    
    for (const target of liveTargets) {
      const { player: targetPlayer, ship, cellIndex } = target;
      
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
      
      if (shipNowSunk) {
        this.playSound('sinkingShip');
        this.message.post('ship_sunk', {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          shipClass: ship.class,
          cell: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
        
        firingPlayer.sunk++;
        
        const multiplier = (firingPlayer.type === 'human' && targetPlayer.type === 'ai')
          ? (targetPlayer.difficulty || 1.0)
          : 1.0;
        firingPlayer.score += Math.round(10 * multiplier);
        
        console.log(`[Game ${this.id}] ${firingPlayer.name} sunk ${targetPlayer.name}'s ${ship.name}: 10 * ${multiplier} = ${Math.round(10 * multiplier)} points`);
        
        this.battleLog(`t${this.currentTurn}-SUNK: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`, 'sunk');
      } else {
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
        
        this.message.post(messageType, messageContext,
          [this.message.channels.CONSOLE, this.message.channels.LOG]);
        
        this.battleLog(`t${this.currentTurn}-HIT: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name} [${revealLevel}]`, 'hit');
      }
    }
    
    firingPlayer.hits++;
    firingPlayer.hitsDamage += hitResults.reduce((sum, h) => sum + h.damage, 0);
    
    const multiplier = (firingPlayer.type === 'human' && hitResults[0]?.player?.type === 'ai')
      ? (hitResults[0].player.difficulty || 1.0)
      : 1.0;
    firingPlayer.score += Math.round(1 * multiplier);
    
    console.log(`[Game ${this.id}] ${firingPlayer.name} hit at ${cellName}: 1 * ${multiplier} = ${Math.round(1 * multiplier)} points`);
    
    let stillAliveAtCell = false;
    for (const target of liveTargets) {
      if (target.ship.health[target.cellIndex] > 0) {
        stillAliveAtCell = true;
        break;
      }
    }
    
    const cellNowFullyDestroyed = !stillAliveAtCell;
    const resultType = cellNowFullyDestroyed ? 'destroyed' : 'hit';
    
    if (resultType === 'destroyed') {
      firingPlayer.recordDontShoot(row, col);
      console.log(`[TARGETING] Marked ${cellName} as dontShoot (destroyed)`);
    }
    
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
  
  registerShipPlacement(ship, shipCells, orientation, playerId) {
    console.log(`[GAME] Attempting to place ${ship.name} for player ${playerId}`);
    
    if (!this.board.canPlaceShip(shipCells, ship.terrain)) {
      console.warn(`[GAME] Ship placement failed board validation (bounds/terrain)`);
      return false;
    }
    
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
    
    console.log(`[GAME] Placement validated, registering ${ship.name} (${orientation})`);
    
    // v0.7.5: Pass orientation to player.placeShip()
    for (let i = 0; i < shipCells.length; i++) {
      const cell = shipCells[i];
      player.placeShip(cell.row, cell.col, ship.id, i, orientation);
    }
    
    return true;
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
    
    return this.board.isValidCoordinate(row, col);
  }
  
    // Update the endGame() method in Game.js
    // Replace lines 583-624 with this version

    endGame() {
      this.state = 'finished';
      this.endTime = new Date();
      
      const humanPlayer = this.players.find(p => p.id === this.humanPlayerId);
      const humanWon = this.winner && humanPlayer && this.winner.id === humanPlayer.id;
      
      // Play victory/defeat sound immediately
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
      
      // NEW TIMING: Wait for fire to clear, THEN capture winner's board, THEN notify
      console.log(`[Game ${this.id}] Waiting ${this.animationSettings.fireAnimationClearDelay}ms for fire animations to clear`);
      
      setTimeout(() => {
        // Capture winner's board AFTER fire has cleared
        if (this.battleBoardRef?.current?.captureWinnerBoard) {
          const winnerId = this.winner?.id || humanPlayer?.id;
          console.log(`[Game ${this.id}] Capturing winner's board (fire cleared), winnerId:`, winnerId);
          this.finalBoardImage = this.battleBoardRef.current.captureWinnerBoard(winnerId);
          if (this.finalBoardImage) {
            console.log(`[Game ${this.id}] Winner's board captured successfully (${this.finalBoardImage.length} bytes)`);
          }
        }
        
        // Now wait before transitioning to OverPage
        console.log(`[Game ${this.id}] Delaying transition to OverPage by ${this.animationSettings.gameOverDelay}ms`);
        setTimeout(() => {
          console.log(`[Game ${this.id}] Notifying game end to CoreEngine`);
          this.notifyGameEnd();
        }, this.animationSettings.gameOverDelay);
        
      }, this.animationSettings.fireAnimationClearDelay);
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
