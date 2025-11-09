// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.16: Moved GameGuide to App.js, removed setShowInfo and InfoButton
// v0.4.15: Changed ERA to SELECTERA (Claude error)
// v0.4.14: Get selectedOpponent from CoreEngine.selectedOpponents array
//          - Removed selectedOpponent from GameContext destructuring
//          - Get from coreEngine.selectedOpponents[0] instead
//          - Matches CoreEngine storage of opponents as array
// v0.4.13: Updated to use CoreEngine singleton pattern
//          - Use coreEngine.player (Player instance for game logic)
//          - Use coreEngine.playerProfile (database object for display)
//          - Consistent with SelectOpponentPage v0.6.6 pattern
// v0.4.12: Replaced InfoPanel with GameGuide component - removed ~60 lines of hardcoded instructions
// v0.4.11: Positioned InfoButton relative to content pane, kept component reusable
// v0.4.10: Added InfoButton and InfoPanel with placement instructions
// v0.4.9: Add beforeunload warning to prevent accidental refresh during placement

import React, { useState, useEffect } from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import CanvasBoard from '../components/CanvasBoard';

const version = 'v0.4.16';
const tag = "PLACEMENT";
const module = "PlacementPage";
let method = "";

const PlacementPage = () => {
    // Logging utilities
    const log = (message) => {
      console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    };
    
    const logwarn = (message) => {
        console.warn(`[${tag}] ${version} ${module}.${method}: ${message}`);
    };

    const logerror = (message, error = null) => {
      if (error) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
      } else {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
      }
    };

  const {
    dispatch,
    events,
    gameInstance,
    board,
    registerShipPlacement,
    subscribeToUpdates
  } = useGame();
  
    //key data - see CoreEngine handle{state}
    const eras = coreEngine.eras;
    const player = coreEngine.player
    const playerProfile = coreEngine.playerProfile;
    const playerId = playerProfile.id;
    const isGuest = player != null && player.isGuest;
    const playerRole = playerProfile.role;
    const isAdmin = player != null && playerProfile.isAdmin;
    const isDeveloper = player != null && playerProfile.isDeveloper;
    const isTester = player != null && playerProfile.isTester;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedEraConfig = coreEngine.selectedEraConfig;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponent = coreEngine.selectedOpponent;
    const selectedOpponents = coreEngine.selectedOpponents;
    
    // stop game if key data is missing (selectedAlliance is allowed to be null)
    const required = { eras, player, playerProfile, playerId, playerRole, selectedEraId, selectedEraConfig, selectedOpponent, selectedOpponents };
    if (Object.values(required).some(v => !v)) {
        logerror('key data missing', required);
        throw new Error('PlacementPage: key data missing');
    }
    const undefined = { selectedAlliance };
    if (Object.values(required).some(v => v === undefined)) {
        logerror('key data missing', undefined);
        throw new Error('PlacementPage: key data missing');
    }

  console.log('[PLACEMENT]', version, 'player=', player);
  console.log('[PLACEMENT]', version, 'playerProfile=', playerProfile);
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
    if (!player) {
      logwarn('No player detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [player, dispatch, events]);
  
  const [error, setError] = useState(null);
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  
  const [, setRenderTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);

  const handleShipPlaced = (ship, shipCells, orientation) => {
      method = 'handleShipPlaced';

      try {
      console.log(version, `Placing ${ship.name} with ${shipCells.length} cells`);
      
      const success = registerShipPlacement(ship, shipCells, orientation, player.id);
      
      if (success) {
        console.log(version, `Successfully placed ${ship.name}`);
        
        // Phase 4: Access fleet directly from player
        const fleet = player?.fleet;
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
      method = 'handleAutoPlace';

    if (!gameInstance || !player || !board || isAutoPlacing) {
      return;
    }

    setIsAutoPlacing(true);
    console.log(version, 'Starting auto-placement with auto-clear');

    try {
      // Phase 4: Access fleet directly from player
      const fleet = player.fleet;
      if (fleet) {
        console.log(version, 'Clearing existing ship placements');
        
        // Phase 4: Clear player's placement map (the fix!)
        player.clearPlacements();
        
        // Reset ship flags
        fleet.ships.forEach(ship => {
          ship.reset();
        });
        
        console.log(`[BOARD] board === gameInstance.board:`, board === gameInstance.board);
        console.log(`[BOARD] player.board === board:`, player.board === board);
        console.log(`[BOARD] player.board === gameInstance.board:`, player.board === gameInstance.board);
        
        // Clear the board (terrain only now)
        board.clear();
        
        console.log(version, 'All ships cleared, ready for fresh auto-placement');
      }

      await gameInstance.autoPlaceShips(player);
      console.log(version, 'Auto-placement completed');
      
    } catch (error) {
      console.error(version, 'Auto-placement failed:', error);
    } finally {
      setIsAutoPlacing(false);
    }
  };

  const handleStartBattle = () => {
      method = 'handleStartBattle';

    console.log(version, 'Player confirmed - starting battle');
    
    if (dispatch && events) {
      dispatch(events.PLAY);
    } else {
      console.error(version, 'Cannot transition - missing dispatch or events');
    }
  };

  const getPlacementMessage = () => {
      method = 'getPlacementMessage';

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
      method = 'getUIMessage';

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

  // v0.4.13: Check player instead of playerProfile
  if (!player) {
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

  if (!board || !gameInstance || !player) {
    const waitingFor = [];
    if (!board) waitingFor.push('board');
    if (!gameInstance) waitingFor.push('game instance');
    if (!player) waitingFor.push('human player');

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
              eraConfig={selectedEraConfig}
              gameBoard={board}
              gameInstance={gameInstance}
              currentShip={currentShip}
              onShipPlaced={handleShipPlaced}
              player={player}
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
