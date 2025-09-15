// src/context/GameContext.js (v0.1.12)
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useState, useEffect } from 'react';
import { StateMachine } from '../classes/StateMachine';
import { supabase } from '../utils/supabaseClient';

const GameState = createContext();

const gameStateMachine = new StateMachine();
let contextVersion = 0;

export const GameProvider = ({ children }) => {
  const [version, setVersion] = useState(contextVersion);
  
  // Game state data
  const [gameState, setGameState] = useState({
    playerId: null,
    player: null,
    selectedEra: null,
    selectedOpponent: null,
    eraConfig: null,
    board: null,
    fleet: null,
    gameId: null
  });

  // Listen for auth state changes to capture playerId
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('GameContext: Auth state changed:', event, session?.user?.id);
      if (session?.user) {
        setGameState(prev => ({
          ...prev,
          playerId: session.user.id,
          player: {
            id: session.user.id,
            email: session.user.email,
            isGuest: session.user.email === process.env.REACT_APP_GUEST_EMAIL
          }
        }));
      } else {
        setGameState(prev => ({
          ...prev,
          playerId: null,
          player: null
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const dispatch = (event) => {
    console.log('v0.1.12: Dispatching event to state machine', event);
    gameStateMachine.transition(event);
    contextVersion += 1;
    setVersion(contextVersion); // Force context value change
  };

  // Game state update functions
  const updateGameState = (updates) => {
    console.log('GameContext: Updating game state:', updates);
    setGameState(prev => ({ ...prev, ...updates }));
  };

  const setSelectedEra = (era, opponent) => {
    console.log('GameContext: Setting selected era and opponent:', era?.name, opponent?.name);
    updateGameState({
      selectedEra: era,
      selectedOpponent: opponent,
      eraConfig: era ? {
        rows: era.rows,
        cols: era.cols,
        terrain: era.terrain,
        ships: era.ships
      } : null
    });
  };

  const clearGameData = () => {
    console.log('GameContext: Clearing game data for new game');
    updateGameState({
      selectedEra: null,
      selectedOpponent: null,
      eraConfig: null,
      board: null,
      fleet: null,
      gameId: null
    });
  };

  const setBoard = (board) => {
    updateGameState({ board });
  };

  const setFleet = (fleet) => {
    updateGameState({ fleet });
  };

  const contextValue = {
    stateMachine: gameStateMachine,
    dispatch,
    version,
    // Game state
    gameState,
    playerId: gameState.playerId,
    player: gameState.player,
    selectedEra: gameState.selectedEra,
    selectedOpponent: gameState.selectedOpponent,
    eraConfig: gameState.eraConfig,
    board: gameState.board,
    fleet: gameState.fleet,
    // State update functions
    updateGameState,
    setSelectedEra,
    clearGameData,
    setBoard,
    setFleet
  };

  return (
    <GameState.Provider value={contextValue}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameState);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

// EOF - EOF - EOF
