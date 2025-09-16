// src/classes/Game.js
// Copyright(c) 2025, Clint H. O'Connor

import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import AiPlayer from './AiPlayer.js';

const version = "v0.1.1";

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
    
    // Game history and logging
    this.gameLog = [];
    this.startTime = null;
    this.endTime = null;
    
    // Turn management
    this.turnTimeout = null;
    this.maxTurnTime = 30000; // 30 seconds per turn
    
    this.log(`Game created: ${this.id}, Mode: ${gameMode}`);
  }

  // Add player to the game
  addPlayer(id, type = 'human', name = 'Player') {
    if (this.players.length >= this.eraConfig.max_players) {
      throw new Error(`Maximum ${this.eraConfig.max_players} players allowed`);
    }

    let player;
    if (type === 'ai') {
      player = new AiPlayer(id, name, this.eraConfig);
    } else {
      player = new HumanPlayer(id, name);
    }

    this.players.push(player);
    this.log(`Player added: ${name} (${type})`);
    return player;
  }

  // Set the game board (usually from placement phase)
  setBoard(board) {
    this.board = board;
    this.log('Board set for game');
  }

  // Start the game
  async startGame() {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players to start game');
    }
    
    if (!this.board) {
      this.board = new Board(this.eraConfig.rows, this.eraConfig.cols, this.eraConfig.terrain);
      this.log('New board created');
    }

    // Auto-place AI ships if needed
    for (const player of this.players) {
      if (player.type === 'ai' && !player.fleet.isComplete()) {
        await this.autoPlaceShips(player);
      }
    }

    this.state = 'playing';
    this.startTime = new Date();
    this.currentPlayerIndex = 0; // Human player goes first
    
    this.log('Game started');
    return true;
  }

  // Auto-place ships for AI players
  async autoPlaceShips(player) {
    if (!this.eraConfig.ships) return;

    for (const shipConfig of this.eraConfig.ships) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 100) {
        const row = Math.floor(Math.random() * this.eraConfig.rows);
        const col = Math.floor(Math.random() * this.eraConfig.cols);
        const horizontal = Math.random() > 0.5;

        try {
          const ship = player.fleet.addShip(shipConfig.name, shipConfig.size);
          const success = this.board.placeShip(ship, row, col, horizontal);
          
          if (success) {
            placed = true;
            this.log(`${player.name}: Placed ${shipConfig.name} at ${row},${col} ${horizontal ? 'H' : 'V'}`);
          } else {
            player.fleet.removeShip(ship.id);
          }
        } catch (error) {
          // Try again
        }
        
        attempts++;
      }

      if (!placed) {
        throw new Error(`Failed to place ${shipConfig.name} for ${player.name}`);
      }
    }
  }

  // Get current player
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // Process player action
  async processPlayerAction(action, data) {
    const currentPlayer = this.getCurrentPlayer();
    
    if (action === 'attack') {
      return await this.processAttack(currentPlayer, data.row, data.col);
    }
    
    throw new Error(`Unknown action: ${action}`);
  }

  // Process attack
  async processAttack(attacker, row, col) {
    if (this.state !== 'playing') {
      throw new Error('Game is not in playing state');
    }

    if (!this.isValidAttack(row, col)) {
      throw new Error('Invalid attack position');
    }

    // Execute attack through board
    const result = this.board.receiveAttack(row, col);
    
    // Log the attack
    this.log(`${attacker.name} attacks ${row},${col}: ${result.hit ? 'HIT' : 'MISS'}`);
    
    // Update attacker's record
    attacker.recordAttack(row, col, result.hit, result.sunk);

    // Check for game end
    if (this.checkGameEnd()) {
      this.endGame();
      return result;
    }

    // Handle turn progression based on game mode
    this.handleTurnProgression(result.hit);
    
    return result;
  }

  // Process AI turn
  async processAITurn() {
    const aiPlayer = this.getCurrentPlayer();
    
    if (aiPlayer.type !== 'ai') {
      throw new Error('Current player is not AI');
    }

    // Get AI's next move
    const move = await aiPlayer.getNextMove(this.board);
    
    if (!move) {
      throw new Error('AI could not determine next move');
    }

    // Execute the attack
    return await this.processAttack(aiPlayer, move.row, move.col);
  }

  // Handle turn progression based on game mode
  handleTurnProgression(wasHit) {
    const gameMode = this.getGameModeConfig();
    
    if (this.gameMode === 'rapidFire') {
      // In rapid fire, no turn changes
      return;
    }
    
    if (this.gameMode === 'turnBased') {
      // Turn-based rules from era config
      const shouldContinue = (wasHit && gameMode.turn_on_hit) ||
                           (!wasHit && gameMode.turn_on_miss);
      
      if (!shouldContinue) {
        this.nextTurn();
      }
    }
  }

  // Advance to next player's turn
  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentTurn++;
    
    const currentPlayer = this.getCurrentPlayer();
    this.log(`Turn ${this.currentTurn}: ${currentPlayer.name}'s turn`);
  }

  // Check if attack position is valid
  isValidAttack(row, col) {
    if (!this.board) return false;
    if (row < 0 || row >= this.eraConfig.rows) return false;
    if (col < 0 || col >= this.eraConfig.cols) return false;
    
    // Check if already attacked
    return !this.board.hasBeenAttacked(row, col);
  }

  // Check if game has ended
  checkGameEnd() {
    for (const player of this.players) {
      if (player.fleet.isDestroyed()) {
        // Find winner (player whose fleet is NOT destroyed)
        this.winner = this.players.find(p => !p.fleet.isDestroyed());
        return true;
      }
    }
    return false;
  }

  // End the game
  endGame() {
    this.state = 'finished';
    this.endTime = new Date();
    
    if (this.winner) {
      this.log(`Game ended: ${this.winner.name} wins!`);
    } else {
      this.log('Game ended: Draw');
    }
  }

  // Reset game for replay
  reset() {
    this.state = 'setup';
    this.currentTurn = 0;
    this.currentPlayerIndex = 0;
    this.winner = null;
    this.startTime = null;
    this.endTime = null;
    this.gameLog = [];
    
    // Reset all players
    this.players.forEach(player => player.reset());
    
    // Reset board
    if (this.board) {
      this.board.reset();
    }
    
    this.log('Game reset');
  }

  // Get game mode configuration from era
  getGameModeConfig() {
    if (!this.eraConfig.game_modes) {
      // Default turn-based rules
      return {
        turn_on_hit: true,
        turn_on_miss: false,
        rapid_fire: false
      };
    }

    const mode = this.eraConfig.game_modes.available.find(m => m.id === this.gameMode);
    return mode || this.eraConfig.game_modes.available[0];
  }

  // Get game statistics
  getGameStats() {
    const duration = this.endTime && this.startTime ?
      this.endTime.getTime() - this.startTime.getTime() : null;

    return {
      gameId: this.id,
      state: this.state,
      currentTurn: this.currentTurn,
      players: this.players.map(p => ({
        name: p.name,
        type: p.type,
        hits: p.getHits(),
        misses: p.getMisses(),
        shipsRemaining: p.fleet.getShipsRemaining(),
        isEliminated: p.fleet.isDestroyed()
      })),
      winner: this.winner?.name || null,
      duration: duration,
      gameMode: this.gameMode
    };
  }

  // Get game state snapshot
  getState() {
    return {
      id: this.id,
      state: this.state,
      currentTurn: this.currentTurn,
      currentPlayer: this.getCurrentPlayer()?.name,
      players: this.players.length,
      winner: this.winner?.name || null,
      gameMode: this.gameMode
    };
  }

  // Logging utility
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
