// src/pages/PlacementPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.19: Allow null playerEmail for guest users in key data check
//          - Guest users don't have email, so playerEmail check is conditional
//          - Only require playerEmail for non-guest users
// v0.4.18: Graceful loading state while CoreEngine finishes initialization
//          - Replaced fatal dependency throw with loading UI
//          - Prevents placement page crash during CoreEngine warmup
// v0.4.17: Use coreEngine singleton directly - remove useGame() passthrough
//          - Get gameInstance, board from coreEngine (not context)
//          - Call coreEngine.registerShipPlacement() directly
//          - Subscribe to coreEngine updates directly
//          - Fixes ship rendering - ensures CanvasBoard gets same references as placement logic
//          - Keep dispatch/events from useGame() as shortcuts only
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

import React, { useState, useEffect, useRef } from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import useGameState from '../hooks/useGameState';
import CanvasBoard from '../components/CanvasBoard';

const version = 'v0.4.19';
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

    //key data - see CoreEngine handle{state}
    const gameConfig = coreEngine.gameConfig;
    const eras = coreEngine.eras;
    const player = coreEngine.player
    const playerProfile = coreEngine.playerProfile;
    const playerEmail = coreEngine.playerEmail;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponents = coreEngine.selectedOpponents;

    // derived data
    const playerId = coreEngine.playerId;
    const playerRole = coreEngine.playerRole;
    const playerGameName = coreEngine.playerGameName;
    const isGuest = player != null && player.isGuest;
      const isAdmin = !!playerProfile?.isAdmin;
      const isDeveloper = !!playerProfile?.isDeveloper;
      const isTester = !!playerProfile?.isTester;
    const selectedOpponent = coreEngine.selectedOpponents[0];

    const selectedGameMode = coreEngine.selectedGameMode;
    const gameInstance = coreEngine.gameInstance;
    const board = coreEngine.board;

      // stop game if key data is missing (selectedAlliance is allowed to be null)
      // playerEmail is allowed to be null for guest users
      const required = isGuest 
          ? { gameConfig, eras, player, playerProfile, selectedEraId, selectedOpponents, gameInstance, board }
          : { gameConfig, eras, player, playerProfile, playerEmail, selectedEraId, selectedOpponents, gameInstance, board };
      const missing = Object.entries(required)
          .filter(([key, value]) => !value)
          .map(([key, value]) => `${key}=${value}`);
      const hasMissingData = missing.length > 0;
      if (hasMissingData) {
          logwarn(`Waiting on placement data: ${missing.join(', ')}`);
      }

    if (!hasMissingData) {
      log('PlacementPage: passed CoreEngine data checks');
    }

    const selectedEraConfig = coreEngine.selectedEraConfig;

    // v0.4.17: Get dispatch/events shortcuts from useGame (only thing we need from context)
    const { dispatch, events } = useGame();
  
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
  
  // Sync message console width to game board container width
  useEffect(() => {
    let rafId = null;
    let lastWidth = 0;
    
    const syncConsoleWidth = () => {
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      
      // Defer DOM updates to next animation frame to prevent ResizeObserver loop
      rafId = requestAnimationFrame(() => {
        if (gameBoardContainerRef.current && messageConsoleRef.current) {
          // Get the canvas element to match its width (not the container)
          const canvasElement = canvasBoardRef.current?.getCanvasElement?.();
          let boardWidth = 0;
          
          if (canvasElement) {
            const canvasRect = canvasElement.getBoundingClientRect();
            boardWidth = canvasRect.width;
          } else {
            // Fallback to container width if canvas not available
            boardWidth = gameBoardContainerRef.current.offsetWidth;
          }
          
          // Only update if width actually changed to prevent loops
          if (boardWidth > 0 && Math.abs(boardWidth - lastWidth) > 1) {
            const consoleCombined = messageConsoleRef.current.querySelector('.console-combined');
            if (consoleCombined) {
              consoleCombined.style.width = `${boardWidth}px`;
              lastWidth = boardWidth;
            }
          }
        }
        rafId = null;
      });
    };

    // Sync on mount and when board size changes
    const timeoutId = setTimeout(syncConsoleWidth, 100);
    
    // Use ResizeObserver to sync when board container resizes
    let resizeObserver;
    if (gameBoardContainerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        syncConsoleWidth();
      });
      resizeObserver.observe(gameBoardContainerRef.current);
    }

    // Also sync on window resize
    window.addEventListener('resize', syncConsoleWidth);

    return () => {
      clearTimeout(timeoutId);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', syncConsoleWidth);
    };
  }, [gameInstance, board, selectedEraConfig]);
  
  const [error, setError] = useState(null);
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  
  // Refs for syncing message console width to game board
  const messageConsoleRef = useRef(null);
  const gameBoardContainerRef = useRef(null);
  const canvasBoardRef = useRef(null);
  
  // No duplicate subscription - useGameState already subscribes to CoreEngine

  const handleShipPlaced = (ship, shipCells, orientation) => {
      method = 'handleShipPlaced';

      try {
      log(`Placing ${ship.name} with ${shipCells.length} cells`);
      
      // v0.4.17: Call coreEngine directly (not through context)
      const success = coreEngine.registerShipPlacement(ship, shipCells, orientation, player.id);
      
      if (success) {
        log(`Successfully placed ${ship.name}`);

          // DEBUG: Check what's in shipPlacements
          console.log('[PLACEMENT] DEBUG player.shipPlacements:', player.shipPlacements);
          console.log('[PLACEMENT] DEBUG ship.cells:', ship.cells);

        // Phase 4: Access fleet directly from player
        const fleet = player?.fleet;
        if (fleet) {
          const placedCount = fleet.ships.filter(ship => ship.isPlaced).length;
          const totalCount = fleet.ships.length;
          log(`Placement progress: ${placedCount}/${totalCount} ships placed`);
          
          if (placedCount === totalCount) {
            log('All ships placed - awaiting player confirmation to start battle');
          }
        }
        
        return true;
      } else {
        log(`Failed to register placement for ${ship.name}`);
        ship.reset();
        return false;
      }
      
    } catch (err) {
      logerror('Error placing ship:', err);
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
    log('Starting auto-placement with auto-clear');

    try {
      // Phase 4: Access fleet directly from player
      const fleet = player.fleet;
      if (fleet) {
        log('Clearing existing ship placements');
        
        // Phase 4: Clear player's placement map (the fix!)
        player.clearPlacements();
        
        // Reset ship flags
        fleet.ships.forEach(ship => {
          ship.reset();
        });
        
        log(`board === gameInstance.board: ${board === gameInstance.board}`);
        log(`player.board === board: ${player.board === board}`);
        log(`player.board === gameInstance.board: ${player.board === gameInstance.board}`);
        
        // Clear the board (terrain only now)
        board.clear();
        
        log('All ships cleared, ready for fresh auto-placement');
      }

      await gameInstance.autoPlaceShips(player);
      log('Auto-placement completed');
      
    } catch (error) {
      logerror('Auto-placement failed:', error);
    } finally {
      setIsAutoPlacing(false);
    }
  };

  const handleStartBattle = () => {
      method = 'handleStartBattle';

    log('Player confirmed - starting battle');
    
    if (dispatch && events) {
        log('exit Placement: events: ', events);
        log('exit Placement: coreEngine.gameInstance: ', coreEngine.gameInstance);
        log('exit Placement: coreEngine.board: ', coreEngine.board);
      dispatch(events.PLAY);
    } else {
      logerror('Cannot transition - missing dispatch or events');
    }
  };

  const getPlacementMessage = () => {
      method = 'getPlacementMessage';

    if (isAutoPlacing) {
      return 'Autoplacing ships...';
    } else if (currentShip) {
      return `Place your ${currentShip.class.toLowerCase()} in ${currentShip.terrain.join(' or ')} water`;
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
    log('Showing error state: ' + error);
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

    if (hasMissingData || !board || !gameInstance || !player) {
    const waitingFor = [];
      if (hasMissingData) waitingFor.push('core data');
      if (!board) waitingFor.push('board');
      if (!gameInstance) waitingFor.push('game instance');
      if (!player) waitingFor.push('human player');

    log('Showing loading state, waiting for: ' + waitingFor.join(', '));
    
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
              <h2>{selectedEraConfig?.name || 'Setting Up'}</h2>
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

          <div className="game-board-container" ref={gameBoardContainerRef}>
            <CanvasBoard
              ref={canvasBoardRef}
              mode="placement"
              eraConfig={selectedEraConfig}
              gameBoard={board}
              gameInstance={gameInstance}
              currentShip={currentShip}
              onShipPlaced={handleShipPlaced}
              player={player}
            />
          </div>

          <div className="message-consoles" ref={messageConsoleRef}>
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
