// src/classes/Player.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.9.0";
// v0.9.0: Phase 4 Refactor - Renamed missedShots → dontShoot for semantic clarity
//         dontShoot now includes both water misses AND destroyed ship cells
//         Prevents player from clicking invalid targets (miss or destroyed)
// v0.8.0: Phase 3 Refactor - Player now owns fleet reference
//         Added setFleet(), getShip(), isDefeated() methods
//         Player is self-contained entity with board, fleet, and placements
// v0.7.0: Phase 2 Refactor - autoPlaceShips() now writes to this.shipPlacements (dual-write)
//         Still calls game.registerShipPlacement() for Board.cellContents (removed in Phase 4)
// v0.6.1: Phase 1 Refactor - moved autoPlaceShips() from Game.js into Player class
//         Encapsulates placement logic with the player who owns the ships
// v0.6.0: Phase 1 Refactor - added shipPlacements Map for player-owned ship locations
//         Added helper methods: setBoard, placeShip, removeShipAt, getShipAt, etc.
//         Non-breaking addition - existing Board.cellContents still used alongside

class Player {
    // A player in the game can be human or AI, with a game handle (unique) and a player id. Players own fleets.  Initially, the game is a human vs. AI.  [FUTURE] Two people will be able to play the game against each other, but this requires shared game play through the database, which has not been added.
    
  constructor(id, name, playerType = 'human', difficulty = 1.0) {
    // Core identity
    this.id = id;
    this.name = name;
    this.type = playerType;
    
    // DIFFICULTY (v0.4.1)
    // Score multiplier for beating this player
    // 0.8 = Easy (less score), 1.0 = Medium (baseline), 1.2-1.5 = Hard (bonus score)
    this.difficulty = difficulty;
    
    // BOARD REFERENCE (v0.6.0 - Phase 1 Refactor)
    // Reference to shared Board instance for coordinate validation
    // Set by Game via setBoard()
    this.board = null;
    
    // FLEET REFERENCE (v0.8.0 - Phase 3 Refactor)
    // Reference to this player's Fleet instance
    // Set by Game via setFleet() when player joins game
    this.fleet = null;
    
    // STATISTICS (initialized here, updated by Game.js)
    this.hits = 0; // successful shots that hit ships
    this.misses = 0; // shots that missed
    this.sunk = 0; // ships sunk by this player
    this.hitsDamage = 0.0; // cumulative damage dealt
    this.score = 0; // calculated game score
    
    // SHIP PLACEMENT (v0.6.0 - Phase 1 Refactor)
    // Map of where MY ships are located
    // Key: "row,col" string
    // Value: {shipId: string, cellIndex: number}
    // Ship health is stored in the Ship object itself (in fleet)
    this.shipPlacements = new Map();
    
    // DON'T SHOOT TRACKING (v0.9.0 - Phase 4 Refactor)
    // Cells this player should NOT shoot at again (both misses AND destroyed ships)
    // Purpose: Prevent UI from allowing invalid targeting
    // Contents: Water/land misses + fully destroyed ship cells
    // Set by Game.receiveAttack() when result is 'miss' or 'destroyed'
    this.dontShoot = new Set(); // "row,col" of cells this player cannot target again
    
    console.log(`[PLAYER] ${name} created (${playerType}, difficulty: ${difficulty})`);
  }

  /**
   * Set the board reference for coordinate validation
   * v0.6.0: Phase 1 - Player needs Board for validation
   */
  setBoard(board) {
    console.log(`[BOARD] ${this.name} receiving board reference`);
    this.board = board;
    console.log(`[BOARD] ${this.name} board set: ${!!this.board}`);
  }

  /**
   * Set the fleet reference when joining a game
   * v0.8.0: Phase 3 - Player owns their fleet
   */
  setFleet(fleet) {
    this.fleet = fleet;
    console.log(`[PLAYER] ${this.name} fleet set: ${fleet?.ships.length || 0} ships`);
  }

  /**
   * Get a ship from this player's fleet by ID
   * v0.8.0: Phase 3 - Convenient accessor for combat
   */
  getShip(shipId) {
    return this.fleet?.ships.find(s => s.id === shipId);
  }

  /**
   * Check if this player's fleet is defeated (all ships sunk)
   * v0.8.0: Phase 3 - Convenient accessor for game-over detection
   */
  isDefeated() {
    return this.fleet?.isDefeated() || false;
  }

  /**
   * Automatically place all ships in the fleet
   * v0.7.0: Phase 2 - Now writes to this.shipPlacements (dual-write with Board)
   * @param {Game} game - Game instance (temporary, removed in Phase 4)
   * @param {Fleet} fleet - Fleet to place
   * @returns {Promise<boolean>} - True if all ships placed successfully
   */
  async autoPlaceShips(game, fleet) {
    if (!this.board) {
      throw new Error(`[PLACEMENT] Player ${this.name} has no board reference`);
    }

    console.log(`[PLACEMENT] Auto-placing ships for ${this.name}`);

    for (const ship of fleet.ships) {
      if (ship.isPlaced) {
        console.log(`[PLACEMENT] ${ship.name} already placed, skipping`);
        continue;
      }
      
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 100) {
        // Get random starting position
        const startCell = this.board.getRandomValidCell();
        if (!startCell) {
          throw new Error(`[PLACEMENT] No valid cells available for ${ship.name}`);
        }
        
        const horizontal = Math.random() > 0.5;

        // Generate cell positions for ship
        const cells = [];
        for (let i = 0; i < ship.size; i++) {
          const cellRow = horizontal ? startCell.row : startCell.row + i;
          const cellCol = horizontal ? startCell.col + i : startCell.col;
          cells.push({ row: cellRow, col: cellCol });
        }

        // Phase 2: DUAL-WRITE - write to both systems
        // Still using Game.registerShipPlacement() for Board.cellContents (removed in Phase 4)
        const registered = game.registerShipPlacement(
          ship,
          cells,
          horizontal ? 'horizontal' : 'vertical',
          this.id
        );
        
        if (registered) {
          // NEW: Also write to player's own shipPlacements map
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            this.placeShip(cell.row, cell.col, ship.id, i);
          }
          
          ship.place();
          placed = true;
          console.log(`[PLACEMENT] Placed ${ship.name} for ${this.name} (attempt ${attempts + 1})`);
          game.notifyUIUpdate();
        }
        
        attempts++;
      }

      if (!placed) {
        throw new Error(`[PLACEMENT] Failed to place ${ship.name} for ${this.name} after 100 attempts`);
      }
    }
    
    console.log(`[PLACEMENT] All ships placed for ${this.name}`);
    return true;
  }

  /**
   * Place a ship cell at coordinates
   * v0.6.0: Phase 1 - Player-owned ship placement
   * @param {number} row - Row coordinate
   * @param {number} col - Column coordinate
   * @param {string} shipId - Ship identifier
   * @param {number} cellIndex - Index of this cell in ship's cells array
   * @returns {boolean} - True if placed successfully, false if invalid
   */
  placeShip(row, col, shipId, cellIndex) {
    // Validate coordinates using Board
    if (!this.board || !this.board.isValidCoordinate(row, col)) {
      console.warn(`[PLACEMENT] Player ${this.name}: Invalid coordinates (${row},${col})`);
      return false;
    }

    const key = `${row},${col}`;
    
    // Allow stacking - multiple ships can occupy same cell
    // But warn if we're replacing the exact same ship+cell
    const existing = this.shipPlacements.get(key);
    if (existing && existing.shipId === shipId && existing.cellIndex === cellIndex) {
      console.warn(`[PLACEMENT] Player ${this.name}: Ship ${shipId} cell ${cellIndex} already at ${key}`);
      return false;
    }

    this.shipPlacements.set(key, { shipId, cellIndex });
    return true;
  }

  /**
   * Remove ship placement at coordinates
   * v0.6.0: Phase 1 - Useful for drag-drop UI when repositioning ships
   */
  removeShipAt(row, col) {
    const key = `${row},${col}`;
    return this.shipPlacements.delete(key);
  }

  /**
   * Get ship placement data at coordinates
   * v0.6.0: Phase 1 - Returns {shipId, cellIndex} or undefined
   */
  getShipAt(row, col) {
    return this.shipPlacements.get(`${row},${col}`);
  }

  /**
   * Check if this player has a ship at coordinates
   * v0.6.0: Phase 1 - Quick existence check
   */
  hasShipAt(row, col) {
    return this.shipPlacements.has(`${row},${col}`);
  }

  /**
   * Clear all ship placements
   * v0.6.0: Phase 1 - Used during reset or when replaying
   */
  clearPlacements() {
    this.shipPlacements.clear();
  }

  /**
   * Get all ship placements
   * v0.6.0: Phase 1 - Returns array of {row, col, shipId, cellIndex}
   * Useful for debugging, UI rendering, or serialization
   */
  getAllPlacements() {
    const placements = [];
    for (const [key, data] of this.shipPlacements.entries()) {
      const [row, col] = key.split(',').map(Number);
      placements.push({
        row,
        col,
        shipId: data.shipId,
        cellIndex: data.cellIndex
      });
    }
    return placements;
  }

  /**
   * Get all cells where a specific ship is placed
   * v0.8.0: Phase 3 - Used for visualizer when ship is sunk
   * Returns array of {row, col, cellIndex} sorted by cellIndex
   */
  getShipCells(shipId) {
    const cells = [];
    for (const [key, placement] of this.shipPlacements.entries()) {
      if (placement.shipId === shipId) {
        const [row, col] = key.split(',').map(Number);
        cells.push({ row, col, cellIndex: placement.cellIndex });
      }
    }
    // Sort by cellIndex to maintain ship orientation
    return cells.sort((a, b) => a.cellIndex - b.cellIndex);
  }

  /**
   * Check if this player can shoot at these coordinates
   * v0.9.0: Updated to use dontShoot (includes both misses and destroyed cells)
   */
  canShootAt(row, col) {
    return !this.isDontShoot(row, col);
  }

  /**
   * Check if this cell is marked as don't shoot
   * v0.9.0: Renamed from hasMissedAt() - now includes destroyed ship cells
   */
  isDontShoot(row, col) {
    return this.dontShoot.has(`${row},${col}`);
  }

  /**
   * Mark a cell as don't shoot (miss or destroyed ship cell)
   * v0.9.0: Renamed from recordMiss() - broader purpose
   * Called by Game.receiveAttack() when result is 'miss' or 'destroyed'
   */
  recordDontShoot(row, col) {
    this.dontShoot.add(`${row},${col}`);
  }

  /**
   * Get all coordinates marked as don't shoot
   * v0.9.0: Renamed from getMissedShots() - returns both misses and destroyed cells
   * Used by HitOverlayRenderer to avoid rendering on destroyed cells
   */
  getDontShoot() {
    return Array.from(this.dontShoot).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
  }

  // Computed properties (getters)
  get shots() {
    return this.hits + this.misses;
  }

  get accuracy() {
    return this.shots > 0 ? ((this.hits / this.shots) * 100).toFixed(1) : 0;
  }

  get averageDamage() {
    return this.hits > 0 ? (this.hitsDamage / this.hits).toFixed(2) : 0;
  }

  get damagePerShot() {
    return this.shots > 0 ? (this.hitsDamage / this.shots).toFixed(2) : 0;
  }

  /**
   * Check if player can play (has fleet, etc.)
   */
  canPlay() {
    return true;
  }

  /**
   * Reset player statistics for new game
   * v0.9.0: Also clears dontShoot Set
   */
  reset() {
    this.hits = 0;
    this.misses = 0;
    this.sunk = 0;
    this.hitsDamage = 0.0;
    this.score = 0;
    this.shipPlacements.clear();
    this.dontShoot.clear();
    // Note: fleet and board references are NOT cleared - they're set by Game
    console.log(`[PLAYER] ${this.name} reset for new game`);
  }

  /**
   * Get player statistics summary
   */
  getStats() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      difficulty: this.difficulty,
      shots: this.shots,
      hits: this.hits,
      misses: this.misses,
      sunk: this.sunk,
      hitsDamage: this.hitsDamage,
      score: this.score,
      accuracy: parseFloat(this.accuracy),
      averageDamage: parseFloat(this.averageDamage),
      damagePerShot: parseFloat(this.damagePerShot)
    };
  }
}

export default Player;
// EOF
