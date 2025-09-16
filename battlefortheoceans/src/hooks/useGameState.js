// src/hooks/useGameState.js (v0.1.9)
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { GameContext } from '../context/GameContext';
import MessageHelper from '../utils/MessageHelper';

const useGameState = (gameMode = 'turnBased') => {
  const { eraConfig, selectedOpponent, player, dispatch, stateMachine, placementBoard } = useContext(GameContext);
  
  const [gameBoard, setGameBoard] = useState(null);
  const [gameState, setGameState] = useState({
    isPlayerTurn: true,
    shots: [],
    message: 'Click on any square to attack! Your ships have blue corners.',
    playerHits: 0,
    opponentHits: 0,
    gameMode,
    isGameActive: true
  });
  
  // Reference to battle board for recording opponent shots
  const battleBoardRef = useRef(null);

  const userId = player?.id;

  const placeOpponentShips = useCallback((board) => {
    if (!eraConfig?.opponentfleet?.ships) return;

    console.log('Placing opponent ships:', eraConfig.opponentfleet.ships.map(s => `${s.name}(${s.size})`));

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

        // Check if all cells are valid AND not adjacent to existing ships
        const isValid = cells.every(cell =>
          cell.row >= 0 && cell.row < eraConfig.rows &&
          cell.col >= 0 && cell.col < eraConfig.cols &&
          board.grid[cell.row][cell.col].terrain !== 'excluded' &&
          shipConfig.terrain.includes(board.grid[cell.row][cell.col].terrain) &&
          board.grid[cell.row][cell.col].state === 'empty' &&
          !hasAdjacentShip(board, cell.row, cell.col) // Prevent adjacent placement
        );

        if (isValid) {
          const ship = {
            name: shipConfig.name,
            size: shipConfig.size,
            terrain: shipConfig.terrain,
            cells: cells,
            start: null,
            damage: 0,
            
            resetDamage() {
              this.damage = 0;
            },
            
            hit(damage = 1.0, row, col) {
              const cell = this.cells.find(c => c.row === row && c.col === col);
              if (cell) {
                if (cell.damage >= 1.0) {
                  console.warn('Ship: No further hits on cell', { row, col, currentDamage: cell.damage, attemptedDamage: damage });
                  return 0;
                }
                cell.damage = (cell.damage || 0) + damage;
                this.damage += damage;
                return damage;
              }
              return 0;
            },
            
            isSunk() {
              return this.damage >= this.size;
            },
            
            getDamage() {
              return this.damage;
            }
          };

          if (board.placeShip(ship, 'opponent')) {
            placed = true;
            console.log('useGameState: Placed opponent ship:', shipConfig.name, 'size:', shipConfig.size, 'at cells:', cells);
          }
        }
        attempts++;
      }
      
      if (!placed) {
        console.warn('Failed to place opponent ship:', shipConfig.name, 'after 100 attempts');
      }
    });
  }, [eraConfig]);

  // Helper function to check if a cell has adjacent ships
  const hasAdjacentShip = (board, row, col) => {
    const adjacent = [
      { row: row - 1, col: col - 1 }, { row: row - 1, col }, { row: row - 1, col: col + 1 },
      { row, col: col - 1 },                                   { row, col: col + 1 },
      { row: row + 1, col: col - 1 }, { row: row + 1, col }, { row: row + 1, col: col + 1 }
    ];
    
    return adjacent.some(({ row: r, col: c }) => {
      if (r >= 0 && r < eraConfig.rows && c >= 0 && c < eraConfig.cols) {
        return board.grid[r][c].state === 'ship';
      }
      return false;
    });
  };

  // Use existing placement board instead of creating new one
  useEffect(() => {
    if (!placementBoard || !eraConfig) return;

    console.log('useGameState: Using placement board with player ships already placed');
    
    // Place opponent ships on the existing board that already has player ships
    placeOpponentShips(placementBoard);
    
    // Use the placement board as the game board
    setGameBoard(placementBoard);

    // Set initial game message
    setGameState(prev => ({
      ...prev,
      message: 'Click on any square to attack! Your ships have blue corners.'
    }));

    console.log('useGameState: Board initialized for', gameMode, 'with existing player ships');
  }, [placementBoard, eraConfig, gameMode, placeOpponentShips]);

  const findShipAtCell = useCallback((board, row, col) => {
    // Find which ship occupies this cell
    for (let r = 0; r < eraConfig.rows; r++) {
      for (let c = 0; c < eraConfig.cols; c++) {
        const cell = board.grid[r][c];
        if (cell.state === 'ship' || cell.state === 'hit') {
          // This is a ship cell, check if it's part of a ship containing our target
          const shipCells = findShipCells(board, r, c);
          if (shipCells.some(shipCell => shipCell.row === row && shipCell.col === col)) {
            // Found the ship, determine its name from opponent fleet
            const shipSize = shipCells.length;
            const matchingShip = eraConfig.opponentfleet.ships.find(ship => ship.size === shipSize);
            return matchingShip?.name || 'Ship';
          }
        }
      }
    }
    return null;
  }, [eraConfig]);

  const fireShot = useCallback((row, col) => {
    if (!gameState.isPlayerTurn || !gameBoard || !gameState.isGameActive) return null;

    const cell = gameBoard.grid[row][col];
    if (cell.state === 'hit' || cell.state === 'miss') {
      setGameState(prev => ({
        ...prev,
        message: 'Already fired at that location!'
      }));
      return null;
    }

    // Friendly fire - lose turn (traditional battleship rule)
    if (cell.state === 'ship' && cell.userId === userId) {
      setGameState(prev => ({
        ...prev,
        message: 'You fired on your own ship! Turn lost.',
        isPlayerTurn: gameMode === 'turnBased' ? false : true
      }));
      
      // In turn-based mode, trigger opponent turn after friendly fire
      if (gameMode === 'turnBased') {
        setTimeout(() => {
          opponentTurn();
        }, 1500);
      }
      
      return { result: 'friendly-fire', row, col };
    }

    const result = gameBoard.receiveAttack(row, col);
    
    if (result === 'hit') {
      // Check if it's an opponent ship hit
      if (cell.userId === 'opponent') {
        const shipName = findShipAtCell(gameBoard, row, col);
        
        setGameState(prev => ({
          ...prev,
          message: MessageHelper.getAttackMessage(eraConfig, 'hit', row, col, shipName),
          playerHits: prev.playerHits + 1
        }));

        // Check for sunk ship and game end
        setTimeout(() => {
          if (isShipSunk(gameBoard, row, col)) {
            const sunkMessage = MessageHelper.getMessage(
              eraConfig?.messages?.ship_sunk,
              { ship: shipName, cell: MessageHelper.formatCell(row, col) }
            );
            setGameState(prev => ({ ...prev, message: sunkMessage || 'Ship SUNK! Keep firing!' }));
          }
          checkGameEnd();
        }, 100);
      }

    } else if (result === 'miss') {
      const missMessage = MessageHelper.getAttackMessage(eraConfig, 'miss', row, col);
      
      setGameState(prev => ({
        ...prev,
        message: missMessage || (gameMode === 'turnBased' ? 'Miss! Opponent\'s turn...' : 'Miss! Keep firing!'),
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
  }, [gameState.isPlayerTurn, gameBoard, gameState.isGameActive, gameMode, userId, eraConfig, findShipAtCell]);

  const opponentTurn = useCallback(() => {
    if (!gameBoard || !gameState.isGameActive) return;

    // AI targets player ships only
    let row, col;
    let attempts = 0;
    do {
      row = Math.floor(Math.random() * eraConfig.rows);
      col = Math.floor(Math.random() * eraConfig.cols);
      attempts++;
    } while (
      (gameBoard.grid[row][col].state === 'hit' ||
       gameBoard.grid[row][col].state === 'miss' ||
       (gameBoard.grid[row][col].state === 'ship' && gameBoard.grid[row][col].userId === 'opponent')) &&
      attempts < 100
    );

    const result = gameBoard.receiveAttack(row, col);

    // Record opponent shot in battle board for visual feedback
    if (battleBoardRef.current?.recordOpponentShot) {
      battleBoardRef.current.recordOpponentShot(row, col, result);
    }

    if (result === 'hit') {
      const shipName = findShipAtCell(gameBoard, row, col);
      const hitMessage = MessageHelper.getOpponentAttackMessage(
        eraConfig,
        selectedOpponent,
        'hit',
        row,
        col,
        shipName
      );

      setGameState(prev => ({
        ...prev,
        message: hitMessage || `${selectedOpponent?.name || 'Opponent'} hit your ship at ${MessageHelper.formatCell(row, col)}!`,
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
        message: `${selectedOpponent?.name || 'Opponent'} missed. Your turn!`,
        isPlayerTurn: true
      }));
    }
  }, [gameBoard, gameState.isGameActive, eraConfig, selectedOpponent, findShipAtCell]);

  const isShipSunk = useCallback((board, row, col) => {
    const cell = board.grid[row][col];
    if (cell.state !== 'hit') return false;

    // Find all cells belonging to this ship
    const shipCells = findShipCells(board, row, col);
    
    // Check if ALL cells of this ship are hit
    const allHit = shipCells.every(({ row: r, col: c }) => {
      const shipCell = board.grid[r][c];
      return shipCell.state === 'hit';
    });

    console.log('Ship sunk check:', {
      shipCells: shipCells.length,
      hitCells: shipCells.filter(({row: r, col: c}) => board.grid[r][c].state === 'hit').length,
      allHit
    });

    return allHit;
  }, []);

  const findShipCells = useCallback((board, startRow, startCol) => {
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
  }, [eraConfig]);

  const checkGameEnd = useCallback(() => {
    if (!eraConfig) return false;

    const opponentShipCells = eraConfig.opponentfleet.ships.reduce((total, ship) => total + ship.size, 0);
    const playerShipCells = eraConfig.playerfleet.ships.reduce((total, ship) => total + ship.size, 0);

    if (gameState.playerHits >= opponentShipCells) {
      const winMessage = MessageHelper.getEndGameMessage(eraConfig, selectedOpponent, true);
      setGameState(prev => ({
        ...prev,
        message: winMessage || 'You WIN! All enemy ships destroyed!',
        isGameActive: false
      }));
      setTimeout(() => {
        dispatch(stateMachine.event.OVER);
      }, 3000);
      return true;
    }

    if (gameState.opponentHits >= playerShipCells) {
      const loseMessage = MessageHelper.getEndGameMessage(eraConfig, selectedOpponent, false);
      setGameState(prev => ({
        ...prev,
        message: loseMessage || 'You LOSE! All your ships are sunk!',
        isGameActive: false
      }));
      setTimeout(() => {
        dispatch(stateMachine.event.OVER);
      }, 3000);
      return true;
    }

    return false;
  }, [eraConfig, gameState.playerHits, gameState.opponentHits, dispatch, stateMachine, selectedOpponent]);

  return {
    // State
    gameState: !userId ? {
      isPlayerTurn: false,
      message: 'Player session lost. Please log in again.',
      isGameActive: false,
      gameMode
    } : { ...gameState, userId },
    gameBoard,
    eraConfig,
    selectedOpponent,
    userId,
    
    // Actions
    fireShot,
    isShipSunk,
    
    // Visual integration
    battleBoardRef,
    
    // Computed values
    isReady: !!(eraConfig && gameBoard && userId),
    error: !userId ? 'Player session lost' : null
  };
};

export default useGameState;
