// src/classes/CoreEngine.js v0.3.7
// Copyright(c) 2025, Clint H. O'Connor

import Game from './Game.js';
import Board from './Board.js';
import HumanPlayer from './HumanPlayer.js';
import UserProfileService from '../services/UserProfileService.js';
import GameStatsService from '../services/GameStatsService.js';
import LeaderboardService from '../services/LeaderboardService.js';
import RightsService from '../services/RightsService.js';
import EraService from '../services/EraService.js';

const version = "v0.3.7";

class CoreEngine {
  constructor() {
    // State machine properties
    this.currentState = 'launch';
    this.lastEvent = null;
    
    // State definitions
    this.events = {
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
          [this.events.LOGIN]: 'login'
        }
      },
      opponent: {
        on: {
          [this.events.PLACEMENT]: 'placement',
          [this.events.LOGIN]: 'login',
          [this.events.SELECTERA]: 'era'
        }
      },
      placement: {
        on: {
          [this.events.PLAY]: 'play',
          [this.events.SELECTOPPONENT]: 'opponent',
          [this.events.LOGIN]: 'login'
        }
      },
      play: { on: { [this.events.OVER]: 'over' } },
      over: {
        on: {
          [this.events.ERA]: 'era',
          [this.events.PLACEMENT]: 'placement'
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
    this.gameInstance = null;
    this.board = null;
    this.userProfile = null;
    
    // Observer pattern for UI updates
    this.updateCounter = 0;
    this.subscribers = new Set();
    
    // Service instances
    this.userProfileService = new UserProfileService();
    this.gameStatsService = new GameStatsService();
    this.leaderboardService = new LeaderboardService();
    this.rightsService = new RightsService();
    this.eraService = new EraService();
    
    // Browser navigation handler
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (event) => {
        this.handleBrowserNavigation(event);
      });
    }
    
    this.log('CoreEngine initialized');
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
    
    if (event === this.events.SELECTERA && eventData.userData) {
      const isGuest = eventData.userData.id.startsWith('guest-');
      
      if (isGuest) {
        // Create temporary in-memory profile for guest
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
        this.humanPlayer = new HumanPlayer(eventData.userData.id, 'Guest');
        
        this.log(`Guest player created: ${eventData.userData.id}`);
      } else {
        // Load user profile for registered users
        const profile = await this.userProfileService.getUserProfile(eventData.userData.id);
        
        if (!profile || !profile.game_name) {
          throw new Error('Cannot access game without valid profile and game name');
        }
        
        this.userProfile = profile;
        this.humanPlayer = new HumanPlayer(
          eventData.userData.id,
          profile.game_name
        );
        this.humanPlayer.email = eventData.userData.email;
        this.humanPlayer.userData = eventData.userData;
        this.humanPlayer.gameName = profile.game_name;
        
        this.log(`Human player created: ${profile.game_name} (${eventData.userData.id})`);
      }
      
    } else if (event === this.events.SELECTOPPONENT) {
      if (eventData.eraConfig) {
        this.eraConfig = eventData.eraConfig;
        this.log(`Era selected: ${eventData.eraConfig.name}`);
      }
      if (eventData.selectedAlliance) {
        this.selectedAlliance = eventData.selectedAlliance;
        this.log(`Alliance selected: ${eventData.selectedAlliance}`);
      }
      
    } else if (event === this.events.PLACEMENT) {
      if (eventData?.selectedOpponent) {
        this.selectedOpponent = eventData.selectedOpponent;
        this.log(`Opponent selected: ${eventData.selectedOpponent.name}`);
      }
      if (eventData?.selectedAlliance && !this.selectedAlliance) {
        this.selectedAlliance = eventData.selectedAlliance;
        this.log(`Alliance selected from opponent page: ${eventData.selectedAlliance}`);
      }
    }
  }

  transition(event) {
    const nextState = this.states[this.currentState]?.on[event];
    if (nextState) {
      const oldState = this.currentState;
      this.currentState = nextState;
      this.lastEvent = event;
      this.syncURL();
      this.log(`State transition: ${oldState} → ${this.currentState}`);
    } else {
      throw new Error(`No transition defined for ${this.currentState} with event ${this.getEventName(event)}`);
    }
  }

  syncURL() {
    const route = this.stateToRoute[this.currentState];
    if (route && typeof window !== 'undefined' && window.history) {
      window.history.pushState(
        { state: this.currentState, timestamp: Date.now() },
        '',
        route
      );
      this.log(`URL synced: ${route}`);
    }
  }

  handleBrowserNavigation(event) {
    const targetState = event.state?.state;
    
    if (!targetState) {
      this.log('Browser navigation with no state - ignoring');
      return;
    }
    
    this.log(`Browser back/forward to: ${targetState}`);
    
    // Block navigation away from active game
    if (this.currentState === 'play' && this.gameInstance?.state === 'playing') {
      this.log('Cannot navigate away from active game');
      window.history.pushState(
        { state: this.currentState, timestamp: Date.now() },
        '',
        this.stateToRoute[this.currentState]
      );
      return;
    }
    
    // Validate target state is accessible
    if (this.isValidBackwardTransition(this.currentState, targetState)) {
      this.currentState = targetState;
      this.handleStateTransition(targetState).catch(error => {
        console.error(`${version} State transition failed:`, error);
      });
      this.notifySubscribers();
    } else {
      this.log(`Invalid backward navigation from ${this.currentState} to ${targetState}`);
      // Restore current state in URL
      this.syncURL();
    }
  }

  isValidBackwardTransition(from, to) {
    // Define allowed backward transitions
    const backwardAllowed = {
      'opponent': ['era'],
      'placement': ['opponent'],
      'over': ['era']
    };
    
    // Login is always accessible from era/opponent/placement
    if (to === 'login' && ['era', 'opponent', 'placement'].includes(from)) {
      return true;
    }
    
    return backwardAllowed[from]?.includes(to) || false;
  }

  async initializeFromURL(path = typeof window !== 'undefined' ? window.location.pathname : '/') {
    const targetState = this.routeToState[path] || 'launch';
    
    this.log(`Initializing from URL: ${path} → ${targetState}`);
    
    // Special case: Direct entry to SelectEra (e.g., QR code)
    // Guest creation handled by SelectEraPage itself
    if (targetState === 'era') {
      this.currentState = 'era';
      // Push initial state to browser history
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(
          { state: 'era', timestamp: Date.now() },
          '',
          '/select-era'
        );
      }
      this.notifySubscribers(); // CRITICAL: Trigger UI update
      return;
    }
    
    // All other states require userProfile
    // Pages will detect missing profile and redirect to login
    if (targetState !== 'launch' && targetState !== 'login') {
      this.log(`Direct URL to protected state ${targetState} - page will validate profile`);
    }
    
    this.currentState = targetState;
    // Push initial state to browser history
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState(
        { state: targetState, timestamp: Date.now() },
        '',
        this.stateToRoute[targetState] || '/'
      );
    }
    this.notifySubscribers(); // CRITICAL: Trigger UI update
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

  /**
   * SIMPLIFIED v0.3.7: Alliance assignment now happens inside addPlayer()
   * No need to call assignPlayerToAlliance() separately
   */
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
    
    this.gameInstance = new Game(this.eraConfig, this.selectedOpponent.gameMode || 'turnBased');
    
    // Set UI update callback (triggers re-renders)
    this.gameInstance.setUIUpdateCallback(() => this.notifySubscribers());
    
    // Set game end callback to trigger state transition
    this.gameInstance.setGameEndCallback(() => {
      this.log('Game end callback triggered - dispatching OVER event');
      this.dispatch(this.events.OVER).catch(error => {
        console.error(`${version} Failed to dispatch OVER event:`, error);
      });
    });
    
    // Create alliances BEFORE adding players
    this.gameInstance.initializeAlliances();
    
    // Create board
    this.board = new Board(this.eraConfig.rows, this.eraConfig.cols, this.eraConfig.terrain);
    this.gameInstance.setBoard(this.board);
    
    // Determine alliance assignments
    let playerAlliance, opponentAlliance;
    if (this.eraConfig.game_rules?.choose_alliance && this.selectedAlliance) {
      playerAlliance = this.selectedAlliance;
      opponentAlliance = this.getOpposingAlliance(this.selectedAlliance);
    } else {
      playerAlliance = this.eraConfig.alliances?.[0]?.name || 'Player';
      opponentAlliance = this.eraConfig.alliances?.[1]?.name || 'Opponent';
        
        // ADD THIS DEBUG BLOCK:
        console.log('[DEBUG CoreEngine] ========== ALLIANCE DEBUG ==========');
        console.log('[DEBUG CoreEngine] Player alliance:', playerAlliance);
        console.log('[DEBUG CoreEngine] Opponent alliance:', opponentAlliance);
        console.log('[DEBUG CoreEngine] Era config alliances:', this.eraConfig.alliances?.map(a => a.name));
        console.log('[DEBUG CoreEngine] Available game alliances:', Array.from(this.gameInstance.alliances.values()).map(a => ({ id: a.id, name: a.name })));
        console.log('[DEBUG CoreEngine] =======================================');
    }
    
    if (!opponentAlliance) {
      throw new Error('Cannot determine opponent alliance');
    }
    
      console.log('[DEBUG] Player alliance:', playerAlliance);
      console.log('[DEBUG] Opponent alliance:', opponentAlliance);
      console.log('[DEBUG] Available alliances:', Array.from(this.gameInstance.alliances.values()).map(a => a.name));
      
    // Add players (alliance assignment happens inside addPlayer)
    const humanPlayerAdded = this.gameInstance.addPlayer(
      this.humanPlayer.id,
      'human',
      this.userProfile.game_name,
      playerAlliance,
      null,
      null
    );
    
    const aiId = this.generateAIPlayerUUID();
    const aiPlayerAdded = this.gameInstance.addPlayer(
      aiId,
      'ai',
      this.selectedOpponent.name,
      opponentAlliance,
      this.selectedOpponent.strategy || 'random',
      this.selectedOpponent.skill_level || 'novice'
    );
    
    if (!humanPlayerAdded || !aiPlayerAdded) {
      throw new Error('Failed to add players to game');
    }

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
      this.log('Game over - guest/AI or no profile, skipping stats update');
      return;
    }
    
    this.log('Processing game over - updating stats');
    
    try {
      const gameResults = this.gameStatsService.calculateGameResults(
        this.gameInstance,
        this.eraConfig,
        this.selectedOpponent
      );
      
      if (gameResults) {
        this.updateGameStats(gameResults).catch(error => {
          console.error(`${version} Failed to update game stats:`, error);
        });
      }
    } catch (error) {
      console.error(`${version} Error processing game completion stats:`, error);
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
    // Unlock audio on first user interaction
    if (!this.audioUnlocked) {
      Object.values(this.gameInstance.soundEffects).forEach(audio => {
        audio.play().then(() => audio.pause()).catch(() => {});
      });
      this.audioUnlocked = true;
    }
    
    // Continue with normal attack logic
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
    
    const fleet = this.gameInstance.playerFleets.get(this.humanPlayer.id);
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

  generateAIPlayerUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `ai-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CoreEngine ${version}] ${message}`);
  }
}

export default CoreEngine;
// EOF
