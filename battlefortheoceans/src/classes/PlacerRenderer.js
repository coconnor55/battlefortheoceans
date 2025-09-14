// src/classes/PlacerRenderer.js (v0.1.1)
// Copyright(c) 2025, Clint H. O’Connor

import React, { useRef, useEffect } from 'react';
import Debug from '../utils/Debug';

class PlacerRenderer {
  constructor(placer, userId) {
    this.placer = placer;
    this.userId = userId;
    this.canvasRef = React.createRef();
    this.cellSize = 30;
    this.labelSize = 20;
  }

  render() {
    useEffect(() => {
      const ctx = this.canvasRef.current?.getContext('2d');
      if (!this.placer.board || !ctx) return;

      const { rows, cols } = this.placer.board;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.canvas.width = cols * this.cellSize + this.labelSize;
      ctx.canvas.height = rows * this.cellSize + this.labelSize;

      // Draw grid lines
      ctx.strokeStyle = '#000';
      for (let row = 0; row <= rows; row++) {
        ctx.beginPath();
        ctx.moveTo(this.labelSize, row * this.cellSize + this.labelSize);
        ctx.lineTo(cols * this.cellSize + this.labelSize, row * this.cellSize + this.labelSize);
        ctx.stroke();
      }
      for (let col = 0; col <= cols; col++) {
        ctx.beginPath();
        ctx.moveTo(col * this.cellSize + this.labelSize, this.labelSize);
        ctx.lineTo(col * this.cellSize + this.labelSize, rows * this.cellSize + this.labelSize);
        ctx.stroke();
      }

      // Draw terrain and ships
      const playerBoard = this.placer.board.getPlayerBoard(this.userId);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cell = playerBoard[row][col];
          if (cell.terrain !== 'excluded') {
            ctx.fillStyle = this.getTerrainColor(cell.terrain);
            ctx.fillRect(col * this.cellSize + this.labelSize, row * this.cellSize + this.labelSize, this.cellSize - 1, this.cellSize - 1);
          }
          if (cell.state === 'ship') {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)'; // Blue for player ships
            ctx.fillRect(col * this.cellSize + this.labelSize, row * this.cellSize + this.labelSize, this.cellSize - 1, this.cellSize - 1);
          }
        }
      }
    }, [this.placer.board, this.userId]);

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

    return (
      <canvas
        ref={this.canvasRef}
        onMouseDown={(e) => this.handleStart(e)}
        onMouseMove={(e) => this.handleMove(e)}
        onMouseUp={(e) => this.handleEnd(e)}
        onTouchStart={(e) => this.handleStart(e.touches[0])}
        onTouchMove={(e) => this.handleMove(e.touches[0])}
        onTouchEnd={(e) => this.handleEnd(e.changedTouches[0])}
        style={{ margin: 0, padding: 0, pointerEvents: 'auto', zIndex: 1000 }}
      />
    );
  }

  handleStart(e) {
    if (!this.placer.currentShip) return;
    const rect = this.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = this.getIndices(x, y);
    this.placer.startPlacement(row, col);
    this.updateCanvas();
  }

  handleMove(e) {
    if (!this.placer.currentShip) return;
    const rect = this.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = this.getIndices(x, y);
    const direction = Math.abs(col - this.placer.currentShip.start.col) > Math.abs(row - this.placer.currentShip.start.row) ? 'horizontal' : 'vertical';
    this.placer.swipe(row, col, direction);
    this.updateCanvas();
  }

  handleEnd(e) {
    if (!this.placer.currentShip) return;
    const rect = this.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [row, col] = this.getIndices(x, y);
    const direction = Math.abs(col - this.placer.currentShip.start.col) > Math.abs(row - this.placer.currentShip.start.row) ? 'horizontal' : 'vertical';
    if (this.placer.swipe(row, col, direction) && this.placer.confirmPlacement()) {
      Debug.log('v0.1.1', 'Ship placed', { ship: this.placer.getCurrentShip()?.name });
      this.updateCanvas();
      if (this.placer.isComplete()) {
        this.props.onClose(); // Trigger transition
      }
    }
  }

  updateCanvas() {
    const ctx = this.canvasRef.current?.getContext('2d');
    if (ctx) this.render();
  }

  getIndices(x, y) {
    const col = Math.floor((x - this.labelSize) / this.cellSize);
    const row = Math.floor((y - this.labelSize) / this.cellSize);
    return [row, col];
  }
}

export default PlacerRenderer;

// EOF - EOF - EOF
