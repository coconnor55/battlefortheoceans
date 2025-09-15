// src/pages/PlayingPage.js (v0.1.1)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import useGameState from '../hooks/useGameState';
import BattleBoard from '../components/BattleBoard';
import GameInfo from '../components/GameInfo';
import './PlayingPage.css';

const version = 'v0.1.1';

const PlayingPage = ({ gameMode = 'turnBased' }) => {
  const {
    gameState,
    opponentBoard,
    playerBoard,
    eraConfig,
    selectedOpponent,
    fireShot,
    isShipSunk,
    isReady,
    error
  } = useGameState(gameMode);

  // Error state - player session lost
  if (error) {
    return (
      <div className="playing-page error">
        <div className="error-message">
          <h2>Session Error</h2>
          <p>{gameState.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Game
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isReady) {
    return (
      <div className="playing-page loading">
        <div className="loading-message">
          <p>Preparing battle...</p>
        </div>
      </div>
    );
  }

  // Prepare board data for components
  const boards = {
    opponentBoard,
    playerBoard
  };

  // Enhanced game state with additional methods
  const enhancedGameState = {
    ...gameState,
    isShipSunk
  };

  return (
    <div className="playing-page">
      <GameInfo
        gameState={enhancedGameState}
        eraConfig={eraConfig}
        selectedOpponent={selectedOpponent}
      />
      
      <BattleBoard
        eraConfig={eraConfig}
        gameState={enhancedGameState}
        boards={boards}
        onShotFired={fireShot}
      />
    </div>
  );
};

export default PlayingPage;

// EOF - EOF - EOF
