// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import FleetPlacement from '../components/FleetPlacement';
import './Pages.css';
import './PlacementPage.css';

const version = 'v0.1.21';

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
    uiVersion  // Use gameLogic via uiVersion
  } = useGame();
  
  const [currentShipIndex, setCurrentShipIndex] = useState(0);
  const [playerFleet, setPlayerFleet] = useState(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Check if game is ready for ship placement - FIXED: removed isReady from dependencies
  useEffect(() => {
    console.log(version, 'useEffect triggered - checking game readiness');

    if (!eraConfig || !humanPlayer || !selectedOpponent) {
      const missingItems = [];
      if (!eraConfig) missingItems.push('eraConfig');
      if (!humanPlayer) missingItems.push('humanPlayer');
      if (!selectedOpponent) missingItems.push('selectedOpponent');
      
      setError(`Missing game configuration: ${missingItems.join(', ')}`);
      setIsReady(false);
      return;
    }

    // Clear any previous error
    setError(null);

    // Check if we have the minimum required components using gameLogic data
    if (gameInstance && board && gameInstance.players && gameInstance.players.length > 0) {
      console.log(version, 'Game instance and board available, checking for player fleet...');
      
      // Check for player fleet
      if (gameInstance.playerFleets && gameInstance.playerFleets.has(humanPlayer.id)) {
        const fleet = gameInstance.playerFleets.get(humanPlayer.id);
        console.log(version, 'Found player fleet with', fleet.count, 'ships');
        
        setPlayerFleet(fleet);
        // Only reset ship index if we don't have a fleet yet or it's a different fleet
        if (!playerFleet || playerFleet !== fleet) {
          setCurrentShipIndex(0);
        }
        setIsReady(true);
      } else {
        console.log(version, 'Player fleet not yet available');
        setIsReady(false);
      }
    } else {
      console.log(version, 'Waiting for game instance or board setup...');
      setIsReady(false);
    }
  }, [eraConfig, humanPlayer, selectedOpponent, gameInstance, board, uiVersion]); // FIXED: removed isReady

  // Handle ship placement
  const handleShipPlaced = (ship, shipCells, orientation) => {
    try {
      console.log(version, `Placing ${ship.name} with ${shipCells.length} cells`);
      
      // Register ship placement with Game and Board (includes position data)
      const success = registerShipPlacement(ship, shipCells, orientation, humanPlayer.id);
      
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

  // Loading state - be more specific about what we're waiting for
  if (!isReady || !board || !playerFleet || !gameInstance) {
    const waitingFor = [];
    if (!isReady) waitingFor.push('ready state');
    if (!board) waitingFor.push('board');
    if (!playerFleet) waitingFor.push('player fleet');
    if (!gameInstance) waitingFor.push('game instance');

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
