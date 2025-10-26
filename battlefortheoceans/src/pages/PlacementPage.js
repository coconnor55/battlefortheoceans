// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.16: Moved GameGuide to App.js, removed setShowInfo and InfoButton
// v0.4.15: Changed ERA to SELECTERA (Claude error)
// v0.4.14: Get selectedOpponent from CoreEngine.selectedOpponents array
//          - Removed selectedOpponent from GameContext destructuring
//          - Get from coreEngine.selectedOpponents[0] instead
//          - Matches CoreEngine storage of opponents as array
// v0.4.13: Updated to use CoreEngine singleton pattern
//          - Use coreEngine.humanPlayer (Player instance for game logic)
//          - Use coreEngine.userProfile (database object for display)
//          - Consistent with SelectOpponentPage v0.6.6 pattern
// v0.4.12: Replaced InfoPanel with GameGuide component - removed ~60 lines of hardcoded instructions
// v0.4.11: Positioned InfoButton relative to content pane, kept component reusable
// v0.4.10: Added InfoButton and InfoPanel with placement instructions
// v0.4.9: Add beforeunload warning to prevent accidental refresh during placement

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import CanvasBoard from '../components/CanvasBoard';

const version = 'v0.4.16';

const PlacementPage = () => {
  const {
    coreEngine,
    dispatch,
    events,
    eraConfig,
    gameInstance,
    board,
    registerShipPlacement,
    subscribeToUpdates
  } = useGame();
  
  // v0.4.14: Use CoreEngine singleton pattern
  const humanPlayer = coreEngine.humanPlayer;              // Player instance (game logic)
  const userProfile = coreEngine.humanPlayer.userProfile;  // Database object (display)
  const selectedOpponent = coreEngine.selectedOpponents?.[0]; // First opponent from array
  
  console.log('[PLACEMENT]', version, 'humanPlayer=', humanPlayer);
  console.log('[PLACEMENT]', version, 'userProfile=', userProfile);
  console.log('[PLACEMENT]', version, 'selectedOpponent=', selectedOpponent);
  
  const {
    currentPlayer,
    currentShipIndex,
    totalShips,
    currentShip,
    isPlacementComplete
  } = useGameState();
    
  // Warn user before leaving page (refresh/close/navigate away)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
      return ''; // Required for other browsers
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  useEffect(() => {
    if (!humanPlayer) {
      console.log(version, 'No player detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [humanPlayer, dispatch, events]);
  
  const [error, setError] = useState(null);
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  
  const [, setRenderTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

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

  const handleShipPlaced = (ship, shipCells, orientation) => {
    try {
      console.log(version, `Placing ${ship.name} with ${shipCells.length} cells`);
      
      const success = registerShipPlacement(ship, shipCells, orientation, humanPlayer.id);
      
      if (success) {
        console.log(version, `Successfully placed ${ship.name}`);
        
        // Phase 4: Access fleet directly from player
        const fleet = humanPlayer?.fleet;
        if (fleet) {
          const placedCount = fleet.ships.filter(ship => ship.isPlaced).length;
          const totalCount = fleet.ships.length;
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

  const handleAutoPlace = async () => {
    if (!gameInstance || !humanPlayer || !board || isAutoPlacing) {
      return;
    }

    setIsAutoPlacing(true);
    console.log(version, 'Starting auto-placement with auto-clear');

    try {
      // Phase 4: Access fleet directly from player
      const fleet = humanPlayer.fleet;
      if (fleet) {
        console.log(version, 'Clearing existing ship placements');
        
        // Phase 4: Clear player's placement map (the fix!)
        humanPlayer.clearPlacements();
        
        // Reset ship flags
        fleet.ships.forEach(ship => {
          ship.reset();
        });
        
        console.log(`[BOARD] board === gameInstance.board:`, board === gameInstance.board);
        console.log(`[BOARD] humanPlayer.board === board:`, humanPlayer.board === board);
        console.log(`[BOARD] humanPlayer.board === gameInstance.board:`, humanPlayer.board === gameInstance.board);
        
        // Clear the board (terrain only now)
        board.clear();
        
        console.log(version, 'All ships cleared, ready for fresh auto-placement');
      }

      await gameInstance.autoPlaceShips(humanPlayer);
      console.log(version, 'Auto-placement completed');
      
    } catch (error) {
      console.error(version, 'Auto-placement failed:', error);
    } finally {
      setIsAutoPlacing(false);
    }
  };

  const handleStartBattle = () => {
    console.log(version, 'Player confirmed - starting battle');
    
    if (dispatch && events) {
      dispatch(events.PLAY);
    } else {
      console.error(version, 'Cannot transition - missing dispatch or events');
    }
  };

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

  // v0.4.13: Check humanPlayer instead of userProfile
  if (!humanPlayer) {
    return null;
  }

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
              onClick={() => dispatch(events.SELECTERA)}
            >
              Back to Era Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="page-with-info">

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
            <button
              className="btn btn--secondary btn--lg"
              onClick={handleAutoPlace}
              disabled={isAutoPlacing}
            >
              {isAutoPlacing ? 'Placing Ships...' : 'Autoplace Ships'}
            </button>

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
    </div>
  );
};

export default PlacementPage;
// EOF
