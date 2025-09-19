// src/pages/PlayingPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import FleetBattle from '../components/FleetBattle';
import './Pages.css';
import './PlayingPage.css';

const version = 'v0.1.8';

const PlayingPage = () => {
  const { gameInstance, eraConfig, selectedOpponent, dispatch, stateMachine } = useGame();
  
  const {
    isPlayerTurn,
    currentPlayer,
    message,
    playerHits,
    opponentHits,
    isGameActive,
    gamePhase,
    winner,
    gameBoard,
    gameMode,
    userId,
    handleAttack
  } = useGameState();

  const [showMessageLog, setShowMessageLog] = useState(false);

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

  // Enhanced game state for FleetBattle
  const gameState = {
    isPlayerTurn,
    currentPlayer,
    message,
    playerHits,
    opponentHits,
    isGameActive,
    gamePhase,
    winner,
    userId
  };

  // Get message log from Game instance
  const messageLog = gameInstance.gameLog || [];

  // Format message log for display/export
  const formatMessageLog = () => {
    const header = `Game Log: ${eraConfig?.name || 'Battleship'}\n` +
                   `Opponent: ${selectedOpponent?.name || 'Unknown'}\n` +
                   `Date: ${new Date().toISOString()}\n\n`;
    
    const entries = messageLog.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `[${time}] Turn ${entry.turn}: ${entry.message}`;
    }).join('\n');
    
    return header + entries;
  };

  // Copy message log to clipboard
  const copyMessageLog = () => {
    const logText = formatMessageLog();
    navigator.clipboard.writeText(logText).then(() => {
      alert('Message log copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy log:', err);
      alert('Failed to copy log. Check console for details.');
    });
  };

  // Email message log
  const emailMessageLog = () => {
    const logText = formatMessageLog();
    const subject = encodeURIComponent(`Battleship Game Log - ${eraConfig?.name || 'Game'}`);
    const body = encodeURIComponent(logText);
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
  };

  // Handle game over transition
  const handleGameOver = () => {
    if (dispatch && stateMachine) {
      dispatch(stateMachine.event.OVER);
    }
  };

  // Game Over state
  if (!isGameActive) {
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
                onShotFired={() => null} // Disable shooting
              />
            </div>
            
            <div className="message-console">
              <p><strong>{message}</strong></p>
              <p>Final Score - Your Hits: {playerHits} | Enemy Hits: {opponentHits}</p>
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

  // Active game state
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
              onShotFired={handleAttack}
            />
          </div>
          
          <div className="message-console">
            <p>{message}</p>
          </div>
          
          <div className="game-stats">
            <div className="score">Your Hits: {playerHits}</div>
            <div className="score">Enemy Hits: {opponentHits}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayingPage;
// EOF
