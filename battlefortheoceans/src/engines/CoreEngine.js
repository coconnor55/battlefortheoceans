// src/engines/CoreEngine.js
// Copyright(c) 2025, Clint H. O'Connor
<<<<<<< HEAD
// v0.6.14: Added restoreToState() method for browser navigation and page refresh
//         - New method handles state restoration without URL sync
//         - Fixes browser back/forward button navigation
//         - Fixes page refresh state restoration
//         - State handlers now run properly for backward navigation
//         - Used by NavigationManager for URL-driven state changes
// v0.6.13: Better semantic naming for captured hash
//         - Renamed pendingConfirmation → urlHash (more accurate)
//         - Renamed confirmationCapturedAt → urlHashCapturedAt
//         - More flexible for future auth flows (signup, recovery, etc.)
// v0.6.12: Clear confirmation data on logout (multi-user protection)
//         - Added cleanup of pendingConfirmation and confirmationCapturedAt in logout()
//         - Prevents confirmation message showing for new user after logout
//         - Part of three-layer protection: age check + logout cleanup + clear on read
// v0.6.11: Import events from GameEvents.js to prevent premature initialization
//         - Events imported from standalone constants file
//         - Prevents supabaseClient.js from loading when accessing events
//         - Fixes Sign Up URL hash consumption issue
//         - No other logic changes
// v0.6.10: Renamed resources to munitions for better semantics
//         - Renamed handleStarShellFired() → fireMunition(munitionType, row, col)
//         - getUIState() now reads munitions from gameInstance.munitions
//         - More extensible architecture for future munition types
// v0.6.9: Moved game logic methods to Game.js
//         - Removed handleStarShellFired() - now in Game.js (~30 lines)
//         - Removed getPlayerStats() - now in Game.js (~34 lines)
//         - getUIState() now reads resources from gameInstance.resources
//         - Game logic centralized in Game.js where it belongs
//         - Reduced CoreEngine from 836 lines to ~772 lines
// v0.6.8: Removed service wrapper methods
//         - Deleted 11 simple pass-through methods (~35 lines)
//         - getUserProfile, getLeaderboard, getRecentChampions, etc.
//         - Components should call services directly
//         - Kept service instances (safer incremental change)
//         - Kept methods with business logic: createUserProfile, updateGameStats, hasEraAccess
//         - Reduced CoreEngine from 876 lines to ~841 lines
// v0.6.7: Refactored game initialization to use GameLifecycleManager
//         - Created this.lifecycleManager in constructor
//         - Delegated initializeForPlacement() to lifecycleManager
//         - Removed calculateResourceWithBoost() (moved to GameLifecycleManager)
//         - Removed getOpposingAlliance() (moved to GameLifecycleManager)
//         - GameLifecycleManager now manages FULL lifecycle: birth + death
//         - Reduced CoreEngine from 984 lines to ~870 lines (114 line reduction)
// v0.6.6: Refactored to use NavigationManager utility class
//         - Removed URL route mappings (stateToRoute, routeToRoute)
//         - Removed initializeFromURL(), syncURL(), handleBrowserNavigation(), isValidBackwardTransition()
//         - Removed browser popstate event listener setup
//         - Added setCurrentState(), getCurrentState(), isGameActive() helper methods
//         - NavigationManager handles all URL/browser navigation
//         - Reduced CoreEngine by ~200 lines
// v0.6.5: Added logout() method for user logout flow
//         - Clears all game state and session
//         - Transitions to 'launch' state
//         - Accessible from anywhere via GameContext
// v0.6.4: Refactored to use SessionManager utility class
//         - Removed restoreSessionSync(), storeSessionContext(), clearSessionContext()
//         - Now uses SessionManager.restore(), SessionManager.save(), SessionManager.clear()
//         - Reduced CoreEngine by ~150 lines
//         - Kept refreshProfileAsync() and restoreEraAsync() (service calls)
// v0.6.3: added a direct getter for game stats
// v0.6.2: Added handleStarShellFired() method - game logic for star shell consumption
//         - Validates star shells remaining
//         - Decrements resource count
//         - Advances turn (star shell consumes turn)
//         - Returns success/failure result
// v0.6.1: Generic multi-opponent resource boost system
//         - Added calculateResourceWithBoost() method
//         - Initialize this.resources in initializeForPlacement()
//         - Reads boost values from era config (star_shells_boost, scatter_shot_boost)
//         - Formula: base + (boost × (opponentCount - 1))
// v0.6.0: Multi-fleet combat support (Pirates of the Gulf)
=======
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
>>>>>>> rollback-to-v0.5.5-plus-auth

import UserProfileService from '../services/UserProfileService.js';
import GameStatsService from '../services/GameStatsService.js';
import LeaderboardService from '../services/LeaderboardService.js';
import RightsService from '../services/RightsService.js';
import AchievementService from '../services/AchievementService.js';
<<<<<<< HEAD
import SessionManager from '../utils/SessionManager.js';
import NavigationManager from '../utils/NavigationManager.js';
import GameLifecycleManager from '../classes/GameLifecycleManager.js';
import { supabase } from '../utils/supabaseClient.js';
import { events } from '../constants/GameEvents.js';

const version = "v0.6.14";
=======

import ConfigLoader from '../utils/ConfigLoader.js';
>>>>>>> rollback-to-v0.5.5-plus-auth

const version = 'v0.6.28';

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
    
<<<<<<< HEAD
    // Import events from GameEvents.js (v0.6.11)
    this.events = events;
    
=======
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
>>>>>>> rollback-to-v0.5.5-plus-auth
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
    
<<<<<<< HEAD
    this.log('CoreEngine initialized');
  }
  
  /**
   * Helper methods for NavigationManager
   */
  
  /**
   * Set current state directly (used by NavigationManager)
   * @param {string} state - New state
   */
  setCurrentState(state) {
    this.currentState = state;
  }
  
  /**
   * Get current state (used by NavigationManager)
   * @returns {string} Current state
   */
  getCurrentState() {
    return this.currentState;
  }
  
  /**
   * Check if game is currently active (used by NavigationManager)
   * @returns {boolean} True if game is in playing state
   */
  isGameActive() {
    return this.gameInstance?.state === 'playing';
  }
  
  /**
   * v0.6.5: Logout user and return to launch page
   * v0.6.12: Added confirmation data cleanup for multi-user protection
   * v0.6.13: Updated to use urlHash/urlHashCapturedAt names
   * Clears all game state and session data
   */
  logout() {
    this.log('User logging out');
=======
    // Reset player stats for new game
    if (this.humanPlayer) {
      console.log('[CORE] DEBUG - humanPlayer.userProfile BEFORE placement reset:', this.humanPlayer.userProfile);
      this.humanPlayer.reset();
      console.log('[CORE] Player stats reset for new game');
      console.log('[CORE] DEBUG - humanPlayer.userProfile AFTER placement reset:', this.humanPlayer.userProfile);
    }
>>>>>>> rollback-to-v0.5.5-plus-auth
    
    // Initialize placement (creates game, board, etc.)
    this.lifecycleManager.initializeForPlacement(this);
    
<<<<<<< HEAD
    // 🧹 LAYER 2: Clear URL hash data (multi-user protection)
    // Prevents old confirmation message showing for next user
    sessionStorage.removeItem('urlHash');
    sessionStorage.removeItem('urlHashCapturedAt');
    this.log('Cleared URL hash data from sessionStorage');
    
    // Transition to launch state
    this.currentState = 'launch';
    this.lastEvent = null;
    
    // Sync URL
    this.navigationManager.syncURL(this.currentState);
    
    // Notify subscribers (triggers UI update to LaunchPage)
    this.notifySubscribers();
    
    this.log('Logout complete - returned to launch');
=======
    // v0.6.19: humanPlayer should already be set from LOGIN
    // Keep this as fallback only
    if (!this.humanPlayer && this.gameInstance) {
      this.humanPlayer = this.gameInstance.players.find(p => p.type === 'human');
      console.log('[CORE] humanPlayer extracted (fallback):', this.humanPlayer?.name);
    }
>>>>>>> rollback-to-v0.5.5-plus-auth
  }

  handleEvent_play() {
    console.log('[CORE] Play state');
    if (this.gameInstance) {
      this.gameInstance.startGame();
    }
  }

  handleEvent_over() {
    console.log('[CORE] Game over state');
  }

  handleEvent_achievements() {
    console.log('[CORE] Achievements state');
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
<<<<<<< HEAD
    
    this.log('Restoring session context');
    
    // Restore user profile
    if (sessionData.user) {
      this.userProfile = {
        id: sessionData.user.id,
        game_name: sessionData.user.game_name || sessionData.user.gameName || 'Unknown',
        wins: sessionData.user.wins || 0,
        losses: sessionData.user.losses || 0,
        accuracy: sessionData.user.accuracy || 0,
        score: sessionData.user.score || 0
      };
    }
    
    // Restore game mode
    if (sessionData.selectedGameMode) {
      this.selectedGameMode = sessionData.selectedGameMode;
    }
    
    // Restore alliance
    if (sessionData.selectedAlliance) {
      this.selectedAlliance = sessionData.selectedAlliance;
    }
    
    // Restore era configuration asynchronously
    if (sessionData.eraId) {
      const eraId = sessionData.eraId;
      this.restoreEraAsync(eraId);
    }
    
    // Restore opponents
    if (sessionData.selectedOpponents && Array.isArray(sessionData.selectedOpponents)) {
      this.selectedOpponents = sessionData.selectedOpponents;
    }
    
    // Restore state (but allow URL to override)
    if (sessionData.currentState) {
      this.currentState = sessionData.currentState;
    }
    
    this.log(`Session restored: state=${this.currentState}, user=${this.userProfile?.game_name}`);
=======

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
>>>>>>> rollback-to-v0.5.5-plus-auth
  }

  /**
<<<<<<< HEAD
   * Restore era configuration asynchronously
   */
  async restoreEraAsync(eraId) {
    try {
      this.eraConfig = await configLoader.loadEraConfig(eraId);
      this.log(`Era config restored: ${eraId}`);
      this.notifySubscribers();
    } catch (error) {
      console.error(`${version} Failed to restore era config:`, error);
    }
  }

  saveSession() {
    SessionManager.save(this);
  }

  clearGameState() {
    this.gameInstance = null;
    this.board = null;
=======
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
    if (!this.gameInstance) {
      console.warn('[CORE] No game instance for munition');
      return false;
    }

    return this.gameInstance.fireMunition(munitionType, row, col);
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
        ship.place();              // ⬅️ RESTORE THIS
        this.notifySubscribers();  // ⬅️ AND THIS
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
      return await AchievementService.getPlayerAchievements(this.userProfile.user_id);
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
      return await LeaderboardService.getLeaderboard(this.eraConfig.id, limit);
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
      return await RightsService.hasEraAccess(this.userProfile.user_id, eraId);
    } catch (error) {
      console.error('[CORE] Error checking era access:', error);
      return false;
    }
  }

  /**
   * Logout user and clear state
   */
  logout() {
    console.log('[CORE] Logging out user');
    
//    this.userProfile = null;
    this.humanPlayer = null;  // v0.6.15: Clear humanPlayer too
>>>>>>> rollback-to-v0.5.5-plus-auth
    this.eraConfig = null;
    this.selectedOpponents = [];
    this.selectedGameMode = null;
    this.selectedAlliance = null;
<<<<<<< HEAD
    this.humanPlayer = null;
    this.aiPlayers = [];
    this.userProfile = null;
    this.loginEventData = null;
    SessionManager.clear();
  }

  initializeGameConfig() {
    this.gameConfig = {
      boardRows: 10,
      boardCols: 10,
      shipSizes: [5, 4, 3, 3, 2]
    };
  }

  async dispatch(event, eventData) {
    const eventName = this.getEventName(event);
    this.log(`Dispatching event: ${eventName}`);
    this.lastEvent = event;

    const nextState = this.states[this.currentState]?.on[event];
    
    if (!nextState) {
      console.error(`${version} Invalid state transition: ${this.currentState} + ${eventName}`);
      return;
    }

    this.log(`Transitioning: ${this.currentState} -> ${nextState}`);
    
    await this.transition(nextState, eventData);
  }

  async transition(newState, eventData) {
    const previousState = this.currentState;
    this.currentState = newState;

    const stateHandler = `handleEvent_${newState}`;
    if (typeof this[stateHandler] === 'function') {
      await this[stateHandler](eventData);
    }

    this.saveSession();
    this.navigationManager.syncURL(newState);
    this.notifySubscribers();

    this.log(`State transition complete: ${previousState} -> ${newState}`);
  }

  /**
   * v0.6.14: Restore to state without URL synchronization
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
    this.log(`Restoring to state: ${previousState || 'none'} -> ${state}`);
    
    // Run state handler asynchronously (if exists)
    const stateHandler = `handleEvent_${state}`;
    if (typeof this[stateHandler] === 'function') {
      try {
        await this[stateHandler](null);
      } catch (error) {
        console.error(`${version} State handler failed during restoration:`, error);
      }
    }
    
    // Save session and notify
    this.saveSession();
    this.notifySubscribers();
    
    this.log(`State restoration complete: ${state}`);
  }

  handleEvent_launch(eventData) {
    this.log('Handling LAUNCH event');
    this.clearGameState();
  }

  handleEvent_login(eventData) {
    this.log('Handling LOGIN event');
    this.loginEventData = eventData || null;
  }

  async handleEvent_era(eventData) {
    this.log('Handling ERA event');
    
    if (eventData && eventData.eraId) {
      this.eraConfig = await configLoader.loadEraConfig(eventData.eraId);
      this.log(`Era loaded: ${eventData.eraId}`);
      this.notifySubscribers();
    }
    
    if (eventData && eventData.user) {
      this.userProfile = eventData.user;
      this.log(`User profile set: ${this.userProfile.game_name}`);
      this.notifySubscribers();
    }
  }

  handleEvent_opponent(eventData) {
    this.log('Handling OPPONENT event');
    
    if (eventData && eventData.eraId) {
      this.log(`Era selected: ${eventData.eraId}`);
    }
    
    if (eventData && eventData.selectedOpponents) {
      this.selectedOpponents = eventData.selectedOpponents;
      this.log(`Opponents selected: ${this.selectedOpponents.map(o => o.name).join(', ')}`);
    }
    
    if (eventData && eventData.gameMode) {
      this.selectedGameMode = eventData.gameMode;
      this.log(`Game mode: ${this.selectedGameMode}`);
    }
    
    if (eventData && eventData.alliance) {
      this.selectedAlliance = eventData.alliance;
      this.log(`Alliance: ${this.selectedAlliance}`);
    }
  }

  handleEvent_placement(eventData) {
    this.log('Handling PLACEMENT event');
    
    // v0.6.7: Delegate to GameLifecycleManager
    this.lifecycleManager.initializeForPlacement(this);
  }

  handleEvent_play(eventData) {
    this.log('Handling PLAY event - game started');
    if (this.gameInstance) {
      this.gameInstance.startGame();
    }
  }

  async handleEvent_over(eventData) {
    this.log('Handling OVER event - game completed');
    
    await this.handleGameOver();
  }

  async handleGameOver() {
    const isGuestOrAI = this.userProfile?.id?.startsWith('guest-') ||
                        this.userProfile?.id?.startsWith('ai-');
    
    if (!this.gameInstance || !this.userProfile || isGuestOrAI) {
      this.log('Game over - guest/AI or no profile, skipping stats/achievements');
      return;
    }
    
    this.log('Processing game over - updating stats and checking achievements');
    
    try {
      const gameResults = this.gameStatsService.calculateGameResults(
        this.gameInstance,
        this.eraConfig,
        this.selectedOpponents[0]
      );
      
      if (!gameResults) {
        console.error(`${version} Failed to calculate game results`);
        return;
      }
      
      await this.updateGameStats(gameResults);
      this.log('Stats update completed successfully');
      
      const newAchievements = await this.achievementService.checkAchievements(
        this.userProfile.id,
        gameResults
      );

      if (newAchievements.length > 0) {
        this.log(`New achievements unlocked: ${newAchievements.length}`);
        this.newAchievements = newAchievements;
        this.notifySubscribers();
      } else {
        this.log('No new achievements unlocked this game');
      }
      
    } catch (error) {
      console.error(`${version} Error processing game completion:`, error);
    }
  }

  registerShipPlacement(ship, shipCells, orientation, playerId) {
    if (!this.gameInstance || !this.board) {
      console.error(`${version} Cannot register ship placement without game/board`);
      return false;
    }

    this.log(`Registering ship placement: ${ship.name} for ${playerId}`);
    
    const success = this.gameInstance.registerShipPlacement(ship, shipCells, orientation, playerId);
    
    if (success) {
      ship.place();
      this.notifySubscribers();
      return true;
    }
    
    return false;
  }

  async handleAttack(row, col) {
    if (!this.audioUnlocked) {
      Object.values(this.gameInstance.soundEffects).forEach(audio => {
        audio.play().then(() => audio.pause()).catch(() => {});
      });
      this.audioUnlocked = true;
    }
    
    if (!this.gameInstance || !this.gameInstance.isValidAttack(row, col)) {
      this.log(`Invalid attack attempt: ${row}, ${col}`);
      return false;
    }

    const currentPlayer = this.gameInstance.getCurrentPlayer();
    if (currentPlayer?.type !== 'human') {
      this.log('Attack blocked - not human turn');
      return false;
    }

    try {
      this.log(`Processing human attack: ${row}, ${col}`);
      const result = await this.gameInstance.processPlayerAction('attack', { row, col });
      this.log(`Attack completed: ${result.result}`);
      return result;
    } catch (error) {
      console.error(`${version} Attack processing failed:`, error);
      return false;
    }
  }

  // v0.6.10: Wrapper for fireMunition (delegates to Game.js)
  fireMunition(munitionType, row, col) {
    if (!this.gameInstance) {
      this.log('Munition blocked - no game instance');
      return false;
    }
    
    const result = this.gameInstance.fireMunition(munitionType, row, col);
    
    if (result) {
      // Notify subscribers of state change
      this.notifySubscribers();
    }
    
    return result;
  }

  // Backward compatibility wrapper
  handleStarShellFired(row, col) {
    return this.fireMunition('starShell', row, col);
  }

  getPlacementProgress() {
    if (!this.gameInstance || !this.humanPlayer) {
      return { current: 0, total: 0, currentShip: null, isComplete: false };
    }
    
    const fleet = this.humanPlayer.fleet;
    if (!fleet) {
      return { current: 0, total: 0, currentShip: null, isComplete: false };
    }
    
    const placedCount = fleet.ships.filter(ship => ship.isPlaced).length;
    const currentShip = fleet.ships.find(ship => !ship.isPlaced) || null;
    
    return {
      current: placedCount,
      total: fleet.ships.length,
      currentShip: currentShip,
      isComplete: placedCount === fleet.ships.length
    };
  }
=======
    this.gameInstance = null;
    
    this.clearSession();
    this.transition('launch');
  }

  // =================================================================
  // UI STATE AGGREGATION
  // =================================================================
>>>>>>> rollback-to-v0.5.5-plus-auth

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
