// src/pages/PlayingPage.js v0.3.12
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.12: Removed inline styles for fleet sidebar layout - now uses CSS classes
// v0.3.11: Added fleet status sidebars (Home/Enemy) showing ship status
// v0.3.10: Added InfoButton and InfoPanel with battle instructions

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import CanvasBoard from '../components/CanvasBoard';
import FleetStatusSidebar from '../components/FleetStatusSidebar';
import InfoButton from '../components/InfoButton';
import InfoPanel from '../components/InfoPanel';

const version = 'v0.3.12';

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
  
  const [viewMode, setViewMode] = useState('blended');
  const [showInfo, setShowInfo] = useState(false);
  
  // Warn user before leaving page (refresh/close/navigate away)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);
  
  const canvasBoardRef = useRef(null);
  
  const [, setRenderTrigger] = useState(0);
  
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const autoPlayTimerRef = useRef(null);
  
  const canUseAutoPlay = ['admin', 'developer', 'tester'].includes(userProfile?.role);
  
  // Get opponent player for fleet sidebar
  const opponentPlayer = gameInstance?.players?.find(p => p.id !== humanPlayer?.id);
  
  useEffect(() => {
    if (gameInstance && canvasBoardRef.current) {
      gameInstance.setBattleBoardRef(canvasBoardRef);
      console.log(version, 'Battle board ref set in game instance');
    }
  }, [gameInstance]);

  const handleShotFired = useCallback((row, col) => {
    if (!isPlayerTurn || !isGameActive) {
      console.log(version, 'Shot blocked - not player turn or game inactive');
      return false;
    }
    
    console.log(version, 'Player shot fired at', { row, col });
    const result = handleAttack(row, col);
    
    return { result, row, col };
  }, [isPlayerTurn, isGameActive, handleAttack]);
  
  const fireRandomShot = useCallback(() => {
    if (!gameInstance || !isPlayerTurn || !isGameActive) {
      return;
    }

    const humanPlayerFromGame = gameInstance.players.find(p => p.type === 'human');
    if (!humanPlayerFromGame) {
      console.log(version, 'AutoPlay: No human player found in game instance');
      return;
    }

    const validTargets = [];
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
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

    const randomIndex = Math.floor(Math.random() * validTargets.length);
    const target = validTargets[randomIndex];
    
    console.log(version, 'AutoPlay firing at', target, `(${validTargets.length} targets remaining)`);
    handleShotFired(target.row, target.col);
  }, [gameInstance, isPlayerTurn, isGameActive, eraConfig, handleShotFired]);

  useEffect(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    if (autoPlayEnabled && isGameActive && isPlayerTurn) {
      autoPlayTimerRef.current = setTimeout(() => {
        fireRandomShot();
      }, 200);
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayEnabled, isGameActive, isPlayerTurn, fireRandomShot, battleMessage]);

  useEffect(() => {
    if (!isGameActive) {
      setAutoPlayEnabled(false);
    }
  }, [isGameActive]);

  const handleAutoPlayToggle = () => {
    setAutoPlayEnabled(prev => !prev);
    console.log(version, 'AutoPlay toggled:', !autoPlayEnabled);
  };

  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

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

  if (!userProfile) {
    return null;
  }

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

  return (
    <div className="container flex flex-column flex-center">
      <div className="page-with-info">
        <InfoButton onClick={() => setShowInfo(true)} />
        
        <InfoPanel
          isOpen={showInfo}
          onClose={() => setShowInfo(false)}
          title="Battle Instructions"
        >
          <h4>Understanding the Board</h4>
          <p>
            The battle board shows a combined view of your fleet and attack results. Use the view mode buttons to change what you see.
          </p>

          <h4>View Modes</h4>
          <ul>
            <li><strong>Fleet View:</strong> Shows only your ships and where enemy has attacked you</li>
            <li><strong>Blended View:</strong> Shows both your ships and your attack results (default)</li>
            <li><strong>Attack View:</strong> Shows only your attacks on the enemy (hides your ships)</li>
          </ul>

          <h4>Board Symbols</h4>
          <ul>
            <li><strong>Blue ship outlines:</strong> Your fleet positions</li>
            <li><strong>Blue dots:</strong> Enemy's missed shots (Fleet view)</li>
            <li><strong>Gray dots:</strong> Your missed shots (Combined/Attack views)</li>
            <li><strong>Red slash:</strong> Your hits on enemy ships</li>
            <li><strong>Blue slash:</strong> Enemy hits on your ships</li>
            <li><strong>Crater icons:</strong> Ship damaged/sunk</li>
          </ul>

          <h4>Fleet Status Sidebars</h4>
          <ul>
            <li><strong>Left sidebar (Home):</strong> Your fleet status</li>
            <li><strong>Right sidebar (Enemy):</strong> Opponent fleet status</li>
            <li><strong>💀 Skull:</strong> Ship is sunk (crossed out)</li>
          </ul>

          <h4>How to Attack</h4>
          <ul>
            <li>Wait for your turn (check the message console)</li>
            <li>Click any unattacked cell on the grid</li>
            <li>Watch for hit/miss feedback and particle effects</li>
            <li>Repeat until all enemy ships are sunk!</li>
          </ul>

          <h4>Strategy Tips</h4>
          <ul>
            <li>After a hit, target adjacent cells to find the rest of the ship</li>
            <li>Ships are oriented horizontally or vertically (not diagonal)</li>
            <li>Terrain affects gameplay - check ship restrictions</li>
            <li>Track enemy attack patterns to predict their strategy</li>
          </ul>

          <h4>Game Stats</h4>
          <p>
            Below the board, you'll see:
          </p>
          <ul>
            <li><strong>Your Hits:</strong> Number of successful attacks you've made</li>
            <li><strong>Enemy Hits:</strong> Number of times enemy has hit your ships</li>
          </ul>
        </InfoPanel>

        <div className="content-pane content-pane--wide">
          <div className="card-header text-center">
            <h2 className="card-title">{eraConfig?.name}</h2>
          </div>
          
          <div className="battle-board-layout">
            <FleetStatusSidebar
              fleet={humanPlayer?.fleet}
              title="Home"
            />
            
            <div className="game-board-container">
              <CanvasBoard
                ref={canvasBoardRef}
                mode="battle"
                viewMode={viewMode}
                eraConfig={eraConfig}
                gameBoard={gameBoard}
                gameInstance={gameInstance}
                gameState={gameState}
                onShotFired={handleShotFired}
              />
            </div>
            
            <FleetStatusSidebar
              fleet={opponentPlayer?.fleet}
              title="Enemy"
            />
          </div>
          
          <div className="view-mode-controls">
            <button
              className={`view-mode-btn ${viewMode === 'fleet' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('fleet')}
            >
              FLEET VIEW
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'blended' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('blended')}
            >
              BLENDED VIEW
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'attack' ? 'view-mode-btn--active' : ''}`}
              onClick={() => setViewMode('attack')}
            >
              ATTACK VIEW
            </button>
          </div>
          
          <div className="game-stats">
            <span className="stat-inline">Your Hits: {playerHits || 0}</span>
            <span className="stat-inline">Enemy Hits: {opponentHits || 0}</span>
            {canUseAutoPlay && isGameActive && (
              <button
                className={`btn btn--sm autoplay-toggle ${autoPlayEnabled ? 'btn--warning' : 'btn--secondary'}`}
                onClick={handleAutoPlayToggle}
              >
                {autoPlayEnabled ? '⏸ Stop AutoPlay' : '▶ AutoPlay'}
              </button>
            )}
          </div>
          
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
    </div>
  );
};

export default PlayingPage;
// EOF
