// src/engines/CoreEngine.js
// Copyright(c) 2025, Clint H. O'Connor
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

import Game from '../classes/Game.js';
import Board from '../classes/Board.js';
import HumanPlayer from '../classes/HumanPlayer.js';
import AiPlayer from '../classes/AiPlayer.js';
import UserProfileService from '../services/UserProfileService.js';
import GameStatsService from '../services/GameStatsService.js';
import LeaderboardService from '../services/LeaderboardService.js';
import RightsService from '../services/RightsService.js';
import configLoader from '../utils/ConfigLoader.js';
import AchievementService from '../services/AchievementService.js';
import SessionManager from '../utils/SessionManager.js';
import NavigationManager from '../utils/NavigationManager.js';
import GameLifecycleManager from '../classes/GameLifecycleManager.js';
import { supabase } from '../utils/supabaseClient.js';
import { events } from '../constants/GameEvents.js';

const version = "v0.6.13";

class CoreEngine {
  constructor() {
    // State machine properties
    this.currentState = null;
    this.lastEvent = null;
    
    // Import events from GameEvents.js (v0.6.11)
    this.events = events;
    
    this.states = {
      launch: { on: { [this.events.LOGIN]: 'login' } },
      login: { on: { [this.events.SELECTERA]: 'era' } },
      era: {
        on: {
          [this.events.SELECTOPPONENT]: 'opponent',
          [this.events.LOGIN]: 'login',
          [this.events.ACHIEVEMENTS]: 'achievements'
        }
      },
      opponent: {
        on: {
          [this.events.PLACEMENT]: 'placement',
          [this.events.LOGIN]: 'login',
          [this.events.SELECTERA]: 'era',
          [this.events.ACHIEVEMENTS]: 'achievements'
        }
      },
      placement: {
        on: {
          [this.events.PLAY]: 'play',
          [this.events.SELECTOPPONENT]: 'opponent',
          [this.events.LOGIN]: 'login',
          [this.events.ACHIEVEMENTS]: 'achievements'
        }
      },
      play: { on: { [this.events.OVER]: 'over' } },
      over: {
        on: {
          [this.events.LAUNCH]: 'launch',
          [this.events.ERA]: 'era',
          [this.events.SELECTOPPONENT]: 'opponent',
          [this.events.PLACEMENT]: 'placement',
          [this.events.LOGIN]: 'login',
          [this.events.ACHIEVEMENTS]: 'achievements'
        }
      }
    };
    
    // Game state data
    this.gameConfig = null;
    this.eraConfig = null;
    this.selectedOpponents = [];
    this.selectedGameMode = null;
    this.selectedAlliance = null;
    this.humanPlayer = null;
    this.aiPlayers = [];
    this.gameInstance = null;
    this.board = null;
    this.userProfile = null;
    this.loginEventData = null;
    
    // Observer pattern for UI updates
    this.updateCounter = 0;
    this.subscribers = new Set();
    
    // Service instances
    this.userProfileService = new UserProfileService();
    this.gameStatsService = new GameStatsService();
    this.leaderboardService = new LeaderboardService();
    this.rightsService = new RightsService();
    this.achievementService = AchievementService;
    
    // Navigation manager
    this.navigationManager = new NavigationManager(this);
    
    // Lifecycle manager (v0.6.7)
    this.lifecycleManager = new GameLifecycleManager(this);
    
    // Achievement tracking
    this.newAchievements = [];
      
    // initialize
    this.initializeGameConfig();
    
    // Initialize from session and URL
    if (typeof window !== 'undefined') {
      this.restoreSession();
      this.navigationManager.initializeFromURL();
      
      if (!this.currentState) {
        this.currentState = 'launch';
      }
    } else {
      this.currentState = 'launch';
    }
    
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
    
    // Clear all game state
    this.clearGameState();
    
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
  }
  
  /**
   * Restore session using SessionManager
   */
  restoreSession() {
    const sessionData = SessionManager.restore();
    
    if (!sessionData) {
      this.log('No stored session found');
      return;
    }
    
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
  }
  
  /**
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
    this.eraConfig = null;
    this.selectedOpponents = [];
    this.selectedGameMode = null;
    this.selectedAlliance = null;
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

  getUIState() {
    const currentPlayer = this.gameInstance?.getCurrentPlayer();
    
    return {
      currentPhase: this.gameInstance?.state || 'setup',
      isPlayerTurn: currentPlayer?.type === 'human',
      currentPlayer: currentPlayer,
      isGameActive: this.gameInstance?.state === 'playing',
      gamePhase: this.gameInstance?.state || 'setup',
      winner: this.gameInstance?.winner,
      currentMessage: this.generateCurrentMessage(),
      playerStats: this.gameInstance?.getPlayerStats() || { player: {}, opponent: {} },
      munitions: this.gameInstance?.munitions || { starShells: 0, scatterShot: 0 }
    };
  }

  generateCurrentMessage() {
    if (!this.gameInstance) return 'Initializing game...';
    
    return this.gameInstance?.message?.getCurrentTurnMessage() || 'Initializing game...';
  }

  getGameStates() {
    return this.gameInstance?.getGameStats() || null;
  }
    
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    this.updateCounter++;
    this.subscribers.forEach(callback => {
      try {
        callback(this.updateCounter);
      } catch (error) {
        console.error(`${version} Subscriber callback error:`, error);
      }
    });
  }

  async createUserProfile(userId, gameName) {
    const profile = await this.userProfileService.createUserProfile(userId, gameName);
    if (profile) {
      this.userProfile = profile;
      this.notifySubscribers();
    }
    return profile;
  }

  async updateGameStats(gameResults) {
    if (!this.userProfile) {
      console.error(`${version} Cannot update stats without user profile`);
      return false;
    }

    const updatedProfile = await this.gameStatsService.updateGameStats(this.userProfile, gameResults);
    
    if (updatedProfile) {
      this.userProfile = updatedProfile;
      this.saveSession();
      this.notifySubscribers();
      return true;
    }
    
    return false;
  }

  async hasEraAccess(userId, eraId) {
    const era = await configLoader.loadEraConfig(eraId);
    
    if (era?.free === true) {
      return true;
    }
    
    if (userId.startsWith('guest-')) {
      return false;
    }
    
    return await this.rightsService.hasEraAccess(userId, eraId);
  }
  getPlayerGameName(playerId) {
    if (playerId === this.humanPlayer?.id && this.userProfile?.game_name) {
      return this.userProfile.game_name;
    }
    
    const player = this.gameInstance?.players.find(p => p.id === playerId);
    return player?.name || 'Unknown Player';
  }

  getEventName(event) {
    return Object.keys(this.events).find(key => this.events[key] === event) || 'UNKNOWN';
  }

  get unlockedAchievements() {
    return this.newAchievements || [];
  }

  clearUnlockedAchievements() {
    this.newAchievements = [];
    this.log('Cleared unlocked achievements');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CoreEngine ${version}] ${message}`);
  }
}

export default CoreEngine;
// EOF
