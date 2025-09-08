// src/context/GameContext.js (v0.1.6)
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext } from 'react';
import { StateMachine } from '../classes/StateMachine';

const GameState = createContext();

const gameStateMachine = new StateMachine();

export const GameProvider = ({ children }) => {
  const dispatch = (event) => {
    gameStateMachine.transition(event);
  };

  return (
    <GameState.Provider value={{ stateMachine: gameStateMachine, dispatch }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// EOF - EOF - EOF
