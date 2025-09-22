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

class Game {
  constructor(eraConfig, gameMode = 'turnBased') {
    // VALIDATION: Ensure era config has required game rules
    if (!eraConfig.game_rules) {
      throw new Error(`Era "${eraConfig.name}" is missing game_rules configuration`);
    }
    
    // VALIDATION: Ensure all required game rule properties exist
    const requiredRules = ['friendly_fire', 'turn_required', 'turn_on_hit', 'turn_on_miss'];
    const missingRules = requiredRules.filter(rule => eraConfig.game_rules[rule] === undefined);
    
    if (missingRules.length > 0) {
      throw new Error(`Era "${eraConfig.name}" missing game rules: ${missingRules.join(', ')}`);
    }

    this.id = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.eraConfig = eraConfig;
    this.gameMode = gameMode; // 'turnBased', 'rapidFire', 'simultaneous'
    
    // Game state
    this.state = 'setup'; // 'setup', 'placement', 'playing', 'paused', 'finished'
    this.currentTurn = 0;
    this.currentPlayerIndex = 0;
    
    // Players and board
    this.players = [];
    this.board = null;
    this.visualizer = null;
    this.winner = null;
    
    // Alliance system for new architecture
    this.alliances = new Map(); // allianceId -> Alliance instance
    this.playerAlliances = new Map(); // playerId -> allianceId
    this.shipOwnership = new Map(); // shipId -> playerId
    this.playerFleets = new Map(); // playerId -> Fleet instance
    
    // NO DEFAULT RULES - Use era config directly or fail
    this.gameRules = { ...eraConfig.game_rules };
    
    // Message system - centralized messaging
    this.message = new Message(this, eraConfig);
    
    // Game history and logging
    this.gameLog = [];
    this.startTime = null;
    this.endTime = null;
    
    // Turn management
    this.turnTimeout = null;
    this.maxTurnTime = 30000; // 30 seconds per turn
    
    // Callback for UI updates
    this.uiUpdateCallback = null;
    
    // UI communication for opponent shots
    this.battleBoardRef = null;
    
    // PERFORMANCE FIX: Store current human player ID for skull color determination
    this.humanPlayerId = null;
    
    this.log(`Game created: ${this.id}, Mode: ${gameMode}`);
    
    // Post game start message
    this.message.post(this.message.types.SYSTEM, {
      message: `Game initialized: ${eraConfig.name}`
    }, [this.message.channels.LOG]);
  }

  /**
   * Static method to validate era configuration before game creation
   */
  static validateEraConfig(eraConfig) {
    const errors = [];
    
    // Check basic structure
    if (!eraConfig.name) errors.push('Missing era name');
    if (!eraConfig.rows || !eraConfig.cols) errors.push('Missing board dimensions');
    if (!eraConfig.terrain) errors.push('Missing terrain configuration');
    if (!eraConfig.ships) errors.push('Missing ship configuration');
    
    // Check game rules
    if (!eraConfig.game_rules) {
      errors.push('Missing game_rules configuration');
    } else {
      const requiredRules = ['friendly_fire', 'turn_required', 'turn_on_hit', 'turn_on_miss'];
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

  /**
   * Set callback for UI updates
   */
  setUIUpdateCallback(callback) {
    this.uiUpdateCallback = callback;
  }

  /**
   * Set battle board reference for opponent shot visualization
   */
  setBattleBoardRef(ref) {
    this.battleBoardRef = ref;
  }

  /**
   * PERFORMANCE FIX: Set human player ID for fast skull color lookups
   */
  setHumanPlayerId(playerId) {
    this.humanPlayerId = playerId;
  }

  /**
   * Notify UI of state changes
   */
  notifyUIUpdate() {
    console.log(`[TIMING] Game.notifyUIUpdate called at ${Date.now()}`);
    if (this.uiUpdateCallback) {
      const start = Date.now();
      this.uiUpdateCallback();
      console.log(`[TIMING] UI callback execution took ${Date.now() - start}ms`);
    }
  }

  /**
   * Notify battle board of opponent shots for visual feedback
   */
  notifyOpponentShot(row, col, result) {
    console.log(`[TIMING] Game.notifyOpponentShot(${row}, ${col}, ${result}) called at ${Date.now()}`);
    if (this.battleBoardRef?.current?.recordOpponentShot) {
      const start = Date.now();
      this.battleBoardRef.current.recordOpponentShot(row, col, result);
      console.log(`[TIMING] recordOpponentShot execution took ${Date.now() - start}ms`);
    }
  }

  addPlayer(id, type = 'human', name = 'Player', strategy = 'methodical_hunting', difficulty = 1) {
    if (this.players.length >= (this.eraConfig.max_players || 2)) {
      throw new Error(`Maximum ${this.eraConfig.max_players || 2} players allowed`);
    }

    let player;
    if (type === 'ai') {
      player = new AiPlayer(id, name, strategy, difficulty);
    } else {
      player = new HumanPlayer(id, name);
      // PERFORMANCE FIX: Store human player ID for fast skull color determination
      this.humanPlayerId = id;
    }

    // Create fleet for the player
    const fleet = Fleet.fromEraConfig(player.id, this.eraConfig);
    
    // Store mappings
    this.players.push(player);
    this.playerFleets.set(player.id, fleet);
    
    this.log(`Player added: ${name} (${type}) with ${fleet.count} ships`);
    return player;
  }

  /**
   * Initialize alliances from era configuration
   */
  initializeAlliances() {
    if (!this.eraConfig.alliances) {
      console.warn('No alliances defined in era config');
      return;
    }

    this.eraConfig.alliances.forEach(allianceConfig => {
      // Alliance owner will be set when first player is assigned
      const alliance = Alliance.fromConfig(allianceConfig, null);
      this.alliances.set(alliance.id, alliance);
      this.log(`Alliance created: ${alliance.name}`);
    });
  }

  /**
   * Assign player to alliance by name
   */
  assignPlayerToAlliance(playerId, allianceName, owner = false) {
    const alliance = Array.from(this.alliances.values()).find(a => a.name === allianceName);
    
    if (!alliance) {
      throw new Error(`Alliance not found: ${allianceName}`);
    }

    const player = this.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    // Set owner if specified
    if (owner) {
      alliance.changeOwner(playerId);
      this.log(`Player ${player.name} is now owner of alliance ${alliance.name}`);
    }

    alliance.addPlayer(player);
    this.playerAlliances.set(playerId, alliance.id);
    
    this.log(`Player ${player.name} assigned to alliance ${alliance.name}`);
    return true;
  }

  /**
   * Enhanced hit resolution - FIXED: Filter out friendly ships, no friendly fire detection
   */
  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    console.log(`[TIMING] Game.receiveAttack(${row}, ${col}) started at ${Date.now()}`);
    const attackStart = Date.now();
    
    // Validate coordinates
    if (row < 0 || row >= this.eraConfig.rows || col < 0 || col >= this.eraConfig.cols) {
      return { result: 'invalid', ships: [] };
    }

    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    
    // Get ships at this location from Board
    const cellData = this.board ? this.board.getShipDataAt(row, col) : [];
    
    // FIXED: Filter out friendly ships immediately - no friendly fire detection needed
    const enemyShips = cellData.filter(shipData => {
      const targetPlayerId = this.shipOwnership.get(shipData.shipId);
      return this.canAttack(firingPlayer.id, targetPlayerId);
    });
    
    // If no enemy ships at this location, it's a miss
    if (enemyShips.length === 0) {
      this.message.post(this.message.types.MISS, {
        attacker: firingPlayer,
        position: cellName
      }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
      
      this.log(`Miss at ${cellName} by ${firingPlayer.name}`);
      
      // Record shot in board for visual feedback
      if (this.board) {
        console.log(`[TIMING] Recording miss in board at ${Date.now()}`);
        this.board.recordShot(row, col, firingPlayer, 'miss');
      }
      
      // Update visualizer for miss
      if (this.visualizer) {
        this.visualizer.updateCellVisuals(row, col, [], firingPlayer, 'miss');
      }
      
      // Notify UI of opponent miss for visual feedback
      if (firingPlayer.type === 'ai') {
        console.log(`[TIMING] Notifying opponent miss at ${Date.now()}`);
        this.notifyOpponentShot(row, col, 'miss');
      }
      
      console.log(`[TIMING] Game.receiveAttack MISS completed in ${Date.now() - attackStart}ms`);
      return { result: 'miss', ships: [] };
    }

    // Process hits on enemy ships only
    const hitResults = [];
    let resultType = 'hit';

    for (const shipData of enemyShips) {
      const { shipId, cellIndex } = shipData;
      const targetPlayerId = this.shipOwnership.get(shipId);
      const targetPlayer = this.getPlayer(targetPlayerId);
      const fleet = this.playerFleets.get(targetPlayerId);
      
      if (!targetPlayer || !fleet) continue;

      // Find the ship in the fleet
      const ship = fleet.ships.find(s => s.id === shipId);
      if (!ship) continue;

      // Calculate final damage with player modifiers
      const finalDamage = this.calculateDamage(firingPlayer, targetPlayer, damage);
      
      // Apply hit to ship
      const shipHealth = ship.receiveHit(cellIndex, finalDamage);
      
      const result = ship.isSunk() ? 'sunk' : 'hit';
      hitResults.push({
        ship: ship,
        player: targetPlayer,
        result: result,
        damage: finalDamage,
        shipHealth: shipHealth
      });
      
      // POST HIT/SUNK MESSAGE to battle console
      if (result === 'sunk') {
        this.message.post(this.message.types.SUNK, {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          position: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
        resultType = 'sunk';
      } else {
        this.message.post(this.message.types.HIT, {
          attacker: firingPlayer,
          target: targetPlayer,
          shipName: ship.name,
          position: cellName
        }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
      }
      
      this.log(`${result.toUpperCase()}: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`);
      
      // Handle ship capture if enabled
      if (this.gameRules.ship_capture && ship.isSunk()) {
        const captureRoll = Math.random();
        if (captureRoll <= this.gameRules.capture_chance) {
          this.handleShipCapture(ship, firingPlayer, targetPlayer);
        }
      }
    }
    
    // Record shot in board for visual feedback
    if (this.board) {
      console.log(`[TIMING] Recording ${resultType} in board at ${Date.now()}`);
      this.board.recordShot(row, col, firingPlayer, resultType);
    }
    
    // Update visualizer with hit results
    if (this.visualizer) {
      this.visualizer.updateCellVisuals(row, col, hitResults, firingPlayer, resultType);
      
      // SKULL COLOR FIX: Use humanPlayerId for correct skull colors
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
    
    // Notify UI for visual feedback
    if (firingPlayer.type === 'ai') {
      console.log(`[TIMING] Notifying opponent ${resultType} at ${Date.now()}`);
      this.notifyOpponentShot(row, col, resultType);
    }
    
    console.log(`[TIMING] Game.receiveAttack ${resultType.toUpperCase()} completed in ${Date.now() - attackStart}ms`);
    return { result: resultType, ships: hitResults };
  }

  /**
   * Check if firingPlayer can attack targetPlayer based on alliance rules
   */
  canAttack(firingPlayerId, targetPlayerId) {
    if (firingPlayerId === targetPlayerId) return false; // Can't attack yourself
    
    if (!this.gameRules.friendly_fire) {
      const firingAlliance = this.playerAlliances.get(firingPlayerId);
      const targetAlliance = this.playerAlliances.get(targetPlayerId);
      
      // Block attack if same alliance
      if (firingAlliance === targetAlliance) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate final damage with player attack/defense modifiers
   */
  calculateDamage(firingPlayer, targetPlayer, baseDamage) {
    let finalDamage = baseDamage;
    
    // Apply firing player's attack boost (future feature)
    // finalDamage *= (firingPlayer.attackBoost || 1.0);
    
    // Apply target player's defense (future feature)
    // finalDamage *= (1.0 - (targetPlayer.defense || 0.0));
    
    return Math.max(0, finalDamage);
  }

  /**
   * Handle ship capture mechanics
   */
  handleShipCapture(sunkShip, firingPlayer, targetPlayer) {
    if (!this.gameRules.ship_capture) return;
    
    const firingFleet = this.playerFleets.get(firingPlayer.id);
    const targetFleet = this.playerFleets.get(targetPlayer.id);
    
    if (firingFleet && targetFleet) {
      // Remove from target fleet and add to firing fleet
      if (targetFleet.removeShip(sunkShip)) {
        sunkShip.reset(); // Repair the captured ship
        if (firingFleet.addShip(sunkShip)) {
          this.shipOwnership.set(sunkShip.id, firingPlayer.id);
          this.log(`Ship captured: ${sunkShip.name} by ${firingPlayer.name}`);
        }
      }
    }
  }

  /**
   * Register ship placement for hit resolution mapping
   * FIXED: Board is single source of truth - only register with Board
   */
  registerShipPlacement(ship, shipCells, orientation, playerId) {
    console.log(`[Game] Registering ship placement: ${ship.name} for ${playerId}`);
    
    // Update ship ownership in Game
    this.shipOwnership.set(ship.id, playerId);
    
    // Register with Board (single source of truth for spatial data)
    if (this.board) {
      const registered = this.board.registerShipPlacement(ship, shipCells);
      if (registered) {
        console.log(`[Game] Ship ${ship.name} registered at ${shipCells.length} cells`);
        return true;
      }
    }
    
    console.warn(`[Game] Failed to register ship ${ship.name} with Board`);
    return false;
  }

  /**
   * Get all cells occupied by a specific ship
   * FIXED: Query Board as single source of truth
   */
  getShipCells(shipId) {
    if (!this.board) {
      console.warn('[Game] Cannot get ship cells without Board instance');
      return [];
    }
    return this.board.getShipCells(shipId);
  }

  /**
   * Get player by ID
   */
  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  /**
   * Set the game board (usually from placement phase)
   */
  setBoard(board) {
    this.board = board;
    this.visualizer = new Visualizer(this.eraConfig.rows, this.eraConfig.cols);
    this.log('Board and visualizer set for game');
  }

  /**
   * Start the game
   */
  async startGame() {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players to start game');
    }
    
    if (!this.board) {
      this.board = new Board(this.eraConfig.rows, this.eraConfig.cols, this.eraConfig.terrain);
      this.visualizer = new Visualizer(this.eraConfig.rows, this.eraConfig.cols);
      this.log('New board and visualizer created');
    }

    // Validate that players have fleets and register ship placements
    for (const player of this.players) {
      const fleet = this.playerFleets.get(player.id);
      if (!fleet) {
        throw new Error(`Player ${player.name} has no fleet`);
      }
      
      // Auto-place AI ships if needed
      if (player.type === 'ai' && !fleet.isPlaced()) {
        await this.autoPlaceShips(player);
      }
    }

    this.state = 'playing';
    this.startTime = new Date();
    this.currentPlayerIndex = 0; // Human player goes first
    
    // POST GAME START MESSAGE
    this.message.post(this.message.types.GAME_START, {
      eraName: this.eraConfig.name,
      players: this.players
    }, [this.message.channels.CONSOLE, this.message.channels.LOG]);
    
    this.log('Game started');
    
    // Post first turn message
    this.postTurnMessage();
    
    // Check if first player is AI and trigger their turn
    this.checkAndTriggerAITurn();
    
    return true;
  }

  /**
   * Post turn message to UI console
   */
  postTurnMessage() {
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      this.message.post(this.message.types.TURN, {
        player: currentPlayer,
        turnNumber: this.currentTurn
      }, [this.message.channels.UI]);
    }
  }

  /**
   * Auto-place ships for AI players
   * FIXED: Uses new architecture - position data passed to registerShipPlacement
   */
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

        // Calculate ship cells
        const cells = [];
        for (let i = 0; i < ship.size; i++) {
          const cellRow = horizontal ? row : row + i;
          const cellCol = horizontal ? col + i : col;
          cells.push({ row: cellRow, col: cellCol });
        }
        
        // Check if placement is valid
        const isValid = cells.every(cell =>
          cell.row >= 0 && cell.row < this.eraConfig.rows &&
          cell.col >= 0 && cell.col < this.eraConfig.cols &&
          this.eraConfig.terrain[cell.row][cell.col] !== 'excluded'
        );

        if (isValid) {
          try {
            // Register placement with Game (position mapping)
            const registered = this.registerShipPlacement(
              ship,
              cells,
              horizontal ? 'horizontal' : 'vertical',
              player.id
            );
            
            if (registered) {
              // Mark ship as placed after successful registration
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

  /**
   * Get current player
   */
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  /**
   * Process player action
   */
  async processPlayerAction(action, data) {
    const currentPlayer = this.getCurrentPlayer();
    
    if (action === 'attack') {
      return await this.processAttack(currentPlayer, data.row, data.col);
    }
    
    throw new Error(`Unknown action: ${action}`);
  }

  /**
   * Process attack using new hit resolution system
   */
  async processAttack(attacker, row, col) {
    console.log(`[TIMING] Game.processAttack(${row}, ${col}) started at ${Date.now()}`);
    const processStart = Date.now();
    
    if (this.state !== 'playing') {
      throw new Error('Game is not in playing state');
    }

    if (!this.isValidAttack(row, col)) {
      throw new Error('Invalid attack position');
    }

    // Use enhanced hit resolution
    const result = this.receiveAttack(row, col, attacker);
    
    // Update attacker stats - only count hits and misses, not blocked shots
    attacker.shotsFired++;
    if (result.result === 'hit' || result.result === 'sunk') {
      attacker.shotsHit++;
      attacker.score += result.result === 'sunk' ? 10 : 1;
    }

    // Check for game end
    if (this.checkGameEnd()) {
      this.endGame();
      console.log(`[TIMING] Game.processAttack completed (GAME END) in ${Date.now() - processStart}ms`);
      return result;
    }

    // Handle turn progression - all shot results now affect turn progression
    console.log(`[TIMING] Starting turn progression at ${Date.now()}`);
    this.handleTurnProgression(result.result === 'hit' || result.result === 'sunk');
    
    console.log(`[TIMING] Game.processAttack completed in ${Date.now() - processStart}ms`);
    return result;
  }

  /**
   * Check if game has ended - FIXED: Check alliances instead of individual players
   */
  checkGameEnd() {
    // Get all active alliances (not defeated)
    const activeAlliances = Array.from(this.alliances.values()).filter(alliance => {
      // Alliance is active if it has players and at least one player is not eliminated
      if (alliance.players.length === 0) return false;
      
      // Check if any player in the alliance still has ships
      return alliance.players.some(player => {
        const fleet = this.playerFleets.get(player.id);
        return fleet && !fleet.isDefeated();
      });
    });

    // Game ends when only one alliance remains
    if (activeAlliances.length <= 1) {
      // Set winner to the surviving alliance (or null if no survivors)
      if (activeAlliances.length === 1) {
        // Find the winning player(s) from the surviving alliance
        const winningAlliance = activeAlliances[0];
        const survivingPlayers = winningAlliance.players.filter(player => {
          const fleet = this.playerFleets.get(player.id);
          return fleet && !fleet.isDefeated();
        });
        // For single-player alliances (Traditional Battleship), set that player as winner
        // For multi-player alliances, we could set the alliance owner or first surviving player
        this.winner = survivingPlayers[0] || winningAlliance.players[0];
        this.winningAlliance = winningAlliance;
      } else {
        // No survivors - draw
        this.winner = null;
        this.winningAlliance = null;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Handle turn progression based on game mode and era rules
   * FIXED: Check for AI turns on both advancement AND continuation
   */
  handleTurnProgression(wasHit) {
    console.log(`[TIMING] Game.handleTurnProgression(${wasHit}) started at ${Date.now()}`);
    
    if (!this.gameRules.turn_required) {
      return; // Rapid fire mode - no turn changes
    }
    
    // Turn-based rules from era config
    const shouldContinue = (wasHit && this.gameRules.turn_on_hit) ||
                         (!wasHit && this.gameRules.turn_on_miss);
    
    if (!shouldContinue) {
      console.log(`[TIMING] Advancing to next turn at ${Date.now()}`);
      this.nextTurn();
      
      // Check for AI turn after advancing
      console.log(`[TIMING] Checking for AI turn after turn advancement at ${Date.now()}`);
      this.checkAndTriggerAITurn();
    } else {
      console.log(`[TIMING] Turn continues for same player due to ${wasHit ? 'hit' : 'miss'} rule`);
      
      // FIXED: Also check for AI turn when turn continues (not just when it advances)
      console.log(`[TIMING] Checking for AI turn after turn continuation at ${Date.now()}`);
      this.checkAndTriggerAITurn();
    }
  }

  /**
   * Check if it's an AI's turn and automatically trigger their move
   * AI handles its own thinking time via simulateThinking()
   */
  async checkAndTriggerAITurn() {
    if (this.state !== 'playing') return;
    
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer?.type === 'ai') {
      console.log(`[TIMING] AI turn starting for ${currentPlayer.name} at ${Date.now()}`);
      try {
        // AI handles its own thinking time internally - no setTimeout needed
        await this.executeAITurn(currentPlayer);
      } catch (error) {
        console.error(`AI turn failed for ${currentPlayer.name}:`, error);
        // Force turn to next player if AI fails
        this.nextTurn();
        this.checkAndTriggerAITurn(); // Check if next player is also AI
      }
    }
  }

  /**
   * Execute AI turn - FIXED: Always notify UI after AI completion
   */
  async executeAITurn(aiPlayer) {
    console.log(`[TIMING] Game.executeAITurn(${aiPlayer.name}) started at ${Date.now()}`);
    const aiStart = Date.now();
    
    if (!aiPlayer.makeMove) {
      throw new Error(`AI Player ${aiPlayer.name} missing makeMove method`);
    }
    
    const result = await aiPlayer.makeMove(this);
    console.log(`AI ${aiPlayer.name} turn result:`, result.result);
    
    // PERFORMANCE FIX: Always notify UI after AI turn to sync turn state
    console.log(`[TIMING] Notifying UI of AI turn completion at ${Date.now()}`);
    this.notifyUIUpdate();
    
    // Check if game ended
    if (this.state !== 'playing') {
      console.log(`[TIMING] Game.executeAITurn completed (GAME ENDED) in ${Date.now() - aiStart}ms`);
      return;
    }
    
    console.log(`[TIMING] Game.executeAITurn completed in ${Date.now() - aiStart}ms`);
  }

  /**
   * Advance to next player's turn
   */
  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentTurn++;
    
    const currentPlayer = this.getCurrentPlayer();
    this.log(`Turn ${this.currentTurn}: ${currentPlayer.name}'s turn`);
    
    // Post turn message to UI console
    this.postTurnMessage();
  }

  /**
   * Check if attack position is valid
   */
  isValidAttack(row, col) {
    if (row < 0 || row >= this.eraConfig.rows) return false;
    if (col < 0 || col >= this.eraConfig.cols) return false;
    
    // Check terrain
    if (this.eraConfig.terrain[row][col] === 'excluded') return false;
    
    return true;
  }

  /**
   * Set state machine dispatch for direct transitions
   */
  setStateMachineDispatch(dispatch, eventTypes) {
    this.stateMachineDispatch = dispatch;
    this.stateMachineEvents = eventTypes;
  }

  /**
   * End the game - FIXED: Direct state machine transition, no React dependency
   */
  endGame() {
    this.state = 'finished';
    this.endTime = new Date();
    
    // POST GAME END MESSAGE
    this.message.post(this.message.types.GAME_END, {
      winner: this.winner,
      gameStats: this.getGameStats()
    }, [this.message.channels.CONSOLE, this.message.channels.UI, this.message.channels.LOG]);
    
    if (this.winner) {
      this.log(`Game ended: ${this.winner.name} wins!`);
    } else {
      this.log('Game ended: Draw');
    }

    // Clean up temporary alliances (alliances without owners)
    this.cleanupTemporaryAlliances();
    
    // DIRECT STATE MACHINE TRANSITION - no useEffect or React delays
    if (this.stateMachineDispatch && this.stateMachineEvents) {
      console.log('[Game] Triggering direct state transition to OVER');
      this.stateMachineDispatch(this.stateMachineEvents.OVER);
    } else {
      console.warn('[Game] Cannot trigger state transition - stateMachineDispatch not set');
    }
  }

  /**
   * Clean up alliances that have no owner (temporary game alliances)
   */
  cleanupTemporaryAlliances() {
    const temporaryAlliances = Array.from(this.alliances.values()).filter(alliance => !alliance.owner);
    
    temporaryAlliances.forEach(alliance => {
      this.alliances.delete(alliance.id);
      this.log(`Temporary alliance ${alliance.name} dissolved after game end`);
    });

    // Clear player alliance mappings for temporary alliances
    this.playerAlliances.forEach((allianceId, playerId) => {
      if (!this.alliances.has(allianceId)) {
        this.playerAlliances.delete(playerId);
      }
    });
  }

  /**
   * Reset game for replay
   */
  reset() {
    this.state = 'setup';
    this.currentTurn = 0;
    this.currentPlayerIndex = 0;
    this.winner = null;
    this.startTime = null;
    this.endTime = null;
    this.gameLog = [];
    
    // Clear Game-owned mappings (Board clears its own data)
    this.shipOwnership.clear();
    
    // Clear board data
    if (this.board) {
      this.board.clear();
    }
    
    // Reset visualizer
    if (this.visualizer) {
      this.visualizer.clearAll();
    }
    
    // Reset message system
    if (this.message) {
      this.message.clear();
    }
    
    // Reset all players and fleets
    this.players.forEach(player => {
      const fleet = this.playerFleets.get(player.id);
      if (fleet) fleet.ships.forEach(ship => ship.reset());
    });
    
    this.log('Game reset');
  }

  /**
   * Get game statistics
   */
  getGameStats() {
    const duration = this.endTime ?
      Math.floor((this.endTime - this.startTime) / 1000) :
      Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
    
    const playerStats = this.players.map(player => {
      const fleet = this.playerFleets.get(player.id);
      return {
        name: player.name,
        type: player.type,
        shotsFired: player.shotsFired,
        shotsHit: player.shotsHit,
        accuracy: player.shotsFired > 0 ? (player.shotsHit / player.shotsFired * 100).toFixed(1) : 0,
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

  /**
   * Logging utility
   */
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
