// src/renderers/HitOverlayRenderer.js v0.3.1
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.1: Phase 4 Refactor - Updated for missedShots → dontShoot rename
//         getDontShoot() now returns both water misses AND destroyed ship cells
//         Renderer checks cell properties to determine what to draw
// v0.3.0: Phase 3 Refactor - reads from player.missedShots instead of Board.shotHistory
// v0.2.1: Fixed image paths and added fallback rendering

const version = 'v0.3.1';

class HitOverlayRenderer {
  constructor() {
    this.craterImage = new Image();
    this.craterPartialImage = new Image();
    this.imagesLoaded = false;
    
    this.craterImage.onload = () => {
      console.log('[OVERLAY] Crater image loaded');
      this.checkImagesLoaded();
    };
    this.craterPartialImage.onload = () => {
      console.log('[OVERLAY] Crater partial image loaded');
      this.checkImagesLoaded();
    };
    
    this.craterImage.onerror = () => {
      console.error(version, '[OVERLAY] Failed to load crater.png');
    };
    this.craterPartialImage.onerror = () => {
      console.error(version, '[OVERLAY] Failed to load crater-partial.png');
    };
    
    const basePath = process.env.PUBLIC_URL || '';
    this.craterImage.src = `${basePath}/assets/images/crater.png`;
    this.craterPartialImage.src = `${basePath}/assets/images/crater-partial.png`;
    
    console.log('[OVERLAY] Loading crater images from:', this.craterImage.src);
  }

  checkImagesLoaded() {
    if (this.craterImage.complete && this.craterPartialImage.complete) {
      this.imagesLoaded = true;
      console.log('[OVERLAY] All crater images loaded successfully');
    }
  }

  drawCraterOrFallback(ctx, x, y, size, centerX, centerY, isPartial) {
    if (this.imagesLoaded) {
      const image = isPartial ? this.craterPartialImage : this.craterImage;
      ctx.drawImage(image, x, y, size, size);
    } else {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, size * 0.3, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  /**
   * v0.3.1: Phase 4 Refactor - uses getDontShoot() instead of getMissedShots()
   */
  drawHitOverlay(ctx, eraConfig, gameInstance, gameState, gameBoard, cellSize, labelSize, offsetX, offsetY, viewMode = 'blended') {
    if (!gameState?.userId || !gameBoard || !gameInstance) return;

    const playerId = gameState.userId;
    
    // Get players
    const humanPlayer = gameInstance.players.find(p => p.id === playerId);
    const aiPlayers = gameInstance.players.filter(p => p.id !== playerId);

    if (!humanPlayer) return;

    if (viewMode === 'fleet') {
      this.drawFleetView(ctx, eraConfig, gameBoard, playerId, humanPlayer, aiPlayers, cellSize, labelSize, offsetX, offsetY, gameInstance);
    } else if (viewMode === 'attack') {
      this.drawAttackView(ctx, eraConfig, gameBoard, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance);
    } else {
      this.drawBlendedView(ctx, eraConfig, gameBoard, playerId, humanPlayer, aiPlayers, cellSize, labelSize, offsetX, offsetY, gameInstance);
    }
  }

  /**
   * v0.3.1: Fleet view - show where AI has shot at player's ships
   * Reads from AI player's dontShoot for both misses and destroyed cells
   */
  drawFleetView(ctx, eraConfig, gameBoard, playerId, humanPlayer, aiPlayers, cellSize, labelSize, offsetX, offsetY, gameInstance) {
    // Draw AI dontShoot markers (blue dots for water misses only)
    aiPlayers.forEach(aiPlayer => {
      const aiDontShoot = aiPlayer.getDontShoot();
      
      aiDontShoot.forEach(({ row, col }) => {
        // Check if this is a ship cell (crater already drawn) or water miss
        const placement = humanPlayer.getShipAt(row, col);
        
        if (!placement) {
          // Water miss - draw blue dot
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;
          const centerX = x + size / 2;
          const centerY = y + size / 2;

          ctx.fillStyle = '#0066FF';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
        // If placement exists, crater is drawn below
      });
    });

    // Draw craters on damaged player ships
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const placement = humanPlayer.getShipAt(row, col);
        if (!placement) continue;

        const ship = humanPlayer.getShip(placement.shipId);
        if (!ship) continue;

        // If this cell was damaged, draw crater
        const cellHealth = ship.health[placement.cellIndex];
        if (cellHealth < 1.0) {
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;
          const centerX = x + size / 2;
          const centerY = y + size / 2;

          this.drawCraterOrFallback(ctx, x, y, size, centerX, centerY, cellHealth > 0);
        }
      }
    }
  }

  /**
   * v0.3.1: Attack view - show where player has shot at AI ships
   * Reads from human player's dontShoot for both misses and destroyed cells
   */
  drawAttackView(ctx, eraConfig, gameBoard, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance) {
    // Draw player dontShoot markers (gray dots for water misses only)
    const playerDontShoot = humanPlayer.getDontShoot();
    
    playerDontShoot.forEach(({ row, col }) => {
      // Check if this is a destroyed ship cell or water miss
      let isShipCell = false;
      
      for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
        const placement = aiPlayer.getShipAt(row, col);
        if (placement) {
          isShipCell = true;
          break;
        }
      }
      
      if (!isShipCell) {
        // Water miss - draw gray dot
        const x = offsetX + col * cellSize + labelSize + 1;
        const y = offsetY + row * cellSize + labelSize + 1;
        const size = cellSize - 2;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }
      // If ship cell, crater is drawn below
    });

    // Draw craters on damaged enemy ships
    gameInstance.players
      .filter(p => p.id !== playerId)
      .forEach(aiPlayer => {
        for (let row = 0; row < eraConfig.rows; row++) {
          for (let col = 0; col < eraConfig.cols; col++) {
            const placement = aiPlayer.getShipAt(row, col);
            if (!placement) continue;

            const ship = aiPlayer.getShip(placement.shipId);
            if (!ship) continue;

            // If this cell was damaged, draw crater
            const cellHealth = ship.health[placement.cellIndex];
            if (cellHealth < 1.0) {
              const x = offsetX + col * cellSize + labelSize + 1;
              const y = offsetY + row * cellSize + labelSize + 1;
              const size = cellSize - 2;
              const centerX = x + size / 2;
              const centerY = y + size / 2;

              this.drawCraterOrFallback(ctx, x, y, size, centerX, centerY, cellHealth > 0);
            }
          }
        }
      });
  }

  /**
   * v0.3.1: Blended view - show both player and AI shots with different markers
   * This is the default view mode
   */
  drawBlendedView(ctx, eraConfig, gameBoard, playerId, humanPlayer, aiPlayers, cellSize, labelSize, offsetX, offsetY, gameInstance) {
    // Draw AI hits on player ships (blue diagonal lines)
    // Check all player ship cells for damage
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        const placement = humanPlayer.getShipAt(row, col);
        if (!placement) continue;

        const ship = humanPlayer.getShip(placement.shipId);
        if (!ship) continue;

        // If this cell was damaged, draw blue diagonal
        const cellHealth = ship.health[placement.cellIndex];
        if (cellHealth < 1.0) {
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;

          const lineWidth = cellHealth <= 0 ? 3 : 1;
          
          ctx.strokeStyle = '#0066FF';
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(x + size, y);
          ctx.lineTo(x, y + size);
          ctx.stroke();
        }
      }
    }

    // Draw player dontShoot markers (white/gray dots for water misses only)
    const playerDontShoot = humanPlayer.getDontShoot();
    
    playerDontShoot.forEach(({ row, col }) => {
      // Check if this is a destroyed ship cell or water miss
      let isShipCell = false;
      
      for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
        const placement = aiPlayer.getShipAt(row, col);
        if (placement) {
          isShipCell = true;
          break;
        }
      }
      
      if (!isShipCell) {
        // Water miss - draw white/gray dot
        const x = offsetX + col * cellSize + labelSize + 1;
        const y = offsetY + row * cellSize + labelSize + 1;
        const size = cellSize - 2;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        // White outline
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Gray center
        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }
      // If ship cell, diagonal is drawn below
    });

    // Draw player hits on enemy ships (red diagonal lines)
    gameInstance.players
      .filter(p => p.id !== playerId)
      .forEach(aiPlayer => {
        for (let row = 0; row < eraConfig.rows; row++) {
          for (let col = 0; col < eraConfig.cols; col++) {
            const placement = aiPlayer.getShipAt(row, col);
            if (!placement) continue;

            const ship = aiPlayer.getShip(placement.shipId);
            if (!ship) continue;

            // If this cell was damaged, draw red diagonal
            const cellHealth = ship.health[placement.cellIndex];
            if (cellHealth < 1.0) {
              const x = offsetX + col * cellSize + labelSize + 1;
              const y = offsetY + row * cellSize + labelSize + 1;
              const size = cellSize - 2;

              const lineWidth = cellHealth <= 0 ? 3 : 1;
              
              ctx.strokeStyle = '#CC0000';
              ctx.lineWidth = lineWidth;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + size, y + size);
              ctx.stroke();
            }
          }
        }
      });
  }
}

export default HitOverlayRenderer;
// EOF
