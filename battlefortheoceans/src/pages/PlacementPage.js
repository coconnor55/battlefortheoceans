// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import FleetPlacement from '../components/FleetPlacement';
import './Pages.css';
import './PlacementPage.css';

const version = 'v0.2.3';

const PlacementPage = () => {
  const {
    dispatch,
    stateMachine,
    eraConfig,
    humanPlayer,
    selectedOpponent,
    gameInstance,
    board,
    registerShipPlacement,
    subscribeToUpdates
  } = useGame();
  
  const {
    currentShipIndex,
    totalShips,
    currentShip,
    isPlacementComplete
  } = useGameState();
  
  // Only UI-specific state remains
  const [error, setError] = useState(null);
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  
  // Force re-render trigger for observer pattern
  const [, setRenderTrigger] = useState(0);

  // Subscribe to game logic updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

  // Check if game is ready for ship placement
  useEffect(() => {
    if (!eraConfig || !humanPlayer || !selectedOpponent) {
      const missingItems = [];
      if (!eraConfig) missingItems.push('eraConfig');
      if (!humanPlayer) missingItems.push('humanPlayer');
      if (!selectedOpponent) missingItems.push('selectedOpponent');
      
      setError(`Missing game configuration: ${missingItems.join(', ')}`);
      return;
    }

    // Clear any previous error
    setError(null);

    // Game readiness is now determined by computed state from useGameState
    if (!gameInstance || !board) {
      console.log(version, 'Waiting for game instance or board setup...');
    } else {
      console.log(version, 'Game ready for ship placement');
    }
  }, [eraConfig, humanPlayer, selectedOpponent, gameInstance, board]);

  // Auto-transition when placement is complete
  useEffect(() => {
    if (isPlacementComplete && gameInstance && board) {
      console.log(version, 'All ships placed, auto-transitioning to battle phase');
      handlePlacementComplete();
    }
  }, [isPlacementComplete, gameInstance, board]);

  // Handle ship placement - simplified since progress tracking is in game logic
  const handleShipPlaced = (ship, shipCells, orientation) => {
    try {
      console.log(version, `Placing ${ship.name} with ${shipCells.length} cells`);
      
      // Register ship placement with Game and Board (includes position data)
      const success = registerShipPlacement(ship, shipCells, orientation, humanPlayer.id);
      
      if (success) {
        console.log(version, `Successfully placed ${ship.name}`);
        // No need to track placement progress - handled by game logic
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

  // Auto place remaining ships using Game's method
  const handleAutoPlace = async () => {
    if (!gameInstance || !humanPlayer || isAutoPlacing) {
      return;
    }

    setIsAutoPlacing(true);
    console.log(version, 'Starting auto-placement');

    try {
      await gameInstance.autoPlaceShips(humanPlayer);
      console.log(version, 'Auto-placement completed');
    } catch (error) {
      console.error(version, 'Auto-placement failed:', error);
    } finally {
      setIsAutoPlacing(false);
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

  // Get placement progress message
  const getPlacementMessage = () => {
    if (isAutoPlacing) {
      return 'Auto-placing ships...';
    } else if (currentShip) {
      return `Place: ${currentShip.name} (${currentShip.size} squares)`;
    } else if (isPlacementComplete) {
      return 'All ships placed! Preparing for battle...';
    } else {
      return 'Preparing fleet placement...';
    }
  };

  // Get progress display
  const getPlacementProgress = () => {
    return `${currentShipIndex} / ${totalShips}`;
  };

  // Get placement instructions
  const getPlacementInstructions = () => {
    if (isAutoPlacing) {
      return ['Auto-placing remaining ships...'];
    } else if (currentShip) {
      return [
        `Tap and drag to place ${currentShip.name}`,
        'Drag horizontally or vertically to set orientation',
        `Allowed terrain: ${currentShip.terrain.join(', ')}`
      ];
    } else if (isPlacementComplete) {
      return ['All ships placed! Ready for battle!'];
    } else {
      return ['Preparing ships for placement...'];
    }
  };

  // Error state
  if (error) {
    console.log(version, 'Showing error state:', error);
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

  // Loading state - check for essential components
  if (!board || !gameInstance || !humanPlayer) {
    const waitingFor = [];
    if (!board) waitingFor.push('board');
    if (!gameInstance) waitingFor.push('game instance');
    if (!humanPlayer) waitingFor.push('human player');

    console.log(version, 'Showing loading state, waiting for:', waitingFor);
    
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

  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="page-header">
            <h2>Place Your Fleet</h2>
            <p>Era: {eraConfig.name}</p>
            <p>vs {selectedOpponent.name}</p>
          </div>

          <div className="game-info">
            <h3>{getPlacementMessage()}</h3>
            <p>Progress: {getPlacementProgress()}</p>
            {currentShip && (
              <p>Allowed terrain: {currentShip.terrain.join(', ')}</p>
            )}
          </div>

          <div className="game-board-container">
            <FleetPlacement
              board={board}
              currentShip={currentShip}
              onShipPlaced={handleShipPlaced}
              eraConfig={eraConfig}
            />
          </div>

          {/* Auto Place Button */}
          {currentShip && !isAutoPlacing && (
            <div className="auto-place-controls">
              <button
                className="btn btn-secondary"
                onClick={handleAutoPlace}
                disabled={isAutoPlacing}
              >
                Auto Place Remaining Ships
              </button>
            </div>
          )}

          <div className="message-console">
            {getPlacementInstructions().map((instruction, index) => (
              <p key={index}>{instruction}</p>
            ))}
          </div>

          {/* Optional manual completion button for testing */}
          {isPlacementComplete && (
            <div className="placement-complete">
              <button
                className="btn btn-primary btn-large"
                onClick={handlePlacementComplete}
              >
                Begin Battle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlacementPage;

// EOF
