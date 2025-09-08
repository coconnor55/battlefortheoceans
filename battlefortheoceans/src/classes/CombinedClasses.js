// src/classes/CombinedClasses.js (v0.1.52)
// Copyright(c) 2025, Clint H. O'Connor
// autoincrement the above version on each change but do not autoincrement or list the artifact if there is no functional change
// Instructions: Allowed to update imports/exports only with explicit user confirmation. Do not remove or modify existing classes/components without explicit user confirmation. Do not alter sections marked with 'LOCKED' without explicit user confirmation. If code appears incomplete, truncated, or potentially missing (e.g., based on logs or context), stop and ask the user to provide the full code before proceeding. Making assumptions or generating substitute code without explicit user confirmation is prohibited.

import { createMachine, assign, interpret } from 'xstate';
import Debug from '../utils/Debug';
import { supabase } from '../supabaseClient';

class Ship {
  // src/classes/CombinedClasses.js/Ship (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor(name, size, terrain) {
    this.name = name;
    this.size = size;
    this.terrain = terrain;
    this.cells = [];
    this.hits = 0;
    this.isSunk = false;
  }

  hit() {
    this.hits += 1;
    this.isSunk = this.hits >= this.size;
    return this.isSunk ? 'sunk' : 'hit';
  }
}

class Board {
  // src/classes/CombinedClasses.js/Board (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor(size, terrain) {
    this.size = size;
    this.grid = Array(size).fill().map(() => Array(size).fill({ terrain: 'deep', state: 'empty', playable: true }));
    if (terrain) {
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          this.grid[row][col].terrain = terrain[row][col] || 'deep';
          this.grid[row][col].playable = !['land', 'off-chart', 'rock'].includes(this.grid[row][col].terrain);
        }
      }
    }
    this.ships = [];
    Debug.log('v0.1.52', 'Board initialized', { size, terrain: terrain ? 'provided' : 'default', gridShape: [this.grid.length, this.grid[0]?.length] });
  }

  addShip(ship) {
    if (!this.canPlaceShip(ship)) {
      Debug.warn('v0.1.52', 'Invalid placement position', { ship: ship.name, cells: ship.cells });
      return false;
    }
    ship.cells.forEach(({ row, col }) => {
      this.grid[row][col].state = 'ship';
      Debug.log('v0.1.52', 'Setting ship state', { row, col, state: 'ship' });
    });
    this.ships.push(ship);
    Debug.log('v0.1.52', 'Ship added to board', { name: ship.name, size: ship.size, gridState: this.grid });
    return true;
  }

  canPlaceShip(ship) {
    return ship.cells.every(({ row, col }) => {
      if (row < 0 || row >= this.size || col < 0 || col >= this.size) {
        Debug.warn('v0.1.52', 'Ship placement out of bounds', { row, col, ship: ship.name });
        return false;
      }
      if (!this.grid[row][col].playable) {
        Debug.warn('v0.1.52', 'Ship placement on non-playable terrain', { row, col, terrain: this.grid[row][col].terrain, ship: ship.name });
        return false;
      }
      return this.grid[row][col].state === 'empty';
    });
  }

  receiveAttack(row, col) {
    if (row < 0 || row >= this.size || col < 0 || col >= this.size || !this.grid[row][col].playable) {
      Debug.warn('v0.1.52', 'Invalid attack position', { row, col });
      return 'miss';
    }
    const cell = this.grid[row][col];
    if (cell.state === 'empty') {
      cell.state = 'miss';
      Debug.log('v0.1.52', 'Attack missed', { row, col });
      return 'miss';
    } else if (cell.state === 'ship') {
      const ship = this.ships.find(s => s.cells.some(c => c.row === row && c.col === col));
      const result = ship.hit();
      Debug.log('v0.1.52', `Attack ${result}`, { row, col, ship: ship.name });
      return result;
    }
    return 'invalid';
  }
}

class Placer {
  // src/classes/CombinedClasses.js/Placer (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor(board) {
    this.board = board;
    this.fleet = [
      new Ship('Carrier', 5, ['deep']),
      new Ship('Battleship', 4, ['deep']),
      new Ship('Cruiser', 3, ['deep', 'shallow']),
      new Ship('Submarine', 3, ['deep']),
      new Ship('Destroyer', 2, ['deep', 'shallow'])
    ];
    this.currentShip = null;
    this.placedShips = [];
  }

  getCurrentShip() {
    return this.currentShip || this.fleet.find(ship => !this.placedShips.includes(ship));
  }

  startPlacement(row, col) {
    const ship = this.getCurrentShip();
    if (!ship) return false;
    this.currentShip = ship;
    this.currentShip.cells = [];
    this.currentShip.start = { row, col };
    Debug.log('v0.1.52', 'Placement started', { row, col, ship: ship.name });
    return true;
  }

  swipe(row, col, direction) {
    if (!this.currentShip || !this.currentShip.start) return false;
    const startRow = this.currentShip.start.row;
    const startCol = this.currentShip.start.col;
    const dr = direction === 'horizontal' ? 0 : 1;
    const dc = direction === 'horizontal' ? 1 : 0;
    const cells = [];
    for (let i = 0; i < this.currentShip.size; i++) {
      const r = startRow + dr * i;
      const c = startCol + dc * i;
      if (r >= 0 && r < this.board.size && c >= 0 && c < this.board.size) {
        cells.push({ row: r, col: c });
      } else {
        Debug.warn('v0.1.52', 'Swipe out of bounds', { row: r, col: c, ship: this.currentShip.name });
        return false;
      }
    }
    if (cells.length !== this.currentShip.size) {
      Debug.warn('v0.1.52', 'Invalid swipe length', { expected: this.currentShip.size, got: cells.length });
      return false;
    }
    if (!cells.every(cell => this.board.grid[cell.row][cell.col].playable && this.currentShip.terrain.includes(this.board.grid[cell.row][cell.col].terrain))) {
      Debug.warn('v0.1.52', 'Invalid terrain for swipe', { cells, terrain: this.currentShip.terrain });
      return false;
    }
    if (cells.some(cell => this.board.grid[cell.row][cell.col].state !== 'empty')) {
      Debug.warn('v0.1.52', 'Swipe overlaps existing ship', { cells });
      return false;
    }
    this.currentShip.cells = cells;
    Debug.log('v0.1.52', 'Swipe validated', { cells, ship: this.currentShip.name });
    return true;
  }

  confirmPlacement() {
    if (this.currentShip && this.currentShip.cells.length === this.currentShip.size) {
      if (this.board.addShip(this.currentShip)) {
        this.placedShips.push(this.currentShip);
        this.currentShip = null;
        Debug.log('v0.1.52', 'Placement confirmed', { ship: this.currentShip?.name });
        return true;
      }
    }
    return false;
  }

  isComplete() {
    return this.fleet.every(ship => this.placedShips.includes(ship));
  }
}

class Player {
  // src/classes/CombinedClasses.js/Player (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor(id, name) {
    this.id = id;
    this.name = name;
    Debug.log('v0.1.52', 'Player initialized', { id, name });
  }
}

class AIPlayer extends Player {
  // src/classes/CombinedClasses.js/AIPlayer (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor(id, name, strategy = 'random_shots') {
    super(id, name);
    this.strategy = strategy;
    Debug.log('v0.1.52', 'AIPlayer initialized', { id, name, strategy });
  }

  aiAttack(board) {
    let row, col;
    do {
      row = Math.floor(Math.random() * board.size);
      col = Math.floor(Math.random() * board.size);
    } while (!board.grid[row][col].playable || board.grid[row][col].state === 'hit' || board.grid[row][col].state === 'miss');
    this.lastAttack = { row, col };
    return board.receiveAttack(row, col);
  }
}

class Game {
  // src/classes/CombinedClasses.js/Game (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor(user_id, era, config) {
    this.game_id = Math.random().toString(36).slice(2);
    this.user_id = user_id;
    this.era = era;
    this.config = config;
    this.player = new Player(user_id, config.player_name || 'Player');
    this.opponent = new AIPlayer(`ai_${this.game_id}`, config.ai_name || 'AI Captain');
    this.playerBoard = null;
    this.opponentBoard = null;
    this.placer = null;
    this.messages = new MessageManager();
    this.scores = new ScoreManager(user_id);
    Debug.log('v0.1.52', 'Game initialized', { game_id: this.game_id, user_id, era });
  }

  start() {
    this.playerBoard = new Board(this.config.rows, this.config.terrain);
    this.opponentBoard = new Board(this.config.rows, this.config.terrain);
    this.placer = new Placer(this.playerBoard);
    Debug.log('v0.1.52', 'Game started, player board and placer initialized', { rows: this.config.rows, cols: this.config.cols });
    return this;
  }

  placeAIFleet(fleet) {
    Debug.log('v0.1.52', 'Starting AI fleet placement', { fleetLength: fleet.length });
    const placer = new Placer(this.opponentBoard, fleet);
    for (let ship of fleet) {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100;
      while (!placed && attempts < maxAttempts) {
        const row = Math.floor(Math.random() * this.opponentBoard.size);
        const col = Math.floor(Math.random() * this.opponentBoard.size);
        const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
        placer.currentShip = { ship, row, col };
        placed = placer.swipe(row, col, direction);
        attempts++;
      }
      if (!placed) {
        Debug.error('v0.1.52', 'Failed to place AI ship after max attempts', { ship: ship.name });
      }
    }
    Debug.log('v0.1.52', 'AI fleet placement completed', { shipsPlaced: placer.fleet.length });
  }

  startPlaying() {
    if (this.placer.fleet.length === 0) {
      Debug.log('v0.1.52', 'Starting gameplay, posting message', { fleetLength: this.placer.fleet.length });
      const aiFleet = [
        new Ship('Carrier', 5, this.config.fleet.ships[0].terrain),
        new Ship('Battleship', 4, this.config.fleet.ships[1].terrain),
        new Ship('Cruiser', 3, this.config.fleet.ships[2].terrain),
        new Ship('Submarine', 3, this.config.fleet.ships[3].terrain),
        new Ship('Destroyer', 2, this.config.fleet.ships[4].terrain)
      ];
      this.placeAIFleet(aiFleet);
      this.messages.post_message(this.player.id, this.config.messages.start_playing, true, 5);
      Debug.log('v0.1.52', 'Message posted', { message: this.config.messages.start_playing, messages: this.messages.messages });
      Debug.log('v0.1.52', 'startPlaying triggered, AI fleet placed');
    }
  }

  saveState() {
    Debug.log('v0.1.52', 'Saving game state');
  }
}

class MessageManager {
  // src/classes/CombinedClasses.js/MessageManager (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor() {
    this.messages = [];
  }

  post_message(sender_id, message, urgency = false, time = 0) {
    this.messages.push({ sender_id, message, urgency, time, acknowledged: false });
  }

  acknowledgeMessage(index) {
    if (index >= 0 && index < this.messages.length) {
      this.messages[index].acknowledged = true;
    }
  }
}

class ScoreManager {
  // src/classes/CombinedClasses.js/ScoreManager (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  constructor(userId) {
    this.userId = userId;
  }

  async getScores() {
    if (this.userId === 'guest') {
      const scores = JSON.parse(localStorage.getItem('battleship_scores') || '{}');
      return Object.entries(scores).map(([ai_name, { wins, losses }]) => ({ ai_name, wins, losses }));
    }
    const { data, error } = await supabase.from('scores').select('ai_name, wins, losses').eq('user_id', this.userId);
    if (error) {
      Debug.error('v0.1.52', 'Failed to fetch scores', error.message);
      return [];
    }
    return data;
  }

  async updateScore(opponentName, win) {
    const scores = JSON.parse(localStorage.getItem('battleship_scores') || '{}');
    if (!scores[opponentName]) scores[opponentName] = { wins: 0, losses: 0 };
    if (win) scores[opponentName].wins += 1;
    else scores[opponentName].losses += 1;
    localStorage.setItem('battleship_scores', JSON.stringify(scores));
  }
}

class LabelUtils {
  // src/classes/CombinedClasses.js/LabelUtils (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  static rowToLabel(row) {
    return String.fromCharCode(65 + row);
  }

  static colToLabel(col) {
    return (col + 1).toString();
  }

  static indicesToLabel(row, col) {
    return `${this.rowToLabel(row)}${this.colToLabel(col)}`;
  }

  static coordsToIndices(x, y, boardSize, cellSize, labelSize) {
    const row = Math.floor((y - labelSize) / cellSize);
    const col = Math.floor((x - labelSize) / cellSize);
    return [row, col];
  }
}

class XStateMachine {
  // src/classes/CombinedClasses.js/XStateMachine (v0.1.52)
  // Copyright(c) 2025, Clint H. O'Connor
  // LOCKED: Do not modify without confirmation
  static #instance = null;

  static getInstance() {
    if (!XStateMachine.#instance) {
      XStateMachine.#instance = new XStateMachine();
      Debug.log('v0.1.52', 'XStateMachine initialized');
    } else {
      Debug.log('v0.1.52', 'Reusing existing XStateMachine instance');
    }
    return XStateMachine.#instance;
  }

  constructor() {
    if (XStateMachine.#instance) {
      return XStateMachine.#instance;
    }
    this.machine = createMachine({
      id: 'battleship',
      initial: 'launch',
      predictableActionArguments: true,
      context: {
        player: null,
        userId: null,
        era: null,
        config: null,
        game: null
      },
      states: {
        launch: {
          entry: () => Debug.log('v0.1.52', 'Entered launch state'),
          on: { LOGIN: { target: 'login', actions: () => Debug.log('v0.1.52', 'Entered login state') } }
        },
        login: {
          entry: () => Debug.log('v0.1.52', 'Entered login state'),
          on: {
            LOGIN_COMPLETE: {
              target: 'chooseEra',
              actions: assign({
                player: (_, event) => event.player,
                userId: (_, event) => event.player.id,
                opponent: (_, event) => event.opponent
              })
            }
          }
        },
        chooseEra: {
          entry: () => Debug.log('v0.1.52', 'Entered chooseEra state'),
          on: {
            SELECT_ERA: {
              actions: assign({
                era: (_, event) => event.era,
                config: (_, event) => event.config
              })
            },
            START_GAME: {
              target: 'placement',
              actions: assign({
                game: (context) => {
                  Debug.log('v0.1.52', 'Initializing game in XStateMachine', { userId: context.userId, era: context.era });
                  const g = new Game(context.userId, context.era, context.config);
                  g.start();
                  if (!g.playerBoard?.grid || !g.opponentBoard?.grid) {
                    Debug.error('v0.1.52', 'Boards not fully initialized', { playerBoard: !!g.playerBoard?.grid, opponentBoard: !!g.opponentBoard?.grid });
                    throw new Error('Boards not fully initialized');
                  }
                  Debug.log('v0.1.52', 'Game context set', { gameId: g.game_id });
                  return g;
                }
              })
            }
          }
        },
        placement: {
          entry: () => Debug.log('v0.1.52', 'Entered placement state'),
          on: { START_PLAYING: { target: 'playing', actions: () => Debug.log('v0.1.52', 'Entered playing state') } }
        },
        playing: {
          entry: () => Debug.log('v0.1.52', 'Entered playing state'),
          on: { SHOW_SCOREBOARD: { target: 'over', actions: () => Debug.log('v0.1.52', 'Entered over state') } }
        },
        over: {
          entry: () => Debug.log('v0.1.52', 'Entered over state'),
          on: { RESTART: { target: 'launch', actions: () => Debug.log('v0.1.52', 'Entered launch state') } }
        }
      }
    });
    this.service = interpret(this.machine).start();
    XStateMachine.#instance = this;
  }

  getCurrentState() {
    return this.service.state.value;
  }

  send(event, payload = {}) {
    Debug.log('v0.1.52', 'Sending state transition event', { event, payload });
    this.service.send({ type: event, ...payload });
  }

  get context() {
    return this.service.state.context;
  }
}

export { Ship, Board, Placer, Player, AIPlayer, Game, MessageManager, ScoreManager, LabelUtils, XStateMachine };
// EOF - EOF - EOF
