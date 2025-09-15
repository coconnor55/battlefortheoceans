// src/classes/Board.js (v0.1.15 - FIXED)
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED: Do not modify without confirmation

class Board {
  constructor(rows, cols, terrain) {
    if (!terrain || !Array.isArray(terrain) || terrain.length !== rows || terrain.some(row => !Array.isArray(row) || row.length !== cols)) {
      throw new Error('Board (v0.1.15): Terrain array must match rows x cols dimensions');
    }
    this.rows = rows;
    this.cols = cols;
    
    // Create grid with individual cell objects (not shared references)
    this.grid = Array(rows).fill().map(() =>
      Array(cols).fill().map(() => ({
        terrain: null,
        state: 'empty',
        userId: null,
        damage: 0
      }))
    );
    
    // Set terrain for each cell individually
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.grid[row][col].terrain = terrain[row][col];
      }
    }
    
    console.log('Board (v0.1.15): Created board', { rows, cols, gridCreated: true });
  }

  placeShip(ship, userId) {
    if (!this.canPlaceShip(ship)) {
      console.warn('Board (v0.1.15): Invalid placement position', { ship: ship.name, cells: ship.cells, userId });
      return false;
    }
    
    ship.resetDamage(); // Sync with placement
    
    // Place ship only on specified cells
    ship.cells.forEach(({ row, col }) => {
      console.log('Board (v0.1.15): Placing ship cell at', { row, col, ship: ship.name });
      this.grid[row][col].state = 'ship';
      this.grid[row][col].userId = userId;
      this.grid[row][col].damage = 0; // Reset damage on placement
    });
    
    console.log('Board (v0.1.15): Ship placed successfully', { ship: ship.name, cellCount: ship.cells.length });
    return true;
  }

  canPlaceShip(ship) {
    if (!ship.cells || !Array.isArray(ship.cells)) {
      console.warn('Board (v0.1.15): Ship has no cells defined', { ship: ship.name });
      return false;
    }
    
    return ship.cells.every(({ row, col }) => {
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
        console.warn('Board (v0.1.15): Ship placement out of bounds', { row, col, ship: ship.name });
        return false;
      }
      if (this.grid[row][col].terrain === 'excluded') {
        console.warn('Board (v0.1.15): Ship placement on excluded terrain', { row, col, terrain: this.grid[row][col].terrain, ship: ship.name });
        return false;
      }
      if (!ship.terrain.includes(this.grid[row][col].terrain)) {
        console.warn('Board (v0.1.15): Ship terrain restriction violated', { row, col, shipTerrain: ship.terrain, cellTerrain: this.grid[row][col].terrain, ship: ship.name });
        return false;
      }
      if (this.grid[row][col].state !== 'empty' || this.grid[row][col].userId !== null) {
        console.warn('Board (v0.1.15): Cell already occupied', { row, col, state: this.grid[row][col].state, userId: this.grid[row][col].userId, ship: ship.name });
        return false;
      }
      return true;
    });
  }

  receiveAttack(row, col, damage = 1.0) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols || this.grid[row][col].terrain === 'excluded') {
      console.warn('Board (v0.1.15): Invalid attack position', { row, col });
      return 'miss';
    }
    const cell = this.grid[row][col];
    if (cell.state === 'empty') {
      cell.state = 'miss';
      return 'miss'; // No damage on miss
    } else if (cell.state === 'ship' || cell.state === 'hit') {
      if (cell.damage >= 1.0) {
        console.warn('Board (v0.1.15): No further hits allowed on cell with damage >= 1.0', { row, col, currentDamage: cell.damage, attemptedDamage: damage });
        return cell.state; // Block further hits
      }
      cell.state = 'hit';
      cell.damage = damage; // Set initial damage, no accumulation beyond first hit
      return 'hit';
    }
    return 'invalid';
  }

  getPublicState() {
    return this.grid.map(row => row.map(cell => ({
      state: cell.state === 'ship' ? 'empty' : cell.state, // Hide all ships
      terrain: cell.terrain,
      damage: cell.damage
    })));
  }

  getCellStyle(userId) {
    return (row, col) => {
      const cell = this.grid[row][col];
      const playerView = {
        terrain: cell.terrain,
        state: cell.userId === userId ? cell.state : (cell.state === 'ship' ? 'empty' : cell.state),
        damage: cell.damage
      };
      return playerView;
    };
  }

  getPlayerBoard(userId) {
    return this.grid.map(row => row.map(cell => ({
      ...cell,
      state: cell.userId !== userId && cell.state === 'ship' && cell.damage === 0 ? 'empty' : cell.state,
      userId: cell.userId === userId ? cell.userId : null
    })));
  }
}

export default Board;

// EOF - EOF - EOF
