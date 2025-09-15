// src/hooks/useBattleBoard.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useRef } from 'react';

const useBattleBoard = (eraConfig, gameState, boards) => {
  const canvasRef = useRef(null);
  const [animations, setAnimations] = useState([]);
  
  const cellSize = 30;
  const labelSize = 20;
  const boardSpacing = 50;

  // Calculate board dimensions
  const boardWidth = eraConfig ? eraConfig.cols * cellSize + labelSize : 0;
  const boardHeight = eraConfig ? eraConfig.rows * cellSize + labelSize : 0;

  useEffect(() => {
    if (boards.opponentBoard && eraConfig) {
      drawCanvas();
    }
  }, [boards.opponentBoard, boards.playerBoard, gameState, animations, eraConfig]);

  const drawCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !boards.opponentBoard || !eraConfig) return;

    ctx.canvas.width = boardWidth * 2 + boardSpacing;
    ctx.canvas.height = boardHeight + 40;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw board labels
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Enemy Waters', boardWidth / 2, 20);
    ctx.fillText('Your Fleet', boardWidth + boardSpacing + boardWidth / 2, 20);

    // Draw opponent board (left side)
    drawBoard(ctx, boards.opponentBoard, 0, 30, false);
    
    // Draw player board (right side)
    if (boards.playerBoard) {
      drawBoard(ctx, boards.playerBoard, boardWidth + boardSpacing, 30, true);
    }

    // Draw animations
    animations.forEach(anim => {
      drawAnimation(ctx, anim);
    });
  };

  const drawBoard = (ctx, board, offsetX, offsetY, showShips) => {
    // Draw row labels (numbers)
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    for (let row = 0; row < eraConfig.rows; row++) {
      ctx.fillText(
        (row + 1).toString(), 
        offsetX + labelSize / 2, 
        offsetY + row * cellSize + labelSize + cellSize / 2 + 4
      );
    }

    // Draw column labels (letters)
    for (let col = 0; col < eraConfig.cols; col++) {
      const letter = String.fromCharCode(65 + col);
      ctx.fillText(
        letter, 
        offsetX + col * cellSize + labelSize + cellSize / 2, 
        offsetY + labelSize / 2 + 4
      );
    }

    // Draw grid lines
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let row = 0; row <= eraConfig.rows; row++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + labelSize, offsetY + row * cellSize + labelSize);
      ctx.lineTo(offsetX + eraConfig.cols * cellSize + labelSize, offsetY + row * cellSize + labelSize);
      ctx.stroke();
    }
    for (let col = 0; col <= eraConfig.cols; col++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + col * cellSize + labelSize, offsetY + labelSize);
      ctx.lineTo(offsetX + col * cellSize + labelSize, offsetY + eraConfig.rows * cellSize + labelSize);
      ctx.stroke();
    }

    // Draw cells
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const cell = board.grid[row][col];
        const x = offsetX + col * cellSize + labelSize + 1;
        const y = offsetY + row * cellSize + labelSize + 1;
        const size = cellSize - 2;

        // Draw terrain
        if (cell.terrain !== 'excluded') {
          ctx.fillStyle = getTerrainColor(cell.terrain);
          ctx.fillRect(x, y, size, size);
        }

        // Draw cell state
        if (cell.state === 'ship' && showShips) {
          ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
          ctx.fillRect(x, y, size, size);
        } else if (cell.state === 'hit') {
          if (gameState.isShipSunk && gameState.isShipSunk(board, row, col)) {
            ctx.fillStyle = '#404040'; // Dark grey for sunk ships
          } else {
            ctx.fillStyle = '#CC0000'; // Red for hits
          }
          ctx.fillRect(x, y, size, size);
        } else if (cell.state === 'miss') {
          // Small grey circle for misses
          ctx.fillStyle = '#999999';
          ctx.beginPath();
          ctx.arc(x + size/2, y + size/2, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  };

  const drawAnimation = (ctx, anim) => {
    ctx.fillStyle = anim.color;
    ctx.beginPath();
    ctx.arc(anim.x, anim.y, anim.radius, 0, 2 * Math.PI);
    ctx.fill();
  };

  const getTerrainColor = (terrain) => {
    switch (terrain) {
      case 'deep': return '#FFFFFF';
      case 'shallow': return '#B3D9FF';
      case 'shoal': return '#87CEEB';
      case 'marsh': return '#90EE90';
      case 'land': return '#DEB887';
      case 'rock': return '#A9A9A9';
      case 'excluded': return 'transparent';
      default: return '#FFFFFF';
    }
  };

  const handleCanvasClick = (e, onShotFired) => {
    if (!gameState.isPlayerTurn || !boards.opponentBoard || !eraConfig) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is on opponent board (left side)
    if (x < boardWidth && y > 30) {
      const col = Math.floor((x - labelSize) / cellSize);
      const row = Math.floor((y - 30 - labelSize) / cellSize);

      if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
        const shotResult = onShotFired(row, col);
        
        if (shotResult) {
          showShotAnimation(shotResult);
        }
      }
    }
  };

  const showShotAnimation = ({ result, row, col }) => {
    const animX = col * cellSize + labelSize + cellSize / 2;
    const animY = 30 + row * cellSize + labelSize + cellSize / 2;
    const animId = Date.now();

    if (result === 'hit') {
      setAnimations(prev => [...prev, {
        id: animId,
        x: animX,
        y: animY,
        radius: 12,
        color: 'rgba(204, 0, 0, 0.8)'
      }]);
    } else if (result === 'miss') {
      setAnimations(prev => [...prev, {
        id: animId,
        x: animX,
        y: animY,
        radius: 8,
        color: 'rgba(153, 153, 153, 0.6)'
      }]);
    }

    // Remove animation after 2 seconds
    setTimeout(() => {
      setAnimations(prev => prev.filter(anim => anim.id !== animId));
    }, 2000);
  };

  return {
    canvasRef,
    handleCanvasClick,
    drawCanvas,
    boardWidth,
    boardHeight,
    isReady: !!(eraConfig && boards.opponentBoard)
  };
};

export default useBattleBoard;

// EOF - EOF - EOF
