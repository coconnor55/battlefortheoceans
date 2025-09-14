// src/classes/Board.js (v0.1.14)
// Copyright(c) 2025, Clint H. O’Connor
// LOCKED: Do not modify without confirmation

class Board {
  constructor(rows, cols, terrain) {
    if (!terrain || !Array.isArray(terrain) || terrain.length !== rows || terrain.some(row => !Array.isArray(row) || row.length !== cols)) {
      throw new Error('Board (v0.1.14): Terrain array must match rows x cols dimensions');
    }
    this.rows = rows;
    this.cols = cols;
    this.grid = Array(rows).fill().map(() => Array(cols).fill({ terrain: null, state: 'empty', userId: null, damage: 0 }));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.grid[row][col].terrain = terrain[row][col];
      }
    }
  }

  placeShip(ship, userId) {
    if (!this.canPlaceShip(ship)) {
      console.warn('Board (v0.1.14): Invalid placement position', { ship: ship.name, cells: ship.cells, userId });
      return false;
    }
    ship.resetDamage(); // Sync with placement
    ship.cells.forEach(({ row, col }) => {
      this.grid[row][col].state = 'ship';
      this.grid[row][col].userId = userId;
      this.grid[row][col].damage = 0; // Reset damage on placement
    });
    return true;
  }

  canPlaceShip(ship) {
    return ship.cells.every(({ row, col }) => {
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
        console.warn('Board (v0.1.14): Ship placement out of bounds', { row, col, ship: ship.name });
        return false;
      }
      if (this.grid[row][col].terrain === 'excluded') {
        console.warn('Board (v0.1.14): Ship placement on excluded terrain', { row, col, terrain: this.grid[row][col].terrain, ship: ship.name });
        return false;
      }
      if (!ship.terrain.includes(this.grid[row][col].terrain)) {
        console.warn('Board (v0.1.14): Ship terrain restriction violated', { row, col, shipTerrain: ship.terrain, cellTerrain: this.grid[row][col].terrain, ship: ship.name });
        return false;
      }
      return this.grid[row][col].state === 'empty' && this.grid[row][col].userId === null;
    });
  }

  receiveAttack(row, col, damage = 1.0) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols || this.grid[row][col].terrain === 'excluded') {
      console.warn('Board (v0.1.14): Invalid attack position', { row, col });
      return 'miss';
    }
    const cell = this.grid[row][col];
    if (cell.state === 'empty') {
      cell.state = 'miss';
      return 'miss'; // No damage on miss
    } else if (cell.state === 'ship' || cell.state === 'hit') {
      if (cell.damage >= 1.0) {
        console.warn('Board (v0.1.14): No further hits allowed on cell with damage >= 1.0', { row, col, currentDamage: cell.damage, attemptedDamage: damage });
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
