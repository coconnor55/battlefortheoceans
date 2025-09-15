// src/hooks/useGameState.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useContext } from 'react';
import { GameContext } from '../context/GameContext';
import Board from '../classes/Board';

const useGameState = (gameMode = 'turnBased') => {
  const { eraConfig, selectedOpponent, player, dispatch, stateMachine } = useContext(GameContext);
  
  const [opponentBoard, setOpponentBoard] = useState(null);
  const [playerBoard, setPlayerBoard] = useState(null);
  const [gameState, setGameState] = useState({
    isPlayerTurn: true,
    shots: [],
    message: 'Fire your shot!',
    playerHits: 0,
    opponentHits: 0,
    gameMode,
    isGameActive: true
  });

  const userId = player?.id || 'defaultPlayer';

  // Initialize boards
  useEffect(() => {
    if (!eraConfig) return;

    // Create opponent board
    const opBoard = new Board(eraConfig.rows, eraConfig.cols, eraConfig.terrain);
    placeOpponentShips(opBoard);
    setOpponentBoard(opBoard);

    // Create player board (in real game, this would come from placement phase)
    const plBoard = new Board(eraConfig.rows, eraConfig.cols, eraConfig.terrain);
    setPlayerBoard(plBoard);

    console.log('useGameState: Boards initialized for', gameMode);
  }, [eraConfig, gameMode]);

  const placeOpponentShips = (board) => {
    if (!eraConfig?.opponentfleet?.ships) return;

    eraConfig.opponentfleet.ships.forEach(shipConfig => {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 100) {
        const row = Math.floor(Math.random() * eraConfig.rows);
        const col = Math.floor(Math.random() * eraConfig.cols);
        const horizontal = Math.random() > 0.5;

        const cells = [];
        for (let i = 0; i < shipConfig.size; i++) {
          const r = horizontal ? row : row + i;
          const c = horizontal ? col + i : col;
          cells.push({ row: r, col: c });
        }

        const isValid = cells.every(cell =>
          cell.row >= 0 && cell.row < eraConfig.rows &&
          cell.col >= 0 && cell.col < eraConfig.cols &&
          board.grid[cell.row][cell.col].terrain !== 'excluded' &&
          shipConfig.terrain.includes(board.grid[cell.row][cell.col].terrain) &&
          board.grid[cell.row][cell.col].state === 'empty'
        );

        if (isValid) {
          const ship = {
            name: shipConfig.name,
            size: shipConfig.size,
            terrain: shipConfig.terrain,
            cells: cells
          };

          if (board.placeShip(ship, 'opponent')) {
            placed = true;
            console.log('useGameState: Placed opponent ship:', shipConfig.name);
          }
        }
        attempts++;
      }
    });
  };

  const fireShot = (row, col) => {
    if (!gameState.isPlayerTurn || !opponentBoard || !gameState.isGameActive) return null;

    const cell = opponentBoard.grid[row][col];
    if (cell.state === 'hit' || cell.state === 'miss') {
      setGameState(prev => ({ ...prev, message: 'Already fired at that location!' }));
      return null;
    }

    const result = opponentBoard.receiveAttack(row, col);
    
    if (result === 'hit') {
      setGameState(prev => ({
        ...prev,
        message: 'HIT! Fire again!',
        playerHits: prev.playerHits + 1
      }));

      // Check for sunk ship and game end
      setTimeout(() => {
        if (isShipSunk(opponentBoard, row, col)) {
          setGameState(prev => ({ ...prev, message: 'Ship SUNK! Keep firing!' }));
        }
        checkGameEnd();
      }, 100);

    } else if (result === 'miss') {
      setGameState(prev => ({
        ...prev,
        message: gameMode === 'turnBased' ? 'Miss! Opponent\'s turn...' : 'Miss! Keep firing!',
        isPlayerTurn: gameMode === 'turnBased' ? false : true
      }));

      // In turn-based mode, trigger opponent turn
      if (gameMode === 'turnBased') {
        setTimeout(() => {
          opponentTurn();
        }, 1500);
      }
    }

    return { result, row, col };
  };

  const opponentTurn = () => {
    if (!playerBoard || !gameState.isGameActive) return;

    // Simple AI: random shots
    let row, col;
    do {
      row = Math.floor(Math.random() * eraConfig.rows);
      col = Math.floor(Math.random() * eraConfig.cols);
    } while (
      playerBoard.grid[row][col].state === 'hit' ||
      playerBoard.grid[row][col].state === 'miss'
    );

    const result = playerBoard.receiveAttack(row, col);

    if (result === 'hit') {
      setGameState(prev => ({
        ...prev,
        message: `Opponent hit your ship at ${String.fromCharCode(65 + col)}${row + 1}!`,
        opponentHits: prev.opponentHits + 1
      }));

      // Opponent gets another turn on hit
      setTimeout(() => {
        if (gameState.isGameActive && !checkGameEnd()) {
          opponentTurn();
        }
      }, 1500);
    } else {
      setGameState(prev => ({
        ...prev,
        message: 'Opponent missed. Your turn!',
        isPlayerTurn: true
      }));
    }
  };

  const isShipSunk = (board, row, col) => {
    const cell = board.grid[row][col];
    if (cell.state !== 'hit') return false;

    const shipCells = findShipCells(board, row, col);
    return shipCells.every(({ row, col }) => board.grid[row][col].state === 'hit');
  };

  const findShipCells = (board, startRow, startCol) => {
    const visited = new Set();
    const shipCells = [];
    const queue = [{ row: startRow, col: startCol }];

    while (queue.length > 0) {
      const { row, col } = queue.shift();
      const key = `${row},${col}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const cell = board.grid[row][col];
      if (cell.state === 'ship' || cell.state === 'hit') {
        shipCells.push({ row, col });

        const adjacent = [
          { row: row - 1, col },
          { row: row + 1, col },
          { row, col: col - 1 },
          { row, col: col + 1 }
        ];

        adjacent.forEach(({ row: r, col: c }) => {
          if (
            r >= 0 && r < eraConfig.rows &&
            c >= 0 && c < eraConfig.cols &&
            !visited.has(`${r},${c}`)
          ) {
            const adjCell = board.grid[r][c];
            if (adjCell.state === 'ship' || adjCell.state === 'hit') {
              queue.push({ row: r, col: c });
            }
          }
        });
      }
    }

    return shipCells;
  };

  const checkGameEnd = () => {
    if (!eraConfig) return false;

    const opponentShipCells = eraConfig.opponentfleet.ships.reduce((total, ship) => total + ship.size, 0);
    const playerShipCells = eraConfig.playerfleet.ships.reduce((total, ship) => total + ship.size, 0);

    if (gameState.playerHits >= opponentShipCells) {
      setGameState(prev => ({
        ...prev,
        message: 'You WIN! All enemy ships destroyed!',
        isGameActive: false
      }));
      setTimeout(() => {
        dispatch(stateMachine.event.OVER);
      }, 3000);
      return true;
    }

    if (gameState.opponentHits >= playerShipCells) {
      setGameState(prev => ({
        ...prev,
        message: 'You LOSE! All your ships are sunk!',
        isGameActive: false
      }));
      setTimeout(() => {
        dispatch(stateMachine.event.OVER);
      }, 3000);
      return true;
    }

    return false;
  };

  return {
    // State
    gameState,
    opponentBoard,
    playerBoard,
    eraConfig,
    selectedOpponent,
    userId,
    
    // Actions
    fireShot,
    isShipSunk,
    
    // Computed values
    isReady: !!(eraConfig && opponentBoard && playerBoard && userId),
    error: null
  };
};

export default useGameState;

// EOF - EOF - EOF
