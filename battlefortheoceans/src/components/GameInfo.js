// src/components/BattleBoard.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import useBattleBoard from '../hooks/useBattleBoard';

const BattleBoard = ({ eraConfig, gameState, boards, onShotFired }) => {
  const {
    canvasRef,
    handleCanvasClick,
    isReady
  } = useBattleBoard(eraConfig, gameState, boards);

  if (!isReady) {
    return (
      <div className="battle-board loading">
        <p>Preparing battle boards...</p>
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
      <div className="battle-instructions">
        <p>Click on the enemy waters (left board) to fire your shots!</p>
      </div>
    </div>
  );
};

export default BattleBoard;

// EOF - EOF - EOF
