// src/components/CanvasBoard.js
// Copyright(c) 2025, Clint H. O'Connor
//
// v0.4.9: FIXED opponent ship rendering when DEBUG_SHOW_OPPONENT_SHIPS is true
// v0.4.8: FIXED stale currentShip closure in InputHandler validation
//         - Bug: InputHandler captured isValidShipPlacement at creation with USS Macedonian
//         - When placing later ships (USS Alligator), validation still checked against Macedonian
//         - Fix: Store isValidShipPlacement in ref, InputHandler reads from ref dynamically
//         - Pattern: Same as mode/gameState - read from ref, not captured closure
// v0.4.7: Fixed ship placement validation - removed call to deleted Board.getShipDataAt()

import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import ReactDOM from 'react-dom';
import { useGame } from '../context/GameContext';
import TerrainRenderer from '../renderers/TerrainRenderer';
import AnimationManager from '../renderers/AnimationManager';
import HitOverlayRenderer from '../renderers/HitOverlayRenderer';
import UXEngine from '../engines/UXEngine';
import InputHandler from '../handlers/InputHandler';
import ActionMenu from './ActionMenu';

const version = 'v0.4.8';

// Constants
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
  onStarShellFired = null,
  currentShip = null,
  onShipPlaced = null,
  humanPlayer = null,
  starShellsRemaining = 0
}, ref) => {
  const canvasRef = useRef(null);
  const { subscribeToUpdates, userProfile } = useGame();
  
  const boardWidth = eraConfig ? eraConfig.cols * CELL_SIZE + LABEL_SIZE : 0;
  const boardHeight = eraConfig ? eraConfig.rows * CELL_SIZE + LABEL_SIZE : 0;

  const [previewCells, setPreviewCells] = useState([]);
  const [isValidPlacement, setIsValidPlacement] = useState(false);
  
  // Star shell state
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPos, setActionMenuPos] = useState({ x: 0, y: 0 });
  const [actionMenuCell, setActionMenuCell] = useState(null);
  const [starShellIllumination, setStarShellIllumination] = useState(null);

  // Lazy initialization
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
  
  const inputHandlerRef = useRef(null);
    
  const isAdmin = userProfile?.role === 'admin';

  const propsRef = useRef({
    mode,
    viewMode,
    gameState,
    gameInstance,
    previewCells,
    isValidPlacement,
    humanPlayerId: humanPlayer?.id,
    starShellIllumination
  });

  // Store ALL dynamic props that InputHandler needs
  const inputPropsRef = useRef({
    mode,
    gameState,
    currentShip,
    starShellsRemaining
  });

  // Preload ship SVGs
  useEffect(() => {
    if (mode === 'placement' && humanPlayer?.fleet?.ships && hitOverlayRendererRef.current) {
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
      humanPlayerId: humanPlayer?.id,
      starShellIllumination
    };
  }, [mode, viewMode, gameState, gameInstance, previewCells, isValidPlacement, humanPlayer?.id, starShellIllumination]);

  // Update inputPropsRef with ALL dynamic values
  useEffect(() => {
    inputPropsRef.current = {
      mode,
      gameState,
      currentShip,
      starShellsRemaining
    };
  }, [mode, gameState, currentShip, starShellsRemaining]);

  // Star shell illumination effect
  const triggerStarShell = useCallback((centerRow, centerCol) => {
    if (starShellsRemaining <= 0) return;
    
    console.log('[CANVAS]', version, 'Star shell at', centerRow, centerCol);
    
    const illuminatedCells = [];
    
    // Get pattern from era config (defaults to 5x5 for backward compatibility)
    const pattern = eraConfig?.resources?.star_shell_pattern || '5x5';
    
    // Center cell: 100% opacity
    illuminatedCells.push({ row: centerRow, col: centerCol, opacity: 1.0 });
    
    // Adjacent 8 cells (distance 1): 50% opacity
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue; // Skip center
        const r = centerRow + dr;
        const c = centerCol + dc;
        if (r >= 0 && r < eraConfig.rows && c >= 0 && c < eraConfig.cols) {
          illuminatedCells.push({ row: r, col: c, opacity: 0.5 });
        }
      }
    }
    
    // Outer ring only for 5x5 pattern
    if (pattern === '5x5') {
      // All cells at distance 2 (full 5x5 square outer ring): 25% opacity
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          // Skip inner 3x3 already covered
          if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) continue;
          
          const r = centerRow + dr;
          const c = centerCol + dc;
          if (r >= 0 && r < eraConfig.rows && c >= 0 && c < eraConfig.cols) {
            illuminatedCells.push({ row: r, col: c, opacity: 0.25 });
          }
        }
      }
    }
    
    setStarShellIllumination({
      cells: illuminatedCells,
      startTime: Date.now()
    });
    
    // Clear after 2 seconds
    setTimeout(() => {
      setStarShellIllumination(null);
    }, 2000);
    
    onStarShellFired?.(centerRow, centerCol);
    
  }, [starShellsRemaining, eraConfig, onStarShellFired]);

  // Render function
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

    // Draw terrain
    terrainRendererRef.current.drawTerrainLayer(ctx, CELL_SIZE, LABEL_SIZE, offsetX, offsetY);

    if (props.mode === 'battle') {
      // Draw hit overlays
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
      
        // Admin debug: Show opponent ships when 'Z' key is held
        if (window.DEBUG_SHOW_OPPONENT_SHIPS && props.humanPlayerId) {
          const opponentPlayers = props.gameInstance.players.filter(p => p.id !== props.humanPlayerId);
          
          opponentPlayers.forEach(opponent => {
            if (opponent.fleet && opponent.fleet.ships) {
              opponent.fleet.ships.forEach(ship => {
                if (ship.isPlaced) {
                  const shipCells = [];
                  for (let row = 0; row < eraConfig.rows; row++) {
                    for (let col = 0; col < eraConfig.cols; col++) {
                      const placement = opponent.getShipAt(row, col);
                      if (placement && placement.shipId === ship.id) {
                        shipCells.push({ row, col });
                      }
                    }
                  }
                  
                  if (shipCells.length > 0) {
                    hitOverlayRendererRef.current.drawShipOutline(
                      ctx,
                      ship,
                      shipCells,
                      CELL_SIZE,
                      LABEL_SIZE,
                      offsetX,
                      offsetY,
                      opponent,
                      0.6, // Semi-transparent debug view
                      'red' // Enemy ships in red
                    );
                  }
                }
              });
            }
          });
        }
        
      // Draw star shell illumination
      if (props.starShellIllumination) {
        const elapsed = Date.now() - props.starShellIllumination.startTime;
        const progress = Math.min(elapsed / 2000, 1.0); // 2 second duration
        const fadeOpacity = 1.0 - progress; // Fade out over time
        
        props.starShellIllumination.cells.forEach(({ row, col, opacity }) => {
          // Find enemy ships at this cell
          const opponentPlayers = props.gameInstance.players.filter(p => p.id !== props.humanPlayerId);
          
          opponentPlayers.forEach(opponent => {
            const shipPlacement = opponent.getShipAt(row, col);
            if (shipPlacement) {
              const ship = opponent.getShip(shipPlacement.shipId);
              
              // Collect all cells for this ship
              const shipCells = [];
              for (let r = 0; r < eraConfig.rows; r++) {
                for (let c = 0; c < eraConfig.cols; c++) {
                  const placement = opponent.getShipAt(r, c);
                  if (placement && placement.shipId === ship.id) {
                    shipCells.push({ row: r, col: c });
                  }
                }
              }
              
              // Draw ship outline with calculated opacity
              const finalOpacity = opacity * fadeOpacity;
              hitOverlayRendererRef.current.drawShipOutline(
                ctx,
                ship,
                shipCells,
                CELL_SIZE,
                LABEL_SIZE,
                offsetX,
                offsetY,
                opponent,
                finalOpacity,
                'red' // Enemy ships shown in red during illumination
              );
            }
          });
          
          // Draw illumination glow effect
          const x = offsetX + col * CELL_SIZE + LABEL_SIZE + CELL_SIZE / 2;
          const y = offsetY + row * CELL_SIZE + LABEL_SIZE + CELL_SIZE / 2;
          const glowOpacity = opacity * fadeOpacity * 0.3;
          
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, CELL_SIZE * 1.5);
          gradient.addColorStop(0, `rgba(255, 255, 200, ${glowOpacity})`);
          gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(
            offsetX + col * CELL_SIZE + LABEL_SIZE - CELL_SIZE,
            offsetY + row * CELL_SIZE + LABEL_SIZE - CELL_SIZE,
            CELL_SIZE * 3,
            CELL_SIZE * 3
          );
        });
      }
    } else {
      // Placement mode - draw placed ships
      if (props.humanPlayerId) {
        const player = props.gameInstance.players.find(p => p.id === props.humanPlayerId);
        if (player && player.fleet && player.fleet.ships) {
          player.fleet.ships.forEach(ship => {
            if (ship.isPlaced) {
              const shipCells = [];
              for (let row = 0; row < eraConfig.rows; row++) {
                for (let col = 0; col < eraConfig.cols; col++) {
                  const placement = player.getShipAt(row, col);
                  if (placement && placement.shipId === ship.id) {
                    shipCells.push({ row, col });
                  }
                }
              }
              
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
                  1.0,
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

  // Keyboard debug
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
  
  useEffect(() => {
    if (eraConfig && terrainRendererRef.current) {
      terrainRendererRef.current.clearCache();
    }
  }, [eraConfig]);

  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      // UXEngine handles rendering
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

  // v0.4.8: Store validation callback in ref for dynamic access by InputHandler
  const validationCallbackRef = useRef(null);
  
  const isValidShipPlacement = useCallback((cells) => {
    // v0.4.8: Read currentShip from inputPropsRef (always fresh)
    const ship = inputPropsRef.current.currentShip;
    
    if (!cells || cells.length === 0 || !ship) return false;
    
    for (const cell of cells) {
      // Check bounds
      if (cell.row < 0 || cell.row >= eraConfig.rows ||
          cell.col < 0 || cell.col >= eraConfig.cols) {
        return false;
      }
      
      // Check if coordinate is valid (not excluded)
      if (!gameBoard.isValidCoordinate(cell.row, cell.col)) {
        return false;
      }
      
      // Check terrain compatibility
      const terrain = gameBoard.terrain[cell.row][cell.col];
      if (!ship.terrain.includes(terrain)) {
        console.log('[CANVAS]', version, `Terrain check failed: ship ${ship.name} allows ${ship.terrain}, cell is ${terrain}`);
        return false;
      }
      
      // v0.4.7: Check ship overlap using player.shipPlacements (Board.getShipDataAt removed in Phase 4)
      if (humanPlayer && humanPlayer.hasShipAt(cell.row, cell.col)) {
        return false;
      }
    }
    
    return true;
  }, [eraConfig, gameBoard, humanPlayer]); // v0.4.8: currentShip NOT in deps - read from inputPropsRef!
  
  // Update validationCallbackRef whenever callback recreates
  useEffect(() => {
    validationCallbackRef.current = isValidShipPlacement;
  }, [isValidShipPlacement]);

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
    
    captureWinnerBoard: (winnerId) => {
      if (!canvasRef.current || !gameState?.userId) return null;
      
      try {
        const humanPlayerId = gameState.userId;
        const isPlayerWinner = winnerId === humanPlayerId;
        const captureViewMode = isPlayerWinner ? 'attack' : 'fleet';
        
        console.log('[CANVAS]', version, `Capturing ${captureViewMode} view for winner:`, winnerId);
        
        const originalViewMode = propsRef.current.viewMode;
        propsRef.current.viewMode = captureViewMode;
        
        renderFrame();
        
        const imageData = canvasRef.current.toDataURL('image/png');
        
        propsRef.current.viewMode = originalViewMode;
        
        return imageData;
      } catch (error) {
        console.error('[CANVAS]', version, 'Failed to capture winner board:', error);
        return null;
      }
    }
  }), [showOpponentAnimation, createExplosion, gameState, renderFrame]);
  
  const handleActionMenuChoice = useCallback((action) => {
    setShowActionMenu(false);
    
    if (!actionMenuCell) return;
    
    const { row, col } = actionMenuCell;
    
    if (action === 'shot') {
      // Regular shot
      if (onShotFired && gameState?.isPlayerTurn) {
        const shotResult = onShotFired(row, col);
        if (shotResult) {
          showShotAnimation(shotResult, row, col);
        }
      }
    } else if (action === 'star') {
      // Star shell
      triggerStarShell(row, col);
    }
    
    setActionMenuCell(null);
  }, [actionMenuCell, onShotFired, gameState, showShotAnimation, triggerStarShell]);

  // Initialize InputHandler - ONLY ONCE
  useEffect(() => {
    if (!canvasRef.current || !eraConfig || !gameBoard) return;
    
    if (!inputHandlerRef.current) {
      inputHandlerRef.current = new InputHandler({
        canvasRef,
        // Read ALL dynamic values from inputPropsRef
        getMode: () => inputPropsRef.current.mode,
        getEraConfig: () => eraConfig,
        getGameBoard: () => gameBoard,
        getGameState: () => inputPropsRef.current.gameState,
        getCurrentShip: () => inputPropsRef.current.currentShip,
        getStarShellsRemaining: () => inputPropsRef.current.starShellsRemaining,
        cellSize: CELL_SIZE,
        labelSize: LABEL_SIZE,
        // Callbacks
        onShotFired: (row, col) => {
          // v0.4.6: Read fresh gameState from inputPropsRef to avoid stale closure
          const currentGameState = inputPropsRef.current.gameState;
          if (onShotFired && currentGameState?.isPlayerTurn) {
            const shotResult = onShotFired(row, col);
            if (shotResult) {
              showShotAnimation(shotResult, row, col);
            }
          }
        },
        onActionMenuRequested: ({ row, col, clientX, clientY }) => {
          setActionMenuCell({ row, col });
          setActionMenuPos({ x: clientX, y: clientY });
          setShowActionMenu(true);
        },
        onShipPlaced: (ship, cells, orientation) => {
          onShipPlaced?.(ship, cells, orientation);
        },
        onPlacementPreview: (cells, isValid) => {
          setPreviewCells(cells);
          setIsValidPlacement(isValid);
        },
        // v0.4.8: InputHandler reads validation callback from ref (always fresh)
        onValidatePlacement: (cells) => validationCallbackRef.current?.(cells) || false
      });
      console.log('[CANVAS]', version, 'InputHandler created');
    }
    
    inputHandlerRef.current.attach();
    
    return () => {
      inputHandlerRef.current?.detach();
    };
  }, [eraConfig, gameBoard, onShotFired, onShipPlaced, showShotAnimation]);
  // mode, gameState, currentShip, starShellsRemaining NOT in dependencies - read from inputPropsRef!
  // isValidShipPlacement NOT in dependencies - read from validationCallbackRef!

  // Reset input handler on mode/ship change
  useEffect(() => {
    if (mode === 'placement' && inputHandlerRef.current) {
      inputHandlerRef.current.reset();
      setPreviewCells([]);
      setIsValidPlacement(false);
    }
  }, [currentShip, mode]);

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
    <>
      <canvas
        ref={canvasRef}
        className={getCanvasClasses()}
      />
      
      {showActionMenu && ReactDOM.createPortal(
        <ActionMenu
          x={actionMenuPos.x}
          y={actionMenuPos.y}
          onAction={handleActionMenuChoice}
          onClose={() => setShowActionMenu(false)}
          starShellsRemaining={starShellsRemaining}
        />,
        document.body
      )}
    </>
  );
});

export default CanvasBoard;
// EOF
