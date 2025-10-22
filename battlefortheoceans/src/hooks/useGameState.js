// src/hooks/useGameState.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.2: Munitions terminology rename (resources → munitions)
//         - Renamed resources to munitions throughout
//         - starShellsRemaining now reads from munitions.starShells
//         - scatterShotRemaining now reads from munitions.scatterShot
//         - Added fireMunition() wrapper for CoreEngine method
//         - Kept handleStarShellFired for backward compatibility
//         - Aligns with Game.js v0.8.8 and CoreEngine.js v0.6.10
// v0.3.1: Exposed resources from CoreEngine and handleStarShellFired wrapper
//         - Added resources (starShells, scatterShot) from uiState
//         - Added starShellsRemaining convenience getter
//         - Added handleStarShellFired() wrapper for CoreEngine method
//         - PlayingPage can now read resources instead of maintaining local state
// v0.3.0: Phase 4 Refactor - Updated for missedShots → dontShoot rename
//         Reflects that dontShoot includes both water misses AND destroyed ship cells
//         Updated log messages and comments for clarity
// v0.2.5: Phase 3 Refactor - Fixed handleAttack() to use correct isValidAttack signature
//         Removed getPlayerView() which referenced deprecated playerFleets/shipOwnership
//         Integration with player-owned fleet, shipPlacements, and miss tracking

import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';

const version = "v0.3.2";

const useGameState = () => {
  const {
    eraConfig,
    selectedOpponent,
    selectedGameMode,
    humanPlayer,
    gameInstance,
    board,
    getUIState,
    getPlacementProgress,
    fireMunition: coreFireMunition,
    handleStarShellFired: coreHandleStarShellFired
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
  const placementProgress = getPlacementProgress();

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
  
  // v0.3.2: Handle star shell firing - backward compatibility wrapper
  const handleStarShellFired = useCallback((row, col) => {
    if (!coreHandleStarShellFired) {
      console.log('[HOOK] No star shell handler available');
      return false;
    }
    
    console.log('[HOOK] Firing star shell through CoreEngine:', { row, col });
    return coreHandleStarShellFired(row, col);
  }, [coreHandleStarShellFired]);
    
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
  
  // v0.3.2: Munitions from CoreEngine (renamed from resources)
  const munitions = uiState.munitions || { starShells: 0, scatterShot: 0 };

  // Determine appropriate battle message
  const battleMessage = messages.console || 'Awaiting battle action...';
  
  // Determine appropriate UI message - prioritize turn messages, fallback to UI messages
  const uiMessage = messages.turn || messages.ui || 'Preparing for battle...';

  console.log('[HOOK] useGameState render', {
    hasGameInstance: !!gameInstance,
    hasBoard: !!board,
    gamePhase: gamePhase,
    isPlayerTurn: isPlayerTurn,
    isGameActive: isGameActive,
    currentPlayerType: currentPlayer?.type,
    hasMessages: !!gameInstance?.message,
    battleMessage: battleMessage.substring(0, 50) + '...',
    uiMessage: uiMessage.substring(0, 50) + '...',
    munitions: munitions
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
    
    // Message state - from Message system with appropriate fallbacks
    battleMessage,           // Battle console message (hits, misses, sunk ships)
    uiMessage,              // UI console message (turn status, game state)
    systemMessage: messages.system || '',
    
    // Player stats - FIXED: Access nested properties correctly
    playerHits: playerStats.player?.hits || 0,
    opponentHits: playerStats.opponent?.hits || 0,
    playerShots: playerStats.player?.shots || 0,
    opponentShots: playerStats.opponent?.shots || 0,
    
    // Placement state - computed from game logic
    currentShipIndex: placementProgress.current,
    totalShips: placementProgress.total,
    currentShip: placementProgress.currentShip,
    isPlacementComplete: placementProgress.isComplete,
    
    // Single board instance (used by both placement and battle)
    gameBoard: board,
    
    // v0.3.2: Munitions from CoreEngine (renamed from resources)
    munitions,
    starShellsRemaining: munitions.starShells,
    scatterShotRemaining: munitions.scatterShot,
    
    // Actions
    fireShot: handleAttack, // Alias for compatibility
    handleAttack,
    fireMunition,           // v0.3.2: Primary munition handler
    handleStarShellFired,   // v0.3.2: Backward compatibility wrapper
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
