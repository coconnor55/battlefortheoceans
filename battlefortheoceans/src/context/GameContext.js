// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useState } from 'react';
import { StateMachine } from '../classes/StateMachine';
import HumanPlayer from '../classes/HumanPlayer';

const version = "v0.1.17";

const GameState = createContext();

const gameStateMachine = new StateMachine();
let contextVersion = 0;

export const GameProvider = ({ children }) => {
  const [version, setVersion] = useState(contextVersion);
  const [eraConfig, setEraConfig] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedGameMode, setSelectedGameMode] = useState(null);
  const [humanPlayer, setHumanPlayer] = useState(null);
  const [placementBoard, setPlacementBoard] = useState(null);

  const dispatch = (event) => {
    console.log('v0.1.17: Dispatching event to state machine', event);
    gameStateMachine.transition(event);
    contextVersion += 1;
    setVersion(contextVersion); // Force context value change
  };

  const updateEraConfig = (config) => {
    console.log('v0.1.17: Updating era config', config?.name);
    setEraConfig(config);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updateSelectedOpponent = (opponent) => {
    console.log('v0.1.17: Updating selected opponent', opponent?.name);
    setSelectedOpponent(opponent);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updateGameMode = (gameMode) => {
    console.log('v0.1.17: Updating game mode', gameMode?.name);
    setSelectedGameMode(gameMode);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updateHumanPlayer = (playerData) => {
    console.log('v0.1.17: Creating HumanPlayer instance', playerData?.id);
    
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

  const updatePlacementBoard = (board) => {
    console.log('v0.1.17: Storing placement board');
    setPlacementBoard(board);
    contextVersion += 1;
    setVersion(contextVersion);
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
      placementBoard,
      updateEraConfig,
      updateSelectedOpponent,
      updateGameMode,
      updateHumanPlayer,
      updatePlacementBoard
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// Export the context for direct use if needed
export { GameState as GameContext };

// EOF
