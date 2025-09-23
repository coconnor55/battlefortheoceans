// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useCallback } from 'react';
import { StateMachine } from '../classes/StateMachine';
import HumanPlayer from '../classes/HumanPlayer';
import Game from '../classes/Game';
import Board from '../classes/Board';
import UserProfileService from '../services/UserProfileService';
import GameStatsService from '../services/GameStatsService';
import LeaderboardService from '../services/LeaderboardService';

const version = "v0.2.9";

const GameState = createContext();
const gameStateMachine = new StateMachine();

// Service instances for database operations
const userProfileService = new UserProfileService();
const gameStatsService = new GameStatsService();
const leaderboardService = new LeaderboardService();

// UUID generation for AI players
const generateAIPlayerUUID = () => {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID generator
  return 'ai-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

// Game logic state - immediate, synchronous access with observer pattern
let gameLogic = {
  eraConfig: null,
  selectedOpponent: null,
  selectedGameMode: null,
  selectedAlliance: null,
  humanPlayer: null,
  gameInstance: null,
  board: null,
  userProfile: null,  // User's game profile data
  updateCounter: 0,
  subscribers: new Set()
};

// Observer pattern for UI updates
const notifySubscribers = () => {
  gameLogic.updateCounter++;
  gameLogic.subscribers.forEach(callback => {
    try {
      callback(gameLogic.updateCounter);
    } catch (error) {
      console.error(version, 'Subscriber callback error:', error);
    }
  });
};

// Subscribe to game logic changes
const subscribeToUpdates = (callback) => {
  gameLogic.subscribers.add(callback);
  return () => gameLogic.subscribers.delete(callback);
};

// Computed state accessors
const getUIState = () => {
  const gameInstance = gameLogic.gameInstance;
  const currentPlayer = gameInstance?.getCurrentPlayer();
  
  return {
    currentPhase: gameInstance?.state || 'setup',
    isPlayerTurn: currentPlayer?.type === 'human',
    currentPlayer: currentPlayer,
    isGameActive: gameInstance?.state === 'playing',
    gamePhase: gameInstance?.state || 'setup',
    winner: gameInstance?.winner,
    currentMessage: generateCurrentMessage(),
    playerStats: getPlayerStats(),
    gameStats: gameInstance?.getGameStats() || null
  };
};

// Generate appropriate game message based on current state
const generateCurrentMessage = () => {
  const gameInstance = gameLogic.gameInstance;
  if (!gameInstance) return 'Initializing game...';
  
  const currentPlayer = gameInstance.getCurrentPlayer();
  
  if (gameInstance.state === 'finished') {
    const winner = gameInstance.winner;
    if (winner?.type === 'human') {
      return 'Victory! You sank the enemy fleet!';
    } else {
      return 'Defeat! Your fleet has been sunk.';
    }
  }

  if (gameInstance.state === 'playing') {
    if (currentPlayer?.type === 'human') {
      const gameRules = gameInstance.gameRules;
      if (!gameRules.turn_required) {
        return 'Rapid Fire! Click to fire continuously!';
      } else {
        return 'Your turn - click to fire!';
      }
    } else {
      return `${currentPlayer?.name || 'Opponent'} is taking their turn...`;
    }
  }

  return gameInstance.state === 'setup' ? 'Preparing game...' : 'Game starting...';
};

// Get current player statistics
const getPlayerStats = () => {
  const gameInstance = gameLogic.gameInstance;
  if (!gameInstance) return { playerHits: 0, opponentHits: 0 };
  
  const humanPlayerInGame = gameInstance.players.find(p => p.type === 'human');
  const aiPlayer = gameInstance.players.find(p => p.type === 'ai');
  
  return {
    playerHits: humanPlayerInGame?.shotsHit || 0,
    opponentHits: aiPlayer?.shotsHit || 0,
    playerShots: humanPlayerInGame?.shotsFired || 0,
    opponentShots: aiPlayer?.shotsFired || 0
  };
};

// Get ship placement progress
const getPlacementProgress = () => {
  const gameInstance = gameLogic.gameInstance;
  const humanPlayer = gameLogic.humanPlayer;
  
  if (!gameInstance || !humanPlayer) return { current: 0, total: 0, currentShip: null };
  
  const fleet = gameInstance.playerFleets.get(humanPlayer.id);
  if (!fleet) return { current: 0, total: 0, currentShip: null };
  
  const placedCount = fleet.ships.filter(ship => ship.isPlaced).length;
  const currentShip = fleet.ships.find(ship => !ship.isPlaced) || null;
  
  return {
    current: placedCount,
    total: fleet.ships.length,
    currentShip: currentShip,
    isComplete: placedCount === fleet.ships.length
  };
};

// Get opposing alliance name
const getOpposingAlliance = (selectedAlliance, eraConfig) => {
  const alliances = eraConfig.alliances;
  if (!alliances || alliances.length < 2) return null;
  
  return alliances.find(alliance => alliance.name !== selectedAlliance)?.name;
};

export const GameProvider = ({ children }) => {
  
  // USER PROFILE FUNCTIONS (Now using services) - MOVED INSIDE COMPONENT
  
  // Get or create user profile
  const getUserProfile = useCallback(async (userId) => {
    return await userProfileService.getUserProfile(userId);
  }, []);

  // Create new user profile
  const createUserProfile = useCallback(async (userId, gameName) => {
    const profile = await userProfileService.createUserProfile(userId, gameName);
    
    if (profile) {
      // Update local profile with new data
      gameLogic.userProfile = profile;
      notifySubscribers();
    }
    
    return profile;
  }, []);

  // Update game statistics after game completion
  const updateGameStats = useCallback(async (gameResults) => {
    if (!gameLogic.userProfile) {
      console.error(version, 'Cannot update stats without user profile');
      return false;
    }

    const updatedProfile = await gameStatsService.updateGameStats(gameLogic.userProfile, gameResults);
    
    if (updatedProfile) {
      // Update local profile with new stats
      gameLogic.userProfile = updatedProfile;
      notifySubscribers();
      return true;
    }
    
    return false;
  }, []);

  // Get leaderboard (top players by total score)
  const getLeaderboard = useCallback(async (limit = 10) => {
    return await leaderboardService.getLeaderboard(limit);
  }, []);

  // Get recent champions (winners from last 30 days)
  const getRecentChampions = useCallback(async (limit = 5) => {
    return await leaderboardService.getRecentChampions(limit);
  }, []);

  // Get player's game name for display
  const getPlayerGameName = useCallback((playerId) => {
    // If it's the human player, use their profile game name
    if (playerId === gameLogic.humanPlayer?.id && gameLogic.userProfile?.game_name) {
      return gameLogic.userProfile.game_name;
    }
    
    // For AI players or when no profile, fall back to player name
    const player = gameLogic.gameInstance?.players.find(p => p.id === playerId);
    return player?.name || 'Unknown Player';
  }, []);

  // Get online players for multiplayer (future feature)
  const getOnlinePlayersForGame = useCallback(async () => {
    try {
      // This would query for users currently online and looking for games
      // For now, return empty array as multiplayer isn't implemented
      console.log(version, 'Multiplayer not yet implemented');
      return [];
    } catch (error) {
      console.error(version, 'Failed to fetch online players:', error);
      return [];
    }
  }, []);

  const dispatch = async (event, eventData = null) => {
    console.log(version, 'Dispatching event to state machine', event);
    
    // Execute business logic BEFORE state transition for all events
    if (event === gameStateMachine.event.LOGIN) {
      // LOGIN transition - validate authentication state
      console.log(version, 'Processing LOGIN transition');
      // No specific business logic needed - authentication handled by LoginPage
      
    } else if (event === gameStateMachine.event.SELECTERA) {
      // SELECTERA transition - validate user is authenticated and has profile
      // Can accept user data as eventData to avoid React state timing
      if (eventData && eventData.userData) {
        console.log(version, 'Creating HumanPlayer from eventData:', eventData.userData.id);
        
        // Load user profile - MANDATORY for game access
        const profile = await getUserProfile(eventData.userData.id);
        
        if (!profile || !profile.game_name) {
          console.error(version, 'Cannot access game without valid profile and game name');
          console.error(version, 'Profile state:', profile);
          return; // Block transition if no valid profile
        }
        
        // Store profile in gameLogic for future use
        gameLogic.userProfile = profile;
        notifySubscribers();
        
        // Create HumanPlayer with game name (no email fallback allowed)
        gameLogic.humanPlayer = new HumanPlayer(
          eventData.userData.id,     // UUID as player ID
          profile.game_name          // Game name as display name - MANDATORY
        );
        gameLogic.humanPlayer.email = eventData.userData.email;
        gameLogic.humanPlayer.userData = eventData.userData;
        gameLogic.humanPlayer.gameName = profile.game_name;
        
        console.log(version, 'HumanPlayer created with UUID:', gameLogic.humanPlayer.id, 'Game name:', profile.game_name);
      }
      
      if (!gameLogic.humanPlayer) {
        console.error(version, 'Cannot select era without authenticated user');
        console.error(version, 'Current humanPlayer state:', gameLogic.humanPlayer);
        return;
      }
      console.log(version, 'Processing SELECTERA transition for user:', gameLogic.humanPlayer.id);
      
    } else if (event === gameStateMachine.event.SELECTOPPONENT) {
      // SELECTOPPONENT transition - commit era and alliance selection from SelectEraPage
      if (eventData?.eraConfig) {
        console.log(version, 'Committing era config from SelectEraPage:', eventData.eraConfig.name);
        gameLogic.eraConfig = eventData.eraConfig;
      }
      
      if (eventData?.selectedAlliance) {
        console.log(version, 'Committing alliance selection:', eventData.selectedAlliance);
        gameLogic.selectedAlliance = eventData.selectedAlliance;
      }
      
      console.log(version, 'Processing SELECTOPPONENT transition');
      
    } else if (event === gameStateMachine.event.PLACEMENT) {
      // PLACEMENT transition - receive opponent from SelectOpponentPage eventData
      if (eventData?.selectedOpponent) {
        console.log(version, 'Committing opponent from SelectOpponentPage:', eventData.selectedOpponent.name);
        gameLogic.selectedOpponent = eventData.selectedOpponent;
      }
      
      // Handle additional alliance selection from SelectOpponentPage (if not already set)
      if (eventData?.selectedAlliance && !gameLogic.selectedAlliance) {
        console.log(version, 'Alliance selected from SelectOpponentPage:', eventData.selectedAlliance);
        gameLogic.selectedAlliance = eventData.selectedAlliance;
      }
      
      // PLACEMENT transition - set up game, players, and alliances BEFORE transition
      if (!gameLogic.gameInstance && gameLogic.eraConfig && gameLogic.humanPlayer && gameLogic.selectedOpponent) {
        try {
          console.log(version, 'Setting up game BEFORE PLACEMENT transition');
          
          // Initialize game synchronously
          const game = initializeGame(gameLogic.selectedOpponent.gameMode || 'turnBased');
          
          if (!game) {
            console.error(version, 'Failed to initialize game, aborting transition');
            return;
          }
          
          // Set up UI update callback for AI turns - use observer pattern
          game.setUIUpdateCallback(notifySubscribers);
          
          // Determine alliance assignments
          let playerAlliance, opponentAlliance;
          
          if (gameLogic.eraConfig.game_rules?.choose_alliance && gameLogic.selectedAlliance) {
            // Player chose alliance, AI gets opposing alliance
            playerAlliance = gameLogic.selectedAlliance;
            opponentAlliance = getOpposingAlliance(gameLogic.selectedAlliance, gameLogic.eraConfig);
            console.log(version, 'Alliance choice - Player:', playerAlliance, 'AI:', opponentAlliance);
          } else {
            // Auto-assign alliances (Traditional Battleship style)
            playerAlliance = gameLogic.eraConfig.alliances?.[0]?.name || 'Player';
            opponentAlliance = gameLogic.eraConfig.alliances?.[1]?.name || 'Opponent';
            console.log(version, 'Auto-assign alliances - Player:', playerAlliance, 'AI:', opponentAlliance);
          }
          
          if (!opponentAlliance) {
            console.error(version, 'Cannot determine opponent alliance');
            return;
          }
          
          // Add human player to selected alliance (use mandatory game name)
          const humanPlayerAdded = addPlayerToGame(
            gameLogic.humanPlayer.id,
            'human',
            gameLogic.userProfile.game_name, // MANDATORY - no fallbacks
            playerAlliance
          );
          
          // Generate UUID for AI player
          const aiId = generateAIPlayerUUID();
          console.log(version, 'Generated AI UUID:', aiId);
          
          // Add AI opponent to opposing alliance
          const aiPlayerAdded = addPlayerToGame(
            aiId,
            'ai',
            gameLogic.selectedOpponent.name,
            opponentAlliance,
            gameLogic.selectedOpponent.strategy || 'methodical_hunting',
            gameLogic.selectedOpponent.difficulty || 1.0
          );
          
          if (!humanPlayerAdded || !aiPlayerAdded) {
            console.error(version, 'Failed to add players, aborting transition');
            return;
          }
          
          console.log(version, 'Game setup completed BEFORE PLACEMENT transition');
          console.log(version, 'Players added:', game.players.length);
          console.log(version, 'Player IDs:', game.players.map(p => ({ name: p.name, id: p.id, type: p.type })));
          console.log(version, 'Human player ID stored in game:', game.humanPlayerId);
          
        } catch (error) {
          console.error(version, 'Failed to set up game BEFORE PLACEMENT transition:', error);
          return; // Don't transition if setup failed
        }
      } else {
        console.error(version, 'Missing required data for PLACEMENT setup:', {
          hasGameInstance: !!gameLogic.gameInstance,
          hasEraConfig: !!gameLogic.eraConfig,
          hasHumanPlayer: !!gameLogic.humanPlayer,
          hasSelectedOpponent: !!gameLogic.selectedOpponent
        });
        return; // Don't transition if data is missing
      }
      
    } else if (event === gameStateMachine.event.PLAY) {
      // PLAY transition - start the game BEFORE transition
      if (gameLogic.gameInstance && gameLogic.gameInstance.state === 'setup') {
        try {
          console.log(version, 'Starting game BEFORE PLAY transition');
          await gameLogic.gameInstance.startGame();
          console.log(version, 'Game started successfully');
        } catch (error) {
          console.error(version, 'Failed to start game:', error);
          return; // Don't transition if game start failed
        }
      } else {
        console.warn(version, 'Cannot start game - no instance or not in setup state');
        return;
      }
      
    } else if (event === gameStateMachine.event.OVER) {
      // OVER transition - handle game completion and update stats
      if (gameLogic.gameInstance && gameLogic.userProfile) {
        console.log(version, 'Processing game over, updating stats');
        
        try {
          // Calculate game results using service
          const gameResults = gameStatsService.calculateGameResults(
            gameLogic.gameInstance,
            gameLogic.eraConfig,
            gameLogic.selectedOpponent
          );
          
          if (gameResults) {
            // Update stats asynchronously (don't block transition)
            updateGameStats(gameResults).catch(error => {
              console.error(version, 'Failed to update game stats:', error);
            });
          }
        } catch (error) {
          console.error(version, 'Error processing game completion stats:', error);
        }
        
        console.log(version, 'Processing game over, final state:', gameLogic.gameInstance.state);
      } else {
        console.warn(version, 'OVER event without game instance or profile');
      }
      
    } else if (event === gameStateMachine.event.ERA) {
      // ERA transition - reset game state for new game
      console.log(version, 'Resetting for new era selection');
      resetGame(); // Clear game instance and board
      // Keep humanPlayer and userProfile, but clear game-specific data
      gameLogic.eraConfig = null;
      gameLogic.selectedOpponent = null;
      gameLogic.selectedGameMode = null;
      gameLogic.selectedAlliance = null;
      
    } else {
      console.warn(version, 'Unknown event:', event);
      return;
    }
    
    // Execute state transition AFTER business logic is complete
    console.log(version, 'Executing state transition for', event);
    gameStateMachine.transition(event);
    
    // Notify all subscribers of state change
    notifySubscribers();
  };

  // Game logic functions - work directly with gameLogic object
  const updateEraConfig = useCallback((config) => {
    console.log(version, 'Updating era config', config?.name);
    gameLogic.eraConfig = config;
    notifySubscribers();
  }, []);

  const updateSelectedOpponent = useCallback((opponent) => {
    console.log(version, 'Updating selected opponent', opponent?.name);
    gameLogic.selectedOpponent = opponent;
    notifySubscribers();
  }, []);

  const updateGameMode = useCallback((gameMode) => {
    console.log(version, 'Updating game mode', gameMode?.name);
    gameLogic.selectedGameMode = gameMode;
    notifySubscribers();
  }, []);

  const updateSelectedAlliance = useCallback((alliance) => {
    console.log(version, 'Updating selected alliance', alliance);
    gameLogic.selectedAlliance = alliance;
    notifySubscribers();
  }, []);

  const updateHumanPlayer = useCallback(async (playerData) => {
    console.log(version, 'Creating HumanPlayer instance', playerData?.id);
    
    if (playerData) {
      // Load user profile first - MANDATORY
      const profile = await getUserProfile(playerData.id);
      
      if (!profile || !profile.game_name) {
        console.error(version, 'Cannot create player without valid profile and game name');
        gameLogic.humanPlayer = null;
        gameLogic.userProfile = null;
        notifySubscribers();
        return;
      }
      
      // Store profile in gameLogic for future use
      gameLogic.userProfile = profile;
      
      // Create HumanPlayer with game name (no email fallback allowed)
      const player = new HumanPlayer(
        playerData.id,         // UUID as player ID
        profile.game_name      // Game name as display name - MANDATORY
      );
      player.email = playerData.email;
      player.userData = playerData;
      player.gameName = profile.game_name;
      gameLogic.humanPlayer = player;
      
      console.log(version, 'HumanPlayer updated with UUID:', player.id, 'Game name:', profile.game_name);
    } else {
      gameLogic.humanPlayer = null;
      gameLogic.userProfile = null;
    }
    
    notifySubscribers();
  }, [getUserProfile]);

  const initializeGame = useCallback((gameMode = 'turnBased') => {
    if (!gameLogic.eraConfig) {
      console.error(version, 'Cannot initialize game without era config');
      return null;
    }

    console.log(version, 'Initializing game instance', { era: gameLogic.eraConfig.name, mode: gameMode });
    
    // Create game instance
    const game = new Game(gameLogic.eraConfig, gameMode);
    
    // DIRECT STATE MACHINE TRANSITION: Pass dispatch function to Game
    game.setStateMachineDispatch(dispatch, gameStateMachine.event);
    console.log(version, 'State machine dispatch configured for direct transitions');
    
    // Initialize alliances from era config
    game.initializeAlliances();
    
    // Create board
    const gameBoard = new Board(gameLogic.eraConfig.rows, gameLogic.eraConfig.cols, gameLogic.eraConfig.terrain);
    game.setBoard(gameBoard);
    
    // Update game logic directly
    gameLogic.gameInstance = game;
    gameLogic.board = gameBoard;
    
    console.log(version, 'Game and board initialized successfully');
    
    return game;
  }, []);

  const addPlayerToGame = useCallback((playerId, playerType = 'human', playerName = 'Player', allianceName = null, strategy = 'methodical_hunting', difficulty = 1.0) => {
    if (!gameLogic.gameInstance) {
      console.error(version, 'No game instance to add player to');
      return null;
    }

    console.log(version, 'Adding player to game', {
      playerId,
      playerType,
      playerName,
      allianceName,
      strategy: playerType === 'ai' ? strategy : 'N/A',
      difficulty: playerType === 'ai' ? difficulty : 'N/A'
    });
    
    try {
      // Add player to game with strategy, difficulty, and allianceName
      const player = gameLogic.gameInstance.addPlayer(playerId, playerType, playerName, strategy, difficulty, allianceName);
      
      if (!player) {
        console.error(version, 'Failed to add player to game');
        return null;
      }
      
      // UUID CONSISTENCY CHECK: Verify player ID is set correctly
      console.log(version, 'Player created with ID:', player.id, 'Type:', player.type);
      if (playerType === 'human' && gameLogic.gameInstance.humanPlayerId !== player.id) {
        console.warn(version, 'Human player ID mismatch!', {
          playerObjectId: player.id,
          gameHumanPlayerId: gameLogic.gameInstance.humanPlayerId
        });
      }
      
      // Assign to alliance if specified (this now happens after fleet creation)
      if (allianceName) {
        gameLogic.gameInstance.assignPlayerToAlliance(playerId, allianceName);
      }
      
      console.log(version, 'Player added successfully:', {
        name: player.name,
        id: player.id,
        type: player.type,
        alliance: allianceName
      });
      
      return player;
      
    } catch (error) {
      console.error(version, 'Failed to add player to game:', error);
      return null;
    }
  }, []);

  const registerShipPlacement = useCallback((ship, shipCells, orientation, playerId) => {
    if (!gameLogic.gameInstance || !gameLogic.board) {
      console.error(version, 'Cannot register ship placement without game/board');
      return false;
    }

    console.log(version, 'Registering ship placement', {
      ship: ship.name,
      playerId,
      cells: shipCells.length,
      orientation
    });
    
    // Register with Game only - Game handles Board registration internally
    const gameRegistered = gameLogic.gameInstance.registerShipPlacement(ship, shipCells, orientation, playerId);
    
    if (gameRegistered) {
      // Mark ship as placed after successful registration
      ship.place();
      
      notifySubscribers();
      return true;
    }
    
    return false;
  }, []);

  const resetGame = useCallback(() => {
    console.log(version, 'Resetting game state');
    gameLogic.gameInstance = null;
    gameLogic.board = null;
    notifySubscribers();
  }, []);

  const getPlayerFleet = useCallback((playerId) => {
    if (!gameLogic.gameInstance) return null;
    return gameLogic.gameInstance.playerFleets.get(playerId);
  }, []);

  return (
    <GameState.Provider value={{
      stateMachine: gameStateMachine,
      dispatch,
      
      // Observer pattern for UI updates
      subscribeToUpdates,
      updateCounter: gameLogic.updateCounter,
      
      // Computed state accessors
      getUIState,
      getPlacementProgress,
      
      // Dynamic gameLogic access - read current values
      get eraConfig() { return gameLogic.eraConfig; },
      get selectedOpponent() { return gameLogic.selectedOpponent; },
      get selectedGameMode() { return gameLogic.selectedGameMode; },
      get selectedAlliance() { return gameLogic.selectedAlliance; },
      get humanPlayer() { return gameLogic.humanPlayer; },
      get gameInstance() { return gameLogic.gameInstance; },
      get board() { return gameLogic.board; },
      get userProfile() { return gameLogic.userProfile; },
      
      // Game logic functions
      updateEraConfig,
      updateSelectedOpponent,
      updateGameMode,
      updateSelectedAlliance,
      updateHumanPlayer,
      initializeGame,
      addPlayerToGame,
      registerShipPlacement,
      resetGame,
      getPlayerFleet,
      
      // User profile functions
      getUserProfile,
      createUserProfile,
      updateGameStats,
      getLeaderboard,
      getRecentChampions,
      getPlayerGameName,
      getOnlinePlayersForGame
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// Export the context for direct use if needed
export { GameState as GameContext };

// EOF
