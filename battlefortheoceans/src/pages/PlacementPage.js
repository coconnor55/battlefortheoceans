// src/pages/PlacementPage.js (v0.1.2)
// Copyright(c) 2025, Clint H. O’Connor

import React, { useState, useEffect, useRef, useContext } from 'react';
import { GameContext } from '../contexts/GameContext';
import Debug from '../utils/Debug';
import Board from '../classes/Board';
import Placer from '../classes/Placer';
import Ship from '../classes/Ship';
import './PlacementPage.css';

const PlacementPage = ({ onGo }) => {
  const { state, dispatch, machine } = useContext(GameContext);
  const { rows, cols, terrain, ships: fleetConfig } = machine.context.config || { rows: 10, cols: 10, terrain: [], ships: [] };
  const userId = machine.context.player?.id || 'defaultPlayer';
  const [board, setBoard] = useState(null);
  const [placer, setPlacer] = useState(null);
  const canvasRef = useRef(null);
  const [message, setMessage] = useState('Place your carrier (5 squares).');
  const cellSize = 30; // Adjustable for larger grids
  const labelSize = 20;

  useEffect(() => {
    const newBoard = new Board(rows, cols, terrain);
    const newPlacer = new Placer(newBoard, fleetConfig, userId);
    setBoard(newBoard);
    setPlacer(newPlacer);
    Debug.log('v0.1.2', 'PlacementPage initialized', { rows, cols, userId });
    updateMessage(newPlacer.getCurrentShip());
  }, [rows, cols, terrain, fleetConfig, userId]);

  const drawBoard = (ctx) => {
    if (!board || !ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.canvas.width = cols * cellSize + labelSize;
    ctx.canvas.height = rows * cellSize + labelSize;

    // Draw grid lines
    ctx.strokeStyle = '#000';
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(labelSize, row * cellSize + labelSize);
      ctx.lineTo(cols * cellSize + labelSize, row * cellSize + labelSize);
      ctx.stroke();
    }
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * cellSize + labelSize, labelSize);
      ctx.lineTo(col * cellSize + labelSize, rows * cellSize + labelSize);
      ctx.stroke();
    }

    // Draw terrain (excluding 'excluded' as transparent)
    const playerBoard = board.getPlayerBoard(userId);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = playerBoard[row][col];
        if (cell.terrain !== 'excluded') {
          ctx.fillStyle = getTerrainColor(cell.terrain);
          ctx.fillRect(col * cellSize + labelSize, row * cellSize + labelSize, cellSize - 1, cellSize - 1);
        }
        if (cell.state === 'ship') {
          ctx.fillStyle = 'rgba(0, 0, 255, 0.3)'; // Blue for player ships
          ctx.fillRect(col * cellSize + labelSize, row * cellSize + labelSize, cellSize - 1, cellSize - 1);
        }
      }
    }
  };

  const getTerrainColor = (terrain) => {
    switch (terrain) {
      case 'deep': return '#000080'; // Dark blue
      case 'shallow': return '#ADD8E6'; // Light blue
      case 'land': return '#8B4513'; // Brown
      case 'off-chart': return '#808080'; // Gray
      case 'rock': return '#A52A2A'; // Reddish
      default: return '#FFFFFF'; // White for unknown
    }
  };

  const updateMessage = (ship) => {
    setMessage(ship ? `Place your ${ship.name} (${ship.size} squares).` : 'Placement complete!');
  };

  const handleStart = (e) => {
    if (!placer?.currentShip || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = getIndices(x, y);
    placer.startPlacement(row, col);
    drawBoard(canvasRef.current.getContext('2d'));
    updateMessage(placer.getCurrentShip());
  };

  const handleMove = (e) => {
    if (!placer?.currentShip || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = getIndices(x, y);
    const direction = Math.abs(col - placer.currentShip.start.col) > Math.abs(row - placer.currentShip.start.row) ? 'horizontal' : 'vertical';
    placer.swipe(row, col, direction);
    drawBoard(canvasRef.current.getContext('2d'));
  };

  const handleEnd = (e) => {
    if (!placer?.currentShip || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = getIndices(x, y);
    const direction = Math.abs(col - placer.currentShip.start.col) > Math.abs(row - placer.currentShip.start.row) ? 'horizontal' : 'vertical';
    if (placer.swipe(row, col, direction) && placer.confirmPlacement()) {
      Debug.log('v0.1.2', 'Ship placed', { ship: placer.getCurrentShip()?.name });
      drawBoard(canvasRef.current.getContext('2d'));
      updateMessage(placer.getCurrentShip());
      if (placer.isComplete()) {
        onGo(); // Trigger transition
      }
    }
  };

  const getIndices = (x, y) => {
    const col = Math.floor((x - labelSize) / cellSize);
    const row = Math.floor((y - labelSize) / cellSize);
    return [row, col];
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && board) drawBoard(ctx);
  }, [board]);

  return (
    <div className="placement-page">
      <div className="game-board">
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={e => handleStart(e.touches[0])}
          onTouchMove={e => handleMove(e.touches[0])}
          onTouchEnd={e => handleEnd(e.changedTouches[0])}
          style={{ margin: 0, padding: 0, pointerEvents: 'auto', zIndex: 1000 }}
        />
      </div>
      <div className="message-console">{message}</div>
      <button onClick={onGo} disabled={!placer?.isComplete()}>Go!</button>
    </div>
  );
}

export default PlacementPage;

// EOF - EOF - EOF
