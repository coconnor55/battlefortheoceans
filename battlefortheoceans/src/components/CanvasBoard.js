// src/components/CanvasBoard.js v0.3.4
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.4: Added keyboard debug feature (z key) for admin users
// v0.3.3: Fixed duplicate function definitions (removed code outside component)
// v0.3.2: Added blue bounding boxes for player ships instead of shading
// v0.3.1: Added viewMode prop support (fleet/attack/blended)

import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { useGame } from '../context/GameContext';
import TerrainRenderer from '../renderers/TerrainRenderer';
import AnimationManager from '../renderers/AnimationManager';
import HitOverlayRenderer from '../renderers/HitOverlayRenderer';

const version = 'v0.3.4';

const CanvasBoard = forwardRef(({
  eraConfig,
  gameBoard,
  gameInstance,
  mode = 'battle',
  viewMode = 'blended',
  gameState = null,
  onShotFired = null,
  currentShip = null,
  onShipPlaced = null,
  humanPlayer = null
}, ref) => {
  const canvasRef = useRef(null);
  const { subscribeToUpdates, userProfile } = useGame();
  
  const cellSize = 30;
  const labelSize = 20;
  const boardWidth = eraConfig ? eraConfig.cols * cellSize + labelSize : 0;
  const boardHeight = eraConfig ? eraConfig.rows * cellSize + labelSize : 0;

  const [previewCells, setPreviewCells] = useState([]);
  const [isValidPlacement, setIsValidPlacement] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [startCell, setStartCell] = useState(null);

  const terrainRendererRef = useRef(new TerrainRenderer());
  const animationManagerRef = useRef(new AnimationManager());
  const hitOverlayRendererRef = useRef(new HitOverlayRenderer());
  
  const lastProcessedCell = useRef(null);

  const isAdmin = userProfile?.role === 'admin';

  // Keyboard debug feature for admin
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e) => {
      if (e.key === 'z' || e.key === 'Z') {
        window.DEBUG_SHOW_OPPONENT_SHIPS = true;
        if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
          drawCanvas();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'z' || e.key === 'Z') {
        window.DEBUG_SHOW_OPPONENT_SHIPS = false;
        if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
          drawCanvas();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isAdmin, gameBoard, eraConfig, gameInstance]);

  const getCanvasCoordinates = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  }, []);
  
  useEffect(() => {
    if (eraConfig) {
      terrainRendererRef.current.clearCache();
    }
  }, [eraConfig]);

  useEffect(() => {
    if (mode === 'placement') {
      setPreviewCells([]);
      setIsValidPlacement(false);
      setStartCell(null);
      setIsPlacing(false);
      lastProcessedCell.current = null;
    }
  }, [currentShip, mode]);

  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        drawCanvas();
      }
    });
    return unsubscribe;
  }, [subscribeToUpdates, gameBoard, eraConfig, gameInstance]);

  useEffect(() => {
    if (gameBoard && eraConfig && gameInstance && canvasRef.current) {
      drawCanvas();
    }
  }, [gameBoard, eraConfig, gameInstance, viewMode]);

  const isValidShipPlacement = useCallback((cells) => {
    if (!cells || cells.length === 0 || !currentShip) return false;
    
    for (const cell of cells) {
      if (cell.row < 0 || cell.row >= eraConfig.rows ||
          cell.col < 0 || cell.col >= eraConfig.cols) {
        return false;
      }
      
      if (!gameBoard.isValidCoordinate(cell.row, cell.col)) {
        return false;
      }
      
      const terrain = gameBoard.terrain[cell.row][cell.col];
      if (!currentShip.terrain.includes(terrain)) {
        return false;
      }
      
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

    const getShipBoundingBoxes = useCallback((playerId) => {
        if (!gameInstance || !gameBoard) return [];
        
        // Phase 4: Get player directly from game instance
        const player = gameInstance.players?.find(p => p.id === playerId);
        if (!player) return [];
        
        const shipCells = new Map();
        
        // Phase 4: Read from player.shipPlacements instead of Board.cellContents
        for (const [key, placement] of player.shipPlacements.entries()) {
          const [row, col] = key.split(',').map(Number);
          
          // Validate coordinates are on board
          if (row < 0 || row >= eraConfig.rows || col < 0 || col >= eraConfig.cols) {
            continue;
          }
          
          const shipId = placement.shipId;
          if (!shipCells.has(shipId)) {
            shipCells.set(shipId, []);
          }
          shipCells.get(shipId).push({ row, col });
        }
        
        const boundingBoxes = [];
        for (const [, cells] of shipCells) {
          if (cells.length === 0) continue;
          
          const minRow = Math.min(...cells.map(c => c.row));
          const maxRow = Math.max(...cells.map(c => c.row));
          const minCol = Math.min(...cells.map(c => c.col));
          const maxCol = Math.max(...cells.map(c => c.col));
          
          boundingBoxes.push({
            minRow,
            maxRow,
            minCol,
            maxCol
          });
        }
        
        return boundingBoxes;
      }, [gameInstance, gameBoard, eraConfig]);
    
  const drawShipBoundingBoxes = useCallback((ctx, offsetX, offsetY, playerId, color = '#0011CC') => {
    const boxes = getShipBoundingBoxes(playerId);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    
    boxes.forEach(box => {
      const x = offsetX + box.minCol * cellSize + labelSize;
      const y = offsetY + box.minRow * cellSize + labelSize;
      const width = (box.maxCol - box.minCol + 1) * cellSize;
      const height = (box.maxRow - box.minRow + 1) * cellSize;
      
      ctx.strokeRect(x, y, width, height);
    });
  }, [getShipBoundingBoxes, cellSize, labelSize]);
    
  const drawBattleShips = useCallback((ctx, offsetX, offsetY) => {
    if (!gameState?.userId) return;
    
    // Always draw player ships in blue (fleet or blended view)
    if (viewMode === 'fleet' || viewMode === 'blended') {
      drawShipBoundingBoxes(ctx, offsetX, offsetY, gameState.userId, '#0066CC');
    }
    
    // DEBUG: Draw opponent ships in orange (visible when holding 'z' key as admin)
    const opponentPlayer = gameInstance?.players?.find(p => p.id !== gameState.userId);
    if (opponentPlayer && window.DEBUG_SHOW_OPPONENT_SHIPS) {
      drawShipBoundingBoxes(ctx, offsetX, offsetY, opponentPlayer.id, '#FF6600');
    }
  }, [gameState, viewMode, drawShipBoundingBoxes, gameInstance]);

  const drawPlacementShips = useCallback((ctx, offsetX, offsetY) => {
    if (!humanPlayer) return;
    drawShipBoundingBoxes(ctx, offsetX, offsetY, humanPlayer.id);
  }, [humanPlayer, drawShipBoundingBoxes]);

  const drawPlacementPreview = useCallback((ctx, offsetX, offsetY) => {
    if (previewCells.length === 0) return;

    previewCells.forEach(({ row, col }) => {
      const x = offsetX + col * cellSize + labelSize + 1;
      const y = offsetY + row * cellSize + labelSize + 1;
      const size = cellSize - 2;
      
      ctx.fillStyle = isValidPlacement ?
        'rgba(144, 238, 144, 0.8)' :
        'rgba(255, 179, 179, 0.8)';
      ctx.fillRect(x, y, size, size);
      
      ctx.strokeStyle = isValidPlacement ? '#228B22' : '#DC143C';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, size, size);
    });
  }, [previewCells, isValidPlacement, cellSize, labelSize]);

  const drawCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !gameBoard || !eraConfig || !gameInstance) return;

    ctx.canvas.width = boardWidth + 40;
    ctx.canvas.height = boardHeight + 40;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const offsetX = 20;
    const offsetY = 20;

    terrainRendererRef.current.drawTerrainLayer(ctx, eraConfig, cellSize, labelSize, offsetX, offsetY);

    if (mode === 'battle') {
      drawBattleShips(ctx, offsetX, offsetY);
      hitOverlayRendererRef.current.drawHitOverlay(ctx, eraConfig, gameInstance, gameState, gameBoard, cellSize, labelSize, offsetX, offsetY, viewMode);
    } else {
      drawPlacementShips(ctx, offsetX, offsetY);
      drawPlacementPreview(ctx, offsetX, offsetY);
    }

    animationManagerRef.current.drawAllAnimations(ctx, offsetX, offsetY, cellSize, labelSize);
    animationManagerRef.current.drawAllParticles(ctx, offsetX, offsetY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameBoard, eraConfig, gameInstance, mode, gameState, viewMode, boardWidth, boardHeight]);

  const createExplosion = useCallback((row, col, isOpponentHit = false) => {
    animationManagerRef.current.createExplosion(row, col, isOpponentHit, cellSize, labelSize);
    
    const animateExplosion = () => {
      const stillAlive = animationManagerRef.current.updateParticles();
      
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        drawCanvas();
      }
      
      if (stillAlive) {
        requestAnimationFrame(animateExplosion);
      }
    };
    
    requestAnimationFrame(animateExplosion);
  }, [cellSize, labelSize, gameBoard, eraConfig, gameInstance, drawCanvas]);

  const showOpponentAnimation = useCallback((row, col, result) => {
    const animId = Date.now() + Math.random();

    let animType = 'splash';
    let color = 'rgba(0, 120, 255, 0.8)';
    let radius = 10;
    
    if (result === 'hit' || result === 'sunk') {
      animType = 'hit';
      color = 'rgba(0, 102, 255, 0.9)';
      radius = 12;
    } else if (result === 'miss') {
      animType = 'splash';
      color = 'rgba(0, 102, 204, 0.7)';
      radius = 8;
    }

    animationManagerRef.current.addAnimation(animId, animType, row, col, radius, color);
    
    const startTime = Date.now();
    const duration = 600;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      animationManagerRef.current.updateAnimationProgress(animId, progress);
      
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          drawCanvas();
        }
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          animationManagerRef.current.removeAnimation(animId);
          if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
            drawCanvas();
          }
        }, 200);
      }
    };
    
    requestAnimationFrame(animate);
  }, [gameBoard, eraConfig, gameInstance, drawCanvas]);

  const showShotAnimation = useCallback((shotResult, row, col) => {
    const result = shotResult.result.result;
    const animId = Date.now() + Math.random();

    animationManagerRef.current.addAnimation(
      animId,
      result === 'miss' ? 'miss' : 'hit',
      row,
      col,
      result === 'miss' ? 8 : 12,
      result === 'miss' ? 'rgba(153, 153, 153, 0.7)' : 'rgba(204, 0, 0, 0.9)'
    );
    
    if (result === 'hit' || result === 'sunk') {
      createExplosion(row, col, false);
    }
    
    const startTime = Date.now();
    const duration = 600;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      animationManagerRef.current.updateAnimationProgress(animId, progress);
      
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        drawCanvas();
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          animationManagerRef.current.removeAnimation(animId);
          if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
            drawCanvas();
          }
        }, 200);
      }
    };
    
    requestAnimationFrame(animate);
  }, [gameBoard, eraConfig, gameInstance, drawCanvas, createExplosion]);

  useImperativeHandle(ref, () => ({
    recordOpponentShot: (row, col, result) => {
      if (result === 'firing') {
        showOpponentAnimation(row, col, 'firing');
      } else {
        showOpponentAnimation(row, col, result);
        
        if (result === 'hit' || result === 'sunk') {
          createExplosion(row, col, true);
        }
        
        if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
          drawCanvas();
        }
      }
    },
    
    captureBoard: () => {
      if (!canvasRef.current) return null;
      try {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx && gameBoard && eraConfig && gameInstance) {
          drawCanvas();
        }
        return canvasRef.current.toDataURL('image/png');
      } catch (error) {
        console.error('[CANVAS]', version, 'Failed to capture board:', error);
        return null;
      }
    }
  }), [showOpponentAnimation, gameBoard, eraConfig, gameInstance, drawCanvas, createExplosion]);
    
  const handleMouseDown = useCallback((e) => {
    if (mode !== 'placement' || !currentShip || isPlacing) return;

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
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
  }, [mode, currentShip, isPlacing, cellSize, labelSize, eraConfig, isValidShipPlacement, gameBoard, gameInstance, drawCanvas, getCanvasCoordinates]);

  const handleCanvasClick = useCallback((e) => {
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
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
  }, [mode, gameState, onShotFired, cellSize, labelSize, eraConfig, showShotAnimation, getCanvasCoordinates]);

  const handleMouseMove = useCallback((e) => {
    if (mode !== 'placement' || !currentShip || !isPlacing || !startCell) return;

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 20 - labelSize) / cellSize);

    if (row < 0 || row >= eraConfig.rows || col < 0 || col >= eraConfig.cols) return;
    
    const cellChanged = !lastProcessedCell.current ||
                       lastProcessedCell.current.row !== row ||
                       lastProcessedCell.current.col !== col;
    
    if (!cellChanged) return;
    
    lastProcessedCell.current = { row, col };

    const deltaCol = col - startCell.col;
    
    let cells = [];
    let direction = 'right';
    
    if (Math.abs(row - startCell.row) > Math.abs(deltaCol)) {
      direction = (row - startCell.row) >= 0 ? 'down' : 'up';
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
        default: break;
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
  }, [mode, currentShip, isPlacing, startCell, cellSize, labelSize, eraConfig, gameBoard, gameInstance, isValidShipPlacement, drawCanvas, getCanvasCoordinates]);

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
      const deltaCol = previewCells[previewCells.length - 1].col - previewCells[0].col;
      const isHorizontal = deltaCol !== 0;
      
      onShipPlaced?.(currentShip, previewCells, isHorizontal ? 'horizontal' : 'vertical');
    }

    setPreviewCells([]);
    setIsValidPlacement(false);
    setStartCell(null);
    setIsPlacing(false);
    lastProcessedCell.current = null;
  }, [mode, currentShip, isPlacing, isValidPlacement, previewCells, onShipPlaced]);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    if (mode !== 'placement' || !currentShip || isPlacing) return;

    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
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
  }, [mode, currentShip, isPlacing, cellSize, labelSize, eraConfig, isValidShipPlacement, gameBoard, gameInstance, drawCanvas, getCanvasCoordinates]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (mode !== 'placement' || !currentShip || !isPlacing || !startCell) return;

    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 20 - labelSize) / cellSize);

    if (row < 0 || row >= eraConfig.rows || col < 0 || col >= eraConfig.cols) return;
    
    const cellChanged = !lastProcessedCell.current ||
                       lastProcessedCell.current.row !== row ||
                       lastProcessedCell.current.col !== col;
    
    if (!cellChanged) return;
    
    lastProcessedCell.current = { row, col };

    const deltaCol = col - startCell.col;
    
    let cells = [];
    let direction = 'right';
    
    if (Math.abs(row - startCell.row) > Math.abs(deltaCol)) {
      direction = (row - startCell.row) >= 0 ? 'down' : 'up';
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
        default: break;
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
  }, [mode, currentShip, isPlacing, startCell, cellSize, labelSize, eraConfig, gameBoard, gameInstance, isValidShipPlacement, drawCanvas, getCanvasCoordinates]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    
    if (mode === 'battle') {
      const touch = e.changedTouches[0];
      const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
      const col = Math.floor((x - 20 - labelSize) / cellSize);
      const row = Math.floor((y - 20 - labelSize) / cellSize);

      if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
        if (onShotFired && gameState?.isPlayerTurn) {
          const shotResult = onShotFired(row, col);
          if (shotResult) {
            showShotAnimation(shotResult, row, col);
          }
        }
      }
      return;
    }
    
    if (!currentShip || !isPlacing) {
      setPreviewCells([]);
      setIsValidPlacement(false);
      setStartCell(null);
      setIsPlacing(false);
      lastProcessedCell.current = null;
      return;
    }

    if (isValidPlacement && previewCells.length > 0) {
      const deltaCol = previewCells[previewCells.length - 1].col - previewCells[0].col;
      const isHorizontal = deltaCol !== 0;
      
      onShipPlaced?.(currentShip, previewCells, isHorizontal ? 'horizontal' : 'vertical');
    }

    setPreviewCells([]);
    setIsValidPlacement(false);
    setStartCell(null);
    setIsPlacing(false);
    lastProcessedCell.current = null;
  }, [mode, currentShip, isPlacing, isValidPlacement, previewCells, onShipPlaced, cellSize, labelSize, eraConfig, onShotFired, gameState, showShotAnimation, getCanvasCoordinates]);

  const getCanvasClasses = () => {
    const classes = ['canvas-board'];
    
    if (mode === 'battle') {
      if (gameState?.isPlayerTurn && gameState?.isGameActive) {
        classes.push('canvas-board--battle');
      } else {
        classes.push('canvas-board--battle-waiting');
      }
    } else {
      if (currentShip) {
        classes.push('canvas-board--placement');
      } else {
        classes.push('canvas-board--placement-empty');
      }
    }
    
    return classes.join(' ');
  };

  if (!eraConfig || !gameBoard || !gameInstance) {
    return (
      <div className="loading-container">
        <p>Loading game board...</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={getCanvasClasses()}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
});

export default CanvasBoard;
// EOF
