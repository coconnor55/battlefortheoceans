// src/pages/PlayingPage.js v0.5.3
// Copyright(c) 2025, Clint H. O'Connor
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
import InfoButton from '../components/InfoButton';
import GameGuide from '../components/GameGuide';
import VideoPopup from '../components/VideoPopup';

const version = 'v0.5.3';

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
    handleAttack,
    starShellsRemaining,
    handleStarShellFired
  } = useGameState();
  
  // Video system (v0.5.0)
  const { showVideo, currentVideo, handleVideoComplete } = useVideoTriggers(gameInstance, eraConfig);
  
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
  
  // Get opponent player(s) for fleet sidebar
  const opponentPlayers = gameInstance?.players?.filter(p => p.id !== humanPlayer?.id) || [];
  
  // Build opponent fleet data for multi-fleet display
  const opponentFleetData = opponentPlayers.map(player => {
    // Try to get captain name from player name or selectedOpponent
    let captainName = player.name;
    
    // For Pirates era, extract captain name from AI player
    if (eraConfig?.era === 'pirates' && selectedOpponent) {
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
    console.log(version, 'Player shot fired at', { row, col });
    const result = handleAttack(row, col);
    return { result, row, col };
  }, [handleAttack]);
  
  const onStarShellFired = useCallback((row, col) => {
    console.log(version, 'Star shell fired at', { row, col });
    handleStarShellFired(row, col);
  }, [handleStarShellFired]);
  
  // v0.5.1: AutoPlay testing utility extracted to hook
  const { autoPlayEnabled, canUseAutoPlay, handleAutoPlayToggle } = useAutoPlay({
    gameInstance,
    eraConfig,
    isPlayerTurn,
    isGameActive,
    handleShotFired,
    userProfile,
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
        
        {/* v0.5.2: GameGuide replaces InfoPanel with static content */}
        <GameGuide
          section="battle"
          manualOpen={showInfo}
          onClose={() => setShowInfo(false)}
          eraName={eraConfig?.name}
        />

        <div className="content-pane content-pane--wide">
          <div className="card-header text-center">
            <h2 className="card-title">{eraConfig?.name}</h2>
          </div>
          
          <div className="battle-board-layout">
            <FleetStatusSidebar
              fleet={humanPlayer?.fleet}
              title="Home"
              starShellsRemaining={starShellsRemaining}
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
                starShellsRemaining={starShellsRemaining}
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
