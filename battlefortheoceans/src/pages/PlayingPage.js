// src/pages/PlayingPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import FleetBattle from '../components/FleetBattle';
import './Pages.css';
import './PlayingPage.css';

const version = 'v0.1.11';

// Battle version of FleetPlacement-style grid
const BattleGrid = ({ board, gameState, eraConfig, onShotFired, humanPlayer }) => {
  const { gameInstance } = useGame();

  const getCellClass = (row, col) => {
    const terrain = eraConfig.terrain[row][col];
    let classes = [`cell`, `terrain-${terrain}`];
    
    // Show your own ships (like in placement)
    if (gameInstance && gameInstance.shipOwnership && humanPlayer) {
      try {
        const shipDataArray = board.getShipDataAt(row, col);
        if (shipDataArray && shipDataArray.length > 0) {
          const hasPlayerShip = shipDataArray.some(shipData => {
            const ownerId = gameInstance.shipOwnership.get(shipData.shipId);
            return ownerId === humanPlayer.id;
          });
          
          if (hasPlayerShip) {
            classes.push('has-ship');
          }
        }
      } catch (error) {
        console.warn(version, 'Error checking ship data at', row, col);
      }
    }

    // Show attack results using Board's shot history
    if (board) {
      const shotHistory = board.getShotHistory(row, col);
      if (shotHistory.length > 0) {
        // Get the most recent shot
        const lastShot = shotHistory[shotHistory.length - 1];
        const isPlayerShot = lastShot.attacker === humanPlayer?.name;
        
        switch (lastShot.result) {
          case 'hit':
            classes.push(isPlayerShot ? 'your-hit' : 'enemy-hit');
            break;
          case 'sunk':
            classes.push(isPlayerShot ? 'your-sunk' : 'enemy-sunk');
            break;
          case 'miss':
            classes.push(isPlayerShot ? 'your-miss' : 'enemy-miss');
            break;
          case 'blocked':
            classes.push(isPlayerShot ? 'your-blocked' : 'enemy-blocked');
            break;
        }
        
        // Add timing class for enemy shots (for fade effect)
        if (!isPlayerShot) {
          const timeSinceShot = Date.now() - lastShot.timestamp;
          if (timeSinceShot < 2000) { // Show for 2 seconds
            classes.push('enemy-recent');
          }
        }
      }
    }
    
    return classes.join(' ');
  };

  const handleCellClick = (row, col) => {
    if (gameState.isPlayerTurn && gameState.isGameActive && onShotFired) {
      onShotFired(row, col);
    }
  };

  return (
    <div className="battle-grid">
      <div
        className="board-grid"
        style={{
          gridTemplateRows: `repeat(${eraConfig.rows}, 1fr)`,
          gridTemplateColumns: `repeat(${eraConfig.cols}, 1fr)`
        }}
      >
        {Array.from({ length: eraConfig.rows }, (_, row) =>
          Array.from({ length: eraConfig.cols }, (_, col) => (
            <div
              key={`${row}-${col}`}
              className={getCellClass(row, col)}
              data-row={row}
              data-col={col}
              onClick={() => handleCellClick(row, col)}
              style={{
                cursor: gameState.isPlayerTurn && gameState.isGameActive ? 'crosshair' : 'default'
              }}
            >
              <span className="cell-coord">{String.fromCharCode(65 + col)}{row + 1}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const PlayingPage = () => {
  const {
    gameInstance,
    eraConfig,
    selectedOpponent,
    dispatch,
    stateMachine,
    humanPlayer,
    board,
    uiVersion  // Use gameLogic
  } = useGame();
  
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

  // Enhanced game state for battle grid
  const gameState = {
    isPlayerTurn,
    currentPlayer,
    message,
    playerHits,
    opponentHits,
    isGameActive,
    gamePhase,
    winner,
    userId: humanPlayer?.id
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
              <BattleGrid
                board={gameBoard}
                gameState={gameState}
                eraConfig={eraConfig}
                onShotFired={null} // Disable shooting
                humanPlayer={humanPlayer}
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
            <BattleGrid
              board={gameBoard}
              gameState={gameState}
              eraConfig={eraConfig}
              onShotFired={handleAttack}
              humanPlayer={humanPlayer}
            />
          </div>
          
          <div className="message-console">
            <p>{message}</p>
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
