// src/classes/CoreEngine.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.5.8: Remove ACHIEVEMENTS state
// v0.5.7: Add ACHIEVEMENTS event and state for achievements page navigation
// v0.5.6: Fix achievement service integration - proper debug logging
// v0.5.5: Add achievement service integration
// v0.5.3: Synchronous session restoration using sessionStorage for both guests and registered users
// v0.5.2: Fix page refresh - restore Supabase session and user profile
// v0.5.1: Fix refresh issue - initialize state from URL in constructor (synchronous)
// v0.5.0: OPTION 1 REFACTOR - Players are persistent entities across games

import Game from './Game.js';
import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import AiPlayer from './AiPlayer.js';
import UserProfileService from '../services/UserProfileService.js';
import GameStatsService from '../services/GameStatsService.js';
import LeaderboardService from '../services/LeaderboardService.js';
import RightsService from '../services/RightsService.js';
import EraService from '../services/EraService.js';
import AchievementService from '../services/AchievementService.js';
import { supabase } from '../utils/supabaseClient.js';

const version = "v0.5.8";

class CoreEngine {
  constructor() {
    // State machine properties
    this.currentState = null; // Will be set by initializeFromURL()
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
    
    // URL route mapping
    this.stateToRoute = {
      'launch': '/',
      'login': '/login',
      'era': '/select-era',
      'opponent': '/select-opponent',
      'placement': '/placement',
      'play': '/battle',
      'over': '/results'
    };
    
    this.routeToState = Object.fromEntries(
      Object.entries(this.stateToRoute).map(([state, route]) => [route, state])
    );
    
    // Game state data
    this.eraConfig = null;
    this.selectedOpponent = null;
    this.selectedGameMode = null;
    this.selectedAlliance = null;
    this.humanPlayer = null;
    this.aiPlayer = null;
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
    this.eraService = new EraService();
    this.achievementService = AchievementService;
    
    // Achievement tracking
    this.newAchievements = [];
    
    // Browser navigation handler
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (event) => {
        this.handleBrowserNavigation(event);
      });
      
      this.restoreSessionSync();
      this.initializeFromURL();
      
      if (!this.currentState) {
        this.currentState = 'launch';
      }
    } else {
      this.currentState = 'launch';
    }
    
    this.log('CoreEngine initialized');
  }

  restoreSessionSync() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = sessionStorage.getItem('game_session');
      if (!stored) {
        this.log('No stored session found');
        return;
      }
      
      const context = JSON.parse(stored);
      this.log('Restoring session context');
      
      if (context.user) {
        this.userProfile = {
          id: context.user.id,
          game_name: context.user.game_name,
          total_games: context.user.total_games || 0,
          total_wins: context.user.total_wins || 0,
          total_score: context.user.total_score || 0,
          best_accuracy: context.user.best_accuracy || 0,
          total_ships_sunk: context.user.total_ships_sunk || 0,
          total_damage: context.user.total_damage || 0
        };
        
        this.humanPlayer = new HumanPlayer(context.user.id, context.user.game_name);
        if (context.user.email) {
          this.humanPlayer.email = context.user.email;
        }
        this.humanPlayer.gameName = context.user.game_name;
        
        this.log(`User restored: ${context.user.game_name}`);
        
        if (context.user.type === 'registered') {
          this.refreshProfileAsync(context.user.id);
        }
      }
      
      if (context.eraId) {
        this.restoreEraAsync(context.eraId);
      }
      
      if (context.selectedOpponent) {
        this.selectedOpponent = context.selectedOpponent;
        this.log(`Opponent restored: ${context.selectedOpponent.name}`);
      }
      
      if (context.selectedAlliance) {
        this.selectedAlliance = context.selectedAlliance;
        this.log(`Alliance restored: ${context.selectedAlliance}`);
      }
      
    } catch (error) {
      console.error(`${version} Error restoring session:`, error);
      sessionStorage.removeItem('game_session');
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
      this.eraConfig = await this.eraService.getEraById(eraId);
      if (this.eraConfig) {
        this.log(`Era restored: ${this.eraConfig.name}`);
        this.notifySubscribers();
      }
    } catch (error) {
      console.error(`${version} Error restoring era:`, error);
    }
  }

  storeSessionContext() {
    if (typeof window === 'undefined') return;
    
    try {
      const context = {
        user: this.userProfile ? {
          id: this.userProfile.id,
          game_name: this.userProfile.game_name,
          type: this.userProfile.id.startsWith('guest-') ? 'guest' : 'registered',
          email: this.humanPlayer?.email || null,
          total_games: this.userProfile.total_games || 0,
          total_wins: this.userProfile.total_wins || 0,
          total_score: this.userProfile.total_score || 0,
          best_accuracy: this.userProfile.best_accuracy || 0,
          total_ships_sunk: this.userProfile.total_ships_sunk || 0,
          total_damage: this.userProfile.total_damage || 0
        } : null,
        
        eraId: this.eraConfig?.id || null,
        selectedOpponent: this.selectedOpponent ? {
          id: this.selectedOpponent.id,
          name: this.selectedOpponent.name,
          strategy: this.selectedOpponent.strategy,
          difficulty: this.selectedOpponent.difficulty
        } : null,
        selectedAlliance: this.selectedAlliance || null,
        
        timestamp: Date.now()
      };
      
      sessionStorage.setItem('game_session', JSON.stringify(context));
      this.log('Session context stored');
    } catch (error) {
      console.error(`${version} Error storing session context:`, error);
    }
  }

  clearSessionContext() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('game_session');
      this.log('Session context cleared');
    }
  }

  initializeFromURL(path = typeof window !== 'undefined' ? window.location.pathname : '/') {
    const targetState = this.routeToState[path] || 'launch';
    
    this.log(`Initializing from URL: ${path} → ${targetState}`);
    
    if (targetState === 'era') {
      this.currentState = 'era';
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(
          { state: 'era', timestamp: Date.now() },
          '',
          '/select-era'
        );
      }
      this.notifySubscribers();
      return;
    }
    
    if (targetState !== 'launch' && targetState !== 'login') {
      this.log(`Direct URL to protected state ${targetState} - page will validate profile`);
    }
    
    this.currentState = targetState;
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState(
        { state: targetState, timestamp: Date.now() },
        '',
        this.stateToRoute[targetState] || '/'
      );
    }
    this.notifySubscribers();
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
      
      this.storeSessionContext();
      
    } else if (event === this.events.SELECTOPPONENT) {
      if (eventData.eraConfig) {
        this.eraConfig = eventData.eraConfig;
        this.log(`Era selected: ${eventData.eraConfig.name}`);
      }
      if (eventData.selectedAlliance) {
        this.selectedAlliance = eventData.selectedAlliance;
        this.log(`Alliance selected: ${eventData.selectedAlliance}`);
      }
      
      this.storeSessionContext();
      
    } else if (event === this.events.PLACEMENT) {
      if (eventData?.selectedOpponent) {
        this.selectedOpponent = eventData.selectedOpponent;
        this.log(`Opponent selected: ${eventData.selectedOpponent.name} (difficulty: ${eventData.selectedOpponent.difficulty || 1.0})`);
      }
      if (eventData?.selectedAlliance && !this.selectedAlliance) {
        this.selectedAlliance = eventData.selectedAlliance;
        this.log(`Alliance selected from opponent page: ${eventData.selectedAlliance}`);
      }
      
      if (this.currentState === 'over' && this.selectedEra) {
        this.eraConfig = await this.eraService.getEraById(this.selectedEra);
        this.log(`Restored eraConfig for Battle Again: ${this.eraConfig?.name}`);
      }
      
      this.storeSessionContext();
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
      
      this.syncURL();
      this.log(`State transition: ${oldState} → ${this.currentState}`);
    } else {
      throw new Error(`No transition defined for ${this.currentState} with event ${this.getEventName(event)}`);
    }
  }
    
  clearGameState() {
    this.log('Clearing game state for clean login');
    this.eraConfig = null;
    this.selectedOpponent = null;
    this.selectedGameMode = null;
    this.selectedAlliance = null;
    this.humanPlayer = null;
    this.aiPlayer = null;
    this.gameInstance = null;
    this.board = null;
    this.userProfile = null;
    this.newAchievements = [];
    
    this.clearSessionContext();
  }

  syncURL() {
    const route = this.stateToRoute[this.currentState];
    if (route && typeof window !== 'undefined' && window.history) {
      const currentUrl = new URL(window.location);
      const newUrl = new URL(route, window.location.origin);
      
      currentUrl.searchParams.forEach((value, key) => {
        newUrl.searchParams.set(key, value);
      });
      
      window.history.pushState(
        { state: this.currentState, timestamp: Date.now() },
        '',
        newUrl.pathname + newUrl.search
      );
      this.log(`URL synced: ${newUrl.pathname + newUrl.search}`);
    }
  }

  handleBrowserNavigation(event) {
    const targetState = event.state?.state;
    
    if (!targetState) {
      this.log('Browser navigation with no state - ignoring');
      return;
    }
    
    this.log(`Browser back/forward to: ${targetState}`);
    
    if (this.currentState === 'play' && this.gameInstance?.state === 'playing') {
      this.log('Cannot navigate away from active game');
      window.history.pushState(
        { state: this.currentState, timestamp: Date.now() },
        '',
        this.stateToRoute[this.currentState]
      );
      return;
    }
    
    if (this.isValidBackwardTransition(this.currentState, targetState)) {
      this.currentState = targetState;
      this.handleStateTransition(targetState).catch(error => {
        console.error(`${version} State transition failed:`, error);
      });
      this.notifySubscribers();
    } else {
      this.log(`Invalid backward navigation from ${this.currentState} to ${targetState}`);
      this.syncURL();
    }
  }

  isValidBackwardTransition(from, to) {
    const backwardAllowed = {
      'opponent': ['era'],
      'placement': ['opponent'],
      'over': ['era'],
      'achievements': ['era']
    };
    
    if (to === 'login' && ['era', 'opponent', 'placement', 'over', 'achievements'].includes(from)) {
      return true;
    }
    
    return backwardAllowed[from]?.includes(to) || false;
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
    this.log('Initializing for placement phase');
    
    this.gameInstance = null;
    this.board = null;
    
    if (!this.eraConfig || !this.humanPlayer || !this.selectedOpponent) {
      const missing = [];
      if (!this.eraConfig) missing.push('eraConfig');
      if (!this.humanPlayer) missing.push('humanPlayer');
      if (!this.selectedOpponent) missing.push('selectedOpponent');
      throw new Error(`Cannot initialize placement - missing: ${missing.join(', ')}`);
    }
    
    this.selectedEra = this.eraConfig.id;
    
    this.gameInstance = new Game(this.eraConfig, this.selectedOpponent.gameMode || 'turnBased');
    
    this.gameInstance.setUIUpdateCallback(() => this.notifySubscribers());
    
    this.gameInstance.setGameEndCallback(() => {
      this.log('Game end callback triggered - dispatching OVER event');
      this.dispatch(this.events.OVER).catch(error => {
        console.error(`${version} Failed to dispatch OVER event:`, error);
      });
    });
    
    this.gameInstance.initializeAlliances();
    
    this.board = new Board(this.eraConfig.rows, this.eraConfig.cols, this.eraConfig.terrain);

    let playerAlliance, opponentAlliance;
    if (this.eraConfig.game_rules?.choose_alliance && this.selectedAlliance) {
      playerAlliance = this.selectedAlliance;
      opponentAlliance = this.getOpposingAlliance(this.selectedAlliance);
    } else {
      playerAlliance = this.eraConfig.alliances?.[0]?.name || 'Player';
      opponentAlliance = this.eraConfig.alliances?.[1]?.name || 'Opponent';
    }
    
    if (!opponentAlliance) {
      throw new Error('Cannot determine opponent alliance');
    }
    
    const humanPlayerAdded = this.gameInstance.addPlayer(this.humanPlayer, playerAlliance);
    
    const aiCaptain = this.selectedOpponent;
    const aiId = `ai-${aiCaptain.id}`;
    
    if (this.aiPlayer && this.aiPlayer.id === aiId) {
      this.aiPlayer.strategy = aiCaptain.strategy || 'random';
      this.aiPlayer.difficulty = aiCaptain.difficulty || 1.0;
      this.log(`Reusing AI player ${aiCaptain.name}, updated properties (${this.aiPlayer.strategy}, ${this.aiPlayer.difficulty})`);
    } else {
      this.aiPlayer = new AiPlayer(
        aiId,
        aiCaptain.name,
        aiCaptain.strategy || 'random',
        aiCaptain.difficulty || 1.0
      );
      this.log(`Created new AI player ${aiCaptain.name} (${this.aiPlayer.strategy}, ${this.aiPlayer.difficulty})`);
    }
    
    const aiPlayerAdded = this.gameInstance.addPlayer(this.aiPlayer, opponentAlliance);
    
    if (!humanPlayerAdded || !aiPlayerAdded) {
      throw new Error('Failed to add players to game');
    }

    this.gameInstance.setBoard(this.board);

    this.log(`Game initialized with ${this.gameInstance.players.length} players`);
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
        this.selectedOpponent
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
      gameStats: this.gameInstance?.getGameStats() || null
    };
  }

  generateCurrentMessage() {
    if (!this.gameInstance) return 'Initializing game...';
    
    const gameState = {
      state: this.gameInstance.state,
      winner: this.gameInstance.winner,
      currentPlayer: this.gameInstance.getCurrentPlayer(),
      gameRules: this.gameInstance.gameRules
    };
    
    return this.eraService.getGameStateMessage(this.eraConfig, gameState);
  }

  getPlayerStats() {
    if (!this.gameInstance) return {
      player: { hits: 0, shots: 0, accuracy: 0 },
      opponent: { hits: 0, shots: 0, accuracy: 0 }
    };
    
    const humanPlayerInGame = this.gameInstance.players.find(p => p.type === 'human');
    const opponentPlayer = this.gameInstance.players.find(p => p.type !== 'human');
    
    return {
      player: {
        hits: humanPlayerInGame?.hits || 0,
        shots: humanPlayerInGame?.shots || 0,
        misses: humanPlayerInGame?.misses || 0,
        sunk: humanPlayerInGame?.sunk || 0,
        accuracy: humanPlayerInGame?.accuracy || 0,
        score: humanPlayerInGame?.score || 0
      },
      opponent: {
        hits: opponentPlayer?.hits || 0,
        shots: opponentPlayer?.shots || 0,
        misses: opponentPlayer?.misses || 0,
        sunk: opponentPlayer?.sunk || 0,
        accuracy: opponentPlayer?.accuracy || 0,
        score: opponentPlayer?.score || 0
      }
    };
  }

  getOpposingAlliance(selectedAlliance) {
    if (!this.eraConfig?.alliances || this.eraConfig.alliances.length < 2) {
      return null;
    }
    
    return this.eraConfig.alliances.find(alliance =>
      alliance.name !== selectedAlliance
    )?.name;
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

  async getUserProfile(userId) {
    return await this.userProfileService.getUserProfile(userId);
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
      this.storeSessionContext();
      this.notifySubscribers();
      return true;
    }
    
    return false;
  }

  async getLeaderboard(limit = 10) {
    return await this.leaderboardService.getLeaderboard(limit);
  }

  async getRecentChampions(limit = 5) {
    return await this.leaderboardService.getRecentChampions(limit);
  }

  async hasEraAccess(userId, eraId) {
    const era = await this.eraService.getEraById(eraId);
    
    if (era?.free === true) {
      return true;
    }
    
    if (userId.startsWith('guest-')) {
      return false;
    }
    
    return await this.rightsService.hasEraAccess(userId, eraId);
  }

  async grantEraAccess(userId, eraId, paymentData = {}) {
    return await this.rightsService.grantEraAccess(userId, eraId, paymentData);
  }

  async redeemVoucher(userId, voucherCode) {
    return await this.rightsService.redeemVoucher(userId, voucherCode);
  }

  async getUserRights(userId) {
    return await this.rightsService.getUserRights(userId);
  }

  async getAllEras() {
    return await this.eraService.getAllEras();
  }

  async getEraById(eraId) {
    return await this.eraService.getEraById(eraId);
  }

  async getPromotableEras() {
    return await this.eraService.getPromotableEras();
  }

  async getFreeEras() {
    return await this.eraService.getFreeEras();
  }

  clearEraCache() {
    this.eraService.clearCache();
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
