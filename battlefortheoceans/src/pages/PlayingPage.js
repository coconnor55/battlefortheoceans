// src/pages/PlayingPage.js v0.3.6
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.6: Removed inline style from AutoPlay button

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import CanvasBoard from '../components/CanvasBoard';

const version = 'v0.3.6';

const PlayingPage = () => {
  const {
    dispatch,
    events,
    gameInstance,
    eraConfig,
    selectedOpponent,
    humanPlayer,
    board,
    userProfile,
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
  
  // Redirect to login if no user profile
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);
  
  // Ref for CanvasBoard to receive opponent shots
  const canvasBoardRef = useRef(null);
  
  // Force re-render trigger for observer pattern
  const [, setRenderTrigger] = useState(0);
  
  // AutoPlay state (hidden feature for testing)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const autoPlayTimerRef = useRef(null);
  
    // Check if user has AutoPlay privileges (admin, developer, or tester roles)
      const canUseAutoPlay = ['admin', 'developer', 'tester'].includes(userProfile?.role);
    
  // Set battle board ref in game instance for opponent shot notifications
  useEffect(() => {
    if (gameInstance && canvasBoardRef.current) {
      gameInstance.setBattleBoardRef(canvasBoardRef);
      console.log(version, 'Battle board ref set in game instance');
    }
  }, [gameInstance]);

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

  // AutoPlay logic - fires at random valid targets
  // v0.3.5: Get humanPlayer directly from game instance to ensure same object reference
  const fireRandomShot = useCallback(() => {
    if (!gameInstance || !isPlayerTurn || !isGameActive) {
      return;
    }

    // Get the human player from the game instance (not from context)
    // This ensures we're using the same Player object that has missedShots Set
    const humanPlayerFromGame = gameInstance.players.find(p => p.type === 'human');
    if (!humanPlayerFromGame) {
      console.log(version, 'AutoPlay: No human player found in game instance');
      return;
    }

    // Get all valid targets using Game's validation logic
    // This includes checking shot history and ship health
    const validTargets = [];
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        // Use Game's isValidAttack with the actual Player object from game
        if (gameInstance.isValidAttack(row, col, humanPlayerFromGame)) {
          validTargets.push({ row, col });
        }
      }
    }

    if (validTargets.length === 0) {
      console.log(version, 'AutoPlay: No valid targets remaining');
      setAutoPlayEnabled(false);
      return;
    }

    // Pick random target
    const randomIndex = Math.floor(Math.random() * validTargets.length);
    const target = validTargets[randomIndex];
    
    console.log(version, 'AutoPlay firing at', target, `(${validTargets.length} targets remaining)`);
    handleShotFired(target.row, target.col);
  }, [gameInstance, isPlayerTurn, isGameActive, eraConfig, handleShotFired]);

  // AutoPlay timer effect - triggers on turn changes
  useEffect(() => {
    // Clear any existing timer
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    // If autoplay enabled, game active, and player's turn
    if (autoPlayEnabled && isGameActive && isPlayerTurn) {
      autoPlayTimerRef.current = setTimeout(() => {
        fireRandomShot();
      }, 200); // 200ms delay between shots
    }

    // Cleanup on unmount or when autoplay disabled
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayEnabled, isGameActive, isPlayerTurn, fireRandomShot, battleMessage]); // Add battleMessage to retrigger after each shot

  // Disable autoplay when game ends
  useEffect(() => {
    if (!isGameActive) {
      setAutoPlayEnabled(false);
    }
  }, [isGameActive]);

  // Toggle autoplay
  const handleAutoPlayToggle = () => {
    setAutoPlayEnabled(prev => !prev);
    console.log(version, 'AutoPlay toggled:', !autoPlayEnabled);
  };

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

  // Don't render if no userProfile (will redirect)
  if (!userProfile) {
    return null;
  }

  // Loading state - no game instance yet
  if (!gameInstance || !gameBoard) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <h2>{eraConfig?.name}</h2>
            <p>Preparing battle boards...</p>
          </div>
        </div>
      </div>
    );
  }

  // Active game state - using CanvasBoard
  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header text-center">
          <h2 className="card-title">{eraConfig?.name}</h2>
        </div>
        
        <div className="game-board-container">
          <CanvasBoard
            ref={canvasBoardRef}
            mode="battle"
            eraConfig={eraConfig}
            gameBoard={gameBoard}
            gameInstance={gameInstance}
            gameState={gameState}
            onShotFired={handleShotFired}
          />
        </div>
        
        {/* Hit statistics - inline between board and console */}
        <div className="game-stats">
          <span className="stat-inline">Your Hits: {playerHits || 0}</span>
          <span className="stat-inline">Enemy Hits: {opponentHits || 0}</span>
          {/* AutoPlay toggle - only visible for testing account */}
          {canUseAutoPlay && isGameActive && (
            <button
              className={`btn btn--sm autoplay-toggle ${autoPlayEnabled ? 'btn--warning' : 'btn--secondary'}`}
              onClick={handleAutoPlayToggle}
            >
              {autoPlayEnabled ? '⏸ Stop AutoPlay' : '▶ AutoPlay'}
            </button>
          )}
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
