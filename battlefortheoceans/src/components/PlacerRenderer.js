// src/components/PlacerRenderer.js (v0.1.4)
// Copyright(c) 2025, Clint H. O'Connor

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Debug from '../utils/Debug';

const PlacerRenderer = ({ placer, userId, onClose }) => {
  const canvasRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const cellSize = 30;
  const labelSize = 20;

  // Get board dimensions from placer
  const rows = placer?.board?.rows || 10;
  const cols = placer?.board?.cols || 10;

  // Force re-render when drag state changes
  const updateRender = useCallback(() => {
    const newDragState = placer?.getDragState();
    setDragState(newDragState);
  }, [placer]);

  // Main rendering effect
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!placer?.board || !ctx) return;

    // Set canvas size
    canvas.width = cols * cellSize + labelSize;
    canvas.height = rows * cellSize + labelSize;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    drawGrid(ctx);
    
    // Draw terrain
    drawTerrain(ctx);
    
    // Draw placed ships
    drawPlacedShips(ctx);
    
    // Draw current drag preview
    drawDragPreview(ctx);
    
    // Draw labels
    drawLabels(ctx);
    
  }, [placer, dragState, rows, cols]);

  const drawGrid = (ctx) => {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    // Horizontal lines
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(labelSize, row * cellSize + labelSize);
      ctx.lineTo(cols * cellSize + labelSize, row * cellSize + labelSize);
      ctx.stroke();
    }
    
    // Vertical lines
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * cellSize + labelSize, labelSize);
      ctx.lineTo(col * cellSize + labelSize, rows * cellSize + labelSize);
      ctx.stroke();
    }
  };

  const drawTerrain = (ctx) => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = placer.board.grid[row][col];
        if (cell.terrain !== 'excluded') {
          ctx.fillStyle = getTerrainColor(cell.terrain);
          ctx.fillRect(
            col * cellSize + labelSize + 1,
            row * cellSize + labelSize + 1,
            cellSize - 2,
            cellSize - 2
          );
        }
      }
    }
  };

  const drawPlacedShips = (ctx) => {
    const playerBoard = placer.board.getPlayerBoard(userId);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = playerBoard[row][col];
        if (cell.state === 'ship') {
          ctx.fillStyle = 'rgba(0, 0, 255, 0.6)'; // Blue for placed ships
          ctx.fillRect(
            col * cellSize + labelSize + 1,
            row * cellSize + labelSize + 1,
            cellSize - 2,
            cellSize - 2
          );
        }
      }
    }
  };

  const drawDragPreview = (ctx) => {
    if (!dragState?.isActive || !dragState.previewCells) return;
    
    // Draw preview cells with green (valid) or red (invalid) color
    const color = dragState.isValid ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)';
    ctx.fillStyle = color;
    
    dragState.previewCells.forEach(({ row, col }) => {
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        ctx.fillRect(
          col * cellSize + labelSize + 1,
          row * cellSize + labelSize + 1,
          cellSize - 2,
          cellSize - 2
        );
      }
    });
  };

  const drawLabels = (ctx) => {
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Column labels (A, B, C...)
    for (let col = 0; col < cols; col++) {
      const letter = String.fromCharCode(65 + col);
      ctx.fillText(letter, col * cellSize + labelSize + cellSize/2, 15);
    }
    
    // Row labels (1, 2, 3...)
    ctx.textAlign = 'right';
    for (let row = 0; row < rows; row++) {
      ctx.fillText((row + 1).toString(), 15, row * cellSize + labelSize + cellSize/2 + 4);
    }
  };

  const getTerrainColor = (terrain) => {
    switch (terrain) {
      case 'deep': return '#000080';
      case 'shallow': return '#ADD8E6';
      case 'shoal': return '#87CEEB';
      case 'marsh': return '#9ACD32';
      case 'land': return '#8B4513';
      case 'rock': return '#A52A2A';
      case 'excluded': return 'transparent';
      default: return '#FFFFFF';
    }
  };

  const getGridCoordinates = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor((x - labelSize) / cellSize);
    const row = Math.floor((y - labelSize) / cellSize);
    return { row, col };
  };

  // Touch/Mouse event handlers
  const handleStart = (clientX, clientY) => {
    const { row, col } = getGridCoordinates(clientX, clientY);
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      placer.startDrag(row, col);
      updateRender();
    }
  };

  const handleMove = (clientX, clientY) => {
    if (!dragState?.isActive) return;
    const { row, col } = getGridCoordinates(clientX, clientY);
    placer.updateDrag(row, col);
    updateRender();
  };

  const handleEnd = () => {
    if (!dragState?.isActive) return;
    
    if (dragState.isValid) {
      const success = placer.confirmPlacement();
      if (success && placer.isComplete()) {
        onClose(); // All ships placed, trigger transition
      }
    } else {
      placer.cancelDrag();
    }
    updateRender();
  };

  // Mouse events
  const onMouseDown = (e) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e) => {
    e.preventDefault();
    handleMove(e.clientX, e.clientY);
  };

  const onMouseUp = (e) => {
    e.preventDefault();
    handleEnd();
  };

  // Touch events
  const onTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const onTouchEnd = (e) => {
    e.preventDefault();
    handleEnd();
  };

  const currentShip = placer?.getCurrentShip();
  const message = currentShip
    ? `Place your ${currentShip.name} (${currentShip.size} squares). Tap stern, swipe to bow.`
    : 'All ships placed! Ready for battle.';

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          border: '1px solid #000',
          cursor: 'crosshair',
          touchAction: 'none' // Prevent scroll/zoom on touch
        }}
      />
      <div className="message-console" style={{ marginTop: '10px', fontSize: '14px' }}>
        {message}
      </div>
    </div>
  );
};

export default PlacerRenderer;

// EOF - EOF - EOF
