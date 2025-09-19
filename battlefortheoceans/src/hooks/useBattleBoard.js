// src/hooks/useBattleBoard.js
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useRef } from 'react';

const version = "v0.1.7"

const useBattleBoard = (eraConfig, gameState, gameBoard, gameInstance) => {
  const canvasRef = useRef(null);
  const [animations, setAnimations] = useState([]);
  const [shotHistory, setShotHistory] = useState(new Map()); // Track all shots with metadata
  
  const cellSize = 30;
  const labelSize = 20;

  // Calculate board dimensions
  const boardWidth = eraConfig ? eraConfig.cols * cellSize + labelSize : 0;
  const boardHeight = eraConfig ? eraConfig.rows * cellSize + labelSize : 0;

  useEffect(() => {
    if (gameBoard && eraConfig && gameInstance) {
      drawCanvas();
    }
  }, [gameBoard, gameState, animations, eraConfig, shotHistory, gameInstance]);

  const drawCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !gameBoard || !eraConfig || !gameInstance) return;

    ctx.canvas.width = boardWidth + 40; // Single board with padding
    ctx.canvas.height = boardHeight + 40;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw the single game board
    drawBoard(ctx, gameBoard, 20, 30);

    // Draw animations (temporary effects)
    animations.forEach(anim => {
      drawAnimation(ctx, anim);
    });
  };

  const drawBoard = (ctx, board, offsetX, offsetY) => {
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

    // Get player view using new Board architecture
    const playerView = board.getPlayerView(
      gameState.userId,
      gameInstance.playerFleets,
      gameInstance.shipOwnership
    );

    // Draw cells with enhanced visual feedback
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const cellView = playerView[row][col];
        const x = offsetX + col * cellSize + labelSize + 1;
        const y = offsetY + row * cellSize + labelSize + 1;
        const size = cellSize - 2;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        // Draw terrain
        if (cellView.terrain !== 'excluded') {
          ctx.fillStyle = getTerrainColor(cellView.terrain);
          ctx.fillRect(x, y, size, size);
        }

        // Draw player ships with light blue background
        if (cellView.hasOwnShip) {
          ctx.fillStyle = 'rgba(173, 216, 230, 0.7)';
          ctx.fillRect(x, y, size, size);
        }

        // Get shot history for this cell
        const shotKey = `${row}-${col}`;
        const shotInfo = shotHistory.get(shotKey);
        const shotResult = board.getLastShotResult(row, col);

        // Draw enhanced attack results
        if (shotResult === 'hit' || shotResult === 'sunk') {
          // Get ship data at this location from Game instance
          const shipDataArray = board.getShipDataAt(row, col);
          const hasPlayerShip = shipDataArray.some(shipData => {
            const ownerId = gameInstance.shipOwnership.get(shipData.shipId);
            return ownerId === gameState.userId;
          });
          const hasEnemyShip = shipDataArray.some(shipData => {
            const ownerId = gameInstance.shipOwnership.get(shipData.shipId);
            return ownerId !== gameState.userId;
          });
          
          // Check if any ships are sunk
          const isSunk = shipDataArray.some(shipData => {
            const ownerId = gameInstance.shipOwnership.get(shipData.shipId);
            const fleet = gameInstance.playerFleets.get(ownerId);
            const ship = fleet?.ships.find(s => s.id === shipData.shipId);
            return ship?.isSunk();
          });
          
          if (hasPlayerShip) {
            // Player ship hit - keep light blue background, add medium grey if sunk
            if (isSunk) {
              ctx.fillStyle = '#808080'; // Medium grey for sunk player ships
              ctx.fillRect(x, y, size, size);
            }
            // Light blue background already drawn above
          } else if (hasEnemyShip && isSunk) {
            // Enemy ship hit and sunk
            ctx.fillStyle = '#808080'; // Medium grey for sunk enemy ships
            ctx.fillRect(x, y, size, size);
          }
          
          // Draw hit indicator based on who shot
          const isPlayerShot = shotInfo?.shooter === 'player';
          ctx.fillStyle = isPlayerShot ? '#CC0000' : '#0066FF'; // Red for player, blue for opponent
          ctx.beginPath();
          ctx.arc(centerX, centerY, isPlayerShot ? size * 0.4 : size * 0.35, 0, 2 * Math.PI);
          ctx.fill();
          
          // Add white center for contrast
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(centerX, centerY, size * 0.12, 0, 2 * Math.PI);
          ctx.fill();

        } else if (shotResult === 'miss') {
          // Always show player misses as persistent grey circles
          if (shotInfo?.shooter === 'player') {
            ctx.fillStyle = '#666666';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
          // Opponent misses: show temporarily via animation only, no permanent indicator
        }
      }
    }
  };

  const drawAnimation = (ctx, anim) => {
    // Blooming circle animation
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - anim.progress);
    
    if (anim.type === 'hit') {
      // Expanding red circle for hits
      ctx.fillStyle = anim.color;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius * (1 + anim.progress), 0, 2 * Math.PI);
      ctx.fill();
      
      // Inner white flash
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius * (0.5 + anim.progress * 0.3), 0, 2 * Math.PI);
      ctx.fill();
      
    } else if (anim.type === 'miss') {
      // Quick splash effect for player misses
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius * (1 + anim.progress * 2), 0, 2 * Math.PI);
      ctx.stroke();
      
    } else if (anim.type === 'opponent-miss') {
      // Orange ring that fades for opponent misses - hollow center to avoid collision
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Inner ring for visibility
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius - 2, 0, 2 * Math.PI);
      ctx.stroke();
    }
    
    ctx.restore();
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
    if (!gameState.isPlayerTurn || !gameBoard || !eraConfig) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate click position on the single board
    const col = Math.floor((x - 20 - labelSize) / cellSize);
    const row = Math.floor((y - 30 - labelSize) / cellSize);

    if (row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols) {
      const shotResult = onShotFired(row, col);
      
      if (shotResult) {
        // Record this shot in history
        const shotKey = `${row}-${col}`;
        setShotHistory(prev => new Map(prev.set(shotKey, {
          shooter: 'player',
          result: shotResult.result,
          timestamp: Date.now()
        })));
        
        // Record shot in Board for persistence
        board.recordShot(row, col, { name: 'Player' }, shotResult.result);
        
        showShotAnimation(shotResult, 'player');
      }
    }
  };

  const recordOpponentShot = (row, col, result) => {
    const shotKey = `${row}-${col}`;
    setShotHistory(prev => new Map(prev.set(shotKey, {
      shooter: 'opponent',
      result: result,
      timestamp: Date.now()
    })));
    
    // Record shot in Board for persistence
    board.recordShot(row, col, { name: 'Opponent' }, result);
    
    showShotAnimation({ result, row, col }, 'opponent');
  };

  const showShotAnimation = ({ result, row, col }, shooter) => {
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
      
      // Animate the bloom effect
      const startTime = Date.now();
      const duration = 800; // 800ms animation
      
      const animateBloom = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        setAnimations(prev => prev.map(anim =>
          anim.id === animId ? { ...anim, progress } : anim
        ));
        
        if (progress < 1) {
          requestAnimationFrame(animateBloom);
        } else {
          // Remove animation when complete
          setTimeout(() => {
            setAnimations(prev => prev.filter(anim => anim.id !== animId));
          }, 200);
        }
      };
      
      requestAnimationFrame(animateBloom);
      
    } else if (result === 'miss') {
      if (shooter === 'player') {
        // Player misses: brief animation only, permanent indicator handled in drawBoard
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
        
        // Quick splash animation
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
        // Opponent misses: show temporary visual feedback with clear center to avoid collision
        const animation = {
          id: animId,
          type: 'opponent-miss',
          x: animX,
          y: animY,
          radius: 8,
          color: 'rgba(255, 179, 71, 0.8)', // Orange color for opponent
          progress: 0
        };
        
        setAnimations(prev => [...prev, animation]);
        
        // Show opponent miss for 1.5 seconds then fade
        const startTime = Date.now();
        const duration = 1500;
        
        const animateOpponentMiss = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          setAnimations(prev => prev.map(anim =>
            anim.id === animId ? { ...anim, progress } : anim
          ));
          
          if (progress < 1) {
            requestAnimationFrame(animateOpponentMiss);
          } else {
            setAnimations(prev => prev.filter(anim => anim.id !== animId));
          }
        };
        
        requestAnimationFrame(animateOpponentMiss);
      }
    }
  };

  return {
    canvasRef,
    handleCanvasClick,
    drawCanvas,
    boardWidth,
    boardHeight,
    recordOpponentShot,
    isReady: !!(eraConfig && gameBoard && gameInstance)
  };
};

export default useBattleBoard;
// EOF
