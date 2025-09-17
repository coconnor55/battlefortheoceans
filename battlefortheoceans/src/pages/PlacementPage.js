// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useContext, useEffect, useState } from 'react';
import { GameContext } from '../context/GameContext';
import Board from '../classes/Board';
import AiPlayer from '../classes/AiPlayer';
import ShipPlacementBoard from '../components/ShipPlacementBoard';
import './PlacementPage.css';

const version = 'v0.1.13';

const PlacementPage = () => {
  const {
    dispatch,
    stateMachine,
    eraConfig,
    humanPlayer,
    selectedOpponent,
    updatePlacementBoard
  } = useContext(GameContext);
  
  const [board, setBoard] = useState(null);
  const [aiPlayer, setAiPlayer] = useState(null);
  const [currentShipIndex, setCurrentShipIndex] = useState(0);
  const [isPlacingShips, setIsPlacingShips] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prevent multiple initializations
    if (isInitialized) {
      console.log(version, 'PlacementPage already initialized, skipping');
      return;
    }

    console.log(version, 'PlacementPage useEffect triggered');
    console.log(version, 'Era config:', eraConfig?.name);
    console.log(version, 'HumanPlayer:', humanPlayer?.id);
    console.log(version, 'Selected opponent:', selectedOpponent?.name);
    
    // Validate required data
    if (!humanPlayer?.id) {
      setError('Player session lost. Please log in again.');
      return;
    }

    if (!eraConfig) {
      setError('Era configuration not found. Please select an era first.');
      return;
    }

    if (!selectedOpponent) {
      setError('No opponent selected. Please select an opponent first.');
      return;
    }

    // Check for required era properties
    const required = ['rows', 'cols', 'terrain', 'playerfleet'];
    const missing = required.filter(prop => !eraConfig[prop]);
    
    if (missing.length > 0) {
      setError(`Invalid Era Configuration - Missing: ${missing.join(', ')}`);
      return;
    }

    // Check for ships in playerfleet
    if (!eraConfig.playerfleet.ships || !Array.isArray(eraConfig.playerfleet.ships)) {
      setError('Invalid Era Configuration - Missing: ships in playerfleet');
      return;
    }

    try {
      const { rows, cols, terrain, playerfleet } = eraConfig;
      
      console.log(version, 'Creating board with dimensions:', rows, 'x', cols);
      console.log(version, 'Fleet ships:', playerfleet.ships.map(s => `${s.name}(${s.size})`));
      
      // Create the game board
      const gameBoard = new Board(rows, cols, terrain);
      setBoard(gameBoard);
      
      // Create AI player with generated ID
      const aiId = `ai-${selectedOpponent.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const ai = new AiPlayer(aiId, selectedOpponent.name, selectedOpponent.strategy, selectedOpponent.difficulty);
      setAiPlayer(ai);
      
      // Initialize human player's fleet with ships from era config (only once)
      if (!humanPlayer.fleet || humanPlayer.fleet.ships.length === 0) {
        humanPlayer.createFleet(eraConfig);
        console.log(version, 'Human fleet created with', humanPlayer.fleet.ships.length, 'ships');
      } else if (humanPlayer.fleet.ships.some(ship => ship.isPlaced)) {
        console.log(version, 'Human fleet already has placed ships, preserving state');
      } else {
        humanPlayer.fleet.reset();
        console.log(version, 'Human fleet reset to initial state');
      }
      console.log(version, 'AI player created:', ai.name);
      
      // Auto-place AI ships
      autoPlaceAIShips(ai, gameBoard);
      
      setIsPlacingShips(true);
      setCurrentShipIndex(0);
      setError(null);
      setIsInitialized(true);
      
    } catch (err) {
      console.error(version, 'Error creating placement setup:', err);
      setError(`Failed to initialize placement: ${err.message}`);
    }
  }, [eraConfig, humanPlayer, selectedOpponent, isInitialized]);

  const autoPlaceAIShips = async (ai, gameBoard) => {
    try {
      console.log(version, 'Auto-placing AI ships');
      
      // Create AI fleet if it doesn't exist
      if (!ai.fleet) {
        ai.createFleet(eraConfig);
      }
      
      console.log(version, 'AI fleet created with', ai.fleet.ships.length, 'ships');

      // Place each AI ship randomly
      for (const ship of ai.fleet.ships) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 100) {
          const row = Math.floor(Math.random() * eraConfig.rows);
          const col = Math.floor(Math.random() * eraConfig.cols);
          const horizontal = Math.random() > 0.5;
          
          // Calculate cells for this ship placement
          const cells = [];
          for (let i = 0; i < ship.size; i++) {
            const cellRow = horizontal ? row : row + i;
            const cellCol = horizontal ? col + i : col;
            cells.push({ row: cellRow, col: cellCol });
          }
          
          // Check if placement is valid (within bounds)
          const isValid = cells.every(cell =>
            cell.row >= 0 && cell.row < eraConfig.rows &&
            cell.col >= 0 && cell.col < eraConfig.cols
          );
          
          if (isValid) {
            try {
              // Place ship (set its position)
              ship.place(cells, horizontal ? 'horizontal' : 'vertical');
              
              // Place on board
              if (gameBoard.placeShip(ship, 'ai')) {
                placed = true;
                console.log(version, `AI placed ${ship.name} at ${row},${col} ${horizontal ? 'H' : 'V'}`);
              } else {
                // Reset ship and try again
                ship.reset();
              }
            } catch (error) {
              // Reset ship and try again
              ship.reset();
            }
          }
          
          attempts++;
        }
        
        if (!placed) {
          console.warn(version, `Failed to place AI ship: ${ship.name}`);
        }
      }
      
      console.log(version, 'AI ship placement complete');
      
    } catch (err) {
      console.error(version, 'Error placing AI ships:', err);
    }
  };

  const handleShipPlaced = (ship, row, col, horizontal) => {
    try {
      console.log(version, `Attempting to place ${ship.name} at ${row},${col} ${horizontal ? 'H' : 'V'}`);
      
      const success = board.placeShip(ship, row, col, horizontal);
      
      if (success) {
        console.log(version, `Successfully placed ${ship.name}`);
        
        // Move to next ship
        const nextIndex = currentShipIndex + 1;
        if (nextIndex >= humanPlayer.fleet.ships.length) {
          // All ships placed
          handlePlacementComplete();
        } else {
          setCurrentShipIndex(nextIndex);
        }
        
        return true;
      } else {
        console.log(version, `Failed to place ${ship.name} - invalid position`);
        return false;
      }
      
    } catch (err) {
      console.error(version, 'Error placing ship:', err);
      return false;
    }
  };

  const handlePlacementComplete = () => {
    console.log(version, 'All ships placed, completing placement phase');
    
    // Store the board with all placed ships in GameContext
    updatePlacementBoard(board);
    
    if (dispatch) {
      console.log(version, 'Firing PLAY event with placement board');
      dispatch(stateMachine.event.PLAY);
    } else {
      console.error(version, 'Dispatch is not available in handlePlacementComplete');
    }
  };

  const getCurrentShip = () => {
    return humanPlayer?.fleet.ships[currentShipIndex] || null;
  };

  const getPlacementProgress = () => {
    const total = humanPlayer?.fleet.ships.length || 0;
    return `${currentShipIndex} / ${total}`;
  };

  if (error) {
    return (
      <div className="placement-page error">
        <div className="error-message">
          <h2>Configuration Error</h2>
          <p>{error}</p>
          <button onClick={() => dispatch(stateMachine.event.ERA)}>
            Back to Era Selection
          </button>
        </div>
      </div>
    );
  }

  if (!board || !isPlacingShips || !humanPlayer) {
    return (
      <div className="placement-page loading">
        <div className="loading-message">
          <p>Setting up placement board...</p>
        </div>
      </div>
    );
  }

  const currentShip = getCurrentShip();

  return (
    <div className="placement-page">
      <div className="game-info">
        <h2>Place Your Fleet</h2>
        <p>Era: {eraConfig.name}</p>
        <p>vs {selectedOpponent.name}</p>
        {currentShip && (
          <div className="current-ship-info">
            <h3>Place: {currentShip.name} ({currentShip.size} squares)</h3>
            <p>Progress: {getPlacementProgress()}</p>
          </div>
        )}
      </div>
      
      <div className="game-board">
        <ShipPlacementBoard
          board={board}
          currentShip={currentShip}
          onShipPlaced={handleShipPlaced}
          eraConfig={eraConfig}
        />
      </div>
    </div>
  );
};

export default PlacementPage;

// EOF
