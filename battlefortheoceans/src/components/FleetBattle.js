// src/components/FleetBattle.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import useBattleBoard from '../hooks/useBattleBoard';

const version = 'v0.1.9';

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
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <p>Preparing battle board...</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={(e) => handleCanvasClick(e, onShotFired)}
      style={{
        cursor: gameState.isPlayerTurn && gameState.isGameActive ? 'crosshair' : 'not-allowed'
      }}
    />
  );
};

export default FleetBattle;
// EOF
