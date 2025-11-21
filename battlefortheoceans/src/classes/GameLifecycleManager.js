// src/classes/GameLifecycleManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.11: Fix consumeRights not being called - use Player.isHuman instead of HumanPlayer.isHuman
//          - HumanPlayer doesn't have static isHuman method, only Player does
//          - Added logging to verify isHuman check
// v0.2.10: Notify subscribers after consuming rights to refresh NavBar
//          - Added notification after consumeRights to refresh both pass and voucher balances
//          - Ensures NavBar updates immediately after game ends
// v0.2.9: Replace key data error throwing with graceful handling
//         - Use logwarn instead of logerror and throw
//         - Call coreEngine.handleKeyDataError() to save error and navigate to Launch
//         - Return early to prevent initialization when key data is missing
// v0.2.8: Refactored for PlayerProfile architecture
//         - Removed deprecated updateGameStats call
//         - Added insertGameResult call for game_results table
//         - PlayerProfile.applyGameResults() now handles stat updates
//         - PlayerProfileService.save() persists to database
//         - Clean separation: stats calculation vs database logging
// v0.2.7: Added startGame and endGame to control lifecycle and manage the incomplete user profile counter and consume the game
// v0.2.5: FIXED munitions initialization - Game owns munitions, not CoreEngine
//         - Removed coreEngine.munitions assignment
//         - Now calls game.initializeMunitions() directly
//         - Munitions are owned by Game instance, read via gameInstance.munitions

import Game from './Game.js';
import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import AiPlayer from './AiPlayer.js';
import Player from './Player.js';
import { supabase } from '../utils/supabaseClient';
import PlayerProfileService from '../services/PlayerProfileService.js';
import RightsService from '../services/RightsService.js';
import GameStatsService from '../services/GameStatsService';
import { coreEngine } from '../context/GameContext';

const version = "v0.2.11";
const tag = "LIFECYCLE";
const module = "GameLifecycleManager";
let method = "";

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
      method = 'constructor';

      // Use instanceof for proper type detection
    if (parent instanceof Game) {
      // Parent is Game instance
      this.game = parent;
      this.coreEngine = coreEngine;
      this.log(`Initialized for game ${parent.id}`);
    } else {
      // Parent is CoreEngine
      this.coreEngine = parent;
      this.game = null; // Will be set during initializeForPlacement
      this.log(`Initialized for CoreEngine`);
    }
    
    this.version = version;
      
      // log creation
      this.log('initialized');
  }

    
    //  Logging
    log(message) {
        console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    }
    logwarn(message) {
        console.warn(`[${tag}] ${version} ${module}.${method}: ${message}`);
    }
    logerror(message, error = null) {
        if (error) {
            console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
        } else {
            console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
        }
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
      method = 'initializeForPlacement';
      
    if (!this.coreEngine) {
      throw new Error('initializeForPlacement() requires CoreEngine reference');
    }
    
    this.log('Initializing for placement phase');
    
    // Reset references
    this.coreEngine.gameInstance = null;
    this.coreEngine.board = null;
    this.coreEngine.aiPlayers = [];
      
      //key data - see CoreEngine handle{state}
      const gameConfig = coreEngine.gameConfig;
      const eras = coreEngine.eras;
      const player = coreEngine.player
      const playerProfile = coreEngine.playerProfile;
      const playerEmail = coreEngine.playerEmail;
      const selectedEraId = coreEngine.selectedEraId;
      const selectedAlliance = coreEngine.selectedAlliance;
      const selectedOpponents = coreEngine.selectedOpponents;

      // derived data
      const playerId = coreEngine.playerId;
      const playerRole = coreEngine.playerRole;
      const playerGameName = coreEngine.playerGameName;
      const isGuest = player != null && player.isGuest;
      const isAdmin = player != null && playerProfile.isAdmin;
      const isDeveloper = player != null && playerProfile.isDeveloper;
      const isTester = player != null && playerProfile.isTester;
      const selectedOpponent = coreEngine.selectedOpponents[0];

      const selectedGameMode = coreEngine.selectedGameMode;
      const gameInstance = coreEngine.gameInstance;
      const board = coreEngine.board;

      // stop game if key data is missing (selectedAlliance is allowed to be null)
      // playerEmail is allowed to be null for guest users
      const required = isGuest 
          ? { gameConfig, eras, player, playerProfile, selectedEraId, selectedOpponents }
          : { gameConfig, eras, player, playerProfile, playerEmail, selectedEraId, selectedOpponents };
      const missing = Object.entries(required)
          .filter(([key, value]) => !value)
          .map(([key, value]) => `${key}=${value}`);
      if (missing.length > 0) {
          const errorMessage = `key data missing: ${missing.join(', ')}`;
          this.logwarn(errorMessage);
          this.coreEngine.handleKeyDataError('placement', errorMessage);
          return; // Return early to prevent initialization
      }

      const selectedEraConfig = coreEngine.selectedEraConfig;

    // Create Game instance
    this.game = new Game(
      selectedEraConfig,
      selectedOpponent.gameMode || 'turnBased'
    );
    this.coreEngine.gameInstance = this.game;
      this.log('DEBUG new Game instance', this.game);
    
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
      selectedEraConfig.rows,
      selectedEraConfig.cols,
      selectedEraConfig.terrain
    );

    // Determine alliances
    let playerAlliance, opponentAlliance;
    if (selectedEraConfig.game_rules?.choose_alliance && selectedAlliance) {
      playerAlliance = selectedAlliance;
      opponentAlliance = this.getOpposingAlliance(selectedAlliance);
    } else {
      playerAlliance = selectedEraConfig.alliances?.[0]?.name || 'Player';
      opponentAlliance = selectedEraConfig.alliances?.[1]?.name || 'Opponent';
    }
    
    if (!opponentAlliance) {
      throw new Error('Cannot determine opponent alliance');
    }
    
    // Add human player
    const humanPlayerAdded = this.game.addPlayer(player, playerAlliance);
    
    // Add multiple AI opponents
    this.log(`Adding ${this.coreEngine.selectedOpponents.length} AI opponent(s) to ${opponentAlliance}`);
    
    for (let i = 0; i < selectedOpponents.length; i++) {
      const aiCaptain = selectedOpponents[i];
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
        selectedEraConfig.munitions?.star_shells,
        selectedEraConfig.munitions?.star_shells_boost,
        opponentCount
      );
      const scatterShot = this.calculateMunitionWithBoost(
        selectedEraConfig.munitions?.scatter_shot,
        selectedEraConfig.munitions?.scatter_shot_boost,
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
      method = 'calculateMunitionWithBoost';

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
      method = 'getOpposingAlliance';
      
    if (!this.coreEngine?.selectedEraConfig?.alliances || this.coreEngine.selectedEraConfig.alliances.length < 2) {
      return null;
    }
    
    return this.coreEngine.selectedEraConfig.alliances.find(alliance =>
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
      method = 'checkGameEnd';

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
     * game start
     * - Increments incomplete_games counter
     * Called when CoreEngine transitions to 'play' state
     *
     * @param {string} playerId - Player's user ID
     * @param {string} eraId - Era identifier
     */
    async startGame(playerId, eraId) {
        method = 'startGame';

        this.log(`playerId=${playerId}, eraId=${eraId}, player.id=${coreEngine.player?.id}`);
        
        if (coreEngine.player == null ||
            coreEngine.player.id !== playerId ||
            coreEngine.player.isGuest)
        {
            return;
        }
        
      try {
        await PlayerProfileService.incrementIncompleteGames(playerId);
        this.log(`Game start tracked for user ${playerId}, era ${eraId}`);
      } catch (error) {
        this.logerror('Exception tracking game start:', error);
      }
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
   * 6. Update player profile stats (PlayerProfile.applyGameResults)
   * 7. Persist profile to database (PlayerProfileService.save)
   * 8. Insert game result record (GameStatsService.insertGameResults)
   * 9. Cleanup temporary alliances
   * 10. Wait for fire animations to clear (2s)
   * 11. Capture winner's board (for OverPage display)
   * 12. Wait for game over delay (4s)
   * 13. Notify CoreEngine (triggers transition to OverPage)
   *
   * Uses delays to coordinate animations:
   * - 1s before sound (let attacks settle)
   * - 2s for fire to clear (before board capture)
   * - 4s total before page transition (let user see final state)
   */
  async endGame() {
      method = 'endGame';

      this.log(`Starting endGame sequence`);
    this.game.state = 'finished';
    this.game.endTime = new Date();
    
      const playerId = this.coreEngine.playerId;
      const playerProfile = this.coreEngine.playerProfile;
      const eraId = this.coreEngine.selectedEraId;
      this.log(`playerId=${playerId}, playerProfile.id=${playerProfile?.id}, eraId=${eraId}, isHuman=${Player.isHuman(playerId)}`);

      const humanPlayer = this.coreEngine.player;
    const humanPlayer2 = this.game.players.find(p => p.id === this.game.humanPlayerId);
      this.log(`humanPlayer.id=${humanPlayer.id}, humanPlayer2.id=${humanPlayer2.id}`);

      const humanWon = this.game.winner && humanPlayer && this.game.winner.id === humanPlayer.id;

    // Call onGameOver callback IMMEDIATELY (synchronous)
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
      this.log(`Human victory - playing fanfare in 1 second`);
      this.game.playSound('victoryFanfare', 1000);
    } else {
      this.log(`Human defeat - playing funeral march in 1 second`);
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

      // Decrement incomplete_games counter and consume rights
      if (Player.isHuman(playerId)) {
        try {
          await PlayerProfileService.decrementIncompleteGames(playerId);
            const consumeResult = await RightsService.consumeRights(playerId, this.coreEngine.selectedEraConfig);
            this.log(`Incomplete game counter decremented and rights consumed (method: ${consumeResult.method})`);
            
            // Notify subscribers to refresh NavBar (for both passes and vouchers)
            if (this.coreEngine && this.coreEngine.notifySubscribers) {
                this.coreEngine.notifySubscribers();
                this.log('Notified subscribers after rights consumption');
            }
        } catch (error) {
          this.logerror(`Failed to process game end housekeeping:`, error);
        }
      }
      
    this.cleanupTemporaryAlliances();
    
      // Calculate game results from player statistics
      const gameResults = GameStatsService.calculateGameResults(
        this.game,
        this.coreEngine.selectedEraConfig,
        this.coreEngine.selectedOpponents
      );

      if (!gameResults) {
        this.logerror('Failed to calculate game results - skipping stats update');
      } else {
        this.log(`Calculated game results: won=${gameResults.won}, score=${gameResults.score}, accuracy=${gameResults.accuracy}`);
        
        // Skip database operations for guest users (they don't have database profiles)
        const isGuest = Player.isGuest(playerId);
        if (isGuest) {
          this.log('Guest user - skipping profile update and database operations');
        } else {
          try {
            // Update SSOT (Single Source of Truth) in-memory
            this.coreEngine.playerProfile.applyGameResults(gameResults);
            this.log('PlayerProfile stats updated in-memory');

            // Persist PlayerProfile to database
            await PlayerProfileService.save(this.coreEngine.playerProfile);
            this.log('PlayerProfile persisted to database');

            // Insert game result record
            try {
              this.log(`Attempting to insert game result for player ${playerId}`);
              const insertSuccess = await GameStatsService.insertGameResults(playerId, gameResults);
              if (insertSuccess) {
                this.log('Game result record inserted successfully');
              } else {
                this.logerror('Game result insert returned false - check database');
              }
            } catch (insertError) {
              this.logerror('Failed to insert game result record:', insertError);
              // Log full error details for debugging
              if (insertError.message) {
                this.logerror(`Insert error message: ${insertError.message}`);
              }
              if (insertError.stack) {
                this.logerror(`Insert error stack: ${insertError.stack}`);
              }
              // Don't throw - game was completed, just log the error
            }

          } catch (error) {
            this.logerror('Failed to update game statistics:', error);
            if (error.message) {
              this.logerror(`Error message: ${error.message}`);
            }
          }
        }
      }
      
    // Wait for fire to clear, THEN capture winner's board, THEN notify
    this.log(`Waiting ${this.game.animationSettings.fireAnimationClearDelay}ms for fire animations to clear`);
    
    setTimeout(() => {
      // Capture winner's board AFTER fire has cleared
      if (this.game.battleBoardRef?.current?.captureWinnerBoard) {
        const winnerId = this.game.winner?.id || humanPlayer?.id;
        this.log(`Capturing winner's board (fire cleared), winnerId: ${winnerId}`);
        this.game.finalBoardImage = this.game.battleBoardRef.current.captureWinnerBoard(winnerId);
        if (this.game.finalBoardImage) {
          this.log(`Winner's board captured successfully (${this.game.finalBoardImage.length} bytes)`);
        }
      }
      
      // Now wait before transitioning to OverPage
      this.log(`Delaying transition to OverPage by ${this.game.animationSettings.gameOverDelay}ms`);
      setTimeout(() => {
        this.log(`Notifying game end to CoreEngine`);
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
      method = 'cleanupTemporaryAlliances';

    const temporaryAlliances = Array.from(this.game.alliances.values()).filter(alliance => !alliance.owner);
    
    temporaryAlliances.forEach(alliance => {
      this.game.alliances.delete(alliance.id);
    });

    this.game.playerAlliances.forEach((allianceId, playerId) => {
      if (!this.game.alliances.has(allianceId)) {
        this.game.playerAlliances.delete(playerId);
      }
    });
      
      this.log("Cleaned up temporary alliances");
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
      method = 'reset';

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
      
      this.log("Reset game to initial state");
  }
}

export default GameLifecycleManager;
// EOF
