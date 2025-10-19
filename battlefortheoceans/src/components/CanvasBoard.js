// src/components/CanvasBoard.js v0.3.13
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.14: Fixed orientation to match canvas CW rotation (0°=right, 90°=down, 180°=left, 270°=up)
// v0.3.13: Fixed vertical placement orientation (was reversed)
//          - Down drag now correctly = 90°, Up drag = 270°
// v0.3.12: Commented out blue bounding boxes (using SVG ship outlines instead)
// v0.3.11: Fixed manual placement to send all 4 orientations (0/90/180/270)
//          - Was only sending 0° or 90°
//          - Now detects drag direction and maps to correct degree
// v0.3.10: Preload ship SVGs in placement mode to fix z-order issues
// v0.3.9: Added ship outline rendering in placement mode
// v0.3.8: ORIENTATION FIX - Send numeric degrees (0/90) instead of strings
//         - Changed 'horizontal'/'vertical' to 0/90 for manual placement
//         - Matches Player.js v0.9.2 orientation validation
// v0.3.7: OPTIMIZED RENDER LOOP - Removed static data from 30fps loop
//         - Pass eraId, gameBoard to renderer constructors (not through loop)
//         - Only pass humanPlayerId instead of whole player object
//         - cellSize/labelSize as constants, not dependencies
// v0.3.6: UXENGINE INTEGRATION - Uses UXEngine for 30fps rendering loop

import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { useGame } from '../context/GameContext';
import TerrainRenderer from '../renderers/TerrainRenderer';
import AnimationManager from '../renderers/AnimationManager';
import HitOverlayRenderer from '../renderers/HitOverlayRenderer';
import UXEngine from '../engines/UXEngine';

const version = 'v0.3.14';

// Constants - never change during game
const CELL_SIZE = 30;
const LABEL_SIZE = 20;

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
  
  const boardWidth = eraConfig ? eraConfig.cols * CELL_SIZE + LABEL_SIZE : 0;
  const boardHeight = eraConfig ? eraConfig.rows * CELL_SIZE + LABEL_SIZE : 0;

  const [previewCells, setPreviewCells] = useState([]);
  const [isValidPlacement, setIsValidPlacement] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [startCell, setStartCell] = useState(null);

  // Lazy initialization - only create once with era and board
  const terrainRendererRef = useRef(null);
  if (!terrainRendererRef.current && eraConfig && gameBoard) {
    terrainRendererRef.current = new TerrainRenderer();
    terrainRendererRef.current.setBoard(eraConfig, gameBoard);
    console.log('[CANVAS]', version, 'TerrainRenderer created');
  }

  const animationManagerRef = useRef(null);
  if (!animationManagerRef.current) {
    animationManagerRef.current = new AnimationManager();
  }

  const hitOverlayRendererRef = useRef(null);
  if (!hitOverlayRendererRef.current && eraConfig && gameBoard) {
    hitOverlayRendererRef.current = new HitOverlayRenderer(eraConfig.era, gameBoard);
    console.log('[CANVAS]', version, 'HitOverlayRenderer created with era:', eraConfig.era);
  }

  const uxEngineRef = useRef(null);
  if (!uxEngineRef.current) {
    uxEngineRef.current = new UXEngine();
    console.log('[CANVAS]', version, 'UXEngine created');
  }
    
  const lastProcessedCell = useRef(null);
  const isAdmin = userProfile?.role === 'admin';

  // OPTIMIZED: Only store data that changes frequently
  const propsRef = useRef({
    mode,
    viewMode,
    gameState,
    gameInstance,
    previewCells,
    isValidPlacement,
    humanPlayerId: humanPlayer?.id
  });

  // Preload all ship SVGs when entering placement mode
  useEffect(() => {
    if (mode === 'placement' && humanPlayer?.fleet?.ships && hitOverlayRendererRef.current) {
      // Preload blue SVGs for all ship classes
      const shipClasses = new Set();
      humanPlayer.fleet.ships.forEach(ship => {
        shipClasses.add(ship.class);
      });
      
      console.log('[CANVAS]', version, 'Preloading ship SVGs:', Array.from(shipClasses));
      shipClasses.forEach(shipClass => {
        hitOverlayRendererRef.current.loadShipSvg(shipClass, 'blue');
      });
    }
  }, [mode, humanPlayer?.fleet?.ships]);

  useEffect(() => {
    propsRef.current = {
      mode,
      viewMode,
      gameState,
      gameInstance,
      previewCells,
      isValidPlacement,
      humanPlayerId: humanPlayer?.id
    };
  }, [mode, viewMode, gameState, gameInstance, previewCells, isValidPlacement, humanPlayer?.id]);

  // Render function called by UXEngine at 30fps
  const renderFrame = useCallback(() => {
    const props = propsRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    
    if (!ctx || !gameBoard || !eraConfig || !props.gameInstance) {
      return;
    }

    ctx.canvas.width = boardWidth + 40;
    ctx.canvas.height = boardHeight + 40;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const offsetX = 20;
    const offsetY = 20;

    // Draw terrain (uses stored eraConfig and gameBoard)
    terrainRendererRef.current.drawTerrainLayer(ctx, CELL_SIZE, LABEL_SIZE, offsetX, offsetY);

    // Draw mode-specific content
    if (props.mode === 'battle') {
      // Draw ship bounding boxes (COMMENTED OUT - using SVG outlines instead)
      // if (props.gameState?.userId) {
      //   if (props.viewMode === 'fleet' || props.viewMode === 'blended') {
      //     drawShipBoundingBoxes(ctx, offsetX, offsetY, props.gameState.userId, '#0066CC');
      //   }
      //
      //   // DEBUG: Draw opponent ships
      //   const opponentPlayer = props.gameInstance?.players?.find(p => p.id !== props.gameState.userId);
      //   if (opponentPlayer && window.DEBUG_SHOW_OPPONENT_SHIPS) {
      //     drawShipBoundingBoxes(ctx, offsetX, offsetY, opponentPlayer.id, '#FF6600');
      //   }
      // }

      // Draw hit overlays (uses stored eraId and gameBoard)
      hitOverlayRendererRef.current.drawHitOverlay(
        ctx,
        props.gameInstance,
        props.gameState,
        CELL_SIZE,
        LABEL_SIZE,
        offsetX,
        offsetY,
        props.viewMode
      );
    } else {
      // Placement mode
      if (props.humanPlayerId) {
        const player = props.gameInstance.players.find(p => p.id === props.humanPlayerId);
        if (player && player.fleet && player.fleet.ships) {
          // Draw ship outlines for placed ships
          player.fleet.ships.forEach(ship => {
            if (ship.isPlaced) {
              // Collect all cells for this ship
              const shipCells = [];
              for (let row = 0; row < eraConfig.rows; row++) {
                for (let col = 0; col < eraConfig.cols; col++) {
                  const placement = player.getShipAt(row, col);
                  if (placement && placement.shipId === ship.id) {
                    shipCells.push({ row, col });
                  }
                }
              }
              
              // Draw ship outline (blue, full opacity)
              if (shipCells.length > 0) {
                hitOverlayRendererRef.current.drawShipOutline(
                  ctx,
                  ship,
                  shipCells,
                  CELL_SIZE,
                  LABEL_SIZE,
                  offsetX,
                  offsetY,
                  player,
                  1.0, // Full opacity in placement
                  'blue'
                );
              }
            }
          });
        }
      }

      // Draw preview
      if (props.previewCells.length > 0) {
        props.previewCells.forEach(({ row, col }) => {
          const x = offsetX + col * CELL_SIZE + LABEL_SIZE + 1;
          const y = offsetY + row * CELL_SIZE + LABEL_SIZE + 1;
          const size = CELL_SIZE - 2;
          
          ctx.fillStyle = props.isValidPlacement ?
            'rgba(144, 238, 144, 0.8)' :
            'rgba(255, 179, 179, 0.8)';
          ctx.fillRect(x, y, size, size);
          
          ctx.strokeStyle = props.isValidPlacement ? '#228B22' : '#DC143C';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, size, size);
        });
      }
    }

    // Draw animations and particles
    animationManagerRef.current.drawAllAnimations(ctx, offsetX, offsetY, CELL_SIZE, LABEL_SIZE);
    animationManagerRef.current.drawAllParticles(ctx, offsetX, offsetY);
  }, [boardWidth, boardHeight, eraConfig, gameBoard, gameInstance]);

  // Start/stop UXEngine
  useEffect(() => {
    const uxEngine = uxEngineRef.current;
    
    if (!uxEngine) return;

    console.log('[CANVAS]', version, 'Starting UXEngine');
    uxEngine.start(renderFrame);

    return () => {
      console.log('[CANVAS]', version, 'Stopping UXEngine');
      uxEngine.stop();
    };
  }, [renderFrame]);

  // Keyboard debug feature for admin
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e) => {
      if (e.key === 'z' || e.key === 'Z') {
        window.DEBUG_SHOW_OPPONENT_SHIPS = true;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'z' || e.key === 'Z') {
        window.DEBUG_SHOW_OPPONENT_SHIPS = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isAdmin]);

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
    if (eraConfig && terrainRendererRef.current) {
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

  // Remove React-triggered redraws - UXEngine handles all rendering
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      // Do nothing - UXEngine draws continuously
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

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
    
    const player = gameInstance.players?.find(p => p.id === playerId);
    if (!player) return [];
    
    const shipCells = new Map();
    
    for (const [key, placement] of player.shipPlacements.entries()) {
      const [row, col] = key.split(',').map(Number);
      
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
      const x = offsetX + box.minCol * CELL_SIZE + LABEL_SIZE;
      const y = offsetY + box.minRow * CELL_SIZE + LABEL_SIZE;
      const width = (box.maxCol - box.minCol + 1) * CELL_SIZE;
      const height = (box.maxRow - box.minRow + 1) * CELL_SIZE;
      
      ctx.strokeRect(x, y, width, height);
    });
  }, [getShipBoundingBoxes]);

  const createExplosion = useCallback((row, col, isOpponentHit = false) => {
    animationManagerRef.current.createExplosion(row, col, isOpponentHit, CELL_SIZE, LABEL_SIZE);
    
    const animateExplosion = () => {
      const stillAlive = animationManagerRef.current.updateParticles();
      
      if (stillAlive) {
        requestAnimationFrame(animateExplosion);
      }
    };
    
    requestAnimationFrame(animateExplosion);
  }, []);

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
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          animationManagerRef.current.removeAnimation(animId);
        }, 200);
      }
    };
    
    requestAnimationFrame(animate);
  }, []);

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
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          animationManagerRef.current.removeAnimation(animId);
        }, 200);
      }
    };
    
    requestAnimationFrame(animate);
  }, [createExplosion]);

    // Add this to the useImperativeHandle in CanvasBoard.js
    // Replace the existing useImperativeHandle (around line 364)

    useImperativeHandle(ref, () => ({
      recordOpponentShot: (row, col, result) => {
        if (result === 'firing') {
          showOpponentAnimation(row, col, 'firing');
        } else {
          showOpponentAnimation(row, col, result);
          
          if (result === 'hit' || result === 'sunk') {
            createExplosion(row, col, true);
          }
        }
      },
      
      captureBoard: () => {
        if (!canvasRef.current) return null;
        try {
          return canvasRef.current.toDataURL('image/png');
        } catch (error) {
          console.error('[CANVAS]', version, 'Failed to capture board:', error);
          return null;
        }
      },
      
      // NEW: Capture winner's board with appropriate view
      captureWinnerBoard: (winnerId) => {
        if (!canvasRef.current || !gameState?.userId) return null;
        
        try {
          // Determine which view to capture based on who won
          const humanPlayerId = gameState.userId;
          const isPlayerWinner = winnerId === humanPlayerId;
          
          // If player won: show attack view (enemy ships revealed)
          // If AI won: show fleet view (player's destroyed fleet)
          const captureViewMode = isPlayerWinner ? 'attack' : 'fleet';
          
          console.log('[CANVAS]', version, `Capturing ${captureViewMode} view for winner:`, winnerId);
          
          // Temporarily update propsRef to render the correct view
          const originalViewMode = propsRef.current.viewMode;
          propsRef.current.viewMode = captureViewMode;
          
          // Force a render with the new view mode
          renderFrame();
          
          // Capture the canvas
          const imageData = canvasRef.current.toDataURL('image/png');
          
          // Restore original view mode
          propsRef.current.viewMode = originalViewMode;
          
          return imageData;
        } catch (error) {
          console.error('[CANVAS]', version, 'Failed to capture winner board:', error);
          return null;
        }
      }
    }), [showOpponentAnimation, createExplosion, gameState, renderFrame]);
    
  const handleMouseDown = useCallback((e) => {
    if (mode !== 'placement' || !currentShip || isPlacing) return;

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const col = Math.floor((x - 20 - LABEL_SIZE) / CELL_SIZE);
    const row = Math.floor((y - 20 - LABEL_SIZE) / CELL_SIZE);

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
    }
  }, [mode, currentShip, isPlacing, eraConfig, isValidShipPlacement, getCanvasCoordinates]);

  const handleCanvasClick = useCallback((e) => {
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const col = Math.floor((x - 20 - LABEL_SIZE) / CELL_SIZE);
    const row = Math.floor((y - 20 - LABEL_SIZE) / CELL_SIZE);

    if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
      if (mode === 'battle' && onShotFired && gameState?.isPlayerTurn) {
        const shotResult = onShotFired(row, col);
        if (shotResult) {
          showShotAnimation(shotResult, row, col);
        }
      }
    }
  }, [mode, gameState, onShotFired, eraConfig, showShotAnimation, getCanvasCoordinates]);

  const handleMouseMove = useCallback((e) => {
    if (mode !== 'placement' || !currentShip || !isPlacing || !startCell) return;

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const col = Math.floor((x - 20 - LABEL_SIZE) / CELL_SIZE);
    const row = Math.floor((y - 20 - LABEL_SIZE) / CELL_SIZE);

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
  }, [mode, currentShip, isPlacing, startCell, eraConfig, isValidShipPlacement, getCanvasCoordinates]);

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
      // Determine orientation from preview cells
      const firstCell = previewCells[0];
      const lastCell = previewCells[previewCells.length - 1];
      
      const deltaCol = lastCell.col - firstCell.col;
      const deltaRow = lastCell.row - firstCell.row;
      
      let orientation = 0; // default
      
      // Determine which direction the ship extends (computer graphics: CW rotation)
      // 0° = right, 90° = down, 180° = left, 270° = up
      if (Math.abs(deltaCol) > Math.abs(deltaRow)) {
        // Horizontal
        orientation = deltaCol > 0 ? 0 : 180; // Right drag = 0°, Left drag = 180°
      } else {
        // Vertical
        orientation = deltaRow > 0 ? 90 : 270; // Down drag = 90°, Up drag = 270°
      }
      
      onShipPlaced?.(currentShip, previewCells, orientation);
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
    const col = Math.floor((x - 20 - LABEL_SIZE) / CELL_SIZE);
    const row = Math.floor((y - 20 - LABEL_SIZE) / CELL_SIZE);

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
    }
  }, [mode, currentShip, isPlacing, eraConfig, isValidShipPlacement, getCanvasCoordinates]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (mode !== 'placement' || !currentShip || !isPlacing || !startCell) return;

    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    const col = Math.floor((x - 20 - LABEL_SIZE) / CELL_SIZE);
    const row = Math.floor((y - 20 - LABEL_SIZE) / CELL_SIZE);

    if (row < 0 || row >= eraConfig.rows || col < 0 || col < eraConfig.cols) return;
    
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
  }, [mode, currentShip, isPlacing, startCell, eraConfig, isValidShipPlacement, getCanvasCoordinates]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    
    if (mode === 'battle') {
      const touch = e.changedTouches[0];
      const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
      const col = Math.floor((x - 20 - LABEL_SIZE) / CELL_SIZE);
      const row = Math.floor((y - 20 - LABEL_SIZE) / CELL_SIZE);

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
      // Determine orientation from preview cells
      const firstCell = previewCells[0];
      const lastCell = previewCells[previewCells.length - 1];
      
      const deltaCol = lastCell.col - firstCell.col;
      const deltaRow = lastCell.row - firstCell.row;
      
      let orientation = 0; // default
      
      // Determine which direction the ship extends
      if (Math.abs(deltaCol) > Math.abs(deltaRow)) {
        // Horizontal
        orientation = deltaCol > 0 ? 0 : 180; // Right drag = 0°, Left drag = 180°
      } else {
        // Vertical (clockwise: 90°=down, 270°=up)
        orientation = deltaRow > 0 ? 90 : 270; // Down drag = 90°, Up drag = 270°
      }
      
      onShipPlaced?.(currentShip, previewCells, orientation);
    }

    setPreviewCells([]);
    setIsValidPlacement(false);
    setStartCell(null);
    setIsPlacing(false);
    lastProcessedCell.current = null;
  }, [mode, currentShip, isPlacing, isValidPlacement, previewCells, onShipPlaced, eraConfig, onShotFired, gameState, showShotAnimation, getCanvasCoordinates]);

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
