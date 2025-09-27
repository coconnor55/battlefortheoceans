// src/hooks/useBattleBoard.js
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext';

const version = "v0.3.14"

const useBattleBoard = (eraConfig, gameState, gameBoard, gameInstance) => {
  const canvasRef = useRef(null);
  const { subscribeToUpdates } = useGame();
  
  // Simplified state management - no more complex hit analysis
  const [animations, setAnimations] = useState([]);
  
  // Force re-render trigger
  const [, setRenderTrigger] = useState(0);
  const forceUpdate = useCallback(() => setRenderTrigger(prev => prev + 1), []);

  const cellSize = 30;
  const labelSize = 20;

  // Calculate board dimensions
  const boardWidth = eraConfig ? eraConfig.cols * cellSize + labelSize : 0;
  const boardHeight = eraConfig ? eraConfig.rows * cellSize + labelSize : 0;

  // PERFORMANCE FIX: Direct game state subscription without React state updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      // Direct canvas redraw without triggering React re-renders
      if (canvasRef.current && gameBoard && eraConfig && gameInstance) {
        drawCanvasOptimized();
      }
    });
    return unsubscribe;
  }, [subscribeToUpdates]); // Removed drawCanvasOptimized dependency to fix hoisting

  // INITIAL RENDER: Draw canvas when game components are ready
  useEffect(() => {
    if (gameBoard && eraConfig && gameInstance && canvasRef.current) {
      drawCanvasOptimized();
    }
  }, [gameBoard, eraConfig, gameInstance]); // Removed drawCanvasOptimized dependency to fix hoisting

  // PERFORMANCE FIX: Cache terrain layer without React state
  const terrainLayerRef = useRef(null);
  useEffect(() => {
    if (eraConfig) {
      terrainLayerRef.current = null; // Clear cache on era change
    }
  }, [eraConfig]);

  // PERFORMANCE FIX: Remove ALL React useEffect cascades
  // Canvas updates now happen only via direct subscribeToUpdates callback

  // LAYERED RENDERING: Optimized canvas drawing with performance measurements
  const drawCanvasOptimized = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !gameBoard || !eraConfig || !gameInstance) return;

    ctx.canvas.width = boardWidth + 40;
    ctx.canvas.height = boardHeight + 40;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // LAYER 1: Static terrain + grid (cache when possible)
    if (!terrainLayerRef.current) {
      const terrainCanvas = document.createElement('canvas');
      terrainCanvas.width = ctx.canvas.width;
      terrainCanvas.height = ctx.canvas.height;
      const terrainCtx = terrainCanvas.getContext('2d');
      
      drawStaticTerrainLayer(terrainCtx, 20, 30);
      terrainLayerRef.current = terrainCanvas;
      
      // Draw cached terrain
      ctx.drawImage(terrainCanvas, 0, 0);
    } else {
      // Use cached terrain
      ctx.drawImage(terrainLayerRef.current, 0, 0);
    }

    // LAYER 2: Ship positions (only player ships)
    drawShipLayer(ctx, 20, 30);

    // LAYER 3: Simplified hit overlay using Visualizer data
    drawSimplifiedHitOverlay(ctx, 20, 30);

    // LAYER 4: Animations (temporary effects) - only if animations exist
    if (animations.length > 0) {
      animations.forEach(anim => {
        drawAnimation(ctx, anim);
      });
    }
  }, [gameBoard, eraConfig, gameInstance, animations, boardWidth, boardHeight]);

  // STATIC TERRAIN LAYER: Grid + terrain (renders once, cached)
  const drawStaticTerrainLayer = useCallback((ctx, offsetX, offsetY) => {
    // Draw row labels (numbers) - WHITE for visibility on dark backgrounds
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    for (let row = 0; row < eraConfig.rows; row++) {
      const text = (row + 1).toString();
      const x = offsetX + labelSize / 2;
      const y = offsetY + row * cellSize + labelSize + cellSize / 2 + 4;
      
      // Draw black outline for contrast
      ctx.strokeText(text, x, y);
      // Draw white text on top
      ctx.fillText(text, x, y);
    }

    // Draw column labels (letters) - WHITE for visibility on dark backgrounds
    for (let col = 0; col < eraConfig.cols; col++) {
      const letter = String.fromCharCode(65 + col);
      const x = offsetX + col * cellSize + labelSize + cellSize / 2;
      const y = offsetY + labelSize / 2 + 4;
      
      // Draw black outline for contrast
      ctx.strokeText(letter, x, y);
      // Draw white text on top
      ctx.fillText(letter, x, y);
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

    // Draw terrain background
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const terrain = eraConfig.terrain[row][col];
        if (terrain !== 'excluded') {
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;
          
          ctx.fillStyle = getTerrainColor(terrain);
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }, [eraConfig, cellSize, labelSize]);

  // SHIP LAYER: Player ship positions
  const drawShipLayer = useCallback((ctx, offsetX, offsetY) => {
    const playerView = gameBoard.getPlayerView(
      gameState.userId,
      gameInstance.playerFleets,
      gameInstance.shipOwnership
    );

    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const cellView = playerView[row][col];
        
        // Only draw player ships
        if (cellView.hasOwnShip) {
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;
          
          ctx.fillStyle = 'rgba(173, 216, 230, 0.7)';
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }, [gameBoard, gameState.userId, gameInstance, eraConfig, cellSize, labelSize]);

  // SIMPLIFIED HIT OVERLAY: Clean architecture with single sources of truth
  // - Board.shotHistory = authoritative record of all game events
  // - Visualizer.cells = pure visual effects (rings, skulls)
  const drawSimplifiedHitOverlay = useCallback((ctx, offsetX, offsetY) => {
    if (!gameInstance?.visualizer) return;
    
    const visualState = gameInstance.visualizer.getVisualState();
    
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const cellVisuals = visualState[row][col];
        const x = offsetX + col * cellSize + labelSize + 1;
        const y = offsetY + row * cellSize + labelSize + 1;
        const size = cellSize - 2;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        // Draw simplified indicators based on Visualizer data
        if (cellVisuals.showSkull) {
          // NO background change - just draw colored skulls
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          
          // SKULL COLOR FIX: Apply colors based on skullType from Visualizer
          console.log(`[SKULL RENDER] Cell ${row},${col}: showSkull=${cellVisuals.showSkull}, skullType=${cellVisuals.skullType}`);
          
          // Color skull based on ship ownership
          if (cellVisuals.skullType === 'blue') {
            // Own ships sunk - blue skull
            ctx.fillStyle = '#0066FF';
            console.log(`[SKULL RENDER] Setting BLUE skull at ${row},${col}`);
          } else if (cellVisuals.skullType === 'red') {
            // Enemy ships sunk - red skull
            ctx.fillStyle = '#CC0000';
            console.log(`[SKULL RENDER] Setting RED skull at ${row},${col}`);
          } else {
            // Mixed or unknown - gray skull
            ctx.fillStyle = '#666666';
            console.log(`[SKULL RENDER] Setting GRAY skull at ${row},${col} (skullType: ${cellVisuals.skullType})`);
          }
          
          // EMOJI FIX: Use proper skull emoji character
//          ctx.fillText('💀', centerX, centerY + 4);
            // Instead of: ctx.fillText('💀', centerX, centerY + 4);
            // Draw a simple X or circle:
            ctx.strokeStyle = ctx.fillStyle; // Use the same color
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(centerX - 6, centerY - 6);
            ctx.lineTo(centerX + 6, centerY + 6);
            ctx.moveTo(centerX + 6, centerY - 6);
            ctx.lineTo(centerX - 6, centerY + 6);
            ctx.stroke();
        } else {
          // Draw damage rings for active ships
          
          // RED OUTER RING: Player hits on enemy ships
          if (cellVisuals.redRingPercent > 0) {
            const ringRadius = size * 0.30;
            const ringWidth = 3;
            const damagePercent = cellVisuals.redRingPercent / 100;
            const damageAngle = (damagePercent * 2 * Math.PI) - (Math.PI / 2);
            
            // Pale red circle shows proximity to death
            ctx.strokeStyle = 'rgba(255, 182, 193, 0.4)';
            ctx.lineWidth = ringWidth;
            ctx.beginPath();
            ctx.arc(centerX, centerY, ringRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Solid red arc shows accumulated damage (clockwise from 12 o'clock)
            if (damagePercent > 0) {
              ctx.strokeStyle = 'rgba(204, 0, 0, 0.9)';
              ctx.lineWidth = ringWidth;
              ctx.beginPath();
              ctx.arc(centerX, centerY, ringRadius, -Math.PI / 2, damageAngle);
              ctx.stroke();
            }
          }

          // BLUE INNER RING: Enemy hits on player ships
          if (cellVisuals.blueRingPercent > 0) {
            const innerRadius = size * 0.25; // Nest inside red ring
            const ringWidth = 3;
            const damagePercent = cellVisuals.blueRingPercent / 100;
            const damageAngle = (damagePercent * 2 * Math.PI) - (Math.PI / 2);
            
            // Pale blue circle shows proximity to death
            ctx.strokeStyle = 'rgba(173, 216, 230, 0.4)';
            ctx.lineWidth = ringWidth;
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Solid blue arc shows accumulated damage (clockwise from 12 o'clock)
            if (damagePercent > 0) {
              ctx.strokeStyle = 'rgba(0, 102, 255, 0.9)';
              ctx.lineWidth = ringWidth;
              ctx.beginPath();
              ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2, damageAngle);
              ctx.stroke();
            }
          }
        }
      }
    }

    // MISS MARKERS FIX: Use Board.shotHistory as single source of truth for miss markers
    // Get miss markers from the authoritative shot history
    const playerMissMarkers = gameBoard.shotHistory.filter(shot => {
      // Check against actual player ID from game state
      const isPlayerShot = (shot.attacker === gameState.userId);
      const isMiss = shot.result === 'miss';
      return isPlayerShot && isMiss;
    });
    
    // Debug logging to see what's in shot history
    if (gameBoard.shotHistory.length > 0) {
      console.log('[DEBUG] Shot history sample:', gameBoard.shotHistory.slice(-3));
      console.log('[DEBUG] Looking for player ID:', gameState.userId);
      console.log('[DEBUG] Found player miss markers:', playerMissMarkers.length);
    }
    
    // Draw all player miss markers from single authoritative source
    playerMissMarkers.forEach(shot => {
      const centerX = offsetX + shot.col * cellSize + labelSize + cellSize / 2;
      const centerY = offsetY + shot.row * cellSize + labelSize + cellSize / 2;
      
      // Player miss - small persistent grey dot
      ctx.fillStyle = '#666666';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [gameInstance, eraConfig, gameState.userId, gameBoard, cellSize, labelSize]);

  // ANIMATION RENDERING: Unchanged
  const drawAnimation = useCallback((ctx, anim) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - anim.progress);
    
    if (anim.type === 'hit') {
      ctx.fillStyle = anim.color;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius * (1 + anim.progress), 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius * (0.5 + anim.progress * 0.3), 0, 2 * Math.PI);
      ctx.fill();
      
    } else if (anim.type === 'miss') {
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius * (1 + anim.progress * 2), 0, 2 * Math.PI);
      ctx.stroke();
      
    } else if (anim.type === 'opponent-miss') {
      const alpha = Math.max(0, 1 - anim.progress);
      
      ctx.fillStyle = `rgba(128, 128, 128, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius * 0.4, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = `rgba(100, 100, 100, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
    
    ctx.restore();
  }, []);

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

  // CLICK HANDLING: Optimized for immediate feedback
  const handleCanvasClick = useCallback((e, onShotFired) => {
    console.log('TIMING: Click received at', Date.now());
    if (!gameState.isPlayerTurn || !gameBoard || !eraConfig) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 30 - labelSize) / cellSize);

    if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
      const shotResult = onShotFired(row, col);
      console.log('TIMING: Shot result received at', Date.now());

      if (shotResult) {
        console.log('TIMING: Starting animation at', Date.now());
        showShotAnimation(shotResult, 'player');
        
        // PERFORMANCE FIX: Direct canvas redraw instead of forceUpdate
        drawCanvasOptimized();
      }
    }
  }, [gameState.isPlayerTurn, gameBoard, eraConfig, cellSize, labelSize, drawCanvasOptimized]);

  // OPPONENT SHOT RECORDING: Simplified
  const recordOpponentShot = useCallback((row, col, result) => {
    // Only show animation for opponent misses
    if (result === 'miss') {
      showShotAnimation({ result, row, col }, 'opponent');
    }
  }, []);

  // ANIMATION SYSTEM: Unchanged
  const showShotAnimation = useCallback(({ result, row, col }, shooter) => {
    const animX = 20 + col * cellSize + labelSize + cellSize / 2;
    const animY = 30 + row * cellSize + labelSize + cellSize / 2;
    const animId = Date.now() + Math.random();

    if (result === 'hit' || result === 'sunk') {
      const animation = {
        id: animId,
        type: 'hit',
        x: animX,
        y: animY,
        radius: 12,
        color: shooter === 'player' ? 'rgba(204, 0, 0, 0.9)' : 'rgba(255, 179, 71, 0.9)',
        progress: 0
      };
      
      setAnimations(prev => [...prev, animation]);
      
      const startTime = Date.now();
      const duration = 800;
      
      const animateBloom = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        setAnimations(prev => prev.map(anim =>
          anim.id === animId ? { ...anim, progress } : anim
        ));
        
        if (progress < 1) {
          requestAnimationFrame(animateBloom);
        } else {
          setTimeout(() => {
            setAnimations(prev => prev.filter(anim => anim.id !== animId));
          }, 200);
        }
      };
      
      requestAnimationFrame(animateBloom);
      
    } else if (result === 'miss') {
      if (shooter === 'player') {
        const animation = {
          id: animId,
          type: 'miss',
          x: animX,
          y: animY,
          radius: 8,
          color: 'rgba(153, 153, 153, 0.7)',
          progress: 0
        };
        
        setAnimations(prev => [...prev, animation]);
        
        const startTime = Date.now();
        const duration = 400;
        
        const animateSplash = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          setAnimations(prev => prev.map(anim =>
            anim.id === animId ? { ...anim, progress } : anim
          ));
          
          if (progress < 1) {
            requestAnimationFrame(animateSplash);
          } else {
            setAnimations(prev => prev.filter(anim => anim.id !== animId));
          }
        };
        
        requestAnimationFrame(animateSplash);
        
      } else {
        const animation = {
          id: animId,
          type: 'opponent-miss',
          x: animX,
          y: animY,
          radius: 12,
          color: 'rgba(128, 128, 128, 0.9)',
          progress: 0
        };
        
        setAnimations(prev => [...prev, animation]);
        
        const startTime = Date.now();
        const holdDuration = 3000;
        const fadeDuration = 1000;
        const totalDuration = holdDuration + fadeDuration;
        
        const animateOpponentMiss = () => {
          const elapsed = Date.now() - startTime;
          let progress;
          
          if (elapsed < holdDuration) {
            progress = 0;
          } else {
            progress = (elapsed - holdDuration) / fadeDuration;
          }
          
          progress = Math.min(progress, 1);
          
          setAnimations(prev => prev.map(anim =>
            anim.id === animId ? { ...anim, progress } : anim
          ));
          
          if (elapsed < totalDuration) {
            requestAnimationFrame(animateOpponentMiss);
          } else {
            setAnimations(prev => prev.filter(anim => anim.id !== animId));
          }
        };
        
        requestAnimationFrame(animateOpponentMiss);
      }
    }
  }, [cellSize, labelSize]);

  return {
    canvasRef,
    handleCanvasClick,
    drawCanvas: drawCanvasOptimized,
    boardWidth,
    boardHeight,
    recordOpponentShot,
    isReady: !!(eraConfig && gameBoard && gameInstance)
  };
};

export default useBattleBoard;
// EOF
