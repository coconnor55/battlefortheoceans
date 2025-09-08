// src/context/GameContext.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext } from 'react';
import StateMachine from '../classes/StateMachine';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const stateMachine = StateMachine.getInstance();

  return (
    <GameContext.Provider value={{ stateMachine }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);

// EOF - EOF - EOF
