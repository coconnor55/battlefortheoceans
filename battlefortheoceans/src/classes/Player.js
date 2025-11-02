// src/classes/Player.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.9.5";
// v0.9.5: Added totalDamage tracking for achievements
// v0.9.4: Added userProfile parameter to constructor
//         - Player now holds reference to lifetime statistics (userProfile)
//         - Per-game stats (hits, misses, etc.) still reset each game
//         - userProfile contains: total_games, total_wins, total_score, best_accuracy, etc.
//         - Simplifies architecture: Player is self-contained with both per-game and lifetime stats
// v0.9.3: Fixed autoPlaceShips to use all four orientations (0/90/180/270)
//         - Was only using 0° and 90°
//         - Now randomly selects from all four directions
// v0.9.2: Changed orientation from string to numeric degrees (0/90/180/270)
//         - 0° = Horizontal L→R (stern left, bow right) - default
//         - 90° = Vertical pointing UP (stern bottom, bow top)
//         - 180° = Horizontal R→L (stern right, bow left)
//         - 270° = Vertical pointing DOWN (stern top, bow bottom)
//         Updated placeShip() to accept degrees (default 0)
//         Updated autoPlaceShips() to use 0 or 90 randomly
// v0.9.1: Store ship orientation in shipPlacements for rendering
//         Added orientation parameter to placeShip()
//         Updated autoPlaceShips() to pass orientation
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
    
  constructor(id, name, playerType = 'human', difficulty = 1.0, userProfile = null) {
    // Core identity
    this.id = id;
    this.name = name;
    this.type = playerType;
      this.totalDamage = 0;
    
    // DIFFICULTY (v0.4.1)
    // Score multiplier for beating this player
    // 0.8 = Easy (less score), 1.0 = Medium (baseline), 1.2-1.5 = Hard (bonus score)
    this.difficulty = difficulty;
    
    // USER PROFILE (v0.9.4)
    // Lifetime statistics for this player (from database)
    // Contains: id, game_name, total_games, total_wins, total_score, best_accuracy, total_ships_sunk, total_damage
    // Only used for human players (null for AI players)
    // Per-game stats (hits, misses, etc.) are separate and reset each game
    this.userProfile = userProfile;
    
    // BOARD REFERENCE (v0.6.0 - Phase 1 Refactor)
    // Reference to shared Board instance for coordinate validation
    // Set by Game via setBoard()
    this.board = null;
    
    // FLEET REFERENCE (v0.8.0 - Phase 3 Refactor)
    // Reference to this player's Fleet instance
    // Set by Game via setFleet() when player joins game
    this.fleet = null;
    
    // STATISTICS (initialized here, updated by Game.js)
    // These are PER-GAME stats that reset each game
    this.hits = 0; // successful shots that hit ships
    this.misses = 0; // shots that missed
    this.sunk = 0; // ships sunk by this player
    this.hitsDamage = 0.0; // cumulative damage dealt
    this.score = 0; // calculated game score
      this.totalDamage = 0;  // new - cumulative damage across all games for achievements
    
    // SHIP PLACEMENT (v0.6.0 - Phase 1 Refactor, v0.9.2 orientation as degrees)
    // Map of where MY ships are located
    // Key: "row,col" string
    // Value: {shipId: string, cellIndex: number, orientation: number}
    // orientation: 0=L→R, 90=UP, 180=R→L, 270=DOWN (degrees)
    // Ship health is stored in the Ship object itself (in fleet)
    this.shipPlacements = new Map();
    
    // DON'T SHOOT TRACKING (v0.9.0 - Phase 4 Refactor)
    // Cells this player should NOT shoot at again (both misses AND destroyed ships)
    // Purpose: Prevent UI from allowing invalid targeting
    // Contents: Water/land misses + fully destroyed ship cells
    // Set by Game.receiveAttack() when result is 'miss' or 'destroyed'
    this.dontShoot = new Set(); // "row,col" of cells this player cannot target again
    
    console.log(`[PLAYER] ${name} created (${playerType}, difficulty: ${difficulty})${userProfile ? ' with profile' : ''}`);
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
   * v0.9.3: Now randomly selects from all four orientations (0/90/180/270)
   * v0.9.2: Now uses numeric degrees (0 or 90) for orientation
   * v0.9.1: Now passes orientation to placeShip()
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

    const validOrientations = [0, 90, 180, 270];

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
        
        // Randomly choose from all four orientations
        const orientation = validOrientations[Math.floor(Math.random() * validOrientations.length)];
        
        // Generate cell positions for ship based on orientation
        const cells = [];
        for (let i = 0; i < ship.size; i++) {
          let cellRow = startCell.row;
          let cellCol = startCell.col;
          
          switch (orientation) {
            case 0:   // L→R: stern at (row, col), bow extends right
              cellCol = startCell.col + i;
              break;
            case 90:  // UP: stern at (row, col), bow extends up
              cellRow = startCell.row - i;
              break;
            case 180: // R→L: stern at (row, col), bow extends left
              cellCol = startCell.col - i;
              break;
            case 270: // DOWN: stern at (row, col), bow extends down
              cellRow = startCell.row + i;
              break;
          }
          
          cells.push({ row: cellRow, col: cellCol });
        }

        // Phase 2: DUAL-WRITE - write to both systems
        // Still using Game.registerShipPlacement() for Board.cellContents (removed in Phase 4)
        const registered = game.registerShipPlacement(
          ship,
          cells,
          orientation,
          this.id
        );
        
        if (registered) {
          // v0.9.3: Pass numeric degrees to placeShip()
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            this.placeShip(cell.row, cell.col, ship.id, i, orientation);
          }
          
          ship.place();
          placed = true;
          console.log(`[PLACEMENT] Placed ${ship.name} for ${this.name} (${orientation}°, attempt ${attempts + 1})`);
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
   * v0.9.2: Changed orientation to numeric degrees (0/90/180/270)
   * v0.9.1: Added orientation parameter for ship rendering
   * v0.6.0: Phase 1 - Player-owned ship placement
   * @param {number} row - Row coordinate
   * @param {number} col - Column coordinate
   * @param {string} shipId - Ship identifier
   * @param {number} cellIndex - Index of this cell in ship's cells array
   * @param {number} orientation - Degrees: 0=L→R, 90=UP, 180=R→L, 270=DOWN
   * @returns {boolean} - True if placed successfully, false if invalid
   */
  placeShip(row, col, shipId, cellIndex, orientation = 0) {
    // Validate coordinates using Board
    if (!this.board || !this.board.isValidCoordinate(row, col)) {
      console.warn(`[PLACEMENT] Player ${this.name}: Invalid coordinates (${row},${col})`);
      return false;
    }

    // Validate orientation is valid degree value
    if (![0, 90, 180, 270].includes(orientation)) {
      console.warn(`[PLACEMENT] Player ${this.name}: Invalid orientation ${orientation}° (must be 0/90/180/270)`);
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

    this.shipPlacements.set(key, { shipId, cellIndex, orientation });
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
   * v0.9.2: Now returns {shipId, cellIndex, orientation} where orientation is degrees
   * v0.9.1: Now returns {shipId, cellIndex, orientation}
   * v0.6.0: Phase 1 - Returns placement data or undefined
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
   * v0.9.2: Orientation now numeric degrees (0/90/180/270)
   * v0.9.1: Now includes orientation in returned data
   * v0.6.0: Phase 1 - Returns array of {row, col, shipId, cellIndex, orientation}
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
        cellIndex: data.cellIndex,
        orientation: data.orientation
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
   * v0.9.4: Does NOT reset userProfile (lifetime stats preserved)
   * v0.9.0: Also clears dontShoot Set
   */
  reset() {
    // Reset per-game stats
    this.hits = 0;
    this.misses = 0;
    this.sunk = 0;
    this.hitsDamage = 0.0;
    this.score = 0;
      this.totalDamage = 0;
    this.shipPlacements.clear();
    this.dontShoot.clear();
    // Note: fleet, board, and userProfile references are NOT cleared
    // - fleet and board are set by Game
    // - userProfile contains lifetime stats and should persist
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
        totalDamage: this.totalDamage,
      score: this.score,
      accuracy: parseFloat(this.accuracy),
      averageDamage: parseFloat(this.averageDamage),
      damagePerShot: parseFloat(this.damagePerShot)
    };
  }
    
    /**
     * Check if user ID represents a guest user
     * @param {string} userId - User ID to check
     * @returns {boolean} True if guest user
     */
    static isGuest(userId) {
      return !userId || userId.startsWith('guest-');
    }

    /**
     * Check if user ID represents an AI player
     * @param {string} userId - User ID to check
     * @returns {boolean} True if AI player
     */
    static isAI(userId) {
      return userId && userId.startsWith('ai-');
    }

    /**
     * Check if user ID represents a human player (authenticated)
     * @param {string} userId - User ID to check
     * @returns {boolean} True if human player
     */
    static isHuman(userId) {
      return userId && !Player.isGuest(userId) && !Player.isAI(userId);
    }
}

export default Player;
// EOF
