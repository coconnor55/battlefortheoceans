// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import AiPlayer from './AiPlayer.js';
import Fleet from './Fleet.js';
import Alliance from './Alliance.js';

const version = "v0.1.10";

class Game {
  constructor(eraConfig, gameMode = 'turnBased') {
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
    this.winner = null;
    
    // Alliance system for new architecture
    this.alliances = new Map(); // allianceId -> Alliance instance
    this.playerAlliances = new Map(); // playerId -> allianceId
    this.cellContents = new Map(); // "row,col" -> [{shipId, cellIndex}]
    this.shipOwnership = new Map(); // shipId -> playerId
    this.playerFleets = new Map(); // playerId -> Fleet instance
    
    // Game rules from era config
    this.gameRules = {
      friendly_fire: false,
      change_alliance: false,
      ship_capture: false,
      capture_chance: 0.0,
      turn_required: true,
      create_alliance: false,
      ...eraConfig.game_rules
    };
    
    // Game history and logging
    this.gameLog = [];
    this.startTime = null;
    this.endTime = null;
    
    // Turn management
    this.turnTimeout = null;
    this.maxTurnTime = 30000; // 30 seconds per turn
    
    this.log(`Game created: ${this.id}, Mode: ${gameMode}`);
  }

  /**
   * Add player to the game with optional strategy and difficulty for AI
   */
  addPlayer(id, type = 'human', name = 'Player', strategy = 'methodical_hunting', difficulty = 1) {
    if (this.players.length >= (this.eraConfig.max_players || 2)) {
      throw new Error(`Maximum ${this.eraConfig.max_players || 2} players allowed`);
    }

    let player;
    if (type === 'ai') {
      player = new AiPlayer(id, name, strategy, difficulty);
    } else {
      player = new HumanPlayer(id, name);
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
   * Enhanced hit resolution with alliance rules and damage calculation
   */
  receiveAttack(row, col, firingPlayer, damage = 1.0) {
    // Validate coordinates
    if (row < 0 || row >= this.eraConfig.rows || col < 0 || col >= this.eraConfig.cols) {
      return { result: 'invalid', ships: [] };
    }

    const cellKey = `${row},${col}`;
    const cellName = `${String.fromCharCode(65 + col)}${row + 1}`;
    
    // Get ships at this location from our mapping
    const cellData = this.cellContents.get(cellKey);
    if (!cellData || cellData.length === 0) {
      this.log(`Miss at ${cellName} by ${firingPlayer.name}`);
      return { result: 'miss', ships: [] };
    }

    // Process hits on all ships at this location
    const hitResults = [];
    let anyValidHits = false;

    for (const shipData of cellData) {
      const { shipId, cellIndex } = shipData;
      const targetPlayerId = this.shipOwnership.get(shipId);
      const targetPlayer = this.getPlayer(targetPlayerId);
      const fleet = this.playerFleets.get(targetPlayerId);
      
      if (!targetPlayer || !fleet) continue;

      // Check friendly fire rules
      if (!this.canAttack(firingPlayer.id, targetPlayerId)) {
        this.log(`Friendly fire blocked: ${firingPlayer.name} -> ${targetPlayer.name} at ${cellName}`);
        continue;
      }

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
      
      anyValidHits = true;
      
      this.log(`${result.toUpperCase()}: ${ship.name} (${targetPlayer.name}) at ${cellName} by ${firingPlayer.name}`);
      
      // Handle ship capture if enabled
      if (this.gameRules.ship_capture && ship.isSunk()) {
        const captureRoll = Math.random();
        if (captureRoll <= this.gameRules.capture_chance) {
          this.handleShipCapture(ship, firingPlayer, targetPlayer);
        }
      }
    }

    if (!anyValidHits) {
      return { result: 'blocked', ships: [] };
    }

    const overallResult = hitResults.some(r => r.result === 'sunk') ? 'sunk' : 'hit';
    return { result: overallResult, ships: hitResults };
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
   */
  registerShipPlacement(ship, playerId) {
    if (!ship.isPlaced || !ship.cells) return false;
    
    // Update ship ownership
    this.shipOwnership.set(ship.id, playerId);
    
    // Update cell contents mapping
    ship.cells.forEach((cell, index) => {
      const cellKey = `${cell.row},${cell.col}`;
      
      if (!this.cellContents.has(cellKey)) {
        this.cellContents.set(cellKey, []);
      }
      
      this.cellContents.get(cellKey).push({
        shipId: ship.id,
        cellIndex: index
      });
    });
    
    return true;
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
    this.log('Board set for game');
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
      this.log('New board created');
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
      
      // Register all placed ships for hit resolution
      fleet.ships.forEach(ship => {
        if (ship.isPlaced) {
          this.registerShipPlacement(ship, player.id);
        }
      });
    }

    this.state = 'playing';
    this.startTime = new Date();
    this.currentPlayerIndex = 0; // Human player goes first
    
    this.log('Game started');
    return true;
  }

  /**
   * Auto-place ships for AI players
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
            ship.place(cells, horizontal ? 'horizontal' : 'vertical');
            placed = true;
            this.log(`${player.name}: Placed ${ship.name} at ${row},${col} ${horizontal ? 'H' : 'V'}`);
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
    if (this.state !== 'playing') {
      throw new Error('Game is not in playing state');
    }

    if (!this.isValidAttack(row, col)) {
      throw new Error('Invalid attack position');
    }

    // Use enhanced hit resolution
    const result = this.receiveAttack(row, col, attacker);
    
    // Update attacker stats
    attacker.shotsFired++;
    if (result.result === 'hit' || result.result === 'sunk') {
      attacker.shotsHit++;
      attacker.score += result.result === 'sunk' ? 10 : 1;
    }

    // Check for game end
    if (this.checkGameEnd()) {
      this.endGame();
      return result;
    }

    // Handle turn progression
    this.handleTurnProgression(result.result === 'hit' || result.result === 'sunk');
    
    return result;
  }

  /**
   * Check if game has ended
   */
  checkGameEnd() {
    const activePlayers = this.players.filter(player => {
      const fleet = this.playerFleets.get(player.id);
      return fleet && !fleet.isDefeated();
    });

    if (activePlayers.length <= 1) {
      this.winner = activePlayers[0] || null;
      return true;
    }
    
    return false;
  }

  /**
   * Handle turn progression based on game mode and era rules
   */
  handleTurnProgression(wasHit) {
    if (!this.gameRules.turn_required) {
      return; // Rapid fire mode - no turn changes
    }
    
    // Turn-based rules from era config
    const shouldContinue = (wasHit && this.gameRules.turn_on_hit) ||
                         (!wasHit && this.gameRules.turn_on_miss);
    
    if (!shouldContinue) {
      this.nextTurn();
    }
  }

  /**
   * Advance to next player's turn
   */
  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentTurn++;
    
    const currentPlayer = this.getCurrentPlayer();
    this.log(`Turn ${this.currentTurn}: ${currentPlayer.name}'s turn`);
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
   * End the game
   */
  endGame() {
    this.state = 'finished';
    this.endTime = new Date();
    
    if (this.winner) {
      this.log(`Game ended: ${this.winner.name} wins!`);
    } else {
      this.log('Game ended: Draw');
    }

    // Clean up temporary alliances (alliances without owners)
    this.cleanupTemporaryAlliances();
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
    
    // Clear mappings
    this.cellContents.clear();
    this.shipOwnership.clear();
    
    // Reset all players and fleets
    this.players.forEach(player => {
      const fleet = this.playerFleets.get(player.id);
      if (fleet) fleet.ships.forEach(ship => ship.reset());
    });
    
    this.log('Game reset');
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
