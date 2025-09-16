// src/hooks/useGameState.js
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useContext } from 'react';
import { GameContext } from '../context/GameContext';
import Game from '../classes/Game';

const version = "v0.1.15";

const useGameState = () => {
  const {
    eraConfig,
    selectedOpponent,
    player,
    placementBoard,
    getCurrentGameMode,
    dispatch,
    stateMachine
  } = useContext(GameContext);
  
  const [game, setGame] = useState(null);
  const [gameState, setGameState] = useState({
    isPlayerTurn: true,
    currentPlayer: null,
    message: 'Starting game...',
    shots: [],
    playerHits: 0,
    opponentHits: 0,
    isGameActive: false,
    gamePhase: 'setup'
  });

  // Initialize game when all required data is available
  useEffect(() => {
    if (!eraConfig || !selectedOpponent || !placementBoard) {
      console.log('v0.1.15: Waiting for game initialization data');
      return;
    }

    const gameMode = getCurrentGameMode();
    console.log('v0.1.15: Initializing new Game instance with mode:', gameMode.name);
    
    // Create new game instance
    const newGame = new Game(eraConfig, gameMode.id);
    
    // Add human player
    const humanPlayerId = player?.id || 'defaultPlayer';
    newGame.addPlayer(humanPlayerId, 'human', player?.name || 'You');
    
    // Add AI opponent
    newGame.addPlayer(selectedOpponent.id, 'ai', selectedOpponent.name);
    
    // Set the placement board (from placement phase)
    if (placementBoard) {
      newGame.setBoard(placementBoard);
      console.log('v0.1.15: Board set from placement phase');
    }
    
    // Start the game
    newGame.startGame()
      .then(() => {
        console.log('v0.1.15: Game started successfully');
        setGame(newGame);
        updateGameState(newGame);
      })
      .catch(error => {
        console.error('v0.1.15: Game start failed:', error);
        setGameState(prev => ({
          ...prev,
          message: `Game start failed: ${error.message}`,
          isGameActive: false
        }));
      });

  }, [eraConfig, selectedOpponent, player, placementBoard, getCurrentGameMode]);

  // Update local game state when game instance changes
  const updateGameState = (gameInstance) => {
    if (!gameInstance) return;

    const currentPlayer = gameInstance.getCurrentPlayer();
    const humanPlayer = gameInstance.players.find(p => p.type === 'human');
    const aiPlayer = gameInstance.players.find(p => p.type === 'ai');

    setGameState({
      isPlayerTurn: currentPlayer?.type === 'human',
      currentPlayer: currentPlayer,
      message: generateGameMessage(gameInstance, currentPlayer),
      shots: gameInstance.gameLog.filter(entry => entry.type === 'attack'),
      playerHits: humanPlayer ? humanPlayer.getHits() : 0,
      opponentHits: aiPlayer ? aiPlayer.getHits() : 0,
      isGameActive: gameInstance.state === 'playing',
      gamePhase: gameInstance.state,
      winner: gameInstance.winner
    });
  };

  // Generate appropriate game message
  const generateGameMessage = (gameInstance, currentPlayer) => {
    if (gameInstance.state === 'finished') {
      const winner = gameInstance.winner;
      if (winner?.type === 'human') {
        return 'Victory! You sank the enemy fleet!';
      } else {
        return 'Defeat! Your fleet has been sunk.';
      }
    }

    if (gameInstance.state === 'playing') {
      if (currentPlayer?.type === 'human') {
        const gameMode = getCurrentGameMode();
        if (gameMode?.id === 'rapid') {
          return 'Rapid Fire! Click to fire continuously!';
        } else {
          return 'Your turn - click to fire!';
        }
      } else {
        return `${currentPlayer?.name || 'Opponent'} is taking their turn...`;
      }
    }

    return gameInstance.state === 'setup' ? 'Preparing game...' : 'Game starting...';
  };

  // Handle player attack
  const handleAttack = async (row, col) => {
    if (!game || !game.isValidAttack(row, col)) {
      console.log('v0.1.15: Invalid attack attempt:', { row, col });
      return false;
    }

    try {
      console.log('v0.1.15: Processing attack:', { row, col });
      
      // Execute the attack through the game instance
      const result = await game.processPlayerAction('attack', { row, col });
      
      // Update our local state
      updateGameState(game);
      
      // Handle AI turn if it's turn-based and game is still active
      if (game.state === 'playing' &&
          getCurrentGameMode()?.id === 'turn' &&
          game.getCurrentPlayer()?.type === 'ai') {
        
        // Small delay for better UX
        setTimeout(async () => {
          try {
            const aiResult = await game.processAITurn();
            console.log('v0.1.15: AI turn completed:', aiResult);
            updateGameState(game);
          } catch (error) {
            console.error('v0.1.15: AI turn failed:', error);
          }
        }, 1000);
      }
      
      return result;
      
    } catch (error) {
      console.error('v0.1.15: Attack processing failed:', error);
      setGameState(prev => ({
        ...prev,
        message: `Attack failed: ${error.message}`
      }));
      return false;
    }
  };

  // Reset game (for restart)
  const resetGame = () => {
    if (game) {
      game.reset();
      updateGameState(game);
    }
  };

  // Get board state for rendering
  const getBoardState = () => {
    if (!game?.board) return null;
    
    return {
      board: game.board,
      shots: gameState.shots,
      gamePhase: gameState.gamePhase
    };
  };

  // Get game statistics
  const getGameStats = () => {
    if (!game) return null;
    
    return game.getGameStats();
  };

  // Check if position is valid for attack
  const isValidAttack = (row, col) => {
    return game ? game.isValidAttack(row, col) : false;
  };

  console.log('v0.1.15: useGameState render', {
    hasGame: !!game,
    gameState: gameState.gamePhase,
    isPlayerTurn: gameState.isPlayerTurn,
    isGameActive: gameState.isGameActive
  });

  return {
    // Game state
    ...gameState,
    gameMode: getCurrentGameMode(),
    
    // Actions
    handleAttack,
    resetGame,
    
    // Data accessors
    getBoardState,
    getGameStats,
    isValidAttack,
    
    // Game instance (for advanced use)
    game
  };
};

export default useGameState;

// EOF
