// src/hooks/useGameState.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.0: CoreEngine subscription for synchronous store updates
//          - Added coreEngine.subscribe() integration that bumps render trigger on mutations
//          - Ensures components re-render when CoreEngine advances turns or updates player state
// v0.3.9: Graceful loading state + readiness flag
//          - Removed fatal dependency throw in favor of readiness checks
//          - Uses optional chaining for profile flags when core data still loading
//          - Exposes isDataReady for components to gate rendering
// v0.3.8: Clean separation - coreEngine for identity, uiState for computed values only
//          - Get playerProfile from coreEngine.playerProfile (not uiState passthrough)
//          - Get humanPlayer from coreEngine.player (not uiState passthrough)
//          - Get ONLY computed values from uiState (isPlayerTurn, gamePhase, winner, stats, munitions)
//          - Fixes ship rendering - CanvasBoard now gets correct player reference
// v0.3.7: Remove GameContext dependency - read directly from coreEngine singleton
//          - Import coreEngine directly instead of using useGame() hook
//          - Read coreEngine.player instead of context's humanPlayer
//          - Read all state directly from coreEngine (era, opponent, gameInstance, board)
//          - Eliminates passthrough layer - aligns with Player singleton pattern
//          - Fixes placement progress reading wrong/stale humanPlayer reference
// v0.3.6: Complete munitions refactoring - remove backward compatibility
//          - Removed handleStarShellFired wrapper
//          - Removed starShellsRemaining and scatterShotRemaining exports
//          - Components now use munitions object and fireMunition() directly
// v0.3.5: Compute placement progress inline from humanPlayer.fleet
//          - Removed call to non-existent getPlacementProgress()
//          - Calculate currentShipIndex, totalShips, currentShip, isPlacementComplete
//          - Read directly from humanPlayer.fleet.ships
// v0.3.4: Player Singleton Pattern implementation
//          - Extract humanPlayer from CoreEngine's UIState
//          - Return both humanPlayer (game logic) and playerProfile (database)
//          - Components use humanPlayer for validation, playerProfile for display
// v0.3.3: Added playerProfile to returned state
// v0.3.2: Munitions terminology rename (resources → munitions)

import { useState, useEffect } from 'react';
import { coreEngine } from '../context/GameContext';

const version = "v0.4.1";
const tag = "GAME";
const module = "useGameState";

// v0.4.1: Minimize React usage - game is synchronous, React just for rendering
// - Single subscription to trigger re-renders
// - Read directly from CoreEngine on each render (no memoization)
// - Direct function calls to CoreEngine (no useCallback wrappers)

const useGameState = () => {
  // Single render trigger - CoreEngine manages all state synchronously
  const [, setRenderTrigger] = useState(0);

  // Single subscription to CoreEngine - triggers re-render when state changes
  useEffect(() => {
    const unsubscribe = coreEngine.subscribe(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Read directly from CoreEngine (synchronous, no React state)
  const gameInstance = coreEngine.gameInstance;
  const board = coreEngine.board;
  const player = coreEngine.player;
  const playerProfile = coreEngine.playerProfile;
  const selectedEraConfig = coreEngine.selectedEraConfig;
  const selectedOpponent = coreEngine.selectedOpponents?.[0];
  const selectedGameMode = coreEngine.selectedGameMode;
  
  // Get UI state directly from CoreEngine
  const uiState = coreEngine.getUIState();
  
  // Get messages directly from game instance (if available)
  const messages = gameInstance?.message?.getCurrentMessages() || {
    console: '',
    ui: '',
    system: '',
    turn: ''
  };

  // Extract computed values from UIState
  const isPlayerTurn = uiState.isPlayerTurn;
  const currentPlayer = uiState.currentPlayer;
  const isGameActive = uiState.isGameActive;
  const gamePhase = uiState.gamePhase;
  const winner = uiState.winner;
  const playerStats = uiState.playerStats;
  const munitions = uiState.munitions || { starShells: 0, scatterShot: 0 };

  // Compute placement progress directly (synchronous read)
  const placementProgress = (() => {
    if (!player?.fleet?.ships) {
      return { current: 0, total: 0, isComplete: false, currentShip: null };
    }
    const ships = player.fleet.ships;
    const placedCount = ships.filter(s => s.isPlaced).length;
    return {
      current: placedCount,
      total: ships.length,
      isComplete: placedCount === ships.length && ships.length > 0,
      currentShip: ships.find(s => !s.isPlaced) || null
    };
  })();

  // Direct function calls to CoreEngine (no React wrappers)
  const handleAttack = (row, col) => {
    if (!gameInstance) return false;
    const currentPlayer = gameInstance.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.type !== 'human') return false;
    if (!gameInstance.isValidAttack(row, col)) return false;
    if (!currentPlayer.canShootAt(row, col)) return false;
    try {
      return gameInstance.processPlayerAction('attack', { row, col });
    } catch (error) {
      console.error('[HOOK]', version, 'Attack failed:', error);
      return false;
    }
  };
  
  const fireMunition = (munitionType, row, col) => {
    return coreEngine.fireMunition(munitionType, row, col);
  };
      
  const resetGame = () => {
    gameInstance?.reset();
  };

  const getGameStats = () => {
    return gameInstance?.getGameStats() || null;
  };

  const isValidAttack = (row, col) => {
    if (!gameInstance) return false;
    const currentPlayer = gameInstance.getCurrentPlayer();
    if (!currentPlayer) return false;
    return gameInstance.isValidAttack(row, col) && currentPlayer.canShootAt(row, col);
  };

  // v0.3.0: REMOVED getPlayerView() - no longer needed with player-owned data
  // Canvas components now read directly from:
  // - player.fleet for ship data
  // - player.shipPlacements for locations
  // - player.dontShoot for preventing invalid targeting
  // - ship.health for rendering craters/diagonals

  const battleMessage = messages.console || 'Awaiting battle action...';
  const uiMessage = messages.turn || messages.ui || 'Preparing for battle...';

  return {
    // Game state - computed from game logic
    isPlayerTurn,
    currentPlayer,
    isGameActive,
    gamePhase,
    winner,
    gameMode: selectedGameMode,
    playerId: player?.id,
    
    // v0.3.8: BOTH player objects from coreEngine singleton (not uiState passthroughs)
    playerProfile,        // Database object - for user display, services, leaderboards
    humanPlayer: player,  // Player instance - for game logic, validation
    
    // Message state - from Message system with appropriate fallbacks
    battleMessage,           // Battle console message (hits, misses, sunk ships)
    uiMessage,              // UI console message (turn status, game state)
    systemMessage: messages.system || '',
    
    // Player stats - FIXED: Access nested properties correctly
    playerHits: playerStats.player?.hits || 0,
    opponentHits: playerStats.opponent?.hits || 0,
    playerShots: playerStats.player?.shots || 0,
    opponentShots: playerStats.opponent?.shots || 0,
    
    // v0.3.7: Placement state - computed from coreEngine.player.fleet (the singleton!)
    currentShipIndex: placementProgress.current,
    totalShips: placementProgress.total,
    currentShip: placementProgress.currentShip,
    isPlacementComplete: placementProgress.isComplete,
    
    // Single board instance (used by both placement and battle)
    gameBoard: board,
    
    // v0.3.2: Munitions from CoreEngine (renamed from resources)
    munitions,
    
    // Actions
    fireShot: handleAttack, // Alias for compatibility
    handleAttack,
    fireMunition,           // v0.3.2: Primary munition handler
    resetGame,
    
    // Data accessors - computed properties
    getGameStats,
    isValidAttack,
    // getPlayerView removed - no longer needed
    
    // Game instance access
    game: gameInstance,
    
    // Context data - v0.3.7: Now from coreEngine directly
    selectedEraConfig,
    selectedOpponent,
    
    // Computed accuracy - FIXED: Use correct nested properties
    accuracy: playerStats.player?.shots > 0 ?
      (playerStats.player.hits / playerStats.player.shots * 100).toFixed(1) : 0,
    isDataReady: !!(gameInstance && board && player && playerProfile)
  };
};

export default useGameState;
// EOF
