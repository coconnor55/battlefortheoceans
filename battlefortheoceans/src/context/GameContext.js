// src/context/GameContext.js (v0.1.13)
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useState } from 'react';
import { StateMachine } from '../classes/StateMachine';

const GameState = createContext();

const gameStateMachine = new StateMachine();
let contextVersion = 0;

export const GameProvider = ({ children }) => {
  const [version, setVersion] = useState(contextVersion);
  const [eraConfig, setEraConfig] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [player, setPlayer] = useState(null);
  const [placementBoard, setPlacementBoard] = useState(null);

  const dispatch = (event) => {
    console.log('v0.1.13: Dispatching event to state machine', event);
    gameStateMachine.transition(event);
    contextVersion += 1;
    setVersion(contextVersion); // Force context value change
  };

  const updateEraConfig = (config) => {
    console.log('v0.1.13: Updating era config', config?.name);
    setEraConfig(config);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updateSelectedOpponent = (opponent) => {
    console.log('v0.1.13: Updating selected opponent', opponent?.name);
    setSelectedOpponent(opponent);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updatePlayer = (playerData) => {
    console.log('v0.1.13: Updating player', playerData?.id);
    setPlayer(playerData);
    contextVersion += 1;
    setVersion(contextVersion);
  };

  const updatePlacementBoard = (board) => {
    console.log('v0.1.13: Storing placement board');
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
      player,
      placementBoard,
      updateEraConfig,
      updateSelectedOpponent,
      updatePlayer,
      updatePlacementBoard
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// Export the context for direct use if needed
export { GameState as GameContext };

// EOF - EOF - EOF
