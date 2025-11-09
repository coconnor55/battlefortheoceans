// src/pages/PlayingPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.5.6: Complete munitions refactoring - remove backward compatibility wrapper
//         - Changed onStarShellFired to use fireMunition('starShell', row, col)
//         - Removed dependency on handleStarShellFired
//         - Completes munitions terminology rename started in v0.5.3
// v0.5.5: Added error handling to handleShotFired for AutoPlay debugging
//         - Wraps handleAttack in try/catch
//         - Logs any errors that might be swallowed
//         - Returns error result to prevent AutoPlay from hanging
// v0.5.4: Moved GameGuide to App.js, removed setShowInfo and InfoButton
// v0.5.3: Munitions terminology rename (resources → munitions)
//         - No code changes needed - reads from useGameState hook
//         - Hook now provides munitions data (was resources)
//         - Aligns with Game.js v0.8.8, CoreEngine.js v0.6.10, useGameState v0.3.2
// v0.5.2: REFACTOR - Replaced InfoPanel with GameGuide component
//         - Removed ~100 lines of instruction content
//         - GameGuide auto-shows on first visit to battle section
//         - Instructions now centralized in GameGuide.js
//         - Reduced from ~290 lines to ~190 lines
// v0.5.1: REFACTOR - Extracted autoplay logic to useAutoPlay hook
//         - Removed autoplay state and timer management (~50 lines)
//         - Now uses useAutoPlay hook for testing utility
//         - Testing/debug code properly isolated from gameplay
//         - Reduced from ~340 lines to ~290 lines
// v0.5.0: REFACTOR - Extracted video logic to useVideoTriggers hook
//         - Removed video state (showVideo, currentVideo)
//         - Removed video callback setup code
//         - Now uses useVideoTriggers hook for all video management
//         - Reduced from ~380 lines to ~340 lines
//         - Video system now reusable across components

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import useVideoTriggers from '../hooks/useVideoTriggers';
import useAutoPlay from '../hooks/useAutoPlay';
import CanvasBoard from '../components/CanvasBoard';
import FleetStatusSidebar from '../components/FleetStatusSidebar';
import VideoPopup from '../components/VideoPopup';

const version = 'v0.5.6';

const PlayingPage = () => {
  const {
    dispatch,
    events,
    gameInstance,
    eraConfig,
    selectedOpponent,
    humanPlayer,
    board,
    playerProfile,
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
    handleAttack,
    munitions,
    fireMunition
  } = useGameState();
  
  // Video system (v0.5.0)
  const { showVideo, currentVideo, handleVideoComplete } = useVideoTriggers(gameInstance, eraConfig);
  
  const [viewMode, setViewMode] = useState('blended');
  
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
    if (!playerProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [playerProfile, dispatch, events]);
  
  const canvasBoardRef = useRef(null);
  
  const [, setRenderTrigger] = useState(0);
  
  // Get opponent player(s) for fleet sidebar
  const opponentPlayers = gameInstance?.players?.filter(p => p.id !== humanPlayer?.id) || [];
  
  // Build opponent fleet data for multi-fleet display
  const opponentFleetData = opponentPlayers.map(player => {
    // Try to get captain name from player name or selectedOpponent
    let captainName = player.name;
    
    // For Pirates era, extract captain name from AI player
    if (eraConfig?.id === 'pirates' && selectedOpponent) {
      // selectedOpponent might be an array of opponents
      const opponentsList = Array.isArray(selectedOpponent) ? selectedOpponent : [selectedOpponent];
      const matchingOpponent = opponentsList.find(opp =>
        opp.ai_captain?.name === player.name || opp.ai_captain?.id === player.id
      );
      
      if (matchingOpponent?.ai_captain?.name) {
        captainName = matchingOpponent.ai_captain.name;
      }
    }
    
    return {
      player,
      captainName
    };
  });
  
  // Set battle board ref (video callbacks handled by useVideoTriggers)
  useEffect(() => {
    if (gameInstance && canvasBoardRef.current) {
      gameInstance.setBattleBoardRef(canvasBoardRef);
      console.log(version, 'Battle board ref set in game instance');
    }
  }, [gameInstance]);

  const handleShotFired = useCallback((row, col) => {
    console.log('[ATTACK]', version, 'Player shot fired at', { row, col });
    
    try {
      const result = handleAttack(row, col);
      
      if (!result) {
        console.error('[ATTACK]', version, 'handleAttack returned falsy result:', result);
        return { result: 'error', row, col, error: 'No result from handleAttack' };
      }
      
      console.log('[ATTACK]', version, 'Shot completed successfully:', result.result);
      return { result, row, col };
      
    } catch (error) {
      console.error('[ATTACK]', version, 'ERROR in handleShotFired:', error);
      console.error('[ATTACK]', version, 'Error stack:', error.stack);
      return { result: 'error', row, col, error: error.message };
    }
  }, [handleAttack]);
  
  const onStarShellFired = useCallback((row, col) => {
    console.log('[MUNITIONS]', version, 'Star shell fired at', { row, col });
    fireMunition('starShell', row, col);
  }, [fireMunition]);
  
  // v0.5.1: AutoPlay testing utility extracted to hook
  const { autoPlayEnabled, canUseAutoPlay, handleAutoPlayToggle } = useAutoPlay({
    gameInstance,
    eraConfig,
    isPlayerTurn,
    isGameActive,
    handleShotFired,
    playerProfile,
    battleMessage
  });

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
    playerId: humanPlayer?.id
  }), [isPlayerTurn, currentPlayer, battleMessage, uiMessage, playerHits, opponentHits, isGameActive, gamePhase, winner, humanPlayer?.id]);

  if (!playerProfile) {
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

        <div className="content-pane content-pane--wide">
          <div className="card-header text-center">
            <h2 className="card-title">{eraConfig?.name}</h2>
          </div>
          
          <div className="battle-board-layout">
            <FleetStatusSidebar
              fleet={humanPlayer?.fleet}
              title="Home"
              munitions={munitions}
            />
            
            <div className="game-board-container">
              {showVideo && currentVideo && (
                <VideoPopup
                  videoSrc={currentVideo}
                  onComplete={handleVideoComplete}
                />
              )}
              
              <CanvasBoard
                ref={canvasBoardRef}
                mode="battle"
                viewMode={viewMode}
                eraConfig={eraConfig}
                gameBoard={gameBoard}
                gameInstance={gameInstance}
                gameState={gameState}
                onShotFired={handleShotFired}
                onStarShellFired={onStarShellFired}
                humanPlayer={humanPlayer}
              />
            </div>
            
            <FleetStatusSidebar
              fleets={opponentFleetData}
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
