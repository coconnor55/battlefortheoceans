// src/hooks/useGameState.js
// Copyright(c) 2025, Clint H. O'Connor
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
//          - Return both humanPlayer (game logic) and userProfile (database)
//          - Components use humanPlayer for validation, userProfile for display
// v0.3.3: Added userProfile to returned state
// v0.3.2: Munitions terminology rename (resources → munitions)

import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';

const version = "v0.3.6";

const useGameState = () => {
  const {
    eraConfig,
    selectedOpponent,
    selectedGameMode,
    humanPlayer,
    gameInstance,
    board,
    getUIState,
    fireMunition: coreFireMunition,
  } = useGame();
  
  // Message state from Game's Message system
  const [messages, setMessages] = useState({
    console: '',
    ui: '',
    system: '',
    turn: ''
  });
  
  // Force re-render trigger for observer pattern
  const [, setRenderTrigger] = useState(0);
  const forceUpdate = useCallback(() => setRenderTrigger(prev => prev + 1), []);

  // Subscribe to Message system updates
  useEffect(() => {
    if (gameInstance?.message) {
      console.log('[HOOK] Subscribing to Message system');
      
      const unsubscribe = gameInstance.message.subscribe((newMessages) => {
        console.log('[HOOK] Message system update:', newMessages);
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

  // Get computed state directly from game logic
  const uiState = getUIState();

  // v0.3.5: Compute placement progress inline from humanPlayer.fleet
  const placementProgress = (() => {
    if (!humanPlayer || !humanPlayer.fleet) {
      return {
        current: 0,
        total: 0,
        isComplete: false,
        currentShip: null
      };
    }
    
    const fleet = humanPlayer.fleet;
    const ships = fleet.ships || [];
    const totalShips = ships.length;
    const placedShips = ships.filter(ship => ship.isPlaced);
    const placedCount = placedShips.length;
    
    // Find first unplaced ship
    const currentShip = ships.find(ship => !ship.isPlaced) || null;
    
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
      console.log('[HOOK] No game instance');
      return false;
    }

    // Get current player
    const currentPlayer = gameInstance.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.type !== 'human') {
      console.log('[HOOK] Attack blocked - not human turn');
      return false;
    }

    // v0.3.0: isValidAttack checks board coordinates only
    if (!gameInstance.isValidAttack(row, col)) {
      console.log('[HOOK] Invalid attack attempt:', { row, col });
      return false;
    }

    // v0.3.0: canShootAt checks dontShoot Set (both water misses AND destroyed ship cells)
    if (!currentPlayer.canShootAt(row, col)) {
      console.log('[HOOK] Already shot at this location (water miss or destroyed ship):', { row, col });
      return false;
    }

    try {
      console.log('[HOOK] Processing human attack through Game instance:', { row, col });
      
      // Execute attack through Game's unified processing (SYNCHRONOUS)
      // Game will handle turn progression and trigger AI moves automatically
      const result = gameInstance.processPlayerAction('attack', { row, col });
      
      // Canvas will handle visual updates automatically
      // Messages will be handled by Message system automatically
      
      console.log('[HOOK] Attack completed:', result.result);
      return result;
      
    } catch (error) {
      console.error('[HOOK] Attack processing failed:', error);
      return false;
    }
  }, [gameInstance]);
  
  // v0.3.2: Handle munition firing - primary method
  const fireMunition = useCallback((munitionType, row, col) => {
    if (!coreFireMunition) {
      console.log('[HOOK] No munition handler available');
      return false;
    }
    
    console.log('[HOOK] Firing munition through CoreEngine:', { munitionType, row, col });
    return coreFireMunition(munitionType, row, col);
  }, [coreFireMunition]);
      
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

  // Computed properties from game logic - no local state
  const isPlayerTurn = uiState.isPlayerTurn;
  const currentPlayer = uiState.currentPlayer;
  const isGameActive = uiState.isGameActive;
  const gamePhase = uiState.gamePhase;
  const winner = uiState.winner;
  const playerStats = uiState.playerStats;
  
  // v0.3.4: Extract BOTH player objects from UIState
  const userProfile = uiState.userProfile;      // Database object (display, services)
  const humanPlayerFromState = uiState.humanPlayer;  // Player instance (game logic)
  
  // v0.3.2: Munitions from CoreEngine (renamed from resources)
  const munitions = uiState.munitions || { starShells: 0, scatterShot: 0 };

  // Determine appropriate battle message
  const battleMessage = messages.console || 'Awaiting battle action...';
  
  // Determine appropriate UI message - prioritize turn messages, fallback to UI messages
  const uiMessage = messages.turn || messages.ui || 'Preparing for battle...';

  console.log('[HOOK] useGameState render', {
    hasGameInstance: !!gameInstance,
    hasBoard: !!board,
    hasUserProfile: !!userProfile,
    hasHumanPlayer: !!humanPlayerFromState,
    gamePhase: gamePhase,
    isPlayerTurn: isPlayerTurn,
    isGameActive: isGameActive,
    currentPlayerType: currentPlayer?.type,
    hasMessages: !!gameInstance?.message,
    battleMessage: battleMessage.substring(0, 50) + '...',
    uiMessage: uiMessage.substring(0, 50) + '...',
    munitions: munitions,
    placementProgress: placementProgress
  });

  return {
    // Game state - computed from game logic
    isPlayerTurn,
    currentPlayer,
    isGameActive,
    gamePhase,
    winner,
    gameMode: selectedGameMode,
    userId: humanPlayer?.id,
    
    // v0.3.4: BOTH player objects for different purposes
    userProfile,        // Database object - for user display, services, leaderboards
    humanPlayer: humanPlayerFromState,  // Player instance - for game logic, validation
    
    // Message state - from Message system with appropriate fallbacks
    battleMessage,           // Battle console message (hits, misses, sunk ships)
    uiMessage,              // UI console message (turn status, game state)
    systemMessage: messages.system || '',
    
    // Player stats - FIXED: Access nested properties correctly
    playerHits: playerStats.player?.hits || 0,
    opponentHits: playerStats.opponent?.hits || 0,
    playerShots: playerStats.player?.shots || 0,
    opponentShots: playerStats.opponent?.shots || 0,
    
    // v0.3.5: Placement state - computed inline from humanPlayer.fleet
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
    
    // Context data
    eraConfig,
    selectedOpponent,
    
    // Computed accuracy - FIXED: Use correct nested properties
    accuracy: playerStats.player?.shots > 0 ?
      (playerStats.player.hits / playerStats.player.shots * 100).toFixed(1) : 0
  };
};

export default useGameState;
// EOF
