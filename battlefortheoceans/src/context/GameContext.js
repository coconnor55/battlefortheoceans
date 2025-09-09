// src/context/GameContext.js (v0.1.11)
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useState } from 'react';
import { StateMachine } from '../classes/StateMachine';

const GameState = createContext();

const gameStateMachine = new StateMachine();
let contextVersion = 0;

export const GameProvider = ({ children }) => {
  const [version, setVersion] = useState(contextVersion);

  const dispatch = (event) => {
    console.log('v0.1.11: Dispatching event to state machine', event);
    gameStateMachine.transition(event);
    contextVersion += 1;
    setVersion(contextVersion); // Force context value change
  };

  return (
    <GameState.Provider value={{ stateMachine: gameStateMachine, dispatch, version }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// EOF - EOF - EOF
