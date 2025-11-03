// src/engines/CoreEngine.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.6.35: Added Supabase signOut to logout method
// v0.6.34: Fixed logout to properly clear humanPlayer
// v0.6.33: FIXED munitions ownership - Game owns munitions, not CoreEngine
//          - Removed CoreEngine.munitions references
//          - getUIState now reads from gameInstance.munitions
//          - handleEvent_play simplified (GameLifecycleManager handles init)
// v0.6.32: Added restoreToState() method and converted services to singletons
//          - Added restoreToState(state) method for browser navigation (after transition())
//          - Handles browser back/forward button state restoration without URL sync
//          - Changed service imports to lowercase singleton instances (no 'new' needed)
//          - userProfileService, gameStatsService, leaderboardService, rightsService, achievementService
//          - Removed handleEvent_achievements() (was legacy from removed ACHIEVEMENTS event)
// v0.6.28: Removed ACHIEVEMENTS event (Claude error)
// v0.6.27: Changed ERA to SELECTERA (Claude error)
// v0.6.26: FIXED - Added back ship.place(), notifySubscribers() in registerShipPlacement
// v0.6.25: FIXED - Added back missing transition() method
//          - v0.6.24 accidentally deleted transition() when removing processEventData()
//          - Reconstructed transition() method between dispatch() and handlers
//          - Now properly passes data from dispatch() → transition() → handler()
// v0.6.24: MAJOR REFACTOR - Removed processEventData, handlers do all the work
//          - dispatch() now passes data directly to transition()
//          - transition() passes data to handleEvent_XXX() methods
//          - Each handler processes its own data (proper separation)
//          - handleEvent_placement() now processes data BEFORE calling GameLifecycleManager
//          - Removed 60+ lines of redundant processEventData() method
//          - This is how it should have been from the start!
// v0.6.23: Added PLACEMENT event data processing
//          - Process opponents array from PLACEMENT dispatch
//          - GameLifecycleManager requires coreEngine.selectedOpponents
//          - Previously only processed during SELECTOPPONENT event
// v0.6.22: Removed redundant reset from SELECTERA event
//          - Only reset player stats in PLACEMENT event (where game actually starts)
//          - SELECTERA reset was premature - stats should reset when placement begins, not era selection
//          - Allows user to navigate back/forth between era/opponent without clearing stats prematurely
// v0.6.21: Fixed userProfile getter - use humanPlayer.userProfile not humanPlayer.profile
//          - Line 600: Changed from .profile to .userProfile
//          - Player class property is userProfile, not profile
//          - Added DEBUG logging to track userProfile through LOGIN/SELECTERA/PLACEMENT events
// v0.6.20: Added get userProfile to get humanPlayer profile (guest has null)
//          - humanPlayer is set directly by LoginPage via CoreEngine.humanPlayer
// v0.6.19: Fixed humanPlayer initialization - set during LOGIN event
//          - humanPlayer now set when processEventData receives LOGIN + player
//          - Was previously only set in handleEvent_placement (too late!)
//          - SelectOpponentPage (opponent state) needs humanPlayer available
//          - Added player param to LOGIN event data handling
// v0.6.18: Restore eraConfig passing in SELECTOPPONENT

import SessionManager from '../utils/SessionManager.js';
import NavigationManager from '../utils/NavigationManager.js';
import GameLifecycleManager from '../classes/GameLifecycleManager.js';
import userProfileService from '../services/UserProfileService.js';
import gameStatsService from '../services/GameStatsService.js';
import leaderboardService from '../services/LeaderboardService.js';
import rightsService from '../services/RightsService.js';
import achievementService from '../services/AchievementService.js';
import { supabase } from '../utils/supabaseClient';
import ConfigLoader from '../utils/ConfigLoader.js';

const version = 'v0.6.35';

/**
 * CoreEngine - Orchestrates game state machine and coordinates services
 *
 * Responsibilities:
 * - State machine management (events, states, transitions)
 * - Session persistence (via SessionManager)
 * - URL synchronization (via NavigationManager)
 * - Service coordination
 * - Observer pattern for UI updates
 *
 * Delegates:
 * - Session storage → SessionManager
 * - URL/browser navigation → NavigationManager
 * - Game initialization → GameLifecycleManager
 * - Combat logic → Game.js
 *
 * Architecture: Thin orchestrator - coordinates but doesn't implement
 */
class CoreEngine {
  constructor() {
    console.log(`[CORE] CoreEngine v${version} initializing...`);
    
    // =================================================================
    // EVENTS - State machine event definitions
    // =================================================================
    this.events = {
      LAUNCH: Symbol('LAUNCH'),
      LOGIN: Symbol('LOGIN'),
      SELECTERA: Symbol('SELECTERA'),
      SELECTOPPONENT: Symbol('SELECTOPPONENT'),
      PLACEMENT: Symbol('PLACEMENT'),
      PLAY: Symbol('PLAY'),
      OVER: Symbol('OVER')
    };

    // =================================================================
    // STATES - State machine state definitions
    // =================================================================
    this.states = {
      launch: {
        on: {
          [this.events.LAUNCH]: 'launch',
          [this.events.LOGIN]: 'login',
          [this.events.SELECTERA]: 'era'
        }
      },
      login: {
        on: {
          [this.events.SELECTERA]: 'era'
        }
      },
      era: {
        on: {
          [this.events.SELECTOPPONENT]: 'opponent',
        }
      },
      opponent: {
        on: {
          [this.events.PLACEMENT]: 'placement',
          [this.events.SELECTERA]: 'era',
        }
      },
      placement: {
        on: {
          [this.events.PLAY]: 'play',
          [this.events.SELECTOPPONENT]: 'opponent',
        }
      },
      play: {
        on: {
          [this.events.OVER]: 'over'
        }
      },
      over: {
        on: {
          [this.events.SELECTERA]: 'era',
          [this.events.SELECTOPPONENT]: 'opponent',
          [this.events.PLACEMENT]: 'placement',
          [this.events.LAUNCH]: 'launch',
        }
      },
    };

    // =================================================================
    // CORE STATE
    // =================================================================
    this.currentState = 'launch';
    this.humanPlayer = null;  // v0.6.15: Added Player instance tracking
    this.eraConfig = null;
    this.selectedOpponents = [];
    this.selectedGameMode = null;
    this.selectedAlliance = null;
    this.gameInstance = null;

    // =================================================================
    // MANAGERS - Initialize helper classes
    // =================================================================
    this.lifecycleManager = new GameLifecycleManager(this);
    
    // CRITICAL: Initialize subscribers BEFORE NavigationManager
    // NavigationManager.initializeFromURL() calls notifySubscribers()
    this.subscribers = [];
    
    // CRITICAL: Define notifySubscribers BEFORE NavigationManager
    this.notifySubscribers = () => {
      this.subscribers.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('[CORE] Error in subscriber callback:', error);
        }
      });
    };
    
    this.navigationManager = new NavigationManager(this);
    
    // =================================================================
    // SESSION RESTORATION
    // =================================================================
    this.restoreSession();
  }

  // =================================================================
  // STATE MACHINE METHODS
  // =================================================================

  /**
   * Dispatch an event to trigger state transition
   * @param {Symbol} event - Event from this.events
   * @param {Object} data - Optional data payload
   */
  dispatch(event, data = null) {
    console.log(`[CORE] Dispatching event:`, event.description, 'with data:', data);

    const nextState = this.states[this.currentState]?.on[event];
    
    if (!nextState) {
      console.warn(`[CORE] No transition for ${this.currentState} + ${event.description}`);
      return;
    }

    // Transition to new state, passing data to handler
    this.transition(nextState, data);
  }

  /**
   * Transition to a new state
   * @param {String} newState - State to transition to
   * @param {Object} data - Optional data for state handler
   */
  transition(newState, data = null) {
    console.log(`[CORE] Transitioning: ${this.currentState} → ${newState}`);
    
    const oldState = this.currentState;
    this.currentState = newState;

    // Update URL
    this.navigationManager.syncURL(newState);

    // Call state-specific handler with data
    const handler = this[`handleEvent_${newState}`];
    if (typeof handler === 'function') {
      handler.call(this, data);
    }

    // Save session
    this.saveSession();

    // Notify UI
    this.notifySubscribers();
  }

  /**
   * v0.6.32: Restore to state without URL synchronization
   * Used by NavigationManager for browser navigation and page refresh
   *
   * Sets state synchronously, then runs handlers asynchronously
   * Saves session and notifies subscribers
   * Does NOT sync URL (we're already at the correct URL)
   *
   * @param {string} state - Target state to restore
   */
  async restoreToState(state) {
    const previousState = this.currentState;
    
    // Set state synchronously
    this.currentState = state;
    console.log(`[CORE] Restoring to state: ${previousState || 'none'} → ${state}`);
    
    // Run state handler asynchronously (if exists)
    const stateHandler = `handleEvent_${state}`;
    if (typeof this[stateHandler] === 'function') {
      try {
        await this[stateHandler](null);
      } catch (error) {
        console.error(`[CORE] ${version} State handler failed during restoration:`, error);
      }
    }
    
    // Save session and notify
    this.saveSession();
    this.notifySubscribers();
    
    console.log(`[CORE] State restoration complete: ${state}`);
  }

  // =================================================================
  // STATE HANDLERS
  // =================================================================

  handleEvent_launch() {
    console.log('[CORE] Launch state');
  }

  handleEvent_login(data) {
    console.log('[CORE] Login state');
    // Login is handled by LoginPage setting coreEngine.humanPlayer directly
  }

  handleEvent_era(data) {
    console.log('[CORE] Era selection state');
    if (data?.eraConfig) {
      this.eraConfig = data.eraConfig;
    }
  }

  handleEvent_opponent(data) {
    console.log('[CORE] Opponent selection state');
    if (data?.eraConfig) {
      this.eraConfig = data.eraConfig;
    }
  }

  handleEvent_placement(data) {
    console.log('[CORE] Placement state - processing data and delegating to GameLifecycleManager');
    
    // Process placement data
    if (data) {
      if (data.eraConfig) {
        this.eraConfig = data.eraConfig;
      }
      if (data.opponents) {
        this.selectedOpponents = data.opponents;
        console.log('[CORE] Stored selectedOpponents:', this.selectedOpponents);
      }
      if (data.selectedAlliance !== undefined) {
        this.selectedAlliance = data.selectedAlliance;
      }
    }
    
    // Reset player stats for new game
    if (this.humanPlayer) {
      console.log('[CORE] DEBUG - humanPlayer.userProfile BEFORE placement reset:', this.humanPlayer.userProfile);
      this.humanPlayer.reset();
      console.log('[CORE] Player stats reset for new game');
      console.log('[CORE] DEBUG - humanPlayer.userProfile AFTER placement reset:', this.humanPlayer.userProfile);
    }
    
    // Initialize placement (creates game, board, etc.)
    this.lifecycleManager.initializeForPlacement(this);
    
    // v0.6.19: humanPlayer should already be set from LOGIN
    // Keep this as fallback only
    if (!this.humanPlayer && this.gameInstance) {
      this.humanPlayer = this.gameInstance.players.find(p => p.type === 'human');
      console.log('[CORE] humanPlayer extracted (fallback):', this.humanPlayer?.name);
    }
  }

  handleEvent_play() {
    console.log('[CORE] Play state');
    if (this.gameInstance) {
        // Track game start (increment incomplete_games counter)
        this.lifecycleManager.startGame(
          this.humanPlayer.id,
          this.eraConfig.era
        ).catch(error => {
            console.error('[CORE] Failed to track game start:', error);
        });

        this.gameInstance.startGame();
        this.notifySubscribers();  // ADD THIS LINE
    }
  }

  handleEvent_over() {
    console.log('[CORE] Game over state');
  }

  // =================================================================
  // SESSION MANAGEMENT
  // =================================================================

  /**
   * Restore state from session storage
   */
  restoreSession() {
    const sessionData = SessionManager.restore();
    
    if (!sessionData) {
      console.log('[CORE] No session to restore');
      return;
    }

    console.log('[CORE] Restoring session:', sessionData);

      // Restore humanPlayer (which contains the profile)
      if (sessionData.humanPlayer) {
        this.humanPlayer = sessionData.humanPlayer;
      }

      this.currentState = sessionData.currentState;
//    this.userProfile = sessionData.user;
    this.selectedOpponents = sessionData.selectedOpponents;
    this.selectedGameMode = sessionData.selectedGameMode;
    this.selectedAlliance = sessionData.selectedAlliance;

    // Restore era config
    if (sessionData.eraId) {
      SessionManager.restoreEraAsync(this, sessionData.eraId);
    }

    // Restore user profile
    if (this.userProfile?.user_id) {
      SessionManager.refreshProfileAsync(this);
    }

    // Initialize from URL (handles browser navigation)
    this.navigationManager.initializeFromURL();
  }

  /**
   * Save current state to session storage
   */
  saveSession() {
    SessionManager.save(this);
  }

  /**
   * Clear session storage
   */
  clearSession() {
    SessionManager.clear();
  }

  // =================================================================
  // GAME ORCHESTRATION (thin wrappers to Game.js)
  // =================================================================

  /**
   * Handle attack on game board
   * @param {Number} row - Target row
   * @param {Number} col - Target column
   * @returns {Object} Attack result
   */
  handleAttack(row, col) {
    if (!this.gameInstance) {
      console.warn('[CORE] No game instance for attack');
      return null;
    }

    const humanPlayer = this.gameInstance.players.find(p => p.type === 'human');
    if (!humanPlayer) {
      console.warn('[CORE] No human player found');
      return null;
    }

    return this.gameInstance.receiveAttack(row, col, humanPlayer);
  }

  /**
   * Fire a munition (star shell, scatter shot)
   * @param {String} munitionType - Type of munition ('starShell', 'scatterShot')
   * @param {Number} row - Target row
   * @param {Number} col - Target column
   * @returns {Boolean} Success
   */
    fireMunition(munitionType, row, col) {
      console.log('[MUNITIONS] fireMunition called:', { munitionType, row, col, currentMunitions: this.munitions });
      
      if (!this.gameInstance) {
        console.log('[MUNITIONS] No game instance!');
        return false;
      }
      
      const result = this.gameInstance.fireMunition(munitionType, row, col);
      console.log('[MUNITIONS] fireMunition result:', result, 'munitions after:', this.munitions);
      
      return result;
    }
    
  /**
   * Register ship placement on board
   */
  registerShipPlacement(ship, shipCells, orientation, playerId) {
    if (!this.gameInstance) {
      console.warn('[CORE] No game instance for ship placement');
      return false;
    }
      
      const success = this.gameInstance.registerShipPlacement(ship, shipCells, orientation, playerId);
      
      if (success) {
        ship.place();              // ⬅️ CRITICAL
        this.notifySubscribers();  // ⬅️ CRITICAL
        return true;
      }
      
      return false;
  }

  /**
   * Get game statistics for UI display
   * @returns {Object} Game statistics
   */
  getGameStats() {
    if (!this.gameInstance) {
      return null;
    }

    return this.gameInstance.getGameStats();
  }

  // =================================================================
  // SERVICE COORDINATION
  // =================================================================

  /**
   * Get user achievements
   * @returns {Promise<Array>} List of achievements
   */
  async getUserAchievements() {
    if (!this.userProfile?.user_id) {
      console.warn('[CORE] No user profile for achievements');
      return [];
    }

    try {
      return await achievementService.getPlayerAchievements(this.userProfile.user_id);
    } catch (error) {
      console.error('[CORE] Error fetching achievements:', error);
      return [];
    }
  }

  /**
   * Get leaderboard for current era
   * @param {Number} limit - Number of top players
   * @returns {Promise<Array>} Leaderboard data
   */
  async getLeaderboard(limit = 10) {
    if (!this.eraConfig?.id) {
      console.warn('[CORE] No era selected for leaderboard');
      return [];
    }

    try {
      return await leaderboardService.getLeaderboard(this.eraConfig.era, limit);
    } catch (error) {
      console.error('[CORE] Error fetching leaderboard:', error);
      return [];
    }
  }

  /**
   * Check if user has access to an era
   * @param {String} eraId - Era identifier
   * @returns {Promise<Boolean>} Has access
   */
  async hasEraAccess(eraId) {
    if (!this.userProfile?.user_id) {
      console.warn('[CORE] No user profile for era access check');
      return false;
    }

    try {
      // Free eras are always accessible
      const eraConfig = await ConfigLoader.loadEraConfig(eraId);
      if (eraConfig.price === 0) {
        return true;
      }

      // Check rights for premium eras
      return await rightsService.hasEraAccess(this.userProfile.user_id, eraId);
    } catch (error) {
      console.error('[CORE] Error checking era access:', error);
      return false;
    }
  }

    /**
       * Logout user and clear state
       * v0.6.29: Added Supabase signOut to clear auth session
       */
      async logout() {
        console.log('[CORE] Logging out user');
        
        // Sign out from Supabase (clears auth session)
        try {
          await supabase.auth.signOut();
          console.log('[CORE] Supabase session cleared');
        } catch (error) {
          console.error('[CORE] Error signing out from Supabase:', error);
          // Continue with local cleanup even if signOut fails
        }
        
        // Clear local state
        this.humanPlayer = null;  // v0.6.15: Clear humanPlayer too
        this.eraConfig = null;
        this.selectedOpponents = [];
        this.selectedGameMode = null;
        this.selectedAlliance = null;
        this.gameInstance = null;
        
        // Clear session storage
        SessionManager.clear();
        
        // Return to launch
        this.transition('launch');
      }
    
  // =================================================================
  // UI STATE AGGREGATION
  // =================================================================

  /**
   * Get current UI state for React components
   * @returns {Object} Aggregated state
   */
  getUIState() {
    // v0.6.16: Compute game state properties
    const isGameActive = this.gameInstance &&
                        (this.currentState === 'play' || this.currentState === 'placement');
    
    const currentPlayer = this.gameInstance?.getCurrentPlayer() || null;
    const isPlayerTurn = currentPlayer?.type === 'human';
    
    let gamePhase = 'setup';
    if (this.currentState === 'placement') gamePhase = 'placement';
    else if (this.currentState === 'play') gamePhase = 'battle';
    else if (this.currentState === 'over') gamePhase = 'gameover';
    
    const winner = this.gameInstance?.winner || null;
    
    // v0.6.16: Get player stats from game instance
    const playerStats = this.gameInstance?.getPlayerStats() || {
      player: { hits: 0, misses: 0, shots: 0 },
      opponent: { hits: 0, misses: 0, shots: 0 }
    };
    
    // v0.6.16: Get munitions from game instance
    const munitions = this.gameInstance?.munitions || {
      starShells: 0,
      scatterShot: 0
    };

    return {
      currentState: this.currentState,
      userProfile: this.userProfile,
      humanPlayer: this.humanPlayer,  // v0.6.15: Expose Player instance for components
      eraConfig: this.eraConfig,
      selectedOpponents: this.selectedOpponents,
      selectedGameMode: this.selectedGameMode,
      selectedAlliance: this.selectedAlliance,
      gameInstance: this.gameInstance,
      
      // v0.6.16: Add back computed properties that were accidentally removed
      isPlayerTurn,
      currentPlayer,
      isGameActive,
      gamePhase,
      winner,
      playerStats,
      munitions
    };
  }

  // =================================================================
  // OBSERVER PATTERN
  // =================================================================

  /**
   * Subscribe to state changes
   * @param {Function} callback - Function to call on state change
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  // =================================================================
  // HELPER METHODS (for Player singleton)
  // =================================================================
    /**
     * Get user profile from humanPlayer
     * @returns {Object|null} User profile or null
     */
    get userProfile() {
      return this.humanPlayer?.userProfile || null;
    }
    
  // =================================================================
  // HELPER METHODS (for NavigationManager)
  // =================================================================

  /**
   * Set current state (for NavigationManager use)
   * @param {String} state - New state
   */
  setCurrentState(state) {
    this.currentState = state;
  }

  /**
   * Get current state (for NavigationManager use)
   * @returns {String} Current state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Check if game is active (for NavigationManager use)
   * @returns {Boolean} Is game active
   */
  isGameActive() {
    return this.gameInstance && (this.currentState === 'play' || this.currentState === 'over');
  }
}

export default CoreEngine;
// EOF
