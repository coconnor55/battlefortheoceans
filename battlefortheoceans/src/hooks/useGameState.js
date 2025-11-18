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

import { useState, useEffect, useCallback } from 'react';
import { coreEngine } from '../context/GameContext';

const version = "v0.4.0";
const tag = "GAME";
const module = "useGameState";
let method = "";

const useGameState = () => {
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
            logwarn(`Game data still initializing: ${missing.join(', ')}`);
        }
    if (!hasMissingData) {
        log('useGameState: passed CoreEngine data checks');
    }
    
    const selectedEraConfig = coreEngine.selectedEraConfig;

  // Message state from Game's Message system
  const [messages, setMessages] = useState({
    console: '',
    ui: '',
    system: '',
    turn: ''
  });
  
  // Force re-render trigger for observer pattern (bumped by coreEngine.subscribe)
  const [, setRenderTrigger] = useState(0);
  const forceUpdate = useCallback(() => setRenderTrigger(prev => prev + 1), []);

  // Subscribe to CoreEngine updates so React sees synchronous store changes
  useEffect(() => {
    console.log('[HOOK]', version, 'Subscribing to CoreEngine updates');
    const unsubscribe = coreEngine.subscribe(() => {
      forceUpdate();
    });

    return () => {
      console.log('[HOOK]', version, 'Unsubscribing from CoreEngine updates');
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [forceUpdate]);

  // Subscribe to Message system updates
  useEffect(() => {
    if (gameInstance?.message) {
      console.log('[HOOK]', version, 'Subscribing to Message system');
      
      const unsubscribe = gameInstance.message.subscribe((newMessages) => {
        console.log('[HOOK]', version, 'Message system update:', newMessages);
        setMessages(newMessages);
      });
      
      // Get initial messages
      const initialMessages = gameInstance.message.getCurrentMessages();
      setMessages(initialMessages);
      
      return unsubscribe;
    } else {
      // Clear messages if no game instance
      setMessages({
        console: '',
        ui: '',
        system: '',
        turn: ''
      });
    }
  }, [gameInstance]);

  // v0.3.8: Get ONLY computed values from UIState (not passthroughs)
  const uiState = coreEngine.getUIState();
  const isPlayerTurn = uiState.isPlayerTurn;        // Computed
  const currentPlayer = uiState.currentPlayer;      // Computed
  const isGameActive = uiState.isGameActive;        // Computed
  const gamePhase = uiState.gamePhase;              // Computed
  const winner = uiState.winner;                    // Computed
  const playerStats = uiState.playerStats;          // Computed/aggregated
  const munitions = uiState.munitions || { starShells: 0, scatterShot: 0 }; // Computed

  // v0.3.7: Compute placement progress from coreEngine.player.fleet (the singleton!)
  const placementProgress = (() => {
    if (!player || !player.fleet) {
      console.log('[HOOK]', version, 'No player or fleet available');
      return {
        current: 0,
        total: 0,
        isComplete: false,
        currentShip: null
      };
    }
    
    const fleet = player.fleet;
    const ships = fleet.ships || [];
    const totalShips = ships.length;
    const placedShips = ships.filter(ship => ship.isPlaced);
    const placedCount = placedShips.length;
    
    // Find first unplaced ship
    const currentShip = ships.find(ship => !ship.isPlaced) || null;
    
    console.log('[HOOK]', version, 'Placement progress:', {
      placedCount,
      totalShips,
      hasCurrentShip: !!currentShip,
      currentShipName: currentShip?.name
    });
    
    return {
      current: placedCount,
      total: totalShips,
      isComplete: placedCount === totalShips && totalShips > 0,
      currentShip: currentShip
    };
  })();

  // Handle player attack using Game's unified turn management
  const handleAttack = useCallback((row, col) => {
    if (!gameInstance) {
      console.log('[HOOK]', version, 'No game instance');
      return false;
    }

    // Get current player
    const currentPlayer = gameInstance.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.type !== 'human') {
      console.log('[HOOK]', version, 'Attack blocked - not human turn');
      return false;
    }

    // v0.3.0: isValidAttack checks board coordinates only
    if (!gameInstance.isValidAttack(row, col)) {
      console.log('[HOOK]', version, 'Invalid attack attempt:', { row, col });
      return false;
    }

    // v0.3.0: canShootAt checks dontShoot Set (both water misses AND destroyed ship cells)
    if (!currentPlayer.canShootAt(row, col)) {
      console.log('[HOOK]', version, 'Already shot at this location (water miss or destroyed ship):', { row, col });
      return false;
    }

    try {
      console.log('[HOOK]', version, 'Processing human attack through Game instance:', { row, col });
      
      // Execute attack through Game's unified processing (SYNCHRONOUS)
      // Game will handle turn progression and trigger AI moves automatically
      const result = gameInstance.processPlayerAction('attack', { row, col });
      
      // Canvas will handle visual updates automatically
      // Messages will be handled by Message system automatically
      
      console.log('[HOOK]', version, 'Attack completed:', result.result);
      return result;
      
    } catch (error) {
      console.error('[HOOK]', version, 'Attack processing failed:', error);
      return false;
    }
  }, [gameInstance]);
  
  // v0.3.7: Fire munition through CoreEngine singleton
  const fireMunition = useCallback((munitionType, row, col) => {
    console.log('[HOOK]', version, 'Firing munition through CoreEngine:', { munitionType, row, col });
    return coreEngine.fireMunition(munitionType, row, col);
  }, []);
      
  // Reset game
  const resetGame = useCallback(() => {
    if (gameInstance) {
      gameInstance.reset();
      // Canvas will handle visual updates automatically
      // Message system will clear messages automatically
    }
  }, [gameInstance]);

  // Get game statistics - computed directly from game instance
  const getGameStats = useCallback(() => {
    return gameInstance ? gameInstance.getGameStats() : null;
  }, [gameInstance]);

  // Check if position is valid for attack - read directly from game instance
  const isValidAttack = useCallback((row, col) => {
    if (!gameInstance) return false;
    
    const currentPlayer = gameInstance.getCurrentPlayer();
    if (!currentPlayer) return false;
    
    // v0.3.0: Check both board validity AND dontShoot tracking
    return gameInstance.isValidAttack(row, col) && currentPlayer.canShootAt(row, col);
  }, [gameInstance]);

  // v0.3.0: REMOVED getPlayerView() - no longer needed with player-owned data
  // Canvas components now read directly from:
  // - player.fleet for ship data
  // - player.shipPlacements for locations
  // - player.dontShoot for preventing invalid targeting
  // - ship.health for rendering craters/diagonals

  // Determine appropriate battle message
  const battleMessage = messages.console || 'Awaiting battle action...';
  
  // Determine appropriate UI message - prioritize turn messages, fallback to UI messages
  const uiMessage = messages.turn || messages.ui || 'Preparing for battle...';

//  console.log('[HOOK]', version, 'useGameState render', {
//    hasGameInstance: !!gameInstance,
//    hasBoard: !!board,
//    hasPlayerProfile: !!playerProfile,
//    hasPlayer: !!player,
//    gamePhase: gamePhase,
//    isPlayerTurn: isPlayerTurn,
//    isGameActive: isGameActive,
//    currentPlayerType: currentPlayer?.type,
//    hasMessages: !!gameInstance?.message,
//    battleMessage: battleMessage.substring(0, 50) + '...',
//    uiMessage: uiMessage.substring(0, 50) + '...',
//    munitions: munitions,
//    placementProgress: placementProgress
//  });

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
      isDataReady: !hasMissingData
  };
};

export default useGameState;
// EOF
