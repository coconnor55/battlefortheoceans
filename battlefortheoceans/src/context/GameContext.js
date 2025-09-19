// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useState } from 'react';
import { StateMachine } from '../classes/StateMachine';
import HumanPlayer from '../classes/HumanPlayer';
import Game from '../classes/Game';
import Board from '../classes/Board';

const version = "v0.1.24";

const GameState = createContext();
const gameStateMachine = new StateMachine();

// Game logic state - immediate, synchronous access
let gameLogic = {
  eraConfig: null,
  selectedOpponent: null,
  selectedGameMode: null,
  humanPlayer: null,
  gameInstance: null,
  board: null
};

export const GameProvider = ({ children }) => {
  // React state - purely for triggering UI updates
  const [uiVersion, setUiVersion] = useState(0);

  // Force UI update after business logic changes
  const forceUIUpdate = () => {
    setUiVersion(prev => prev + 1);
  };

  const dispatch = async (event, eventData = null) => {
    console.log('v0.1.24: Dispatching event to state machine', event);
    
    // Execute business logic BEFORE state transition for all events
    if (event === gameStateMachine.event.LOGIN) {
      // LOGIN transition - validate authentication state
      console.log('v0.1.24: Processing LOGIN transition');
      // No specific business logic needed - authentication handled by LoginPage
      
    } else if (event === gameStateMachine.event.SELECTERA) {
      // SELECTERA transition - validate user is authenticated
      // Can accept user data as eventData to avoid React state timing
      if (eventData && eventData.userData) {
        console.log('v0.1.24: Creating HumanPlayer from eventData:', eventData.userData.id);
        gameLogic.humanPlayer = new HumanPlayer(
          eventData.userData.id,
          eventData.userData.name || eventData.userData.email
        );
        gameLogic.humanPlayer.email = eventData.userData.email;
        gameLogic.humanPlayer.userData = eventData.userData;
      }
      
      if (!gameLogic.humanPlayer) {
        console.error('v0.1.24: Cannot select era without authenticated user');
        console.error('v0.1.24: Current humanPlayer state:', gameLogic.humanPlayer);
        return;
      }
      console.log('v0.1.24: Processing SELECTERA transition for user:', gameLogic.humanPlayer.id);
      
    } else if (event === gameStateMachine.event.PLACEMENT) {
      // PLACEMENT transition - set up game, players, and alliances BEFORE transition
      if (!gameLogic.gameInstance && gameLogic.eraConfig && gameLogic.humanPlayer && gameLogic.selectedOpponent) {
        try {
          console.log('v0.1.24: Setting up game BEFORE PLACEMENT transition');
          
          // Initialize game synchronously
          const game = initializeGame(gameLogic.selectedOpponent.gameMode || 'turnBased');
          
          if (!game) {
            console.error('v0.1.24: Failed to initialize game, aborting transition');
            return;
          }
          
          // Set up UI update callback for AI turns
          game.setUIUpdateCallback(forceUIUpdate);
          
          // Add players with index-based alliance assignment
          const playerAlliance = gameLogic.eraConfig.alliances?.[0]?.name || 'Player';
          const opponentAlliance = gameLogic.eraConfig.alliances?.[1]?.name || 'Opponent';
          
          console.log('v0.1.24: Alliance assignments:', { playerAlliance, opponentAlliance });
          
          // Add human player to first alliance
          const humanPlayerAdded = addPlayerToGame(gameLogic.humanPlayer.id, 'human', gameLogic.humanPlayer.name || 'Player', playerAlliance);
          
          // Add AI opponent to second alliance
          const aiId = gameLogic.selectedOpponent.id || `ai-${Date.now()}`;
          const aiPlayerAdded = addPlayerToGame(aiId, 'ai', gameLogic.selectedOpponent.name, opponentAlliance);
          
          if (!humanPlayerAdded || !aiPlayerAdded) {
            console.error('v0.1.24: Failed to add players, aborting transition');
            return;
          }
          
          console.log('v0.1.24: Game setup completed BEFORE PLACEMENT transition');
          console.log('v0.1.24: Players added:', game.players.length);
          console.log('v0.1.24: Player fleets:', game.playerFleets.size);
          
        } catch (error) {
          console.error('v0.1.24: Failed to set up game BEFORE PLACEMENT transition:', error);
          return; // Don't transition if setup failed
        }
      } else {
        console.error('v0.1.24: Missing required data for PLACEMENT setup:', {
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
          console.log('v0.1.24: Starting game BEFORE PLAY transition');
          await gameLogic.gameInstance.startGame();
          console.log('v0.1.24: Game started successfully');
        } catch (error) {
          console.error('v0.1.24: Failed to start game:', error);
          return; // Don't transition if game start failed
        }
      } else {
        console.warn('v0.1.24: Cannot start game - no instance or not in setup state');
        return;
      }
      
    } else if (event === gameStateMachine.event.OVER) {
      // OVER transition - handle game completion
      if (gameLogic.gameInstance) {
        console.log('v0.1.24: Processing game over, final state:', gameLogic.gameInstance.state);
        // Game completion logic handled by Game class itself
      } else {
        console.warn('v0.1.24: OVER event without game instance');
      }
      
    } else if (event === gameStateMachine.event.ERA) {
      // ERA transition - reset game state for new game
      console.log('v0.1.24: Resetting for new era selection');
      resetGame(); // Clear game instance and board
      // Keep humanPlayer, but clear game-specific data
      gameLogic.eraConfig = null;
      gameLogic.selectedOpponent = null;
      gameLogic.selectedGameMode = null;
      
    } else {
      console.warn('v0.1.24: Unknown event:', event);
      return;
    }
    
    // Execute state transition AFTER business logic is complete
    console.log('v0.1.24: Executing state transition for', event);
    gameStateMachine.transition(event);
    
    // Force UI update to reflect business logic changes
    forceUIUpdate();
  };

  // Game logic functions - work directly with gameLogic object
  const updateEraConfig = (config) => {
    console.log('v0.1.24: Updating era config', config?.name);
    gameLogic.eraConfig = config;
    forceUIUpdate();
  };

  const updateSelectedOpponent = (opponent) => {
    console.log('v0.1.24: Updating selected opponent', opponent?.name);
    gameLogic.selectedOpponent = opponent;
    forceUIUpdate();
  };

  const updateGameMode = (gameMode) => {
    console.log('v0.1.24: Updating game mode', gameMode?.name);
    gameLogic.selectedGameMode = gameMode;
    forceUIUpdate();
  };

  const updateHumanPlayer = (playerData) => {
    console.log('v0.1.24: Creating HumanPlayer instance', playerData?.id);
    
    if (playerData) {
      const player = new HumanPlayer(playerData.id, playerData.name || playerData.email);
      player.email = playerData.email;
      player.userData = playerData;
      gameLogic.humanPlayer = player;
    } else {
      gameLogic.humanPlayer = null;
    }
    
    forceUIUpdate();
  };

  const initializeGame = (gameMode = 'turnBased') => {
    if (!gameLogic.eraConfig) {
      console.error('v0.1.24: Cannot initialize game without era config');
      return null;
    }

    console.log('v0.1.24: Initializing game instance', { era: gameLogic.eraConfig.name, mode: gameMode });
    
    // Create game instance
    const game = new Game(gameLogic.eraConfig, gameMode);
    
    // Initialize alliances from era config
    game.initializeAlliances();
    
    // Create board
    const gameBoard = new Board(gameLogic.eraConfig.rows, gameLogic.eraConfig.cols, gameLogic.eraConfig.terrain);
    game.setBoard(gameBoard);
    
    // Update game logic directly
    gameLogic.gameInstance = game;
    gameLogic.board = gameBoard;
    
    console.log('v0.1.24: Game and board initialized successfully');
    
    return game;
  };

  const addPlayerToGame = (playerId, playerType = 'human', playerName = 'Player', allianceName = null) => {
    if (!gameLogic.gameInstance) {
      console.error('v0.1.24: No game instance to add player to');
      return null;
    }

    console.log('v0.1.24: Adding player to game', { playerId, playerType, playerName, allianceName });
    
    try {
      // Add player to game
      const player = gameLogic.gameInstance.addPlayer(playerId, playerType, playerName);
      
      if (!player) {
        console.error('v0.1.24: Failed to add player to game');
        return null;
      }
      
      // Assign to alliance if specified
      if (allianceName) {
        gameLogic.gameInstance.assignPlayerToAlliance(playerId, allianceName);
      }
      
      console.log('v0.1.24: Player added successfully:', player.name);
      return player;
      
    } catch (error) {
      console.error('v0.1.24: Failed to add player to game:', error);
      return null;
    }
  };

  const registerShipPlacement = (ship, shipCells, orientation, playerId) => {
    if (!gameLogic.gameInstance || !gameLogic.board) {
      console.error('v0.1.24: Cannot register ship placement without game/board');
      return false;
    }

    console.log('v0.1.24: Registering ship placement', {
      ship: ship.name,
      playerId,
      cells: shipCells.length,
      orientation
    });
    
    // Register with both Game and Board (they handle position mapping)
    const gameRegistered = gameLogic.gameInstance.registerShipPlacement(ship, shipCells, orientation, playerId);
    const boardRegistered = gameLogic.board.registerShipPlacement(ship, shipCells);
    
    if (gameRegistered && boardRegistered) {
      // Mark ship as placed after successful registration
      ship.place();
      
      forceUIUpdate();
      return true;
    }
    
    return false;
  };

  const resetGame = () => {
    console.log('v0.1.24: Resetting game state');
    gameLogic.gameInstance = null;
    gameLogic.board = null;
    forceUIUpdate();
  };

  const getPlayerFleet = (playerId) => {
    if (!gameLogic.gameInstance) return null;
    return gameLogic.gameInstance.playerFleets.get(playerId);
  };

  return (
    <GameState.Provider value={{
      stateMachine: gameStateMachine,
      dispatch,
      uiVersion,
      forceUIUpdate, // Expose forceUIUpdate for Game class to call
      // Expose game logic as read-only properties
      eraConfig: gameLogic.eraConfig,
      selectedOpponent: gameLogic.selectedOpponent,
      selectedGameMode: gameLogic.selectedGameMode,
      humanPlayer: gameLogic.humanPlayer,
      gameInstance: gameLogic.gameInstance,
      board: gameLogic.board,
      // Game logic functions
      updateEraConfig,
      updateSelectedOpponent,
      updateGameMode,
      updateHumanPlayer,
      initializeGame,
      addPlayerToGame,
      registerShipPlacement,
      resetGame,
      getPlayerFleet
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// Export the context for direct use if needed
export { GameState as GameContext };

// EOF
