// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useState } from 'react';
import { StateMachine } from '../classes/StateMachine';
import HumanPlayer from '../classes/HumanPlayer';
import Game from '../classes/Game';
import Board from '../classes/Board';

const version = "v0.1.18";

const GameState = createContext();

const gameStateMachine = new StateMachine();
let contextVersion = 0;

export const GameProvider = ({ children }) => {
  const [version, setVersion] = useState(contextVersion);
  const [eraConfig, setEraConfig] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedGameMode, setSelectedGameMode] = useState(null);
  const [humanPlayer, setHumanPlayer] = useState(null);
  const [gameInstance, setGameInstance] = useState(null);
  const [board, setBoard] = useState(null);

  const dispatch = (event) => {
    console.log('v0.1.18: Dispatching event to state machine', event);
    gameStateMachine.transition(event);
    contextVersion += 1;
    setVersion(contextVersion); // Force context value change
  };

  const updateEraConfig = (config) => {
    console.log('v0.1.18: Updating era config', config?.name);
    setEraConfig(config);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updateSelectedOpponent = (opponent) => {
    console.log('v0.1.18: Updating selected opponent', opponent?.name);
    setSelectedOpponent(opponent);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updateGameMode = (gameMode) => {
    console.log('v0.1.18: Updating game mode', gameMode?.name);
    setSelectedGameMode(gameMode);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updateHumanPlayer = (playerData) => {
    console.log('v0.1.18: Creating HumanPlayer instance', playerData?.id);
    
    if (playerData) {
      const player = new HumanPlayer(playerData.id, playerData.name || playerData.email);
      // Store additional player data if needed
      player.email = playerData.email;
      player.userData = playerData;
      setHumanPlayer(player);
    } else {
      setHumanPlayer(null);
    }
    
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const initializeGame = (gameMode = 'turnBased') => {
    if (!eraConfig) {
      console.error('v0.1.18: Cannot initialize game without era config');
      return null;
    }

    console.log('v0.1.18: Initializing game instance', { era: eraConfig.name, mode: gameMode });
    
    // Create game instance
    const game = new Game(eraConfig, gameMode);
    
    // Initialize alliances from era config
    game.initializeAlliances();
    
    // Create board
    const gameBoard = new Board(eraConfig.rows, eraConfig.cols, eraConfig.terrain);
    game.setBoard(gameBoard);
    
    setGameInstance(game);
    setBoard(gameBoard);
    
    contextVersion += 1;
    setVersion(contextVersion);
    
    return game;
  };

  const addPlayerToGame = (playerId, playerType = 'human', playerName = 'Player', allianceName = null) => {
    if (!gameInstance) {
      console.error('v0.1.18: No game instance to add player to');
      return null;
    }

    console.log('v0.1.18: Adding player to game', { playerId, playerType, playerName, allianceName });
    
    // Add player to game
    const player = gameInstance.addPlayer(playerId, playerType, playerName);
    
    // Assign to alliance if specified
    if (allianceName) {
      try {
        gameInstance.assignPlayerToAlliance(playerId, allianceName);
      } catch (error) {
        console.error('v0.1.18: Failed to assign player to alliance', error);
      }
    }
    
    contextVersion += 1;
    setVersion(contextVersion);
    
    return player;
  };

  const registerShipPlacement = (ship, playerId) => {
    if (!gameInstance || !board) {
      console.error('v0.1.18: Cannot register ship placement without game/board');
      return false;
    }

    console.log('v0.1.18: Registering ship placement', { ship: ship.name, playerId });
    
    // Register with both Game and Board
    const gameRegistered = gameInstance.registerShipPlacement(ship, playerId);
    const boardRegistered = board.registerShipPlacement(ship);
    
    if (gameRegistered && boardRegistered) {
      contextVersion += 1;
      setVersion(contextVersion);
      return true;
    }
    
    return false;
  };

  const resetGame = () => {
    console.log('v0.1.18: Resetting game state');
    setGameInstance(null);
    setBoard(null);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const getPlayerFleet = (playerId) => {
    if (!gameInstance) return null;
    return gameInstance.playerFleets.get(playerId);
  };

  return (
    <GameState.Provider value={{
      stateMachine: gameStateMachine,
      dispatch,
      version,
      eraConfig,
      selectedOpponent,
      selectedGameMode,
      humanPlayer,
      gameInstance,
      board,
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
