// src/classes/GameLifecycleManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.5: FIXED munitions initialization - Game owns munitions, not CoreEngine
//         - Removed coreEngine.munitions assignment
//         - Now calls game.initializeMunitions() directly
//         - Munitions are owned by Game instance, read via gameInstance.munitions

import Game from './Game.js';
import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import AiPlayer from './AiPlayer.js';

const version = "v0.2.5";
/**
 * v0.2.4: BUGFIX - Removed .catch() from dispatch call
 *         - CoreEngine.dispatch() is now synchronous (returns undefined, not Promise)
 *         - Was causing "can't access property 'catch'" error on game over
 *         - Changed line 127: removed .catch(error => {...})
 * v0.2.3: Munitions terminology rename (resources → munitions)
 * - Changed this.coreEngine.resources → this.coreEngine.munitions
 * - Changed eraConfig.resources → eraConfig.munitions
 * - Updated calculateResourceWithBoost → calculateMunitionWithBoost naming in comments
 * - Aligns with Game.js v0.8.8 and CoreEngine.js v0.6.10
 * v0.2.2: Proper fix - Use instanceof for parent type detection
 * - Changed from Array.isArray(parent.players) band-aid
 * - Now uses proper instanceof Game check
 * - Explicit, type-safe, standard JavaScript pattern
 * v0.2.1: HOTFIX - Fixed parent detection logic (band-aid)
 * v0.2.0: Added game initialization (birth) to complete lifecycle management
 * - Added initializeForPlacement() - creates Game instance and sets up board
 * - Added calculateMunitionWithBoost() - multi-opponent munition calculation
 * - Added getOpposingAlliance() - alliance determination helper
 * - Constructor now accepts parent (CoreEngine or Game)
 * - When passed CoreEngine: manages game creation + end
 * - When passed Game: manages game end only (backward compatible)
 * - Extracted ~120 lines from CoreEngine.js v0.6.6
 * - GameLifecycleManager now manages FULL lifecycle: birth to death ✅
 * v0.1.0: Initial extraction from Game.js v0.8.5
 * - Extracted ~131 lines of game lifecycle logic
 * - checkGameEnd() - determines if game is over and identifies winner
 * - endGame() - handles game end sequence, callbacks, sounds, board capture
 * - cleanupTemporaryAlliances() - removes temporary alliances after game
 * - reset() - resets all game state for new game
 * - Reduces Game.js from 695 lines to ~564 lines
 */

/**
 * GameLifecycleManager
 *
 * Manages FULL game lifecycle:
 * - Birth: Game initialization, player setup, board creation
 * - Death: Game end detection, victory/defeat sequence, cleanup, reset
 *
 * Can be instantiated by:
 * - CoreEngine: for game initialization (birth)
 * - Game: for game termination (death)
 *
 * Extracted from Game.js and CoreEngine.js to follow Single Responsibility Principle.
 */
class GameLifecycleManager {
  /**
   * @param {Game|CoreEngine} parent - Reference to parent instance
   */
  constructor(parent) {
    // Use instanceof for proper type detection
    if (parent instanceof Game) {
      // Parent is Game instance
      this.game = parent;
      this.coreEngine = null;
      console.log(`[GameLifecycleManager ${version}] Initialized for game ${parent.id}`);
    } else {
      // Parent is CoreEngine
      this.coreEngine = parent;
      this.game = null; // Will be set during initializeForPlacement
      console.log(`[GameLifecycleManager ${version}] Initialized for CoreEngine`);
    }
    
    this.version = version;
  }

  // ============================================================================
  // BIRTH: Game Initialization
  // ============================================================================

  /**
   * Initialize game for placement phase
   *
   * Creates:
   * - Game instance with era config
   * - Board with terrain
   * - Players (human + AI opponents)
   * - Alliances
   * - Munitions with multi-opponent boost
   *
   * Called by CoreEngine when transitioning to placement state.
   *
   * @returns {Promise<void>}
   * @throws {Error} If required data is missing
   */
  async initializeForPlacement() {
    if (!this.coreEngine) {
      throw new Error('initializeForPlacement() requires CoreEngine reference');
    }
    
    this.log('Initializing for placement phase');
    
    // Reset references
    this.coreEngine.gameInstance = null;
    this.coreEngine.board = null;
    this.coreEngine.aiPlayers = [];
    
    // Validate required data
    if (!this.coreEngine.eraConfig || !this.coreEngine.humanPlayer || this.coreEngine.selectedOpponents.length === 0) {
      const missing = [];
      if (!this.coreEngine.eraConfig) missing.push('eraConfig');
      if (!this.coreEngine.humanPlayer) missing.push('humanPlayer');
      if (this.coreEngine.selectedOpponents.length === 0) missing.push('selectedOpponents');
      throw new Error(`Cannot initialize placement - missing: ${missing.join(', ')}`);
    }
    
    this.coreEngine.selectedEra = this.coreEngine.eraConfig.id;
    
    // Create Game instance
    this.game = new Game(
      this.coreEngine.eraConfig,
      this.coreEngine.selectedOpponents[0].gameMode || 'turnBased'
    );
    this.coreEngine.gameInstance = this.game;
    
    // Set up game callbacks
    this.game.setUIUpdateCallback(() => this.coreEngine.notifySubscribers());
    
    this.game.setGameEndCallback(() => {
      this.log('Game end callback triggered - dispatching OVER event');
      this.coreEngine.dispatch(this.coreEngine.events.OVER);
    });
    
    // Initialize alliances
    this.game.initializeAlliances();
    
    // Create board
    this.coreEngine.board = new Board(
      this.coreEngine.eraConfig.rows,
      this.coreEngine.eraConfig.cols,
      this.coreEngine.eraConfig.terrain
    );

    // Determine alliances
    let playerAlliance, opponentAlliance;
    if (this.coreEngine.eraConfig.game_rules?.choose_alliance && this.coreEngine.selectedAlliance) {
      playerAlliance = this.coreEngine.selectedAlliance;
      opponentAlliance = this.getOpposingAlliance(this.coreEngine.selectedAlliance);
    } else {
      playerAlliance = this.coreEngine.eraConfig.alliances?.[0]?.name || 'Player';
      opponentAlliance = this.coreEngine.eraConfig.alliances?.[1]?.name || 'Opponent';
    }
    
    if (!opponentAlliance) {
      throw new Error('Cannot determine opponent alliance');
    }
    
    // Add human player
    const humanPlayerAdded = this.game.addPlayer(this.coreEngine.humanPlayer, playerAlliance);
    
    // Add multiple AI opponents
    this.log(`Adding ${this.coreEngine.selectedOpponents.length} AI opponent(s) to ${opponentAlliance}`);
    
    for (let i = 0; i < this.coreEngine.selectedOpponents.length; i++) {
      const aiCaptain = this.coreEngine.selectedOpponents[i];
      const aiId = `ai-${aiCaptain.id}-${i}`;
      
      const aiPlayer = new AiPlayer(
        aiId,
        aiCaptain.name,
        aiCaptain.strategy || 'random',
        aiCaptain.difficulty || 1.0
      );
      
      if (aiCaptain.ships && Array.isArray(aiCaptain.ships)) {
        this.game.addPlayerWithFleet(aiPlayer, opponentAlliance, aiCaptain.ships);
        this.log(`Added AI ${aiCaptain.name} with ${aiCaptain.ships.length} specific ships (fleet_id: ${aiCaptain.fleet_id || 'unknown'})`);
      } else {
        this.game.addPlayer(aiPlayer, opponentAlliance);
        this.log(`Added AI ${aiCaptain.name} with alliance fleet`);
      }
      
      this.coreEngine.aiPlayers.push(aiPlayer);
    }
    
    if (!humanPlayerAdded || this.coreEngine.aiPlayers.length === 0) {
      throw new Error('Failed to add players to game');
    }

    // Set board on game
    this.game.setBoard(this.coreEngine.board);
    
      // Calculate munitions with multi-opponent boost
      const opponentCount = this.coreEngine.selectedOpponents.length;
      const starShells = this.calculateMunitionWithBoost(
        this.coreEngine.eraConfig.munitions?.star_shells,
        this.coreEngine.eraConfig.munitions?.star_shells_boost,
        opponentCount
      );
      const scatterShot = this.calculateMunitionWithBoost(
        this.coreEngine.eraConfig.munitions?.scatter_shot,
        this.coreEngine.eraConfig.munitions?.scatter_shot_boost,
        opponentCount
      );

      // Initialize munitions on game instance (Game owns munitions, not CoreEngine)
      this.game.initializeMunitions(starShells, scatterShot);

      this.log(`Munitions initialized: starShells=${starShells}, scatterShot=${scatterShot}`);
      
    this.log(`Game initialized with ${this.game.players.length} players (1 human + ${this.coreEngine.aiPlayers.length} AI)`);
  }

  /**
   * Calculate munition amount with multi-opponent boost
   *
   * Formula: base + (boost × (opponentCount - 1))
   *
   * Example: 3 star shells base, +2 per opponent, 2 opponents:
   *   3 + (2 × (2 - 1)) = 3 + 2 = 5 star shells
   *
   * @param {number} baseAmount - Base munition amount
   * @param {number} boostPerOpponent - Boost per additional opponent
   * @param {number} opponentCount - Number of opponents
   * @returns {number} Total munition amount
   */
  calculateMunitionWithBoost(baseAmount, boostPerOpponent, opponentCount) {
    if (!baseAmount || opponentCount <= 1 || !boostPerOpponent) {
      return baseAmount || 0;
    }
    
    const boost = boostPerOpponent * (opponentCount - 1);
    const total = baseAmount + boost;
    
    this.log(`Munition boost: base=${baseAmount}, boost/opp=${boostPerOpponent}, opps=${opponentCount}, total=${total}`);
    
    return total;
  }

  /**
   * Get opposing alliance name
   *
   * @param {string} selectedAlliance - Player's selected alliance
   * @returns {string|null} Opposing alliance name
   */
  getOpposingAlliance(selectedAlliance) {
    if (!this.coreEngine?.eraConfig?.alliances || this.coreEngine.eraConfig.alliances.length < 2) {
      return null;
    }
    
    return this.coreEngine.eraConfig.alliances.find(alliance =>
      alliance.name !== selectedAlliance
    )?.name;
  }

  // ============================================================================
  // DEATH: Game Termination
  // ============================================================================

  /**
   * Check if the game has ended
   *
   * Game ends when:
   * - One or fewer active alliances remain
   * - All players in losing alliances are defeated
   *
   * @returns {boolean} True if game is over
   */
  checkGameEnd() {
    const activeAlliances = Array.from(this.game.alliances.values()).filter(alliance => {
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
        this.game.winner = survivingPlayers[0] || winningAlliance.players[0];
        this.game.winningAlliance = winningAlliance;
      } else {
        this.game.winner = null;
        this.game.winningAlliance = null;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * End the game
   *
   * Sequence:
   * 1. Set state to 'finished', record end time
   * 2. Trigger onGameOver callback (synchronous - for video popups)
   * 3. Play victory/defeat sound (1s delay)
   * 4. Post game end message
   * 5. Log to battle log
   * 6. Cleanup temporary alliances
   * 7. Wait for fire animations to clear (2s)
   * 8. Capture winner's board (for OverPage display)
   * 9. Wait for game over delay (4s)
   * 10. Notify CoreEngine (triggers transition to OverPage)
   *
   * Uses delays to coordinate animations:
   * - 1s before sound (let attacks settle)
   * - 2s for fire to clear (before board capture)
   * - 4s total before page transition (let user see final state)
   */
  endGame() {
    this.game.state = 'finished';
    this.game.endTime = new Date();
    
    const humanPlayer = this.game.players.find(p => p.id === this.game.humanPlayerId);
    const humanWon = this.game.winner && humanPlayer && this.game.winner.id === humanPlayer.id;
    
    // v0.8.3: Call onGameOver callback IMMEDIATELY (synchronous)
    // This allows video to start while animations play
    if (this.game.onGameOver) {
      const eventType = humanWon ? 'victory' : 'defeat';
      this.game.onGameOver(eventType, {
        winner: this.game.winner,
        humanPlayer: humanPlayer,
        gameStats: this.game.getGameStats()
      });
    }
    
    // Play victory/defeat sound
    if (humanWon) {
      console.log(`[Game ${this.game.id}] Human victory - playing fanfare in 1 second`);
      this.game.playSound('victoryFanfare', 1000);
    } else {
      console.log(`[Game ${this.game.id}] Human defeat - playing funeral march in 1 second`);
      this.game.playSound('funeralMarch', 1000);
    }
    
    this.game.message.post(this.game.message.types.GAME_END, {
      winner: this.game.winner,
      gameStats: this.game.getGameStats()
    }, [this.game.message.channels.CONSOLE, this.game.message.channels.UI, this.game.message.channels.LOG]);
    
    if (this.game.winner) {
      this.game.battleLog(`Game ended: ${this.game.winner.name} wins!`, 'victory');
    } else {
      this.game.battleLog('Game ended: Draw', 'draw');
    }

    this.cleanupTemporaryAlliances();
    
    // Wait for fire to clear, THEN capture winner's board, THEN notify
    console.log(`[Game ${this.game.id}] Waiting ${this.game.animationSettings.fireAnimationClearDelay}ms for fire animations to clear`);
    
    setTimeout(() => {
      // Capture winner's board AFTER fire has cleared
      if (this.game.battleBoardRef?.current?.captureWinnerBoard) {
        const winnerId = this.game.winner?.id || humanPlayer?.id;
        console.log(`[Game ${this.game.id}] Capturing winner's board (fire cleared), winnerId:`, winnerId);
        this.game.finalBoardImage = this.game.battleBoardRef.current.captureWinnerBoard(winnerId);
        if (this.game.finalBoardImage) {
          console.log(`[Game ${this.game.id}] Winner's board captured successfully (${this.game.finalBoardImage.length} bytes)`);
        }
      }
      
      // Now wait before transitioning to OverPage
      console.log(`[Game ${this.game.id}] Delaying transition to OverPage by ${this.game.animationSettings.gameOverDelay}ms`);
      setTimeout(() => {
        console.log(`[Game ${this.game.id}] Notifying game end to CoreEngine`);
        this.game.notifyGameEnd();
      }, this.game.animationSettings.gameOverDelay);
      
    }, this.game.animationSettings.fireAnimationClearDelay);
  }

  /**
   * Clean up temporary alliances
   *
   * Removes:
   * - Alliances without an owner (temporary, game-created)
   * - Player alliance mappings for deleted alliances
   *
   * Called at end of game to prepare for new game.
   */
  cleanupTemporaryAlliances() {
    const temporaryAlliances = Array.from(this.game.alliances.values()).filter(alliance => !alliance.owner);
    
    temporaryAlliances.forEach(alliance => {
      this.game.alliances.delete(alliance.id);
    });

    this.game.playerAlliances.forEach((allianceId, playerId) => {
      if (!this.game.alliances.has(allianceId)) {
        this.game.playerAlliances.delete(playerId);
      }
    });
  }

  /**
   * Reset game to initial state
   *
   * Resets:
   * - Game state to 'setup'
   * - Turn counters
   * - Winner/times
   * - Game log
   * - Action queue
   * - Board cells
   * - Message system
   * - All players and their fleets
   *
   * Prepares for new game without creating new Game instance.
   */
  reset() {
    this.game.state = 'setup';
    this.game.currentTurn = 0;
    this.game.currentPlayerIndex = 0;
    this.game.winner = null;
    this.game.startTime = null;
    this.game.endTime = null;
    this.game.gameLog = [];
    
    this.game.actionQueue = [];
    this.game.isProcessingAction = false;
    this.game.lastAttackResult = null;
    
    if (this.game.board) {
      this.game.board.clear();
    }
    
    if (this.game.message) {
      this.game.message.clear();
    }
    
    this.game.players.forEach(player => {
      if (player.fleet) {
        player.fleet.ships.forEach(ship => ship.reset());
      }
      player.reset();
    });
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Log message (delegates to CoreEngine if available)
   * @param {string} message - Message to log
   */
  log(message) {
    if (this.coreEngine?.log) {
      this.coreEngine.log(message);
    } else {
      console.log(`[GameLifecycleManager ${version}]`, message);
    }
  }
}

export default GameLifecycleManager;
// EOF
