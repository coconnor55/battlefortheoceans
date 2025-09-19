// src/hooks/useGameState.js
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';

const version = "v0.1.25";

const useGameState = () => {
  const {
    eraConfig,
    selectedOpponent,
    selectedGameMode,
    humanPlayer,
    gameInstance,
    board,
    uiVersion  // Use gameLogic instead of React state
  } = useGame();
  
  const [gameState, setGameState] = useState({
    isPlayerTurn: true,
    currentPlayer: null,
    message: 'Initializing game...',
    shots: [],
    playerHits: 0,
    opponentHits: 0,
    isGameActive: false,
    gamePhase: 'setup'
  });

  // Update local game state when game instance changes
  const updateGameState = useCallback((game) => {
    if (!game) return;

    const currentPlayer = game.getCurrentPlayer();
    const humanPlayerInGame = game.players.find(p => p.type === 'human');
    const aiPlayer = game.players.find(p => p.type === 'ai');

    setGameState({
      isPlayerTurn: currentPlayer?.type === 'human',
      currentPlayer: currentPlayer,
      message: generateGameMessage(game, currentPlayer),
      shots: game.gameLog.filter(entry => entry.message.includes('attack')),
      playerHits: humanPlayerInGame?.shotsHit || 0,
      opponentHits: aiPlayer?.shotsHit || 0,
      isGameActive: game.state === 'playing',
      gamePhase: game.state,
      winner: game.winner
    });
  }, []);

  // Generate appropriate game message
  const generateGameMessage = useCallback((game, currentPlayer) => {
    if (game.state === 'finished') {
      const winner = game.winner;
      if (winner?.type === 'human') {
        return 'Victory! You sank the enemy fleet!';
      } else {
        return 'Defeat! Your fleet has been sunk.';
      }
    }

    if (game.state === 'playing') {
      if (currentPlayer?.type === 'human') {
        const gameRules = game.gameRules;
        if (!gameRules.turn_required) {
          return 'Rapid Fire! Click to fire continuously!';
        } else {
          return 'Your turn - click to fire!';
        }
      } else {
        return `${currentPlayer?.name || 'Opponent'} is taking their turn...`;
      }
    }

    return game.state === 'setup' ? 'Preparing game...' : 'Game starting...';
  }, []);

  // Handle player attack using Game's unified turn management
  const handleAttack = useCallback(async (row, col) => {
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
      
      // Execute attack through Game's unified processing
      // Game will handle turn progression and trigger AI moves automatically
      const result = await gameInstance.processPlayerAction('attack', { row, col });
      
      // Update our local state to reflect changes
      updateGameState(gameInstance);
      
      return result;
      
    } catch (error) {
      console.error(version + ': Attack processing failed:', error);
      setGameState(prev => ({
        ...prev,
        message: `Attack failed: ${error.message}`
      }));
      return false;
    }
  }, [gameInstance, updateGameState]);

  // Listen to game instance changes - use uiVersion to track gameLogic changes
  useEffect(() => {
    if (gameInstance) {
      updateGameState(gameInstance);
    }
  }, [gameInstance, updateGameState, uiVersion]);

  // Reset game
  const resetGame = useCallback(() => {
    if (gameInstance) {
      gameInstance.reset();
      updateGameState(gameInstance);
    }
  }, [gameInstance, updateGameState]);

  // Get game statistics
  const getGameStats = useCallback(() => {
    return gameInstance ? gameInstance.getGameStats() : null;
  }, [gameInstance]);

  // Check if position is valid for attack
  const isValidAttack = useCallback((row, col) => {
    return gameInstance ? gameInstance.isValidAttack(row, col) : false;
  }, [gameInstance]);

  // Get player view from Board for UI rendering
  const getPlayerView = useCallback((playerId) => {
    if (!board || !gameInstance) return null;
    
    return board.getPlayerView(
      playerId,
      gameInstance.playerFleets,
      gameInstance.shipOwnership
    );
  }, [board, gameInstance]);

  console.log(version + ': useGameState render', {
    hasGameInstance: !!gameInstance,
    hasBoard: !!board,
    gamePhase: gameState.gamePhase,
    isPlayerTurn: gameState.isPlayerTurn,
    isGameActive: gameState.isGameActive,
    currentPlayerType: gameState.currentPlayer?.type
  });

  return {
    // Game state
    ...gameState,
    gameMode: selectedGameMode,
    userId: humanPlayer?.id,
    
    // Single board instance (used by both placement and battle)
    gameBoard: board,
    
    // Actions
    fireShot: handleAttack, // Alias for compatibility
    handleAttack,
    resetGame,
    
    // Data accessors
    getGameStats,
    isValidAttack,
    getPlayerView,
    
    // Game instance access
    game: gameInstance,
    
    // Context data
    eraConfig,
    selectedOpponent
  };
};

export default useGameState;

// EOF
