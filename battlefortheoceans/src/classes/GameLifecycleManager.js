// src/classes/GameLifecycleManager.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.1.0";
/**
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
 * Manages game lifecycle transitions:
 * - Game end detection
 * - Victory/defeat sequence
 * - Cleanup and reset
 * 
 * Extracted from Game.js to follow Single Responsibility Principle.
 */
class GameLifecycleManager {
  /**
   * @param {Game} game - Reference to parent Game instance
   */
  constructor(game) {
    this.game = game;
    this.version = version;
    
    console.log(`[GameLifecycleManager ${version}] Initialized for game ${game.id}`);
  }

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
}

export default GameLifecycleManager;
