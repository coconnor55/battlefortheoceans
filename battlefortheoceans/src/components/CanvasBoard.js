// src/components/CanvasBoard.js v0.1.15
// Copyright(c) 2025, Clint H. O'Connor

import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { useGame } from '../context/GameContext';

const version = 'v0.1.15';

const CanvasBoard = forwardRef(({
  eraConfig,
  gameBoard,
  gameInstance,
  mode = 'battle', // 'battle' | 'placement'
  // Battle mode props
  gameState = null,
  onShotFired = null,
  // Placement mode props
  currentShip = null,
  onShipPlaced = null,
  humanPlayer = null
}, ref) => {
  const canvasRef = useRef(null);
  const { subscribeToUpdates } = useGame();
  
  // Canvas dimensions
  const cellSize = 30;
  const labelSize = 20;
  const boardWidth = eraConfig ? eraConfig.cols * cellSize + labelSize : 0;
  const boardHeight = eraConfig ? eraConfig.rows * cellSize + labelSize : 0;

  // Placement mode state
  const [previewCells, setPreviewCells] = useState([]);
  const [isValidPlacement, setIsValidPlacement] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [startCell, setStartCell] = useState(null);

  // Animation state - use ref for immediate access during animation loop
  const animationsRef = useRef([]);
  const [animationTrigger, setAnimationTrigger] = useState(0);

  // Performance optimization - cache terrain layer
  const terrainLayerRef = useRef(null);
  
  // Track last processed cell to prevent excessive updates
  const lastProcessedCell = useRef(null);
  
  // Clear terrain cache when era changes
  useEffect(() => {
    if (eraConfig) {
      terrainLayerRef.current = null;
    }
  }, [eraConfig]);

  // Clear placement preview when ship changes
  useEffect(() => {
    if (mode === 'placement') {
      setPreviewCells([]);
      setIsValidPlacement(false);
      setStartCell(null);
      setIsPlacing(false);
      lastProcessedCell.current = null;
    }
  }, [currentShip, mode]);

  // Subscribe to game updates for real-time canvas redraw
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        drawCanvas();
      }
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

  // Initial canvas draw when components are ready
  useEffect(() => {
    if (gameBoard && eraConfig && gameInstance && canvasRef.current) {
      drawCanvas();
    }
  }, [gameBoard, eraConfig, gameInstance]);

  // Get terrain color
  const getTerrainColor = useCallback((terrain) => {
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
  }, []);

  // Validate ship placement
  const isValidShipPlacement = useCallback((cells) => {
    if (!cells || cells.length === 0 || !currentShip) return false;
    
    for (const cell of cells) {
      // Check bounds
      if (cell.row < 0 || cell.row >= eraConfig.rows ||
          cell.col < 0 || cell.col >= eraConfig.cols) {
        return false;
      }
      
      // Check if excluded terrain - FIX: use isValidCoordinate instead
      if (!gameBoard.isValidCoordinate(cell.row, cell.col)) {
        return false;
      }
      
      // Check terrain compatibility - FIX: access terrain array directly
      const terrain = gameBoard.terrain[cell.row][cell.col];
      if (!currentShip.terrain.includes(terrain)) {
        return false;
      }
      
      // Check for existing ships
      try {
        const shipDataArray = gameBoard.getShipDataAt(cell.row, cell.col);
        if (shipDataArray && shipDataArray.length > 0) {
          return false;
        }
      } catch (error) {
        console.warn(version, 'Error checking ship overlap at', cell.row, cell.col);
      }
    }
    
    return true;
  }, [currentShip, eraConfig, gameBoard]);
    
  // Main canvas drawing function
  const drawCanvas = useCallback(() => {
    console.log('[CANVAS]', version, 'drawCanvas() executing');
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !gameBoard || !eraConfig || !gameInstance) return;

    // Set canvas size with equal margins
    ctx.canvas.width = boardWidth + 40;
    ctx.canvas.height = boardHeight + 40;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Equal 20px margins on all sides
    const offsetX = 20;
    const offsetY = 20;

    // Layer 1: Static terrain + grid (cached)
    drawTerrainLayer(ctx, offsetX, offsetY);

    // Layer 2: Ships (different logic for battle vs placement)
    if (mode === 'battle') {
      drawBattleShips(ctx, offsetX, offsetY);
      drawHitOverlay(ctx, offsetX, offsetY);
    } else {
      drawPlacementShips(ctx, offsetX, offsetY);
      drawPlacementPreview(ctx, offsetX, offsetY);
    }

    // Layer 3: Animations - read directly from ref for current state
    if (animationsRef.current.length > 0) {
      animationsRef.current.forEach(anim => drawAnimation(ctx, anim, offsetX, offsetY));
    }
  }, [gameBoard, eraConfig, gameInstance, mode, gameState, previewCells, isValidPlacement, boardWidth, boardHeight]);

  // Draw terrain and grid (cached for performance)
  const drawTerrainLayer = useCallback((ctx, offsetX, offsetY) => {
    if (!terrainLayerRef.current) {
      const terrainCanvas = document.createElement('canvas');
      terrainCanvas.width = ctx.canvas.width;
      terrainCanvas.height = ctx.canvas.height;
      const terrainCtx = terrainCanvas.getContext('2d');
      
      // Draw row labels (numbers) - WHITE with black outline for visibility
      terrainCtx.fillStyle = '#FFFFFF';
      terrainCtx.font = 'bold 12px Arial';
      terrainCtx.textAlign = 'center';
      terrainCtx.strokeStyle = '#000000';
      terrainCtx.lineWidth = 3;
      
      for (let row = 0; row < eraConfig.rows; row++) {
        const text = (row + 1).toString();
        const x = offsetX + labelSize / 2;
        const y = offsetY + row * cellSize + labelSize + cellSize / 2 + 4;
        
        terrainCtx.strokeText(text, x, y);
        terrainCtx.fillText(text, x, y);
      }

      // Draw column labels (letters)
      for (let col = 0; col < eraConfig.cols; col++) {
        const letter = String.fromCharCode(65 + col);
        const x = offsetX + col * cellSize + labelSize + cellSize / 2;
        const y = offsetY + labelSize / 2 + 4;
        
        terrainCtx.strokeText(letter, x, y);
        terrainCtx.fillText(letter, x, y);
      }

      // Draw grid lines
      terrainCtx.strokeStyle = '#000';
      terrainCtx.lineWidth = 1;
      for (let row = 0; row <= eraConfig.rows; row++) {
        terrainCtx.beginPath();
        terrainCtx.moveTo(offsetX + labelSize, offsetY + row * cellSize + labelSize);
        terrainCtx.lineTo(offsetX + eraConfig.cols * cellSize + labelSize, offsetY + row * cellSize + labelSize);
        terrainCtx.stroke();
      }
      for (let col = 0; col <= eraConfig.cols; col++) {
        terrainCtx.beginPath();
        terrainCtx.moveTo(offsetX + col * cellSize + labelSize, offsetY + labelSize);
        terrainCtx.lineTo(offsetX + col * cellSize + labelSize, offsetY + eraConfig.rows * cellSize + labelSize);
        terrainCtx.stroke();
      }

      // Draw terrain background
      for (let row = 0; row < eraConfig.rows; row++) {
        for (let col = 0; col < eraConfig.cols; col++) {
          const terrain = eraConfig.terrain[row][col];
          if (terrain !== 'excluded') {
            const x = offsetX + col * cellSize + labelSize + 1;
            const y = offsetY + row * cellSize + labelSize + 1;
            const size = cellSize - 2;
            
            terrainCtx.fillStyle = getTerrainColor(terrain);
            terrainCtx.fillRect(x, y, size, size);
          }
        }
      }
      
      terrainLayerRef.current = terrainCanvas;
    }
    
    ctx.drawImage(terrainLayerRef.current, 0, 0);
  }, [eraConfig, cellSize, labelSize, getTerrainColor]);

  // Draw ships for battle mode
  const drawBattleShips = useCallback((ctx, offsetX, offsetY) => {
    if (!gameState?.userId) return;

    const playerView = gameBoard.getPlayerView(
      gameState.userId,
      gameInstance.playerFleets,
      gameInstance.shipOwnership
    );

    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const cellView = playerView[row][col];
        
        if (cellView.hasOwnShip) {
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;
          
          ctx.fillStyle = 'rgba(173, 216, 230, 0.7)';
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }, [gameBoard, gameState, gameInstance, eraConfig, cellSize, labelSize]);

  // Draw ships for placement mode
  const drawPlacementShips = useCallback((ctx, offsetX, offsetY) => {
    if (!humanPlayer) return;

    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        try {
          const shipDataArray = gameBoard.getShipDataAt(row, col);
          if (shipDataArray && shipDataArray.length > 0) {
            const hasPlayerShip = shipDataArray.some(shipData => {
              const ownerId = gameInstance.shipOwnership.get(shipData.shipId);
              return ownerId === humanPlayer.id;
            });
            
            if (hasPlayerShip) {
              const x = offsetX + col * cellSize + labelSize + 1;
              const y = offsetY + row * cellSize + labelSize + 1;
              const size = cellSize - 2;
              
              ctx.fillStyle = 'rgba(173, 216, 230, 0.7)';
              ctx.fillRect(x, y, size, size);
            }
          }
        } catch (error) {
          console.warn(version, 'Error checking ship data at', row, col);
        }
      }
    }
  }, [gameBoard, gameInstance, humanPlayer, eraConfig, cellSize, labelSize]);

  // Draw placement preview
  const drawPlacementPreview = useCallback((ctx, offsetX, offsetY) => {
    if (previewCells.length === 0) return;

    previewCells.forEach(({ row, col }) => {
      const x = offsetX + col * cellSize + labelSize + 1;
      const y = offsetY + row * cellSize + labelSize + 1;
      const size = cellSize - 2;
      
      ctx.fillStyle = isValidPlacement ?
        'rgba(144, 238, 144, 0.8)' : // Light green for valid
        'rgba(255, 179, 179, 0.8)';   // Light red for invalid
      ctx.fillRect(x, y, size, size);
      
      // Add border
      ctx.strokeStyle = isValidPlacement ? '#228B22' : '#DC143C';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, size, size);
    });
  }, [previewCells, isValidPlacement, cellSize, labelSize]);

  // Draw hit overlay for battle mode
  const drawHitOverlay = useCallback((ctx, offsetX, offsetY) => {
    if (mode !== 'battle' || !gameInstance?.visualizer) return;
    
    const visualState = gameInstance.visualizer.getVisualState();
    
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const cellVisuals = visualState[row][col];
        const x = offsetX + col * cellSize + labelSize + 1;
        const y = offsetY + row * cellSize + labelSize + 1;
        const size = cellSize - 2;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        if (cellVisuals.showSkull) {
          // Draw skull indicator
          ctx.strokeStyle = cellVisuals.skullType === 'blue' ? '#0066FF' :
                          cellVisuals.skullType === 'red' ? '#CC0000' : '#666666';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(centerX - 6, centerY - 6);
          ctx.lineTo(centerX + 6, centerY + 6);
          ctx.moveTo(centerX + 6, centerY - 6);
          ctx.lineTo(centerX - 6, centerY + 6);
          ctx.stroke();
        } else {
          // Draw damage rings
          if (cellVisuals.redRingPercent > 0) {
            const ringRadius = size * 0.30;
            const damagePercent = cellVisuals.redRingPercent / 100;
            const damageAngle = (damagePercent * 2 * Math.PI) - (Math.PI / 2);
            
            ctx.strokeStyle = 'rgba(255, 182, 193, 0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, ringRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            if (damagePercent > 0) {
              ctx.strokeStyle = 'rgba(204, 0, 0, 0.9)';
              ctx.beginPath();
              ctx.arc(centerX, centerY, ringRadius, -Math.PI / 2, damageAngle);
              ctx.stroke();
            }
          }

          if (cellVisuals.blueRingPercent > 0) {
            const innerRadius = size * 0.25;
            const damagePercent = cellVisuals.blueRingPercent / 100;
            const damageAngle = (damagePercent * 2 * Math.PI) - (Math.PI / 2);
            
            ctx.strokeStyle = 'rgba(173, 216, 230, 0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            if (damagePercent > 0) {
              ctx.strokeStyle = 'rgba(0, 102, 255, 0.9)';
              ctx.beginPath();
              ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2, damageAngle);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Draw miss markers from shot history
    if (gameState?.userId) {
      const playerMissMarkers = gameBoard.shotHistory.filter(shot =>
        shot.attacker === gameState.userId && shot.result === 'miss'
      );
      
      playerMissMarkers.forEach(shot => {
        const centerX = offsetX + shot.col * cellSize + labelSize + cellSize / 2;
        const centerY = offsetY + shot.row * cellSize + labelSize + cellSize / 2;
        
        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, [mode, gameInstance, eraConfig, gameState, gameBoard, cellSize, labelSize]);

  // Draw animations
  const drawAnimation = useCallback((ctx, anim, offsetX, offsetY) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - anim.progress);
    
    // Calculate actual canvas position with offsets
    const animX = offsetX + anim.col * cellSize + labelSize + cellSize / 2;
    const animY = offsetY + anim.row * cellSize + labelSize + cellSize / 2;
    
    if (anim.type === 'hit') {
      ctx.fillStyle = anim.color;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress), 0, 2 * Math.PI);
      ctx.fill();
    } else if (anim.type === 'miss') {
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress * 2), 0, 2 * Math.PI);
      ctx.stroke();
    } else if (anim.type === 'splash') {
      // Opponent splash animation
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress * 2), 0, 2 * Math.PI);
      ctx.stroke();
      
      // Add ripple effect
      ctx.strokeStyle = `rgba(255, 165, 0, ${0.5 * (1 - anim.progress)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress * 3), 0, 2 * Math.PI);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [cellSize, labelSize]);

  useImperativeHandle(ref, () => ({
    recordOpponentShot: (row, col, result) => {
      console.log('[OPPONENT SHOT]', version, 'Recording at:', row, col, 'Result:', result);
      
      // Show animation for opponent shot
      if (result === 'firing') {
        showOpponentAnimation(row, col, 'firing');
      } else {
        showOpponentAnimation(row, col, result);
        
        if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
          drawCanvas();
        }
      }
    },
    
    // Capture board as PNG
    captureBoard: () => {
      if (!canvasRef.current) return null;
      try {
        // Ensure canvas is fully rendered before capture
        const ctx = canvasRef.current.getContext('2d');
        if (ctx && gameBoard && eraConfig && gameInstance) {
          drawCanvas(); // Force final redraw
        }
        return canvasRef.current.toDataURL('image/png');
      } catch (error) {
        console.error('[CANVAS]', version, 'Failed to capture board:', error);
        return null;
      }
    }
  }), [gameBoard, eraConfig, gameInstance, drawCanvas]);
    
  // Show opponent shot animation
  const showOpponentAnimation = useCallback((row, col, result) => {
    const animId = Date.now() + Math.random();

    let animType = 'splash';
    let color = 'rgba(0, 120, 255, 0.8)'; // Blue for incoming (matches blue damage rings)
    let radius = 10;
    
    if (result === 'hit' || result === 'sunk') {
      animType = 'hit';
      color = 'rgba(0, 102, 255, 0.9)'; // Darker blue for opponent hit (matches blue ring)
      radius = 12;
    } else if (result === 'miss') {
      animType = 'splash';
      color = 'rgba(0, 102, 204, 0.7)'; // Medium blue for miss
      radius = 8;
    }

    const animation = {
      id: animId,
      type: animType,
      row: row,
      col: col,
      radius: radius,
      color: color,
      progress: 0
    };
    
    // Add to ref for immediate access
    animationsRef.current = [...animationsRef.current, animation];
    console.log('[OPPONENT ANIM]', version, 'Animation added:', animType, 'at', row, col, '- Total animations:', animationsRef.current.length);
    
    const startTime = Date.now();
    const duration = 600;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Update progress in ref
      animationsRef.current = animationsRef.current.map(anim =>
        anim.id === animId ? { ...anim, progress } : anim
      );
      
      // Redraw canvas each frame with current animations
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          // Redraw everything
          drawCanvas();
        }
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove animation after completion
        setTimeout(() => {
          animationsRef.current = animationsRef.current.filter(anim => anim.id !== animId);
          console.log('[OPPONENT ANIM]', version, 'Animation removed - Remaining:', animationsRef.current.length);
          // Final redraw
          if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
            drawCanvas();
          }
        }, 200);
      }
    };
    
    requestAnimationFrame(animate);
  }, [gameBoard, eraConfig, gameInstance, drawCanvas]);

  // Handle mouse down for placement start
  const handleMouseDown = useCallback((e) => {
    if (mode !== 'placement' || !currentShip || isPlacing) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 20 - labelSize) / cellSize);

    if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
      setStartCell({ row, col });
      setIsPlacing(true);
      lastProcessedCell.current = { row, col };
      
      // Show immediate horizontal preview
      const defaultCells = [];
      for (let i = 0; i < currentShip.size; i++) {
        defaultCells.push({ row, col: col + i });
      }
      
      setPreviewCells(defaultCells);
      setIsValidPlacement(isValidShipPlacement(defaultCells));
      
      requestAnimationFrame(() => {
        if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
          drawCanvas();
        }
      });
    }
  }, [mode, currentShip, isPlacing, cellSize, labelSize, eraConfig, isValidShipPlacement, gameBoard, gameInstance, drawCanvas]);

  // Handle canvas clicks for battle mode
  const handleCanvasClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 20 - labelSize) / cellSize);

    if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
      if (mode === 'battle' && onShotFired && gameState?.isPlayerTurn) {
        const shotResult = onShotFired(row, col);
        if (shotResult) {
          showShotAnimation(shotResult, row, col);
        }
      }
    }
  }, [mode, gameState, onShotFired, cellSize, labelSize, eraConfig]);

  // Handle mouse move for placement preview
  const handleMouseMove = useCallback((e) => {
    if (mode !== 'placement' || !currentShip || !isPlacing || !startCell) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 20 - labelSize) / cellSize);

    if (row < 0 || row >= eraConfig.rows || col < 0 || col >= eraConfig.cols) return;
    
    const cellChanged = !lastProcessedCell.current ||
                       lastProcessedCell.current.row !== row ||
                       lastProcessedCell.current.col !== col;
    
    if (!cellChanged) return;
    
    lastProcessedCell.current = { row, col };

    const deltaRow = row - startCell.row;
    const deltaCol = col - startCell.col;
    
    let cells = [];
    let direction = 'right';
    
    if (Math.abs(deltaRow) > Math.abs(deltaCol)) {
      direction = deltaRow >= 0 ? 'down' : 'up';
    } else {
      direction = deltaCol >= 0 ? 'right' : 'left';
    }
    
    for (let i = 0; i < currentShip.size; i++) {
      let cellRow = startCell.row;
      let cellCol = startCell.col;
      
      switch (direction) {
        case 'right': cellCol = startCell.col + i; break;
        case 'left': cellCol = startCell.col - i; break;
        case 'down': cellRow = startCell.row + i; break;
        case 'up': cellRow = startCell.row - i; break;
      }
      
      cells.push({ row: cellRow, col: cellCol });
    }
    
    const isValid = isValidShipPlacement(cells);
    
    setPreviewCells(cells);
    setIsValidPlacement(isValid);
    
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && gameBoard && eraConfig && gameInstance) {
      drawCanvas();
      
      const offsetX = 20;
      const offsetY = 20;
      
      cells.forEach(({ row: cellRow, col: cellCol }) => {
        const x = offsetX + cellCol * cellSize + labelSize + 1;
        const y = offsetY + cellRow * cellSize + labelSize + 1;
        const size = cellSize - 2;
        
        ctx.fillStyle = isValid ?
          'rgba(144, 238, 144, 0.8)' :
          'rgba(255, 179, 179, 0.8)';
        ctx.fillRect(x, y, size, size);
        
        ctx.strokeStyle = isValid ? '#228B22' : '#DC143C';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, size, size);
      });
    }
  }, [mode, currentShip, isPlacing, startCell, cellSize, labelSize, eraConfig, gameBoard, gameInstance, isValidShipPlacement, drawCanvas]);

  // Handle mouse up for placement completion
  const handleMouseUp = useCallback((e) => {
    if (mode !== 'placement' || !currentShip || !isPlacing) {
      setPreviewCells([]);
      setIsValidPlacement(false);
      setStartCell(null);
      setIsPlacing(false);
      lastProcessedCell.current = null;
      return;
    }

    if (isValidPlacement && previewCells.length > 0) {
      const deltaRow = previewCells[previewCells.length - 1].row - previewCells[0].row;
      const deltaCol = previewCells[previewCells.length - 1].col - previewCells[0].col;
      const isHorizontal = deltaCol !== 0;
      
      const success = onShipPlaced?.(currentShip, previewCells, isHorizontal ? 'horizontal' : 'vertical');
    }

    setPreviewCells([]);
    setIsValidPlacement(false);
    setStartCell(null);
    setIsPlacing(false);
    lastProcessedCell.current = null;
  }, [mode, currentShip, isPlacing, isValidPlacement, previewCells, onShipPlaced]);

  // NEW v0.1.15: Touch event handlers
  const handleTouchStart = useCallback((e) => {
    e.preventDefault(); // CRITICAL: Prevent page scrolling
    if (mode !== 'placement' || !currentShip || isPlacing) return;

    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 20 - labelSize) / cellSize);

    if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
      setStartCell({ row, col });
      setIsPlacing(true);
      lastProcessedCell.current = { row, col };
      
      const defaultCells = [];
      for (let i = 0; i < currentShip.size; i++) {
        defaultCells.push({ row, col: col + i });
      }
      
      setPreviewCells(defaultCells);
      setIsValidPlacement(isValidShipPlacement(defaultCells));
      
      requestAnimationFrame(() => {
        if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
          drawCanvas();
        }
      });
    }
  }, [mode, currentShip, isPlacing, cellSize, labelSize, eraConfig, isValidShipPlacement, gameBoard, gameInstance, drawCanvas]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault(); // CRITICAL: Prevent page scrolling
    if (mode !== 'placement' || !currentShip || !isPlacing || !startCell) return;

    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 20 - labelSize) / cellSize);

    if (row < 0 || row >= eraConfig.rows || col < 0 || col >= eraConfig.cols) return;
    
    const cellChanged = !lastProcessedCell.current ||
                       lastProcessedCell.current.row !== row ||
                       lastProcessedCell.current.col !== col;
    
    if (!cellChanged) return;
    
    lastProcessedCell.current = { row, col };

    const deltaRow = row - startCell.row;
    const deltaCol = col - startCell.col;
    
    let cells = [];
    let direction = 'right';
    
    if (Math.abs(deltaRow) > Math.abs(deltaCol)) {
      direction = deltaRow >= 0 ? 'down' : 'up';
    } else {
      direction = deltaCol >= 0 ? 'right' : 'left';
    }
    
    for (let i = 0; i < currentShip.size; i++) {
      let cellRow = startCell.row;
      let cellCol = startCell.col;
      
      switch (direction) {
        case 'right': cellCol = startCell.col + i; break;
        case 'left': cellCol = startCell.col - i; break;
        case 'down': cellRow = startCell.row + i; break;
        case 'up': cellRow = startCell.row - i; break;
      }
      
      cells.push({ row: cellRow, col: cellCol });
    }
    
    const isValid = isValidShipPlacement(cells);
    
    setPreviewCells(cells);
    setIsValidPlacement(isValid);
    
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && gameBoard && eraConfig && gameInstance) {
      drawCanvas();
      
      const offsetX = 20;
      const offsetY = 20;
      
      cells.forEach(({ row: cellRow, col: cellCol }) => {
        const x = offsetX + cellCol * cellSize + labelSize + 1;
        const y = offsetY + cellRow * cellSize + labelSize + 1;
        const size = cellSize - 2;
        
        ctx.fillStyle = isValid ?
          'rgba(144, 238, 144, 0.8)' :
          'rgba(255, 179, 179, 0.8)';
        ctx.fillRect(x, y, size, size);
        
        ctx.strokeStyle = isValid ? '#228B22' : '#DC143C';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, size, size);
      });
    }
  }, [mode, currentShip, isPlacing, startCell, cellSize, labelSize, eraConfig, gameBoard, gameInstance, isValidShipPlacement, drawCanvas]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault(); // CRITICAL: Prevent page scrolling
    if (mode !== 'placement' || !currentShip || !isPlacing) {
      setPreviewCells([]);
      setIsValidPlacement(false);
      setStartCell(null);
      setIsPlacing(false);
      lastProcessedCell.current = null;
      return;
    }

    if (isValidPlacement && previewCells.length > 0) {
      const deltaRow = previewCells[previewCells.length - 1].row - previewCells[0].row;
      const deltaCol = previewCells[previewCells.length - 1].col - previewCells[0].col;
      const isHorizontal = deltaCol !== 0;
      
      const success = onShipPlaced?.(currentShip, previewCells, isHorizontal ? 'horizontal' : 'vertical');
    }

    setPreviewCells([]);
    setIsValidPlacement(false);
    setStartCell(null);
    setIsPlacing(false);
    lastProcessedCell.current = null;
  }, [mode, currentShip, isPlacing, isValidPlacement, previewCells, onShipPlaced]);

  // Show player shot animation
  const showShotAnimation = useCallback((shotResult, row, col) => {
    const animId = Date.now() + Math.random();

    const animation = {
      id: animId,
      type: shotResult.result === 'miss' ? 'miss' : 'hit',
      row: row,
      col: col,
      radius: shotResult.result === 'miss' ? 8 : 12,
      color: shotResult.result === 'miss' ? 'rgba(153, 153, 153, 0.7)' : 'rgba(204, 0, 0, 0.9)',
      progress: 0
    };
    
    // Add to ref
    animationsRef.current = [...animationsRef.current, animation];
    
    const startTime = Date.now();
    const duration = 600;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Update progress in ref
      animationsRef.current = animationsRef.current.map(anim =>
        anim.id === animId ? { ...anim, progress } : anim
      );
      
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        drawCanvas();
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          animationsRef.current = animationsRef.current.filter(anim => anim.id !== animId);
          if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
            drawCanvas();
          }
        }, 200);
      }
    };
    
    requestAnimationFrame(animate);
  }, [gameBoard, eraConfig, gameInstance, drawCanvas]);

  // Determine cursor style
  const getCursorStyle = () => {
    if (mode === 'battle') {
      return gameState?.isPlayerTurn && gameState?.isGameActive ? 'crosshair' : 'not-allowed';
    } else {
      return currentShip ? 'copy' : 'default';
    }
  };

  if (!eraConfig || !gameBoard || !gameInstance) {
    return (
      <div className="text-center" style={{ padding: '20px' }}>
        <p>Loading game board...</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        cursor: getCursorStyle(),
        border: '1px solid #ccc',
        borderRadius: '4px',
        touchAction: 'none' // Prevent all default touch behaviors
      }}
    />
  );
});

export default CanvasBoard;
// EOF
