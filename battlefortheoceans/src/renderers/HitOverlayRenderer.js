// src/renderers/HitOverlayRenderer.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.12.1: Added explicit globalCompositeOperation reset in drawShipOutline for proper z-layering
// v0.12.0: Added fire/smoke effects to blended view for both player and opponent ships
// v0.11.2: Simplified - uses pre-generated colored SVG files (-blue.svg, -red.svg)
//          - Removed complex canvas compositing code
//          - Just loads the appropriate colored SVG file
// v0.11.0: Added colored ship SVG overlays (blue for player, red for opponent)
// v0.10.3: Changed miss markers to consistent dark grey (#4A5568)
// v0.10.2: Refactored miss markers to be shared between Fleet and Attack views

const version = 'v0.12.1';

class HitOverlayRenderer {
  constructor(eraId = 'traditional', gameBoard = null) {
    // Store era ID and board permanently
    this.eraId = eraId;
    this.gameBoard = gameBoard;
    
    // Fire particle system (now using emoji)
    this.fireParticles = new Map(); // key: "row,col", value: array of particles
    this.fireAnimationFrame = 0;
    
    // SVG cache for ship outlines - now includes color in key
    this.shipSvgCache = new Map(); // key: "eraId-shipClass-color", value: SVG image
    this.svgLoadingState = new Map(); // track loading state
    
    console.log('[OVERLAY]', version, 'Initialized with eraId:', eraId);
  }

  /**
   * Load ship outline SVG (colored variant)
   * @param {string} shipClass - Ship class name
   * @param {string} color - 'blue' or 'red'
   */
  async loadShipSvg(shipClass, color = 'blue') {
    const key = `${this.eraId}-${shipClass}-${color}`;
    
    // Return cached if available
    if (this.shipSvgCache.has(key)) {
      return this.shipSvgCache.get(key);
    }
    
    // Check if already loading
    if (this.svgLoadingState.has(key)) {
      return null; // Still loading
    }
    
    // Start loading
    this.svgLoadingState.set(key, 'loading');
    
    try {
      const classLower = shipClass.toLowerCase().replace(/\s+/g, '-');
      const svgPath = `/assets/ships/${this.eraId}/${classLower}-${color}.svg`;
      
      const img = new Image();
      
      return new Promise((resolve) => {
        img.onload = () => {
          this.shipSvgCache.set(key, img);
          this.svgLoadingState.set(key, 'loaded');
          console.log('[OVERLAY]', version, 'Loaded colored ship SVG:', key);
          resolve(img);
        };
        
        img.onerror = () => {
          console.warn('[OVERLAY]', version, 'Failed to load ship SVG:', svgPath);
          this.svgLoadingState.set(key, 'failed');
          resolve(null);
        };
        
        img.src = svgPath;
      });
    } catch (error) {
      console.error('[OVERLAY]', version, 'Error loading ship SVG:', error);
      this.svgLoadingState.set(key, 'failed');
      return null;
    }
  }

  /**
   * Update fire particles - called by UXEngine loop
   */
  updateFireParticles() {
    this.fireAnimationFrame++;
    
    for (const [key, particles] of this.fireParticles.entries()) {
      particles.forEach(p => {
        if (p.type === 'smoke') {
          // Smoke rises and drifts toward 2 o'clock (up and right)
          p.life++;
          if (p.life >= p.maxLife) {
            // Respawn smoke
            p.life = 0;
            p.driftX = 0;
            p.driftY = 0;
          } else {
            const lifeRatio = p.life / p.maxLife;
            // Drift toward 2 o'clock: right (cos 30°) and up (sin 30°)
            p.driftX = lifeRatio * 40 * Math.cos(Math.PI / 6); // ~35 pixels right
            p.driftY = -lifeRatio * 40 * Math.sin(Math.PI / 6); // ~20 pixels up
          }
        } else if (p.type === 'fire') {
          // Update rotation randomly every few frames
          p.framesSinceChange++;
          if (p.framesSinceChange >= p.rotationChangeFrames) {
            p.rotation = (Math.random() * 20 - 10) * (Math.PI / 180); // New random ±10 degrees
            p.framesSinceChange = 0;
            p.rotationChangeFrames = Math.floor(3 + Math.random() * 5); // Next change in 3-7 frames
          }
        }
      });
    }
  }

  /**
   * Initialize fire particles for a cell (now using emoji with rotation)
   */
  initializeFireForCell(row, col, x, y, size) {
    const key = `${row},${col}`;
    if (this.fireParticles.has(key)) {
      return; // Already initialized
    }
    
    const particles = [];
    
    // Create 3 fire emoji layers covering 80% of cell
    for (let i = 0; i < 3; i++) {
      particles.push({
        type: 'fire',
        emoji: '🔥',
        baseX: x + size * 0.5, // Center of cell
        baseY: y + size * 0.6, // Slightly below center
        rotation: (Math.random() * 20 - 10) * (Math.PI / 180), // Random ±10 degrees
        rotationChangeFrames: Math.floor(3 + Math.random() * 5), // Change every 3-7 frames
        framesSinceChange: 0,
        scaleOffset: Math.random() * Math.PI * 2,
        scaleSpeed: 0.05 + Math.random() * 0.02, // Reduced by ~33% for slower animation
        baseScale: 0.8 + (i * 0.15), // Layer 0=0.8, 1=0.95, 2=1.1 for depth
        scaleY: 0.9 + Math.random() * 0.5, // Random Y-scale from -10% to +40% (0.9 to 1.4)
        opacityOffset: Math.random() * Math.PI * 2,
        opacitySpeed: 0.067 + Math.random() * 0.033 // Reduced by ~33% for slower flicker
      });
    }
    
    // Create 2 smoke puffs
    for (let i = 0; i < 2; i++) {
      particles.push({
        type: 'smoke',
        emoji: '💨',
        baseX: x + size * 0.5,  // center of cell
        baseY: y + size * 0.4, // Start near top of cell
        life: Math.random() * 60,
        maxLife: 80 + Math.random() * 40,
        driftX: 0, // Will drift toward 2 o'clock
        driftY: 0, // Will rise
        baseOpacity: 0.8 + Math.random() * 0.2, // Increased to 0.8-1.0 for visibility
        scale: 0.6 + Math.random() * 0.3
      });
    }
    
    this.fireParticles.set(key, particles);
  }

  /**
   * Draw emoji-based fire effect with rotation
   */
  drawFire(ctx, x, y, drawableSize, row, col) {
    // Initialize particles for this cell if needed
    this.initializeFireForCell(row, col, x, y, drawableSize);
    
    const key = `${row},${col}`;
    const particles = this.fireParticles.get(key);
    if (!particles) return;
    
    // Set emoji font size based on cell size to cover 80%
    const emojiFontSize = Math.floor(drawableSize * 0.8);
    
    // Draw smoke first (behind fire)
    particles.forEach(p => {
      if (p.type === 'smoke') {
        const lifeRatio = p.life / p.maxLife;
        const currentX = p.baseX + p.driftX;
        const currentY = p.baseY + p.driftY;
        
        // Fade out as it rises
        const opacity = p.baseOpacity * (1 - lifeRatio);
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = `${emojiFontSize * p.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, currentX, currentY);
        ctx.restore();
      }
    });
    
    // Draw fire emoji on top with rotation and Y-scale
    particles.forEach(p => {
      if (p.type === 'fire') {
        // Use current random rotation (updated every few frames)
        const rotation = p.rotation;
        
        // Calculate scale pulsing
        const scalePulse = Math.sin(p.scaleOffset + this.fireAnimationFrame * p.scaleSpeed) * 0.1;
        const currentScale = p.baseScale + scalePulse;
        
        // Calculate opacity flickering
        const opacityFlicker = Math.sin(p.opacityOffset + this.fireAnimationFrame * p.opacitySpeed) * 0.15;
        const opacity = 0.85 + opacityFlicker; // Range 0.7-1.0
        
        ctx.save();
        
        // Translate to emoji center, apply rotation and scale
        ctx.translate(p.baseX, p.baseY);
        ctx.rotate(rotation);
        ctx.scale(1, p.scaleY); // Apply random Y-scale for vertical variation
        
        ctx.globalAlpha = opacity;
        ctx.font = `${emojiFontSize * currentScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
        
        ctx.restore();
      }
    });
  }

  /**
   * Draw ship outline SVG with color
   * v0.11.2: Loads pre-generated colored SVG files
   *
   * @param {string} color - 'blue' for player ships, 'red' for opponent ships
   */
  drawShipOutline(ctx, ship, cells, cellSize, labelSize, offsetX, offsetY, player, opacity = 0.6, color = 'blue') {
    if (!ship || !cells || cells.length === 0) return;
    
    const shipClass = ship.class;
    const key = `${this.eraId}-${shipClass}-${color}`;
    
    // Try to load colored SVG if not already loaded
    if (!this.shipSvgCache.has(key) && !this.svgLoadingState.has(key)) {
      this.loadShipSvg(shipClass, color);
      return; // Skip drawing this frame while loading
    }
    
    const svgImg = this.shipSvgCache.get(key);
    if (!svgImg) return; // Not loaded yet or failed
    
    // Get orientation from first cell placement (stern, cellIndex 0)
    // Sort cells by cellIndex to find stern (cell 0)
    const sortedCells = [...cells].sort((a, b) => {
      const placementA = player.getShipAt(a.row, a.col);
      const placementB = player.getShipAt(b.row, b.col);
      return (placementA?.cellIndex || 0) - (placementB?.cellIndex || 0);
    });
    
    const sternCell = sortedCells[0];
    const sternPlacement = player.getShipAt(sternCell.row, sternCell.col);
    const orientation = sternPlacement?.orientation || 0; // Default to 0° if not found
    
    // Calculate bounding box of all cells
    const minRow = Math.min(...cells.map(c => c.row));
    const maxRow = Math.max(...cells.map(c => c.row));
    const minCol = Math.min(...cells.map(c => c.col));
    const maxCol = Math.max(...cells.map(c => c.col));
    
    const x = offsetX + minCol * cellSize + labelSize;
    const y = offsetY + minRow * cellSize + labelSize;
    const width = (maxCol - minCol + 1) * cellSize;
    const height = (maxRow - minRow + 1) * cellSize;
    
    // Calculate center point for rotation
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    ctx.save();
    
    // Reset canvas state to ensure proper layering
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = opacity;
    
    // Translate to center, rotate
    ctx.translate(centerX, centerY);
    ctx.rotate((orientation * Math.PI) / 180); // Convert degrees to radians
    
    // Draw the pre-colored SVG
    // For 0° and 180°: use width x height (horizontal ship)
    // For 90° and 270°: swap dimensions (vertical ship)
    const drawWidth = (orientation === 90 || orientation === 270) ? height : width;
    const drawHeight = (orientation === 90 || orientation === 270) ? width : height;
    
    ctx.drawImage(svgImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    
    ctx.restore();
  }

  /**
   * Remove fire particles for a cell (when ship sinks)
   */
  removeFireForCell(row, col) {
    const key = `${row},${col}`;
    this.fireParticles.delete(key);
  }

  drawHitOverlay(ctx, gameInstance, gameState, cellSize, labelSize, offsetX, offsetY, viewMode = 'blended') {
    if (!gameState?.userId || !gameInstance) {
      return;
    }

    const playerId = gameState.userId;
    const humanPlayer = gameInstance.players.find(p => p.id === playerId);

    if (!humanPlayer) {
      return;
    }

    // Update fire particles every frame
    this.updateFireParticles();

    if (viewMode === 'fleet') {
      this.drawFleetView(ctx, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance);
    } else if (viewMode === 'attack') {
      this.drawAttackView(ctx, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance);
    } else if (viewMode === 'blended') {
      this.drawBlendedView(ctx, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance);
    }
  }

  /**
   * Draw miss markers with consistent dark grey color
   */
  drawMissMarkers(ctx, player, gameInstance, playerId, cellSize, labelSize, offsetX, offsetY, eraRows, eraCols) {
    const playerDontShoot = player.getDontShoot();
    
    playerDontShoot.forEach(({ row, col }) => {
      let isShipCell = false;
      
      // Check if this cell has any opponent ships
      for (const otherPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
        const placement = otherPlayer.getShipAt(row, col);
        if (placement) {
          isShipCell = true;
          break;
        }
      }
      
      // Only draw miss marker if it's NOT a ship cell (water miss)
      if (!isShipCell) {
        const x = offsetX + col * cellSize + labelSize + 1;
        const y = offsetY + row * cellSize + labelSize + 1;
        const size = cellSize - 2;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        // Consistent dark grey for miss markers (visible on all terrains)
        ctx.fillStyle = '#4A5568';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    });
  }

  drawFleetView(ctx, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance) {
    if (!this.gameBoard) {
      console.warn('[OVERLAY]', version, 'gameBoard not set');
      return;
    }

    const eraRows = this.gameBoard.rows || 10;
    const eraCols = this.gameBoard.cols || 10;

    // Draw ship outlines for ALL placed player ships (BLUE)
    if (humanPlayer.fleet && humanPlayer.fleet.ships) {
      humanPlayer.fleet.ships.forEach(ship => {
        if (ship.isPlaced) {
          // Collect all cells for this ship
          const shipCells = [];
          for (let row = 0; row < eraRows; row++) {
            for (let col = 0; col < eraCols; col++) {
              const placement = humanPlayer.getShipAt(row, col);
              if (placement && placement.shipId === ship.id) {
                shipCells.push({ row, col });
              }
            }
          }
          
          // Draw ship outline with opacity based on sunk status
          if (shipCells.length > 0) {
            const opacity = ship.isSunk() ? 0.4 : 1.0;
            this.drawShipOutline(ctx, ship, shipCells, cellSize, labelSize, offsetX, offsetY, humanPlayer, opacity, 'blue');
          }
        }
      });
    }

    // Draw fire on player's damaged ships (only if not sunk)
    for (let row = 0; row < eraRows; row++) {
      for (let col = 0; col < eraCols; col++) {
        const placement = humanPlayer.getShipAt(row, col);
        if (!placement) continue;

        const ship = humanPlayer.getShip(placement.shipId);
        if (!ship) continue;

        // If ship is sunk, remove fire particles and skip drawing
        if (ship.isSunk()) {
          this.removeFireForCell(row, col);
          continue;
        }

        const cellHealth = ship.health[placement.cellIndex];
        if (cellHealth < 1.0) {
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;

          this.drawFire(ctx, x, y, size, row, col);
        }
      }
    }

    // Draw AI miss markers using shared method
    for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
      this.drawMissMarkers(ctx, aiPlayer, gameInstance, aiPlayer.id, cellSize, labelSize, offsetX, offsetY, eraRows, eraCols);
    }
  }

  drawAttackView(ctx, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance) {
    if (!this.gameBoard) {
      console.warn('[OVERLAY]', version, 'gameBoard not set');
      return;
    }
    
    const eraRows = this.gameBoard.rows || 10;
    const eraCols = this.gameBoard.cols || 10;
    
    // Draw player's miss markers using shared method
    this.drawMissMarkers(ctx, humanPlayer, gameInstance, playerId, cellSize, labelSize, offsetX, offsetY, eraRows, eraCols);
    
    // Draw fire on hit cells ONLY if ship is NOT sunk
    for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
      if (!aiPlayer.fleet || !aiPlayer.fleet.ships) continue;
      
      for (let row = 0; row < eraRows; row++) {
        for (let col = 0; col < eraCols; col++) {
          const placement = aiPlayer.getShipAt(row, col);
          if (!placement) continue;
          
          const ship = aiPlayer.getShip(placement.shipId);
          if (!ship) continue;
          
          // If ship is sunk, remove fire particles and skip drawing
          if (ship.isSunk()) {
            this.removeFireForCell(row, col);
            continue;
          }
          
          const cellHealth = ship.health[placement.cellIndex];
          if (cellHealth < 1.0) {
            const x = offsetX + col * cellSize + labelSize + 1;
            const y = offsetY + row * cellSize + labelSize + 1;
            const size = cellSize - 2;
            
            this.drawFire(ctx, x, y, size, row, col);
          }
        }
      }
    }
    
    // Draw ship outlines for sunk ships (RED)
    for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
      if (!aiPlayer.fleet || !aiPlayer.fleet.ships) continue;
      
      aiPlayer.fleet.ships.forEach(ship => {
        if (ship.isSunk()) {
          // Collect all cells for this ship
          const shipCells = [];
          for (let row = 0; row < eraRows; row++) {
            for (let col = 0; col < eraCols; col++) {
              const placement = aiPlayer.getShipAt(row, col);
              if (placement && placement.shipId === ship.id) {
                shipCells.push({ row, col });
              }
            }
          }
          
          this.drawShipOutline(ctx, ship, shipCells, cellSize, labelSize, offsetX, offsetY, aiPlayer, 0.6, 'red');
        }
      });
    }
  }
      
  drawBlendedView(ctx, playerId, humanPlayer, cellSize, labelSize, offsetX, offsetY, gameInstance) {
    if (!this.gameBoard) {
      console.warn('[OVERLAY]', version, 'gameBoard not set');
      return;
    }

    const eraRows = this.gameBoard.rows || 10;
    const eraCols = this.gameBoard.cols || 10;

    // Draw player's ship outlines (BLUE) - background layer
    if (humanPlayer.fleet && humanPlayer.fleet.ships) {
      humanPlayer.fleet.ships.forEach(ship => {
        if (ship.isPlaced) {
          // Collect all cells for this ship
          const shipCells = [];
          for (let row = 0; row < eraRows; row++) {
            for (let col = 0; col < eraCols; col++) {
              const placement = humanPlayer.getShipAt(row, col);
              if (placement && placement.shipId === ship.id) {
                shipCells.push({ row, col });
              }
            }
          }
          
          // Draw ship outline with opacity based on sunk status
          if (shipCells.length > 0) {
            const opacity = ship.isSunk() ? 0.4 : 1.0;
            this.drawShipOutline(ctx, ship, shipCells, cellSize, labelSize, offsetX, offsetY, humanPlayer, opacity, 'blue');
          }
        }
      });
    }

    // Draw fire on player's damaged ships (only if not sunk)
    for (let row = 0; row < eraRows; row++) {
      for (let col = 0; col < eraCols; col++) {
        const placement = humanPlayer.getShipAt(row, col);
        if (!placement) continue;

        const ship = humanPlayer.getShip(placement.shipId);
        if (!ship) continue;

        // If ship is sunk, remove fire particles and skip drawing
        if (ship.isSunk()) {
          this.removeFireForCell(row, col);
          continue;
        }

        const cellHealth = ship.health[placement.cellIndex];
        if (cellHealth < 1.0) {
          const x = offsetX + col * cellSize + labelSize + 1;
          const y = offsetY + row * cellSize + labelSize + 1;
          const size = cellSize - 2;

          this.drawFire(ctx, x, y, size, row, col);
        }
      }
    }

    // Draw AI hits on player ships (blue diagonal lines)
    for (let row = 0; row < eraRows; row++) {
      for (let col = 0; col < eraCols; col++) {
        const placement = humanPlayer.getShipAt(row, col);
        if (!placement) continue;

        const ship = humanPlayer.getShip(placement.shipId);
        if (!ship) continue;

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

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Draw fire on enemy damaged ships (only if not sunk)
    for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
      if (!aiPlayer.fleet || !aiPlayer.fleet.ships) continue;
      
      for (let row = 0; row < eraRows; row++) {
        for (let col = 0; col < eraCols; col++) {
          const placement = aiPlayer.getShipAt(row, col);
          if (!placement) continue;

          const ship = aiPlayer.getShip(placement.shipId);
          if (!ship) continue;

          // If ship is sunk, remove fire particles and skip drawing
          if (ship.isSunk()) {
            this.removeFireForCell(row, col);
            continue;
          }

          const cellHealth = ship.health[placement.cellIndex];
          if (cellHealth < 1.0) {
            const x = offsetX + col * cellSize + labelSize + 1;
            const y = offsetY + row * cellSize + labelSize + 1;
            const size = cellSize - 2;

            this.drawFire(ctx, x, y, size, row, col);
          }
        }
      }
    }

    // Draw player hits on enemy ships (red X marks)
    for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
      if (!aiPlayer.fleet || !aiPlayer.fleet.ships) continue;
      
      for (let row = 0; row < eraRows; row++) {
        for (let col = 0; col < eraCols; col++) {
          const placement = aiPlayer.getShipAt(row, col);
          if (!placement) continue;

          const ship = aiPlayer.getShip(placement.shipId);
          if (!ship) continue;

          const cellHealth = ship.health[placement.cellIndex];
          if (cellHealth < 1.0) {
            const x = offsetX + col * cellSize + labelSize + 1;
            const y = offsetY + row * cellSize + labelSize + 1;
            const size = cellSize - 2;

            // Red X
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
    }

    // Draw opponent sunk ships (RED) - top layer for visibility
    for (const aiPlayer of gameInstance.players.filter(p => p.id !== playerId)) {
      if (!aiPlayer.fleet || !aiPlayer.fleet.ships) continue;
      
      aiPlayer.fleet.ships.forEach(ship => {
        if (ship.isSunk()) {
          // Collect all cells for this ship
          const shipCells = [];
          for (let row = 0; row < eraRows; row++) {
            for (let col = 0; col < eraCols; col++) {
              const placement = aiPlayer.getShipAt(row, col);
              if (placement && placement.shipId === ship.id) {
                shipCells.push({ row, col });
              }
            }
          }
          
          this.drawShipOutline(ctx, ship, shipCells, cellSize, labelSize, offsetX, offsetY, aiPlayer, 0.6, 'red');
        }
      });
    }
  }
}

export default HitOverlayRenderer;
// EOF
