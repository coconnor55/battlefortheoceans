// src/components/PlacerRenderer.js (v0.1.6)
// Copyright(c) 2025, Clint H. O'Connor

import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import { GameContext } from '../context/GameContext';
import MessageHelper from '../utils/MessageHelper';

const PlacerRenderer = ({ placer, userId, onClose, rows, cols, terrain }) => {
  const { eraConfig } = useContext(GameContext);
  const canvasRef = useRef(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [startCell, setStartCell] = useState(null);
  const cellSize = 30;
  const labelSize = 20;

  const drawCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!placer?.board || !ctx) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.canvas.width = cols * cellSize + labelSize;
    ctx.canvas.height = rows * cellSize + labelSize;

    // Draw row labels (numbers)
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    for (let row = 0; row < rows; row++) {
      ctx.fillText((row + 1).toString(), labelSize / 2, row * cellSize + labelSize + cellSize / 2 + 4);
    }

    // Draw column labels (letters)
    for (let col = 0; col < cols; col++) {
      const letter = String.fromCharCode(65 + col); // A, B, C, etc.
      ctx.fillText(letter, col * cellSize + labelSize + cellSize / 2, labelSize / 2 + 4);
    }

    // Draw grid lines
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
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
        
        // Draw terrain
        if (cell.terrain !== 'excluded') {
          ctx.fillStyle = getTerrainColor(cell.terrain);
          ctx.fillRect(col * cellSize + labelSize + 1, row * cellSize + labelSize + 1, cellSize - 2, cellSize - 2);
        }
        
        // Draw ships
        if (cell.state === 'ship') {
          ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // Semi-transparent blue for placed ships
          ctx.fillRect(col * cellSize + labelSize + 1, row * cellSize + labelSize + 1, cellSize - 2, cellSize - 2);
        }
      }
    }

    // Draw current ship preview if placing
    if (placer.currentShip && placer.currentShip.cells && placer.currentShip.cells.length > 0) {
      const isValid = placer.currentShip.cells.length === placer.currentShip.size;
      ctx.fillStyle = isValid ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)'; // Green if valid, red if invalid
      
      placer.currentShip.cells.forEach(({ row, col }) => {
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          ctx.fillRect(col * cellSize + labelSize + 1, row * cellSize + labelSize + 1, cellSize - 2, cellSize - 2);
        }
      });
    }
  }, [placer, userId, rows, cols, cellSize, labelSize]);

  useEffect(() => {
    drawCanvas();
  }, [placer, rows, cols, terrain, drawCanvas]);

  const getTerrainColor = (terrain) => {
    // NOAA Chart 1 colors
    switch (terrain) {
      case 'deep': return '#FFFFFF'; // White for deep water
      case 'shallow': return '#B3D9FF'; // Light blue for shallow water
      case 'shoal': return '#87CEEB'; // Sky blue for shoal water
      case 'marsh': return '#90EE90'; // Light green for marsh
      case 'land': return '#DEB887'; // Burlywood/buff for land
      case 'rock': return '#A9A9A9'; // Dark gray for rock
      case 'excluded': return 'transparent'; // Transparent for excluded
      default: return '#FFFFFF'; // White for unknown
    }
  };

  const getIndices = (x, y) => {
    const col = Math.floor((x - labelSize) / cellSize);
    const row = Math.floor((y - labelSize) / cellSize);
    return [row, col];
  };

  const handleStart = (e) => {
    const currentShip = placer.getCurrentShip();
    if (!currentShip) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const [row, col] = getIndices(x, y);

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      setIsPlacing(true);
      setStartCell({ row, col });
      placer.startPlacement(row, col);
      console.log('v0.1.6', 'Started placement at', { row, col });
      drawCanvas();
    }
  };

  const handleMove = (e) => {
    if (!isPlacing || !startCell || !placer.currentShip) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const [row, col] = getIndices(x, y);

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      // Calculate direction based on movement from start cell
      const deltaRow = row - startCell.row;
      const deltaCol = col - startCell.col;
      
      // Determine direction: if more horizontal movement, it's horizontal, otherwise vertical
      const direction = Math.abs(deltaCol) > Math.abs(deltaRow) ? 'horizontal' : 'vertical';
      
      // For horizontal: positive deltaCol = right, negative = left
      // For vertical: positive deltaRow = down, negative = up
      let shipDirection = direction;
      if (direction === 'horizontal' && deltaCol < 0) {
        // Moving left - place ship extending left from start
        shipDirection = 'horizontal-left';
      } else if (direction === 'vertical' && deltaRow < 0) {
        // Moving up - place ship extending up from start
        shipDirection = 'vertical-up';
      }

      // Calculate ship cells based on direction
      const shipCells = [];
      for (let i = 0; i < placer.currentShip.size; i++) {
        let cellRow, cellCol;
        
        switch (shipDirection) {
          case 'horizontal-left':
            cellRow = startCell.row;
            cellCol = startCell.col - i;
            break;
          case 'vertical-up':
            cellRow = startCell.row - i;
            cellCol = startCell.col;
            break;
          case 'vertical':
            cellRow = startCell.row + i;
            cellCol = startCell.col;
            break;
          default: // horizontal (right)
            cellRow = startCell.row;
            cellCol = startCell.col + i;
            break;
        }
        
        shipCells.push({ row: cellRow, col: cellCol });
      }

      // Validate placement
      const isValid = shipCells.every(cell =>
        cell.row >= 0 && cell.row < rows &&
        cell.col >= 0 && cell.col < cols &&
        placer.board.grid[cell.row][cell.col].terrain !== 'excluded' &&
        placer.currentShip.terrain.includes(placer.board.grid[cell.row][cell.col].terrain) &&
        placer.board.grid[cell.row][cell.col].state === 'empty'
      );

      if (isValid) {
        placer.currentShip.cells = shipCells;
        console.log('v0.1.6', 'Valid placement preview', { direction: shipDirection, cells: shipCells });
      } else {
        placer.currentShip.cells = shipCells; // Show invalid placement in red
        console.log('v0.1.6', 'Invalid placement preview', { direction: shipDirection, cells: shipCells });
      }

      drawCanvas();
    }
  };

  const handleEnd = (e) => {
    if (!isPlacing || !placer.currentShip || !placer.currentShip.cells) return;

    const isValidPlacement = placer.currentShip.cells.length === placer.currentShip.size;

    if (isValidPlacement && placer.confirmPlacement()) {
      console.log('v0.1.6', 'Ship placed successfully');
      if (placer.isComplete()) {
        console.log('v0.1.6', 'All ships placed - triggering completion');
        onClose(); // Trigger transition to play state
      }
    } else {
      console.log('v0.1.6', 'Invalid placement - clearing current ship');
      if (placer.currentShip) {
        placer.currentShip.cells = [];
      }
    }

    setIsPlacing(false);
    setStartCell(null);
    drawCanvas();
  };

  // Get current message for placement
  const getCurrentMessage = () => {
    const currentShip = placer?.getCurrentShip();
    if (currentShip) {
      return `Place your ${currentShip.name} (${currentShip.size} squares). Tap and drag to orient.`;
    } else if (placer?.isComplete()) {
      // Use dynamic transition message from era config
      return MessageHelper.getTransitionMessage(eraConfig) || 'All ships placed! Ready for battle!';
    }
    return 'Place your fleet';
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onTouchStart={(e) => { e.preventDefault(); handleStart(e); }}
        onTouchMove={(e) => { e.preventDefault(); handleMove(e); }}
        onTouchEnd={(e) => { e.preventDefault(); handleEnd(e); }}
        style={{
          margin: 0,
          padding: 0,
          pointerEvents: 'auto',
          zIndex: 1000,
          border: '1px solid #ccc',
          cursor: isPlacing ? 'crosshair' : 'pointer'
        }}
      />
      <div className="message-console">
        {getCurrentMessage()}
      </div>
    </div>
  );
};

export default PlacerRenderer;
