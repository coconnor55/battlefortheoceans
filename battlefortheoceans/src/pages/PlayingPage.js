// src/pages/PlayingPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState } from 'react';
import useGameState from '../hooks/useGameState';
import BattleBoard from '../components/BattleBoard';
import './PlayingPage.css';

const version = 'v0.1.6';

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
    battleBoardRef,
    messageLog,
    dispatch,
    stateMachine
  } = useGameState(gameMode);

  const [showMessageLog, setShowMessageLog] = useState(false);

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

  // Format message log for display/export
  const formatMessageLog = () => {
    const header = `Game Log: ${eraConfig?.name || 'Battleship'}\n` +
                   `Opponent: ${selectedOpponent?.name || 'Unknown'}\n` +
                   `Date: ${new Date().toISOString()}\n\n`;
    
    const entries = messageLog.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `[${time}] ${entry.turn.toUpperCase()}: ${entry.message}`;
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

  // Email message log (opens default email client)
  const emailMessageLog = () => {
    const logText = formatMessageLog();
    const subject = encodeURIComponent(`Battleship Game Log - ${eraConfig?.name || 'Game'}`);
    const body = encodeURIComponent(logText);
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
  };

  // Handle manual game over transition
  const handleGameOver = () => {
    if (dispatch && stateMachine) {
      dispatch(stateMachine.event.OVER);
    }
  };

  // Game Over state - show final board with controls
  if (!gameState.isGameActive) {
    return (
      <div className="playing-page game-over">
        <div className="game-header">
          <h2>{eraConfig?.name || 'Battle Waters'}</h2>
          <div className="opponent-info">
            <p>vs {selectedOpponent?.name || 'Unknown Opponent'}</p>
          </div>
        </div>
        
        <BattleBoard
          eraConfig={eraConfig}
          gameState={enhancedGameState}
          gameBoard={gameBoard}
          onShotFired={() => null} // Disable shooting
        />
        
        <div className="game-over-controls">
          <div className="game-message final">
            <p><strong>{gameState.message}</strong></p>
            <p>Final Score - Your Hits: {gameState.playerHits} | Enemy Hits: {gameState.opponentHits}</p>
          </div>
          
          <div className="game-over-buttons">
            <button 
              className="log-button" 
              onClick={() => setShowMessageLog(!showMessageLog)}
            >
              {showMessageLog ? 'Hide' : 'Show'} Message Log
            </button>
            
            <button className="copy-button" onClick={copyMessageLog}>
              Copy Log
            </button>
            
            <button className="email-button" onClick={emailMessageLog}>
              Email Log
            </button>
            
            <button className="continue-button primary" onClick={handleGameOver}>
              Continue
            </button>
          </div>
        </div>

        {showMessageLog && (
          <div className="message-log-display">
            <h3>Game Message Log</h3>
            <div className="log-content">
              {messageLog.map((entry, index) => (
                <div key={index} className={`log-entry ${entry.type}`}>
                  <span className="log-time">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="log-turn">[{entry.turn.toUpperCase()}]</span>
                  <span className="log-message">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active game state
  return (
    <div className="playing-page">
      <div className="game-header">
        <h2>{eraConfig?.name || 'Battle Waters'}</h2>
        <div className="opponent-info">
          <p>vs {selectedOpponent?.name || 'Unknown Opponent'}</p>
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
// EOF
