// src/pages/PlayingPage.js (v0.1.4)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import useGameState from '../hooks/useGameState';
import BattleBoard from '../components/BattleBoard';
import './PlayingPage.css';

const version = 'v0.1.4';

const PlayingPage = ({ gameMode = 'turnBased' }) => {
  const {
    gameState,
    gameBoard,
    eraConfig,
    selectedOpponent,
    fireShot,
    isShipSunk,
    isReady,
    error,
    battleBoardRef
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

  // Loading state with era-specific title
  if (!isReady) {
    return (
      <div className="playing-page loading">
        <div className="loading-message">
          <h2>{eraConfig?.name || 'Battle Waters'}</h2>
          <p>Preparing battle boards...</p>
        </div>
      </div>
    );
  }

  // Enhanced game state with additional methods
  const enhancedGameState = {
    ...gameState,
    isShipSunk,
    battleBoardRef
  };

  return (
    <div className="playing-page">
      <div className="game-header">
        <h2>{eraConfig?.name || 'Battle Waters'}</h2>
        <div className="opponent-info">
          <p>vs {selectedOpponent?.name || 'Unknown Opponent'}</p>
        </div>
        <div className="game-stats">
          <span className="player-hits">Your Hits: {gameState.playerHits}</span>
          <span className="opponent-hits">Enemy Hits: {gameState.opponentHits}</span>
        </div>
      </div>
      
      <BattleBoard
        eraConfig={eraConfig}
        gameState={enhancedGameState}
        gameBoard={gameBoard}
        onShotFired={fireShot}
      />
      
      <div className="game-message">
        <p>{gameState.message}</p>
      </div>
    </div>
  );
};

export default PlayingPage;

// EOF - EOF - EOF
