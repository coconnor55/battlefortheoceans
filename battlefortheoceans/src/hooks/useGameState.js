// src/hooks/useGameState.js
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';

const version = "v0.1.19";

const useGameState = () => {
  const {
    eraConfig,
    selectedOpponent,
    selectedGameMode,
    humanPlayer,
    gameInstance,
    board,
    initializeGame,
    addPlayerToGame
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

  // Initialize game when ready for battle phase
  useEffect(() => {
    if (!eraConfig || !selectedOpponent || !humanPlayer || gameInstance) {
      return; // Wait for all data or game already exists
    }

    console.log(version + ': Initializing game for battle phase');
    
    // Initialize game instance through GameContext
    const game = initializeGame(selectedGameMode?.id || 'turnBased');
    if (!game) {
      console.error(version + ': Failed to initialize game');
      return;
    }

    // Add human player to game and assign to alliance
    const humanPlayerId = humanPlayer.id || 'human-player';
    addPlayerToGame(humanPlayerId, 'human', humanPlayer.name || 'Player', 'Player Alliance');

    // Add AI opponent and assign to alliance
    const aiId = selectedOpponent.id || 'ai-opponent';
    const aiStrategy = selectedOpponent.strategy || 'methodical_hunting';
    const aiDifficulty = selectedOpponent.difficulty || 1.0;
    addPlayerToGame(aiId, 'ai', selectedOpponent.name, 'Opponent Alliance');

    console.log(version + ': Players added to game with alliance assignments');

  }, [eraConfig, selectedOpponent, humanPlayer, selectedGameMode, gameInstance, initializeGame, addPlayerToGame]);

  // Start game when both players are added and ships are placed
  useEffect(() => {
    if (!gameInstance || gameInstance.state !== 'setup') return;

    // Check if all players have fleets and ships are placed
    const allPlayersReady = gameInstance.players.every(player => {
      const fleet = gameInstance.playerFleets.get(player.id);
      return fleet && fleet.isPlaced();
    });

    if (allPlayersReady) {
      console.log(version + ': All players ready, starting game');
      
      gameInstance.startGame()
        .then(() => {
          console.log(version + ': Game started successfully');
          updateGameState(gameInstance);
        })
        .catch(error => {
          console.error(version + ': Game start failed:', error);
          setGameState(prev => ({
            ...prev,
            message: `Game start failed: ${error.message}`,
            isGameActive: false
          }));
        });
    }
  }, [gameInstance]);

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
  }, [eraConfig]);

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

  // Handle player attack using Game's hit resolution
  const handleAttack = useCallback(async (row, col) => {
    if (!gameInstance || !gameInstance.isValidAttack(row, col)) {
      console.log(version + ': Invalid attack attempt:', { row, col });
      return false;
    }

    try {
      console.log(version + ': Processing attack through Game instance:', { row, col });
      
      // Execute attack through Game's enhanced hit resolution
      const result = await gameInstance.processPlayerAction('attack', { row, col });
      
      // Update our local state
      updateGameState(gameInstance);
      
      // Handle AI turn if turn-based and game still active
      if (gameInstance.state === 'playing' &&
          gameInstance.gameRules.turn_required &&
          gameInstance.getCurrentPlayer()?.type === 'ai') {
        
        // Small delay for better UX
        setTimeout(async () => {
          try {
            const aiResult = await gameInstance.processAITurn();
            console.log(version + ': AI turn completed:', aiResult);
            updateGameState(gameInstance);
          } catch (error) {
            console.error(version + ': AI turn failed:', error);
          }
        }, 1000);
      }
      
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
    isGameActive: gameState.isGameActive
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
