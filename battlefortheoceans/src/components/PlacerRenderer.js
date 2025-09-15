// src/components/PlacerRenderer.js (v0.1.3)
// Copyright(c) 2025, Clint H. O’Connor

import React, { useEffect, useRef } from 'react';
import Debug from '../utils/Debug';
import Placer from '../classes/Placer';

const PlacerRenderer = ({ placer, userId, onClose, rows, cols, terrain }) => {
  const canvasRef = useRef(null);
  const cellSize = 30;
  const labelSize = 20;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!placer?.board || !ctx) return;

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

    // Draw terrain and ships
    const playerBoard = placer.board.getPlayerBoard(userId);
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
  }, [placer.board, userId, cols, rows, terrain]);

  const getTerrainColor = (terrain) => {
    switch (terrain) {
      case 'deep': return '#000080'; // Dark blue
      case 'shallow': return '#ADD8E6'; // Light blue
      case 'shoal': return '#87CEEB'; // Light cyan
      case 'marsh': return '#9ACD32'; // Yellow-green
      case 'land': return '#8B4513'; // Brown
      case 'rock': return '#A52A2A'; // Reddish
      case 'excluded': return 'transparent'; // Transparent for excluded
      default: return '#FFFFFF'; // White for unknown
    }
  };

  const handleStart = (e) => {
    if (!placer.currentShip) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = getIndices(x, y);
    placer.startPlacement(row, col);
    updateCanvas();
  };

  const handleMove = (e) => {
    if (!placer.currentShip) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = getIndices(x, y);
    const direction = Math.abs(col - placer.currentShip.start.col) > Math.abs(row - placer.currentShip.start.row) ? 'horizontal' : 'vertical';
    placer.swipe(row, col, direction);
    updateCanvas();
  };

  const handleEnd = (e) => {
    if (!placer.currentShip) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = getIndices(x, y);
    const direction = Math.abs(col - placer.currentShip.start.col) > Math.abs(row - placer.currentShip.start.row) ? 'horizontal' : 'vertical';
    if (placer.swipe(row, col, direction) && placer.confirmPlacement()) {
      Debug.log('v0.1.3', 'Ship placed', { ship: placer.getCurrentShip()?.name });
      updateCanvas();
      if (placer.isComplete()) {
        onClose(); // Trigger transition
      }
    }
  };

  const updateCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.canvas.parentNode.replaceChild(canvasRef.current.cloneNode(), canvasRef.current); // Force re-render
  };

  const getIndices = (x, y) => {
    const col = Math.floor((x - labelSize) / cellSize);
    const row = Math.floor((y - labelSize) / cellSize);
    return [row, col];
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onTouchStart={(e) => handleStart(e.touches[0])}
        onTouchMove={(e) => handleMove(e.touches[0])}
        onTouchEnd={(e) => handleEnd(e.changedTouches[0])}
        style={{ margin: 0, padding: 0, pointerEvents: 'auto', zIndex: 1000 }}
      />
      <div className="message-console">
        {placer?.getCurrentShip() ? `Place your ${placer.getCurrentShip().name} (${placer.getCurrentShip().size} squares).` : 'Placement complete!'}
      </div>
    </div>
  );
};

export default PlacerRenderer;

// EOF - EOF - EOF
