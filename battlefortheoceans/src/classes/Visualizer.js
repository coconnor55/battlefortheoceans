// src/classes/Visualizer.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.2.2";

class Visualizer {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    
    // Visual state grid - parallel to Board dimensions
    // REFACTORED: Removed shot tracking (lastShotResult, shotCount) - Board.shotHistory is SSOT
    this.cells = Array(rows).fill().map(() =>
      Array(cols).fill().map(() => ({
        redRingPercent: 0,      // Enemy damage percentage (0-100)
        blueRingPercent: 0,     // Own damage percentage (0-100)
        skullType: null,        // 'red', 'blue', 'gray' for different sunk ship types
        showSkull: false,       // Any sunk ship at this cell
        lastUpdated: null       // Timestamp of last update
      }))
    );
    
    console.log(`Visualizer: Created ${rows}x${cols} visual grid`);
  }

  /**
   * Update visual state for a cell based on attack results
   * REFACTORED: No longer tracks shots - only visual effects
   */
  updateCellVisuals(row, col, hitResults, firingPlayer, attackResult) {
    if (!this.isValidCoordinate(row, col)) {
      console.warn(`Visualizer: Invalid coordinates ${row},${col}`);
      return;
    }

    const cell = this.cells[row][col];
    cell.lastUpdated = Date.now();

    // For misses, no visual updates needed (Board.shotHistory handles tracking)
    if (!hitResults || hitResults.length === 0) {
      console.log(`Visualizer: Miss recorded at ${row},${col} (tracked by Board)`);
      return;
    }

    // Process hit results for visual effects only
    let playerShipHit = false;  // Blue ring (enemy hits player ships)
    let enemyShipHit = false;   // Red ring (player hits enemy ships)

    hitResults.forEach(({ ship, player, result }) => {
      const isSunk = ship.isSunk();
      
      // Determine ring color based on WHO got hit, not who fired
      if (player.type === 'human') {
        // Player ship was hit by enemy - BLUE ring
        playerShipHit = true;
        if (isSunk) {
          // Update ALL cells of this sunk player ship
          this.updateSunkShipCells(ship, player, 'blue');
        }
      } else {
        // Enemy ship was hit by player - RED ring
        enemyShipHit = true;
        if (isSunk) {
          // Update ALL cells of this sunk enemy ship
          this.updateSunkShipCells(ship, player, 'red');
        }
      }
    });

    // Full rings on any hit
    if (playerShipHit) {
      cell.blueRingPercent = 100;
    }
    if (enemyShipHit) {
      cell.redRingPercent = 100;
    }

    console.log(`Visualizer: Updated ${row},${col} - Red:${cell.redRingPercent}% Blue:${cell.blueRingPercent}% Skull:${cell.skullType || 'none'}`);
  }

  /**
   * Update all cells of a sunk ship with skull markers
   * Called internally when a ship is sunk
   */
  updateSunkShipCells(ship, player, skullColor) {
    // We need Game to call this with ship cell positions
    // For now, just mark the current cell - Game will need to call updateShipSunk separately
  }

  /**
   * Update visual state when a ship is sunk (show skulls on all ship cells)
   * Called by Game when ship destruction is confirmed
   * SKULL COLOR FIX: Properly use isPlayerShip parameter from UUID logic
   */
  updateShipSunk(shipCells, shipOwner, isPlayerShip = false) {
    // FIXED: Use the isPlayerShip parameter correctly from Game.js UUID logic
    const skullColor = isPlayerShip ? 'blue' : 'red';
    
    console.log(`[SKULL FIX] Visualizer.updateShipSunk called with:`, {
      shipCellsCount: shipCells.length,
      shipOwner,
      isPlayerShip,
      calculatedSkullColor: skullColor
    });
    
    shipCells.forEach(({ row, col }) => {
      if (this.isValidCoordinate(row, col)) {
        const cell = this.cells[row][col];
        
        // Handle mixed skull scenarios
        if (cell.showSkull) {
          // Already has a skull - check if we need to upgrade to gray
          if (cell.skullType !== skullColor) {
            cell.skullType = 'gray'; // Both player and enemy ships sunk
            console.log(`[SKULL FIX] Mixed skull at ${row},${col} - setting to gray`);
          }
        } else {
          // First skull at this location
          cell.skullType = skullColor;
          cell.showSkull = true;
          console.log(`[SKULL FIX] New ${skullColor} skull at ${row},${col}`);
        }
        
        cell.lastUpdated = Date.now();
      }
    });
    
    console.log(`[SKULL FIX] Applied ${skullColor} skulls to ${shipCells.length} cells`);
  }

  /**
   * Get visual state for a specific cell
   */
  getCellVisuals(row, col) {
    if (!this.isValidCoordinate(row, col)) {
      return null;
    }
    return { ...this.cells[row][col] };
  }

  /**
   * Get visual state for entire board (for rendering)
   */
  getVisualState() {
    return this.cells.map(row => row.map(cell => ({ ...cell })));
  }

  /**
   * REFACTORED: Generate miss markers from Board.shotHistory (SSOT)
   * Canvas calls this instead of maintaining dual tracking
   */
  getMissMarkersFromShotHistory(shotHistory, playerId) {
    return shotHistory
      .filter(shot => shot.result === 'miss' && shot.attacker === playerId)
      .map(shot => ({ row: shot.row, col: shot.col }));
  }

  /**
   * Get visual state for player view (filtered for player perspective)
   * This method considers alliance rules and visibility
   */
  getPlayerVisualState(playerId, playerAlliances, gameRules) {
    // For now, return full visual state
    // Future: Filter based on fog of war, alliance visibility, etc.
    return this.getVisualState();
  }

  /**
   * Clear visual effects from a cell
   */
  clearCellVisuals(row, col) {
    if (!this.isValidCoordinate(row, col)) {
      return;
    }

    const cell = this.cells[row][col];
    cell.redRingPercent = 0;
    cell.blueRingPercent = 0;
    cell.showSkull = false;
    cell.skullType = null;
    cell.lastUpdated = Date.now();
  }

  /**
   * Clear all visual effects (for game reset)
   */
  clearAll() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.clearCellVisuals(row, col);
      }
    }
    console.log('Visualizer: All visual effects cleared');
  }

  /**
   * Validate coordinates
   */
  isValidCoordinate(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  /**
   * Get cells with active visual effects
   */
  getActiveCells() {
    const active = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col];
        if (cell.redRingPercent > 0 || cell.blueRingPercent > 0 || cell.showSkull) {
          active.push({ row, col, ...cell });
        }
      }
    }
    return active;
  }

  /**
   * Get statistics about visual state
   */
  getStats() {
    let cellsWithEffects = 0;
    let skullCells = 0;
    let redSkulls = 0;
    let blueSkulls = 0;
    let graySkulls = 0;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col];
        
        if (cell.redRingPercent > 0 || cell.blueRingPercent > 0 || cell.showSkull) {
          cellsWithEffects++;
        }
        
        if (cell.showSkull) {
          skullCells++;
          switch (cell.skullType) {
            case 'red': redSkulls++; break;
            case 'blue': blueSkulls++; break;
            case 'gray': graySkulls++; break;
          }
        }
      }
    }

    return {
      dimensions: { rows: this.rows, cols: this.cols },
      totalCells: this.rows * this.cols,
      cellsWithEffects,
      skullCells,
      skullBreakdown: { red: redSkulls, blue: blueSkulls, gray: graySkulls },
      version
    };
  }

  /**
   * Export visual state for debugging
   */
  exportState() {
    return {
      version,
      dimensions: { rows: this.rows, cols: this.cols },
      cells: this.cells,
      stats: this.getStats(),
      exportedAt: Date.now()
    };
  }
}

export default Visualizer;
// EOF
