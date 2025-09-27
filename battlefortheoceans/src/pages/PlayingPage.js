// src/pages/PlayingPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import FleetBattle from '../components/FleetBattle';

const version = 'v0.2.8';

const PlayingPage = () => {
  const {
    gameInstance,
    eraConfig,
    selectedOpponent,
    humanPlayer,
    board,
    subscribeToUpdates
  } = useGame();
  
  const {
    isPlayerTurn,
    currentPlayer,
    battleMessage,
    uiMessage,
    playerHits,
    opponentHits,
    isGameActive,
    gamePhase,
    winner,
    gameBoard,
    gameMode,
    handleAttack
  } = useGameState();
  
  // Force re-render trigger for observer pattern
  const [, setRenderTrigger] = useState(0);

  // Stable shot handler to prevent retriggering
  const handleShotFired = useCallback((row, col) => {
    // Only allow shots during player turn
    if (!isPlayerTurn || !isGameActive) {
      console.log(version, 'Shot blocked - not player turn or game inactive');
      return false;
    }
    
    console.log(version, 'Player shot fired at', { row, col });
    return handleAttack(row, col);
  }, [isPlayerTurn, isGameActive, handleAttack]);

  // Subscribe to game logic updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

  // Memoized game state to prevent unnecessary re-renders
  const gameState = React.useMemo(() => ({
    isPlayerTurn,
    currentPlayer,
    battleMessage,
    uiMessage,
    playerHits,
    opponentHits,
    isGameActive,
    gamePhase,
    winner,
    userId: humanPlayer?.id
  }), [isPlayerTurn, currentPlayer, battleMessage, uiMessage, playerHits, opponentHits, isGameActive, gamePhase, winner, humanPlayer?.id]);

  // Loading state - no game instance yet
  if (!gameInstance || !gameBoard) {
    return (
      <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
        <div className="content-pane content-pane-narrow">
          <div className="loading">
            <div className="spinner spinner-lg"></div>
            <h2>{eraConfig?.name}</h2>
            <p>Preparing battle boards...</p>
          </div>
        </div>
      </div>
    );
  }

  // Active game state - using Canvas-based FleetBattle
  return (
    <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
      <div className="content-pane content-pane-wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header" style={{ textAlign: 'center' }}>
          <h2 className="card-title">{eraConfig?.name}</h2>
        </div>
        
        <div className="game-board-container">
          <FleetBattle
            eraConfig={eraConfig}
            gameState={gameState}
            gameBoard={gameBoard}
            onShotFired={handleShotFired}
          />
        </div>
        
        {/* Hit statistics - inline between board and console */}
        <div className="game-stats">
          <span className="stat-inline">Your Hits: {playerHits || 0}</span>
          <span className="stat-inline">Enemy Hits: {opponentHits || 0}</span>
        </div>
        
        {/* Consolidated message console - UI message on top, battle message below */}
        <div className="message-consoles">
          <div className="console-combined">
            <div className="console-header">Messages</div>
            <div className="console-content-combined">
              <div className="ui-message">
                {uiMessage || 'Preparing for battle...'}
              </div>
              <div className="message-divider"></div>
              <div className="battle-message">
                {battleMessage || 'Awaiting battle action...'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayingPage;
// EOF
