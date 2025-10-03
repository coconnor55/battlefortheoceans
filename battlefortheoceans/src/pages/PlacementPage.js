// src/pages/PlacementPage.js v0.4.6
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.6: Added pulse glow to Start Battle button when all ships placed

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import CanvasBoard from '../components/CanvasBoard';

const version = 'v0.4.6';

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
    subscribeToUpdates,
    userProfile
  } = useGame();
  
  const {
    currentPlayer,
    currentShipIndex,
    totalShips,
    currentShip,
    isPlacementComplete
  } = useGameState();
  
  // Redirect to login if no user profile
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);
  
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

  // Handle ship placement
  const handleShipPlaced = (ship, shipCells, orientation) => {
    try {
      console.log(version, `Placing ${ship.name} with ${shipCells.length} cells`);
      
      const success = registerShipPlacement(ship, shipCells, orientation, humanPlayer.id);
      
      if (success) {
        console.log(version, `Successfully placed ${ship.name}`);
        
        const placementProgress = gameInstance?.playerFleets?.get(humanPlayer.id);
        if (placementProgress) {
          const placedCount = placementProgress.ships.filter(ship => ship.isPlaced).length;
          const totalCount = placementProgress.ships.length;
          console.log(version, `Placement progress: ${placedCount}/${totalCount} ships placed`);
          
          if (placedCount === totalCount) {
            console.log(version, 'All ships placed - awaiting player confirmation to start battle');
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

  // Auto-place ships with auto-clear functionality
  const handleAutoPlace = async () => {
    if (!gameInstance || !humanPlayer || !board || isAutoPlacing) {
      return;
    }

    setIsAutoPlacing(true);
    console.log(version, 'Starting auto-placement with auto-clear');

    try {
      // Clear all existing ship placements
      const fleet = gameInstance.playerFleets.get(humanPlayer.id);
      if (fleet) {
        console.log(version, 'Clearing existing ship placements');
        
        // Reset each ship
        fleet.ships.forEach(ship => {
          ship.reset();
        });
        
        // Clear the board
        board.clear();
        
        console.log(version, 'All ships cleared, ready for fresh auto-placement');
      }

      // Now auto-place all ships
      await gameInstance.autoPlaceShips(humanPlayer);
      console.log(version, 'Auto-placement completed');
      
    } catch (error) {
      console.error(version, 'Auto-placement failed:', error);
    } finally {
      setIsAutoPlacing(false);
    }
  };

  // Manual start button
  const handleStartBattle = () => {
    console.log(version, 'Player confirmed - starting battle');
    
    if (dispatch && events) {
      dispatch(events.PLAY);
    } else {
      console.error(version, 'Cannot transition - missing dispatch or events');
    }
  };

  // Get placement message for console
  const getPlacementMessage = () => {
    if (isAutoPlacing) {
      return 'Autoplacing ships...';
    } else if (currentShip) {
      return `Place your ${currentShip.name.toLowerCase()} in ${currentShip.terrain.join(' or ')} water`;
    } else if (isPlacementComplete) {
      return 'Fleet is complete! Review your placement or click "Start Battle" to begin.';
    } else {
      return 'Preparing fleet placement...';
    }
  };

  // Get UI message for console
  const getUIMessage = () => {
    if (isAutoPlacing) {
      return 'Autoplacing ships...';
    } else if (currentShip) {
      return `${currentShip.name} (${currentShip.size} squares)`;
    } else if (isPlacementComplete) {
      return `All ${totalShips} ships placed - Ready to battle!`;
    } else {
      return 'Preparing fleet placement...';
    }
  };

  // Don't render if no userProfile (will redirect)
  if (!userProfile) {
    return null;
  }

  // Error state
  if (error) {
    console.log(version, 'Showing error state:', error);
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="card-header">
            <h2 className="card-title">Configuration Error</h2>
          </div>
          <div className="card-body">
            <p className="message message--error">{error}</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn--primary"
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
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <h2>Setting Up</h2>
            <p>Preparing your ships and battle board...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        
        <div className="card-header">
          <h2 className="card-title">Place Your Fleet</h2>
          <p className="card-subtitle">{currentPlayer?.name} vs {selectedOpponent.name}</p>
        </div>

        <div className="divider"></div>

        <div className="game-board-container">
          <CanvasBoard
            mode="placement"
            eraConfig={eraConfig}
            gameBoard={board}
            gameInstance={gameInstance}
            currentShip={currentShip}
            onShipPlaced={handleShipPlaced}
            humanPlayer={humanPlayer}
          />
        </div>

        <div className="message-consoles">
          <div className="console-combined">
            <div className="console-header">Fleet Placement</div>
            <div className="console-content-combined">
              <div className="ui-message">
                {getUIMessage()}
              </div>
              <div className="message-divider"></div>
              <div className="battle-message">
                {getPlacementMessage()}
              </div>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        <div className="placement-actions">
          {/* Autoplace button */}
          <button
            className="btn btn--secondary btn--lg"
            onClick={handleAutoPlace}
            disabled={isAutoPlacing}
          >
            {isAutoPlacing ? 'Placing Ships...' : 'Autoplace Ships'}
          </button>

          {/* Start Battle button - pulse glow when ready */}
          <button
            className={`btn btn--primary btn--lg ${isPlacementComplete && !isAutoPlacing ? 'btn--pulse' : ''}`}
            onClick={handleStartBattle}
            disabled={!isPlacementComplete || isAutoPlacing}
          >
            Start Battle
          </button>
        </div>

      </div>
    </div>
  );
};

export default PlacementPage;

// EOF
