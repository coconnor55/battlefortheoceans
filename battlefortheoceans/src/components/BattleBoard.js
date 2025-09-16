// src/components/BattleBoard.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useEffect } from 'react';
import useBattleBoard from '../hooks/useBattleBoard';

const version = 'v0.1.4'
const BattleBoard = ({ eraConfig, gameState, gameBoard, onShotFired }) => {
  const {
    canvasRef,
    handleCanvasClick,
    recordOpponentShot,
    isReady
  } = useBattleBoard(eraConfig, gameState, gameBoard);

  // Connect battle board to game state for opponent shot tracking
  useEffect(() => {
    if (gameState.battleBoardRef) {
      gameState.battleBoardRef.current = { recordOpponentShot };
    }
  }, [recordOpponentShot, gameState.battleBoardRef]);

  if (!isReady) {
    return (
      <div className="battle-board loading">
        <p>Preparing battle board...</p>
      </div>
    );
  }

  return (
    <div className="battle-board">
      <canvas
        ref={canvasRef}
        onClick={(e) => handleCanvasClick(e, onShotFired)}
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
          background: 'white',
          cursor: gameState.isPlayerTurn && gameState.isGameActive ? 'crosshair' : 'not-allowed'
        }}
      />

      <div className="visual-legend">
        <div className="legend-item">
          <div className="legend-color red-hit"></div>
          <span>Your hits</span>
        </div>
        <div className="legend-item">
          <div className="legend-color blue-hit"></div>
          <span>Enemy hits</span>
        </div>
        <div className="legend-item">
          <div className="legend-color grey-miss"></div>
          <span>Your misses</span>
        </div>
      </div>
    </div>
  );
};

export default BattleBoard;
// EOF
