// src/engines/CoreEngine.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.6.49: Fixed key data error appearing during logout
//          - handleKeyDataError now skips error if player is null (planned logout)
//          - handleEvent_launch clears keyDataError if this is a logout scenario
// v0.6.48: Fixed alliance persistence bug when navigating back to era selection
//          - handleEvent_era() now clears selectedAlliance and selectedOpponents
//          - Prevents alliance from one era carrying over to another era
// v0.6.47: Improved network error handling with retry logic and user-friendly messages
//          - Added retryWithBackoff utility for automatic retries with exponential backoff
//          - Config and era loading now retry up to 3 times before failing
//          - User-friendly error messages based on context (config, era-list, era-config)
//          - Individual era config failures don't stop other eras from loading
// v0.6.46: NetworkError handling - transition to Launch state on network errors
//          - Detect NetworkError in config loading
//          - Prevent loops by checking current state
// v0.6.45: Fix keyDataError persistence - don't clear in handleEvent_launch
//          - keyDataError now persists so LaunchPage can display it
//          - Only cleared when user clicks "Play Game" button
// v0.6.44: Fix handleKeyDataError to bypass transition validation
//          - Changed from dispatch(this.events.LAUNCH) to transition('launch')
//          - Allows recovery from any state, not just states with defined LAUNCH transitions
//          - Prevents "No transition for X + LAUNCH" warnings
// v0.6.43: Add graceful key data error handling
//          - Added keyDataError property to store error state
//          - Added handleKeyDataError() method to logwarn, save error, and navigate to Launch
//          - Clear keyDataError when transitioning to Launch state
// v0.6.42: Refactored for PlayerProfile architecture
//          - Added playerProfile as direct property (not getter from humanPlayer)
//          - Updated get playerProfile() to return this.playerProfile
//          - Updated get playerId() to use this.playerProfile
//          - Updated get playerGameName() to use this.playerProfile
//          - Updated logging to match new pattern (tag, module, method)
//          - PlayerProfile is now managed separately from HumanPlayer
// v0.6.41: Change selectedEraConfig to a get/set
// v0.6.40: Added selectedEra
// v0.6.39: Load eraList and all eras
// v0.6.38: Load game configuration
// v0.6.37: Added userEmail
// v0.6.36: Removed deprecated methods never called
//          - Removed getLeaderboard() (replaced by LeaderboardService)
//          - Removed getUserAchievements() (replaced by AchievementService)
//          - Removed hasEraAccess() (replaced by RightsService.canPlayEra())
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
//          - playerProfileService, gameStatsService, leaderboardService, rightsService, achievementService
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
// v0.6.21: Fixed playerProfile getter - use humanPlayer.playerProfile not humanPlayer.profile
//          - Line 600: Changed from .profile to .playerProfile
//          - Player class property is playerProfile, not profile
//          - Added DEBUG logging to track playerProfile through LOGIN/SELECTERA/PLACEMENT events
// v0.6.20: Added get playerProfile to get humanPlayer profile (guest has null)
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
import ConfigLoader, { isNetworkError } from '../utils/ConfigLoader';
import { retryWithBackoff, isNetworkErrorForRetry } from '../utils/retryWithBackoff';
import { supabase } from '../utils/supabaseClient';

const version = 'v0.6.49';
const tag = "CORE";
const module = "CoreEngine";
let method = "";

/**
 * v0.6.47: Removed selectedGameMode property (game is always turn-based)
 *          - Removed from session storage/restore
 *          - Removed from reset
 *          - Removed from getUIState
 * v0.6.46: [Previous version notes retained]
 * 
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
    method = 'constructor';
    this.log('initializing...');
    
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
      this.gameInstance = null;
      this.gameConfig = null;       // set during Launch state
      this.eraList = null;          // set during Launch state
      this.eras = new Map();        // set during Launch state
      
    this.player = null;             // set during Login state, Player instance (per-game)
    this.playerProfile = null;      // set during Login state, PlayerProfile instance (persistent career stats)
    this.playerEmail = null;          // set during Login state
      
    this.eraConfig = null;
    this._selectedEraId = null;     // getter/setter, set during SelectEra state
    this._selectedOpponents = [];
    this._selectedAlliance = null;
    
    // Error state for graceful error handling
    this.keyDataError = null;       // stores key data error message when data is lost
    this.networkErrorHandled = false; // Prevent loops - track if we've already handled a network error

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
          console.error(`[${tag}] ${version} ${module}.notifySubscribers: Error in subscriber callback:`, error);
        }
      });
    };
    
    this.navigationManager = new NavigationManager(this);
    
    // =================================================================
    // SESSION RESTORATION
    // =================================================================
    this.restoreSession();
      
      // Load game config immediately with retry logic
      retryWithBackoff(
        () => ConfigLoader.loadGameConfig(),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          shouldRetry: isNetworkErrorForRetry
        }
      )
        .then(config => {
          this.gameConfig = config;
          this.log(`Game config loaded`);
          this.networkErrorHandled = false; // Reset on successful load
        })
        .catch(error => {
          this.handleNetworkError('config', error);
        });

      // Load era list with retry logic, then preload all era configs
      retryWithBackoff(
        () => ConfigLoader.loadEraList(),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          shouldRetry: isNetworkErrorForRetry
        }
      )
        .then(async (eraList) => {
          this.log(`Era list loaded: ${eraList.length}`);
          
          // Preload all era configs with retry for each
          for (const era of eraList) {
            try {
              const fullConfig = await retryWithBackoff(
                () => ConfigLoader.loadEraConfig(era.id),
                {
                  maxAttempts: 2, // Fewer retries for individual era configs
                  initialDelay: 500,
                  maxDelay: 3000,
                  shouldRetry: isNetworkErrorForRetry
                }
              );
              this.eras.set(era.id, fullConfig);
            } catch (error) {
              // Log error but continue loading other eras
              this.logwarn(`Failed to load era config for ${era.id} after retries:`, error);
              // Don't break - continue loading other eras
            }
          }
          this.log(`All era configs preloaded: ${this.eras.size} of ${eraList.length}`);
          this.networkErrorHandled = false; // Reset on successful load
        })
        .catch(error => {
          this.handleNetworkError('era-list', error);
        });
  }

    // Logging utilities
    log = (message) => {
      console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    };
    
    logwarn = (message) => {
        console.warn(`[${tag}] ${version} ${module}.${method}: ${message}`);
    };

    logerror = (message, error = null) => {
      if (error) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
      } else {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
      }
    };

  // =================================================================
  // STATE MACHINE METHODS
  // =================================================================

  /**
   * Dispatch an event to trigger state transition
   * @param {Symbol} event - Event from this.events
   * @param {Object} data - Optional data payload
   */
  dispatch(event, data = null) {
    method = 'dispatch';
    this.log(`Dispatching event: ${event.description} with data: ${JSON.stringify(data)}`);

    const nextState = this.states[this.currentState]?.on[event];
    
    if (!nextState) {
      this.logwarn(`No transition for ${this.currentState} + ${event.description}`);
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
    method = 'transition';
    this.log(`Transitioning: ${this.currentState} → ${newState}`);
    
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
    method = 'restoreToState';
    const previousState = this.currentState;
    
    // Set state synchronously
    this.currentState = state;
    this.log(`Restoring to state: ${previousState || 'none'} → ${state}`);
    
    // Run state handler asynchronously (if exists)
    const stateHandler = `handleEvent_${state}`;
    if (typeof this[stateHandler] === 'function') {
      try {
        await this[stateHandler](null);
      } catch (error) {
        this.logerror('State handler failed during restoration:', error);
      }
    }
    
    // Save session and notify
    this.saveSession();
    this.notifySubscribers();
    
    this.log(`State restoration complete: ${state}`);
  }

  // =================================================================
  // STATE HANDLERS
  // =================================================================

  handleEvent_launch() {
    method = 'handleEvent_launch';
    this.log('Launch state');
      // Launch prefetches some data, known for the life of the session:
      // coreEngine.gameConfig
      
    // Clear keyDataError if this is a logout (player is null)
    // During logout, key data is intentionally cleared, so don't show error message
    if (!this.player && this.keyDataError) {
      this.keyDataError = null;
      this.log('Cleared keyDataError - this is a logout, not an error');
    }
    // Otherwise, don't clear keyDataError here - let it persist so LaunchPage can display it
    // It will be cleared when user clicks "Play Game" button in LaunchPage
    
    // Reset network error handling flag when entering launch state
    // This allows retry after user clicks "Play Game"
    this.networkErrorHandled = false;
    
    this.notifySubscribers();
  }
  
  /**
   * Handle key data error gracefully
   * Logs warning, saves error message, and navigates to Launch state
   * Bypasses normal state transition validation since this is an error recovery path
   * @param {string} stateName - Name of the state where error occurred
   * @param {string} errorMessage - Error message to display
   */
  handleKeyDataError(stateName, errorMessage) {
    method = 'handleKeyDataError';
    
    // Skip if this is a planned logout (player is null)
    // During logout, key data is intentionally cleared, so this is not an error
    // Launch page also doesn't require player data, so missing player there is expected
    if (!this.player) {
      this.log('Key data check with no player - skipping error (expected during logout or on launch page)');
      return;
    }
    
    this.logwarn(`Key data lost in ${stateName}: ${errorMessage}`);
    
    // Save error message - use simple, non-technical message for players
    this.keyDataError = {
      state: stateName,
      message: `Key data lost, restarting game`
    };
    
    // Directly transition to Launch state (bypasses dispatch validation)
    // This allows recovery from any state, not just states with defined LAUNCH transitions
    this.transition('launch');
  }
  
  /**
   * Handle NetworkError - transition to Launch state to prevent loops
   * Provides user-friendly error messages and retry guidance
   * @param {string} context - Context where error occurred (e.g., 'config', 'era-list')
   * @param {Error} error - Error object
   */
  handleNetworkError(context, error) {
    method = 'handleNetworkError';
    
    // Prevent loops - if we're already in launch or already handled this error, don't recurse
    if (this.currentState === 'launch' || this.networkErrorHandled) {
      this.logwarn(`NetworkError in ${context} but already in launch or error already handled - preventing loop`);
      return;
    }
    
    // Check if this is actually a NetworkError
    if (!isNetworkError(error) && !error.isNetworkError) {
      // Not a network error - log but don't transition
      this.logerror(`Error in ${context} (not a NetworkError):`, error);
      return;
    }
    
    this.logerror(`NetworkError in ${context}:`, error);
    
    // Mark as handled to prevent loops
    this.networkErrorHandled = true;
    
    // Save error message - use simple, non-technical message for players
    this.keyDataError = {
      state: context,
      message: `Key data lost, restarting game`
    };
    
    // Transition to Launch state
    this.transition('launch');
    this.notifySubscribers();
  }

  handleEvent_login() {
    method = 'handleEvent_login';
      // Login determines who the player is:
      // 1. Authenticated user (has a login)
      // 2. New user (goes through ProfileCreation)
      // 3. Guest user
      // upon dispatch to era state, the following are known for the life of the session:
      // coreEngine.player
      // coreEngine.playerProfile
      // coreEngine.playerId (alias to coreEngine.playerProfile.id)
      // coreEngine.eras (loads all the available eras into an array)
    this.log('Login state');
    // Login is handled by LoginPage setting coreEngine.player and coreEngine.playerProfile directly
  }

  handleEvent_era() {
    method = 'handleEvent_era';
      // SelectEra determines which era the player will be playing.
      // upon dispatch to era state, the following are known for the rest of the game:
      // coreEngine.selectedEraId
      // coreEngine.selectedEraConfig (from eras array)
    
    // Clear alliance and opponents - they're era-specific
    this.selectedAlliance = null;
    this.selectedOpponents = [];
    this.log('Era selection state - cleared alliance and opponents');
  }

  handleEvent_opponent() {
    method = 'handleEvent_opponent';
      // SelectOpponent determines which opponent(s) the player will be facing.
      // upon dispatch to placement state, the following are known for the rest of the game:
      // coreEngine.selectedOpponents
    this.log('Opponent selection state');
  }

  handleEvent_placement() {
    method = 'handleEvent_placement';

      this.log('Placement state - processing data and delegating to GameLifecycleManager');
      
//    // Process placement data
//    if (data) {
////      if (data.eraConfig) {
////        this.eraConfig = data.eraConfig;
////      }
//      if (data.opponents) {
//        this.selectedOpponents = data.opponents;
//        this.log(`Stored selectedOpponents: ${this.selectedOpponents.length}`);
//      }
//      if (data.selectedAlliance !== undefined) {
//        this.selectedAlliance = data.selectedAlliance;
//      }
//    }
    
    // Reset player stats for new game
    if (this.player) {
      this.player.reset();
      this.log('Player stats reset for new game');
    }
    
    // Initialize placement (creates game, board, etc.)
    this.lifecycleManager.initializeForPlacement(this);
    
  }

  handleEvent_play() {
    method = 'handleEvent_play';

      this.log('Play state');
    
      if (!this.gameInstance) {
          this.logerror("no game instance");
          throw new Error('handleEvent_play no game instance');
      }
      
        // Track game start (increment incomplete_games counter)
        this.lifecycleManager.startGame(
          this.playerId,
          this.selectedEraId
        ).catch(error => {
            this.logerror('Failed to track game start:', error);
        });

        this.gameInstance.startGame();
        this.notifySubscribers();
    }

  handleEvent_over() {
    method = 'handleEvent_over';
    this.log('Game over state');
  }

  // =================================================================
  // SESSION MANAGEMENT
  // =================================================================

  /**
   * Restore state from session storage
   */
  restoreSession() {
    method = 'restoreSession';
    const sessionData = SessionManager.restore();
    
    if (!sessionData) {
      this.log('No session to restore');
      return;
    }

    this.log(`Restoring session: ${JSON.stringify(sessionData)}`);

    // Restore player
    if (sessionData.player) {
      this.player = sessionData.player;
    }
    
    // Restore playerProfile (separate from player now)
    if (sessionData.playerProfile) {
      this.playerProfile = sessionData.playerProfile;
    }

    this.currentState = sessionData.currentState;
    this.selectedOpponents = sessionData.selectedOpponents;
    this.selectedAlliance = sessionData.selectedAlliance;

    // Restore era config
    if (sessionData.eraId) {
      SessionManager.restoreEraAsync(this, sessionData.eraId);
    }

//    // Restore user profile
//    if (this.playerProfile?.id) {
//      SessionManager.refreshProfileAsync(this);
//    }

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
    method = 'handleAttack';
    if (!this.gameInstance) {
      this.logwarn('No game instance for attack');
      return null;
    }

    const player = this.gameInstance.players.find(p => p.type === 'human');
    if (!player) {
      this.logwarn('No human player found');
      return null;
    }

    return this.gameInstance.receiveAttack(row, col, player);
  }

  /**
   * Fire a munition (star shell, scatter shot)
   * @param {String} munitionType - Type of munition ('starShell', 'scatterShot')
   * @param {Number} row - Target row
   * @param {Number} col - Target column
   * @returns {Boolean} Success
   */
  fireMunition(munitionType, row, col) {
    method = 'fireMunition';
    this.log(`called with ${munitionType} at ${row},${col}`);
    
    if (!this.gameInstance) {
      this.log(`No game instance!`);
      return false;
    }
    
    const result = this.gameInstance.fireMunition(munitionType, row, col);
    this.log(`result=${result}`);
    
    return result;
  }
    
  /**
   * Register ship placement on board
   */
  registerShipPlacement(ship, shipCells, orientation, playerId) {
    method = 'registerShipPlacement';
    if (!this.gameInstance) {
      this.logwarn(`No game instance for ship placement`);
      return false;
    }
      
    const success = this.gameInstance.registerShipPlacement(ship, shipCells, orientation, playerId);
    
    if (success) {
      ship.place();
      this.notifySubscribers();
      return true;
    }
    
    return false;
  }

  /**
   * Get game statistics for UI display
   * @returns {Object} Game statistics
   */
  getGameStats() {
    method = 'getGameStats';
    if (!this.gameInstance) {
      return null;
    }

    return this.gameInstance.getGameStats();
  }

  // =================================================================
  // SERVICE COORDINATION
  // =================================================================

  /**
   * Logout user and clear state
   */
  async logout() {
    method = 'logout';
    this.log('Logging out user');
    
    // Clear keyDataError - logout is planned, not an error
    this.keyDataError = null;
    
    // Clear local state FIRST (before async operations)
    this.player = null;
    this.playerProfile = null;
    this.playerEmail = null;
//    this.eraConfig = null;
    this.selectedOpponents = [];
    this.selectedAlliance = null;
    this.gameInstance = null;
    
    // Clear session storage
    SessionManager.clear();
    
    // Sign out from Supabase (clears auth session and localStorage)
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        this.logerror('Error signing out from Supabase:', error);
      } else {
        this.log('Supabase session cleared');
      }
      
      // Also explicitly clear Supabase localStorage keys as backup
      if (typeof window !== 'undefined' && window.localStorage) {
        const supabaseKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('sb-') || key.includes('supabase')
        );
        supabaseKeys.forEach(key => {
          localStorage.removeItem(key);
          this.log(`Cleared localStorage key: ${key}`);
        });
      }
    } catch (error) {
      this.logerror('Error during signOut cleanup:', error);
      // Continue even if signOut fails
    }
    
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
    method = 'getUIState';
    // Compute game state properties
    const isGameActive = this.gameInstance &&
                        (this.currentState === 'play' || this.currentState === 'placement');
    
    const currentPlayer = this.gameInstance?.getCurrentPlayer() || null;
    const isPlayerTurn = currentPlayer?.type === 'human';
    
    let gamePhase = 'setup';
    if (this.currentState === 'placement') gamePhase = 'placement';
    else if (this.currentState === 'play') gamePhase = 'battle';
    else if (this.currentState === 'over') gamePhase = 'gameover';
    
    const winner = this.gameInstance?.winner || null;
    
    // Get player stats from game instance
    const playerStats = this.gameInstance?.getPlayerStats() || {
      player: { hits: 0, misses: 0, shots: 0 },
      opponent: { hits: 0, misses: 0, shots: 0 }
    };
    
    // Get munitions from game instance
    const munitions = this.gameInstance?.munitions || {
      starShells: 0,
      scatterShot: 0
    };

    return {
      currentState: this.currentState,
      playerProfile: this.playerProfile,
      player: this.player,
      eraConfig: this.eraConfig,
      selectedOpponents: this.selectedOpponents,
      selectedAlliance: this.selectedAlliance,
      gameInstance: this.gameInstance,
      
      // Computed properties
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
  // HELPER METHODS
  // =================================================================
  
  get playerId() {
    return this.playerProfile?.id || null;
  }
    
    get playerRole() {
        return this.playerProfile?.role || null;
    }
  
  get playerGameName() {
    return this.playerProfile?.game_name || null;
  }
  
  get selectedEraId() {
    return this._selectedEraId;
  }
  
    set selectedEraId(eraId) {
      this._selectedEraId = eraId;
      this.notifySubscribers();
      this.log(`Selected era ID set to: ${this.selectedEraId}, config=`, this.selectedEraConfig);
    }
    
    get selectedAlliance() {
      return this._selectedAlliance;
    }
    
    // Setter for selectedAlliance - triggers React updates
    set selectedAlliance(name) {
      this._selectedAlliance = name;
      this.notifySubscribers();
      this.log(`Selected era ID set to: ${this.selectedEraId}, config=`, this.selectedEraConfig);
    }

    get selectedOpponent() {
        return this.selectedOpponents[0];
    }

    // Getter for selectedOpponents
    get selectedOpponents() {
      return this._selectedOpponents || [];
    }

    // Setter for selectedOpponents - triggers React updates
    set selectedOpponents(opponents) {
      this._selectedOpponents = opponents;
      this.notifySubscribers();
    }
    
  get selectedEraConfig() {
    // Returns FULL config from eras Map (with ships, munitions, messages, etc.)
//      this.log(`getting era for selected eraId ${this.selectedEraId} from {this.eras.size} eras, config=`, this.selectedEraConfig);
    return this.eras.get(this.selectedEraId);
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
