// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import FleetPlacement from '../components/FleetPlacement';

const version = 'v0.3.3';

const PlacementPage = () => {
  const {
    dispatch,
    events,
    eraConfig,
    humanPlayer,
    selectedOpponent,
    gameInstance,
    board,
    registerShipPlacement,
    subscribeToUpdates
  } = useGame();
  
  const {
    currentPlayer,
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

    setError(null);

    if (!gameInstance || !board) {
      console.log(version, 'Waiting for game instance or board setup...');
    } else {
      console.log(version, 'Game ready for ship placement');
    }
  }, [eraConfig, humanPlayer, selectedOpponent, gameInstance, board]);

  // Handle ship placement - check for completion synchronously
  const handleShipPlaced = (ship, shipCells, orientation) => {
    try {
      console.log(version, `Placing ${ship.name} with ${shipCells.length} cells`);
      
      const success = registerShipPlacement(ship, shipCells, orientation, humanPlayer.id);
      
      if (success) {
        console.log(version, `Successfully placed ${ship.name}`);
        
        // Check for placement completion synchronously after each ship
        const placementProgress = gameInstance?.playerFleets?.get(humanPlayer.id);
        if (placementProgress) {
          const placedCount = placementProgress.ships.filter(ship => ship.isPlaced).length;
          const totalCount = placementProgress.ships.length;
          
          if (placedCount === totalCount) {
            console.log(version, 'All ships placed - transitioning to battle synchronously');
            if (dispatch && events) {
              dispatch(events.PLAY);
            }
          }
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
      
      // Check if all ships are now placed and transition if so
      const placementProgress = gameInstance?.playerFleets?.get(humanPlayer.id);
      if (placementProgress) {
        const placedCount = placementProgress.ships.filter(ship => ship.isPlaced).length;
        const totalCount = placementProgress.ships.length;
        
        if (placedCount === totalCount) {
          console.log(version, 'Auto-placement complete - transitioning to battle synchronously');
          if (dispatch && events) {
            dispatch(events.PLAY);
          }
        }
      }
    } catch (error) {
      console.error(version, 'Auto-placement failed:', error);
    } finally {
      setIsAutoPlacing(false);
    }
  };

  // Manual completion button handler (for testing/backup)
  const handlePlacementComplete = () => {
    console.log(version, 'Manual completion triggered');
    
    if (dispatch && events) {
      dispatch(events.PLAY);
    } else {
      console.error(version, 'Cannot transition - missing dispatch or events');
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
      <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
        <div className="content-pane content-pane-narrow">
          <div className="card-header">
            <h2 className="card-title">Configuration Error</h2>
          </div>
          <div className="card-body">
            <p className="error-message">{error}</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn-primary"
              onClick={() => dispatch(events.ERA)}
            >
              Back to Era Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!board || !gameInstance || !humanPlayer) {
    const waitingFor = [];
    if (!board) waitingFor.push('board');
    if (!gameInstance) waitingFor.push('game instance');
    if (!humanPlayer) waitingFor.push('human player');

    console.log(version, 'Showing loading state, waiting for:', waitingFor);
    
    return (
      <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
        <div className="loading">
          <div className="spinner spinner-lg"></div>
          <h2>Setting up fleet placement...</h2>
          <p>Preparing your ships and battle board</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
      <div className="content-pane content-pane-wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <h2 className="card-title">Place Your Fleet</h2>
          <p className="card-subtitle">{currentPlayer?.name} vs {selectedOpponent.name}</p>
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
  );
};

export default PlacementPage;

// EOF
