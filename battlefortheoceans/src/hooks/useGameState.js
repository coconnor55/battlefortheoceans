// src/hooks/useGameState.js
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';

const version = "v0.2.4";

const useGameState = () => {
  const {
    eraConfig,
    selectedOpponent,
    selectedGameMode,
    humanPlayer,
    gameInstance,
    board,
    getUIState,
    getPlacementProgress
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
      console.log(version + ': Subscribing to Message system');
      
      const unsubscribe = gameInstance.message.subscribe((newMessages) => {
        console.log(version + ': Message system update:', newMessages);
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
    // Handle player attack using Game's unified turn management
    const handleAttack = useCallback((row, col) => {
      if (!gameInstance || !gameInstance.isValidAttack(row, col)) {
        console.log(version + ': Invalid attack attempt:', { row, col });
        return false;
      }

      // Only allow human attacks when it's the human's turn
      const currentPlayer = gameInstance.getCurrentPlayer();
      if (currentPlayer?.type !== 'human') {
        console.log(version + ': Attack blocked - not human turn');
        return false;
      }

      try {
        console.log(version + ': Processing human attack through Game instance:', { row, col });
        
        // Execute attack through Game's unified processing (SYNCHRONOUS)
        // Game will handle turn progression and trigger AI moves automatically
        const result = gameInstance.processPlayerAction('attack', { row, col });
        
        // Canvas will handle visual updates automatically
        // Messages will be handled by Message system automatically
        
        console.log(version + ': Attack completed:', result.result);
        return result;
        
      } catch (error) {
        console.error(version + ': Attack processing failed:', error);
        return false;
      }
    }, [gameInstance]);
    
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
    return gameInstance ? gameInstance.isValidAttack(row, col) : false;
  }, [gameInstance]);

  // Get player view from Board for UI rendering - read directly from board
  const getPlayerView = useCallback((playerId) => {
    if (!board || !gameInstance) return null;
    
    return board.getPlayerView(
      playerId,
      gameInstance.playerFleets,
      gameInstance.shipOwnership
    );
  }, [board, gameInstance]);

  // Computed properties from game logic - no local state
  const isPlayerTurn = uiState.isPlayerTurn;
  const currentPlayer = uiState.currentPlayer;
  const isGameActive = uiState.isGameActive;
  const gamePhase = uiState.gamePhase;
  const winner = uiState.winner;
  const playerStats = uiState.playerStats;

  // Determine appropriate battle message
  const battleMessage = messages.console || 'Awaiting battle action...';
  
  // Determine appropriate UI message - prioritize turn messages, fallback to UI messages
  const uiMessage = messages.turn || messages.ui || 'Preparing for battle...';

  console.log(version + ': useGameState render', {
    hasGameInstance: !!gameInstance,
    hasBoard: !!board,
    gamePhase: gamePhase,
    isPlayerTurn: isPlayerTurn,
    isGameActive: isGameActive,
    currentPlayerType: currentPlayer?.type,
    hasMessages: !!gameInstance?.message,
    battleMessage: battleMessage.substring(0, 50) + '...',
    uiMessage: uiMessage.substring(0, 50) + '...'
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
    
    // Actions
    fireShot: handleAttack, // Alias for compatibility
    handleAttack,
    resetGame,
    
    // Data accessors - computed properties
    getGameStats,
    isValidAttack,
    getPlayerView,
    
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
