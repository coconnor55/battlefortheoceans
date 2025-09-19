// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import FleetPlacement from '../components/FleetPlacement';
import './Pages.css';
import './PlacementPage.css';

const version = 'v0.1.15';

const PlacementPage = () => {
  const {
    dispatch,
    stateMachine,
    eraConfig,
    humanPlayer,
    selectedOpponent,
    gameInstance,
    board,
    initializeGame,
    addPlayerToGame,
    registerShipPlacement
  } = useGame();
  
  const [currentShipIndex, setCurrentShipIndex] = useState(0);
  const [playerFleet, setPlayerFleet] = useState(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize game and players when component mounts
  useEffect(() => {
    if (!eraConfig || !humanPlayer || !selectedOpponent) {
      setError('Missing game configuration. Please select era and opponent.');
      return;
    }

    if (gameInstance) {
      console.log(version, 'Game instance already exists, checking player setup');
      checkPlayerSetup();
      return;
    }

    console.log(version, 'Initializing game for placement phase');
    
    try {
      // Initialize game through GameContext
      const game = initializeGame(selectedOpponent.gameMode || 'turnBased');
      
      if (!game) {
        throw new Error('Failed to initialize game instance');
      }

      console.log(version, 'Game initialized, adding players');
      
    } catch (err) {
      console.error(version, 'Error initializing game:', err);
      setError(`Failed to initialize game: ${err.message}`);
    }
  }, [eraConfig, humanPlayer, selectedOpponent, gameInstance, initializeGame]);

  // Set up players and fleets once game is initialized
  useEffect(() => {
    if (!gameInstance || gameInstance.players.length > 0) return;

    console.log(version, 'Setting up players and fleets');

    try {
      // Add human player and assign to alliance
      const humanPlayerId = humanPlayer.id;
      addPlayerToGame(humanPlayerId, 'human', humanPlayer.name || 'Player', 'Player Alliance');

      // Add AI opponent and assign to alliance
      const aiId = selectedOpponent.id || `ai-${Date.now()}`;
      const aiStrategy = selectedOpponent.strategy || 'methodical_hunting';
      const aiDifficulty = selectedOpponent.difficulty || 1.0;
      addPlayerToGame(aiId, 'ai', selectedOpponent.name, 'Opponent Alliance');

      console.log(version, 'Players added successfully');

    } catch (err) {
      console.error(version, 'Error setting up players:', err);
      setError(`Failed to set up players: ${err.message}`);
    }
  }, [gameInstance, humanPlayer, selectedOpponent, addPlayerToGame]);

  // Check if players are ready and get human player's fleet
  const checkPlayerSetup = () => {
    if (!gameInstance) return;

    const humanPlayerId = humanPlayer.id;
    const fleet = gameInstance.playerFleets.get(humanPlayerId);
    
    if (fleet) {
      setPlayerFleet(fleet);
      setCurrentShipIndex(0);
      setIsReady(true);
      console.log(version, 'Player fleet ready with', fleet.count, 'ships');
    } else {
      console.log(version, 'Waiting for player fleet...');
    }
  };

  // Update ready state when game changes
  useEffect(() => {
    checkPlayerSetup();
  }, [gameInstance]);

  // Handle ship placement
  const handleShipPlaced = (ship, shipCells, orientation) => {
    try {
      console.log(version, `Placing ${ship.name} with ${shipCells.length} cells`);
      
      // Set ship's position and cells
      ship.place(shipCells, orientation);
      
      // Register ship placement with both Game and Board
      const success = registerShipPlacement(ship, humanPlayer.id);
      
      if (success) {
        console.log(version, `Successfully placed ${ship.name}`);
        
        // Move to next ship
        const nextIndex = currentShipIndex + 1;
        if (nextIndex >= playerFleet.count) {
          handlePlacementComplete();
        } else {
          setCurrentShipIndex(nextIndex);
        }
        
        return true;
      } else {
        console.log(version, `Failed to register placement for ${ship.name}`);
        ship.reset();
        return false;
      }
      
    } catch (err) {
      console.error(version, 'Error placing ship:', err);
      ship.reset();
      return false;
    }
  };

  // Complete placement phase
  const handlePlacementComplete = () => {
    console.log(version, 'All ships placed, transitioning to battle phase');
    
    if (dispatch && stateMachine) {
      dispatch(stateMachine.event.PLAY);
    } else {
      console.error(version, 'Cannot transition - missing dispatch or stateMachine');
    }
  };

  // Get current ship to place
  const getCurrentShip = () => {
    if (!playerFleet || currentShipIndex >= playerFleet.count) return null;
    return playerFleet.ships[currentShipIndex];
  };

  // Get placement progress
  const getPlacementProgress = () => {
    const total = playerFleet?.count || 0;
    return `${currentShipIndex} / ${total}`;
  };

  // Error state
  if (error) {
    return (
      <div className="page-base">
        <div className="page-content">
          <div className="error-message">
            <h2>Configuration Error</h2>
            <p>{error}</p>
            <button
              className="btn btn-primary"
              onClick={() => dispatch(stateMachine.event.ERA)}
            >
              Back to Era Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isReady || !board || !playerFleet) {
    return (
      <div className="page-base">
        <div className="page-content">
          <div className="loading-message">
            <h2>Setting up fleet placement...</h2>
            <p>Preparing your ships and battle board</p>
          </div>
        </div>
      </div>
    );
  }

  const currentShip = getCurrentShip();

  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="page-header">
            <h2>Place Your Fleet</h2>
            <p>Era: {eraConfig.name}</p>
            <p>vs {selectedOpponent.name}</p>
          </div>

          {currentShip && (
            <div className="game-info">
              <h3>Place: {currentShip.name} ({currentShip.size} squares)</h3>
              <p>Progress: {getPlacementProgress()}</p>
              <p>Allowed terrain: {currentShip.terrain.join(', ')}</p>
            </div>
          )}

          <div className="game-board-container">
            <FleetPlacement
              board={board}
              currentShip={currentShip}
              onShipPlaced={handleShipPlaced}
              eraConfig={eraConfig}
            />
          </div>

          <div className="message-console">
            {currentShip ? (
              <>
                <p>Tap and drag to place {currentShip.name}</p>
                <p>Drag horizontally or vertically to set orientation</p>
              </>
            ) : (
              <p>All ships placed! Preparing for battle...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlacementPage;

// EOF
