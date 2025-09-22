// src/pages/PlayingPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import FleetBattle from '../components/FleetBattle';
import './Pages.css';
import './PlayingPage.css';

const version = 'v0.2.3';

const PlayingPage = () => {
  const {
    gameInstance,
    eraConfig,
    selectedOpponent,
    dispatch,
    stateMachine,
    humanPlayer,
    board,
    subscribeToUpdates
  } = useGame();
  
  const {
    isPlayerTurn,
    currentPlayer,
    battleMessage,      // NEW: Battle console message from Message system
    uiMessage,         // NEW: UI console message from Message system
    playerHits,
    opponentHits,
    isGameActive,
    gamePhase,
    winner,
    gameBoard,
    gameMode,
    handleAttack
  } = useGameState();

  const [showMessageLog, setShowMessageLog] = useState(false);
  
  // Force re-render trigger for observer pattern
  const [, setRenderTrigger] = useState(0);

  // FIXED: Move all useCallback hooks BEFORE any early returns
  
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

  // Format message log for display/export
  const formatMessageLog = useCallback(() => {
    const messageLog = gameInstance?.gameLog || [];
    const header = `Game Log: ${eraConfig?.name || 'Battleship'}\n` +
                   `Opponent: ${selectedOpponent?.name || 'Unknown'}\n` +
                   `Date: ${new Date().toISOString()}\n\n`;
    
    const entries = messageLog.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `[${time}] Turn ${entry.turn}: ${entry.message}`;
    }).join('\n');
    
    return header + entries;
  }, [eraConfig?.name, selectedOpponent?.name, gameInstance?.gameLog]);

  // Copy message log to clipboard
  const copyMessageLog = useCallback(() => {
    const logText = formatMessageLog();
    navigator.clipboard.writeText(logText).then(() => {
      alert('Message log copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy log:', err);
      alert('Failed to copy log. Check console for details.');
    });
  }, [formatMessageLog]);

  // Email message log
  const emailMessageLog = useCallback(() => {
    const logText = formatMessageLog();
    const subject = encodeURIComponent(`Battleship Game Log - ${eraConfig?.name || 'Game'}`);
    const body = encodeURIComponent(logText);
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
  }, [formatMessageLog, eraConfig?.name]);

  // Handle game over transition
  const handleGameOver = useCallback(() => {
    if (dispatch && stateMachine) {
      dispatch(stateMachine.event.OVER);
    }
  }, [dispatch, stateMachine]);

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
    battleMessage,      // NEW: Battle console message
    uiMessage,         // NEW: UI console message
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
      <div className="page-base">
        <div className="page-content">
          <div className="loading-message">
            <h2>{eraConfig?.name || 'Battle Waters'}</h2>
            <p>Preparing battle boards...</p>
          </div>
        </div>
      </div>
    );
  }

  // Get message log from Game instance
  const messageLog = gameInstance.gameLog || [];

  // Game Over state
  if (!isGameActive && gamePhase === 'finished') {
    return (
      <div className="page-base">
        <div className="page-content">
          <div className="content-frame">
            <div className="page-header">
              <h2>{eraConfig?.name || 'Battle Waters'}</h2>
              <p>vs {selectedOpponent?.name || 'Unknown Opponent'}</p>
            </div>
            
            <div className="game-board-container">
              <FleetBattle
                eraConfig={eraConfig}
                gameState={gameState}
                gameBoard={gameBoard}
                onShotFired={null} // Disable shooting
              />
            </div>
            
            <div className="message-consoles">
              <div className="console-battle">
                <div className="console-header">Battle Report</div>
                <div className="console-content">{battleMessage || 'Battle complete'}</div>
              </div>
              <div className="console-ui">
                <div className="console-header">Game Status</div>
                <div className="console-content">
                  {uiMessage || 'Game Over'} | Your Hits: {playerHits} | Enemy Hits: {opponentHits}
                </div>
              </div>
            </div>
            
            <div className="game-over-controls">
              <button
                className="btn btn-secondary"
                onClick={() => setShowMessageLog(!showMessageLog)}
              >
                {showMessageLog ? 'Hide' : 'Show'} Message Log
              </button>
              
              <button
                className="btn btn-warning"
                onClick={copyMessageLog}
              >
                Copy Log
              </button>
              
              <button
                className="btn btn-secondary"
                onClick={emailMessageLog}
              >
                Email Log
              </button>
              
              <button
                className="btn btn-primary"
                onClick={handleGameOver}
              >
                Continue
              </button>
            </div>

            {showMessageLog && (
              <div className="message-log-display">
                <h3>Game Message Log</h3>
                <div className="log-content">
                  {messageLog.map((entry, index) => (
                    <div key={index} className={`log-entry ${entry.type || 'info'}`}>
                      <span className="log-time">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="log-turn">[T{entry.turn || '0'}]</span>
                      <span className="log-message">{entry.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active game state - using Canvas-based FleetBattle
  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="page-header">
            <h2>{eraConfig?.name || 'Battle Waters'}</h2>
            <p>vs {selectedOpponent?.name || 'Unknown Opponent'}</p>
            <span className="game-mode">({gameMode?.name || 'Turn Based'})</span>
          </div>
          
          <div className="game-board-container">
            <FleetBattle
              eraConfig={eraConfig}
              gameState={gameState}
              gameBoard={gameBoard}
              onShotFired={handleShotFired}
            />
          </div>
          
          <div className="message-consoles">
            <div className="console-battle">
              <div className="console-header">Battle Report</div>
              <div className="console-content">{battleMessage || 'Awaiting battle action...'}</div>
            </div>
            <div className="console-ui">
              <div className="console-header">Turn Status</div>
              <div className="console-content">{uiMessage || 'Preparing for battle...'}</div>
            </div>
          </div>
          
          <div className="game-stats">
            <div className="score">Your Hits: {playerHits}</div>
            <div className="score">Enemy Hits: {opponentHits}</div>
          </div>

          <div className="battle-legend">
            <div className="legend-item">
              <div className="legend-icon has-ship"></div>
              <span>Your ships</span>
            </div>
            <div className="legend-item">
              <div className="legend-icon your-hit"></div>
              <span>Your hits</span>
            </div>
            <div className="legend-item">
              <div className="legend-icon enemy-hit"></div>
              <span>Enemy hits</span>
            </div>
            <div className="legend-item">
              <div className="legend-icon your-miss"></div>
              <span>Your misses</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayingPage;
// EOF
