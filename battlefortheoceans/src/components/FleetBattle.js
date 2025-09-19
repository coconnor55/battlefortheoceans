// src/components/FleetBattle.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import useBattleBoard from '../hooks/useBattleBoard';
import './FleetBattle.css';

const version = 'v0.1.8'

const FleetBattle = ({ eraConfig, gameState, gameBoard, onShotFired }) => {
  const { gameInstance } = useGame();
  
  const {
    canvasRef,
    handleCanvasClick,
    recordOpponentShot,
    isReady
  } = useBattleBoard(eraConfig, gameState, gameBoard, gameInstance);

  // Connect battle board to game state for opponent shot tracking
  useEffect(() => {
    if (gameState.battleBoardRef) {
      gameState.battleBoardRef.current = { recordOpponentShot };
    }
  }, [recordOpponentShot, gameState.battleBoardRef]);

  // Connect battle board to Game instance for AI shot visualization
  useEffect(() => {
    if (gameInstance && recordOpponentShot) {
      // Set up reference so Game can notify battle board of opponent shots
      gameInstance.setBattleBoardRef({ current: { recordOpponentShot } });
    }
  }, [gameInstance, recordOpponentShot]);

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
        <div className="legend-item">
          <div className="legend-color sunk-ship"></div>
          <span>Sunk ships</span>
        </div>
      </div>
    </div>
  );
};

export default FleetBattle;
// EOF
