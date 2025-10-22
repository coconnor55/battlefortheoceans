// src/engines/CoreEngine.js
// Copyright(c) 2025, Clint H. O'Connor
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

const version = "v0.6.8";

class CoreEngine {
  constructor() {
    // State machine properties
    this.currentState = null;
    this.lastEvent = null;
    
    // State definitions
    this.events = {
      LAUNCH: Symbol('LAUNCH'),
      LOGIN: Symbol('LOGIN'),
      SELECTERA: Symbol('SELECTERA'),
      SELECTOPPONENT: Symbol('SELECTOPPONENT'),
      PLACEMENT: Symbol('PLACEMENT'),
      PLAY: Symbol('PLAY'),
      OVER: Symbol('OVER'),
      ERA: Symbol('ERA')
    };
    
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
    
    // Game resources (star shells, scatter shot, etc.)
    this.resources = null;
    
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
   * Clears all game state and session data
   */
  logout() {
    this.log('User logging out');
    
    // Clear all game state
    this.clearGameState();
    
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
        game_name: sessionData.user.game_name,
        total_games: sessionData.user.total_games || 0,
        total_wins: sessionData.user.total_wins || 0,
        total_score: sessionData.user.total_score || 0,
        best_accuracy: sessionData.user.best_accuracy || 0,
        total_ships_sunk: sessionData.user.total_ships_sunk || 0,
        total_damage: sessionData.user.total_damage || 0
      };
      
      this.humanPlayer = new HumanPlayer(sessionData.user.id, sessionData.user.game_name);
      if (sessionData.user.email) {
        this.humanPlayer.email = sessionData.user.email;
      }
      this.humanPlayer.gameName = sessionData.user.game_name;
      
      this.log(`User restored: ${sessionData.user.game_name}`);
      
      // Refresh registered user profile from database
      if (sessionData.user.type === 'registered') {
        this.refreshProfileAsync(sessionData.user.id);
      }
    }
    
    // Restore era
    if (sessionData.eraId) {
      this.restoreEraAsync(sessionData.eraId);
    }
    
    // Restore opponents
    if (sessionData.selectedOpponents && Array.isArray(sessionData.selectedOpponents)) {
      this.selectedOpponents = sessionData.selectedOpponents;
      this.log(`Opponents restored: ${sessionData.selectedOpponents.length} captains`);
    }
    
    // Restore alliance
    if (sessionData.selectedAlliance) {
      this.selectedAlliance = sessionData.selectedAlliance;
      this.log(`Alliance restored: ${sessionData.selectedAlliance}`);
    }
  }
  
  /**
   * Save session using SessionManager
   */
  saveSession() {
    const context = {
      user: this.userProfile ? {
        id: this.userProfile.id,
        game_name: this.userProfile.game_name,
        email: this.humanPlayer?.email || null,
        total_games: this.userProfile.total_games || 0,
        total_wins: this.userProfile.total_wins || 0,
        total_score: this.userProfile.total_score || 0,
        best_accuracy: this.userProfile.best_accuracy || 0,
        total_ships_sunk: this.userProfile.total_ships_sunk || 0,
        total_damage: this.userProfile.total_damage || 0
      } : null,
      
      eraId: this.eraConfig?.id || null,
      
      selectedOpponents: this.selectedOpponents.map(opp => ({
        id: opp.id,
        name: opp.name,
        strategy: opp.strategy,
        difficulty: opp.difficulty
      })),
      
      selectedAlliance: this.selectedAlliance || null
    };
    
    SessionManager.save(context);
  }
  
  /**
   * Calculate resource count with multi-opponent boost
   * @param {number} baseAmount - Base resource from era config
   * @param {number} boostPerOpponent - Boost per additional opponent
   * @param {number} opponentCount - Number of opponents
   * @returns {number} Final resource count
   */
  /**
   * Handle star shell firing (consumes turn)
   * @param {number} row - Target row
   * @param {number} col - Target column
   * @returns {boolean} Success/failure
   */
  handleStarShellFired(row, col) {
    if (!this.gameInstance || this.gameInstance.state !== 'playing') {
      this.log('Star shell blocked - game not active');
      return false;
    }
    
    const currentPlayer = this.gameInstance.getCurrentPlayer();
    if (currentPlayer?.type !== 'human') {
      this.log('Star shell blocked - not human turn');
      return false;
    }
    
    if (!this.resources || this.resources.starShells <= 0) {
      this.log('Star shell blocked - none remaining');
      return false;
    }
    
    this.log(`Star shell fired at (${row}, ${col})`);
    
    // Decrement star shell count
    this.resources.starShells = Math.max(0, this.resources.starShells - 1);
    
    // Advance turn (star shell consumes turn)
    this.gameInstance.handleTurnProgression();
    
    // Notify subscribers of state change
    this.notifySubscribers();
    
    return true;
  }

  async initializeGameConfig() {
    try {
      this.gameConfig = await configLoader.loadGameConfig();
      this.log(`Game config loaded: v${this.gameConfig.version}`);
    } catch (error) {
      console.error(`${version} Failed to load game config:`, error);
    }
  }

  async refreshProfileAsync(userId) {
    try {
      const profile = await this.userProfileService.getUserProfile(userId);
      if (profile && profile.game_name) {
        this.userProfile = profile;
        if (this.humanPlayer) {
          this.humanPlayer.name = profile.game_name;
          this.humanPlayer.gameName = profile.game_name;
        }
        this.log(`Profile refreshed from database: ${profile.game_name}`);
        this.notifySubscribers();
      }
    } catch (error) {
      console.error(`${version} Error refreshing profile:`, error);
    }
  }

  async restoreEraAsync(eraId) {
    try {
      this.eraConfig = await configLoader.loadEraConfig(eraId);
      if (this.eraConfig) {
        this.log(`Era restored: ${this.eraConfig.name}`);
        this.notifySubscribers();
      }
    } catch (error) {
      console.error(`${version} Error restoring era:`, error);
    }
  }

  async dispatch(event, eventData = null) {
    this.log(`Dispatching event: ${this.getEventName(event)} from state: ${this.currentState}`);
    
    try {
      await this.processEventData(event, eventData);
      this.transition(event);
      await this.handleStateTransition(this.currentState);
      this.notifySubscribers();
    } catch (error) {
      console.error(`${version} Error in dispatch:`, error);
      throw error;
    }
  }

  async processEventData(event, eventData) {
    if (!eventData) return;
    
    if (event === this.events.LOGIN && eventData.showSignup !== undefined) {
      this.loginEventData = { showSignup: eventData.showSignup };
      this.log(`LOGIN event with showSignup: ${eventData.showSignup}`);
    }
    
    if (event === this.events.SELECTERA && eventData.userData) {
      const isGuest = eventData.userData.id.startsWith('guest-');
      
      if (isGuest) {
        this.userProfile = {
          id: eventData.userData.id,
          game_name: 'Guest',
          total_games: 0,
          total_wins: 0,
          total_score: 0,
          best_accuracy: 0,
          total_ships_sunk: 0,
          total_damage: 0
        };
        
        if (!this.humanPlayer) {
          this.humanPlayer = new HumanPlayer(eventData.userData.id, 'Guest');
          this.log(`Guest player created: ${eventData.userData.id}`);
        } else {
          this.log(`Reusing existing guest player: ${eventData.userData.id}`);
        }
        
      } else {
        const profile = await this.userProfileService.getUserProfile(eventData.userData.id);
        
        if (!profile || !profile.game_name) {
          throw new Error('Cannot access game without valid profile and game name');
        }
        
        this.userProfile = profile;
        
        if (!this.humanPlayer) {
          this.humanPlayer = new HumanPlayer(
            eventData.userData.id,
            profile.game_name
          );
          this.log(`Human player created: ${profile.game_name} (${eventData.userData.id})`);
        } else {
          this.humanPlayer.name = profile.game_name;
          this.log(`Reusing human player, updated name: ${profile.game_name}`);
        }
        
        this.humanPlayer.email = eventData.userData.email;
        this.humanPlayer.userData = eventData.userData;
        this.humanPlayer.gameName = profile.game_name;
      }
      
      this.saveSession();
      
    } else if (event === this.events.SELECTOPPONENT) {
      if (eventData.eraConfig) {
        this.eraConfig = eventData.eraConfig;
        this.log(`Era selected: ${eventData.eraConfig.name}`);
      }
      if (eventData.selectedAlliance) {
        this.selectedAlliance = eventData.selectedAlliance;
        this.log(`Alliance selected: ${eventData.selectedAlliance}`);
      }
      
      this.saveSession();
      
    } else if (event === this.events.PLACEMENT) {
      if (eventData?.selectedOpponents && Array.isArray(eventData.selectedOpponents)) {
        this.selectedOpponents = eventData.selectedOpponents;
        this.log(`Opponents selected: ${eventData.selectedOpponents.length} captains`);
        eventData.selectedOpponents.forEach(opp => {
          this.log(`  - ${opp.name} (${opp.difficulty || 1.0}x difficulty)`);
        });
      } else if (eventData?.selectedOpponent) {
        this.selectedOpponents = [eventData.selectedOpponent];
        this.log(`Opponent selected (legacy): ${eventData.selectedOpponent.name} (${eventData.selectedOpponent.difficulty || 1.0}x)`);
      }
      
      if (eventData?.selectedAlliance && !this.selectedAlliance) {
        this.selectedAlliance = eventData.selectedAlliance;
        this.log(`Alliance selected from opponent page: ${eventData.selectedAlliance}`);
      }
      
      if (this.currentState === 'over' && this.selectedEra) {
        this.eraConfig = await configLoader.loadEraConfig(this.selectedEra);
        this.log(`Restored eraConfig for Battle Again: ${this.eraConfig?.name}`);
      }
      
      this.saveSession();
    }
  }

  transition(event) {
    const nextState = this.states[this.currentState]?.on[event];
    if (nextState) {
      const oldState = this.currentState;
      this.currentState = nextState;
      this.lastEvent = event;
      
      if (nextState === 'login' || nextState === 'launch') {
        this.clearGameState();
      }
      
      this.navigationManager.syncURL(this.currentState);
      this.log(`State transition: ${oldState} → ${this.currentState}`);
    } else {
      throw new Error(`No transition defined for ${this.currentState} with event ${this.getEventName(event)}`);
    }
  }
    
  clearGameState() {
    this.log('Clearing game state');
    this.eraConfig = null;
    this.selectedOpponents = [];
    this.selectedGameMode = null;
    this.selectedAlliance = null;
    this.humanPlayer = null;
    this.aiPlayers = [];
    this.gameInstance = null;
    this.board = null;
    this.userProfile = null;
    this.newAchievements = [];
    this.resources = null;
    
    SessionManager.clear();
  }

  async handleStateTransition(newState) {
    this.log(`Handling state transition to: ${newState}`);
    
    switch (newState) {
      case 'placement':
        await this.initializeForPlacement();
        break;
        
      case 'play':
        await this.startGame();
        break;
        
      case 'over':
        await this.handleGameOver();
        break;
        
      default:
        break;
    }
  }

  async initializeForPlacement() {
    await this.lifecycleManager.initializeForPlacement();
  }

  async startGame() {
    if (!this.gameInstance || this.gameInstance.state !== 'setup') {
      throw new Error('Cannot start game - no instance or not in setup state');
    }
    
    this.log('Starting game');
    await this.gameInstance.startGame();
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
      playerStats: this.getPlayerStats(),
      resources: this.resources
    };
  }

  generateCurrentMessage() {
    if (!this.gameInstance) return 'Initializing game...';
    
    return this.gameInstance?.message?.getCurrentTurnMessage() || 'Initializing game...';
  }

  getGameStates() {
    return this.gameInstance?.getGameStats() || null;
  }
    
  getPlayerStats() {
    if (!this.gameInstance) return {
      player: { hits: 0, shots: 0, accuracy: 0 },
      opponent: { hits: 0, shots: 0, accuracy: 0 }
    };
    
    const humanPlayerInGame = this.gameInstance.players.find(p => p.type === 'human');
    
    const aiPlayers = this.gameInstance.players.filter(p => p.type === 'ai');
    
    const opponentAggregateStats = aiPlayers.reduce((acc, ai) => ({
      hits: acc.hits + (ai.hits || 0),
      shots: acc.shots + (ai.shots || 0),
      misses: acc.misses + (ai.misses || 0),
      sunk: acc.sunk + (ai.sunk || 0),
      score: acc.score + (ai.score || 0)
    }), { hits: 0, shots: 0, misses: 0, sunk: 0, score: 0 });
    
    opponentAggregateStats.accuracy = opponentAggregateStats.shots > 0
      ? ((opponentAggregateStats.hits / opponentAggregateStats.shots) * 100).toFixed(1)
      : 0;
    
    return {
      player: {
        hits: humanPlayerInGame?.hits || 0,
        shots: humanPlayerInGame?.shots || 0,
        misses: humanPlayerInGame?.misses || 0,
        sunk: humanPlayerInGame?.sunk || 0,
        accuracy: humanPlayerInGame?.accuracy || 0,
        score: humanPlayerInGame?.score || 0
      },
      opponent: opponentAggregateStats
    };
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
