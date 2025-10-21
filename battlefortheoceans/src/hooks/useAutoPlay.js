// src/hooks/useAutoPlay.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial autoplay hook
//         - Extracts autoplay logic from PlayingPage
//         - Testing/debug utility for admin/developer/tester roles
//         - Automatically fires random valid shots at 200ms intervals
//         - Returns state and toggle handler

import { useState, useEffect, useCallback, useRef } from 'react';

const version = 'v0.1.0';

/**
 * useAutoPlay - Automated testing utility for rapid gameplay
 * 
 * Fires random valid shots automatically at 200ms intervals.
 * Only available to users with admin/developer/tester roles.
 * 
 * @param {Object} params - Configuration object
 * @param {Game} params.gameInstance - Game instance
 * @param {Object} params.eraConfig - Era configuration (for board dimensions)
 * @param {boolean} params.isPlayerTurn - Whether it's the player's turn
 * @param {boolean} params.isGameActive - Whether the game is active
 * @param {Function} params.handleShotFired - Callback to fire a shot (row, col)
 * @param {Object} params.userProfile - User profile (to check role)
 * @param {string} params.battleMessage - Battle message (for render trigger)
 * 
 * @returns {Object} { autoPlayEnabled, canUseAutoPlay, handleAutoPlayToggle }
 * 
 * @example
 * const { autoPlayEnabled, canUseAutoPlay, handleAutoPlayToggle } = useAutoPlay({
 *   gameInstance,
 *   eraConfig,
 *   isPlayerTurn,
 *   isGameActive,
 *   handleShotFired,
 *   userProfile,
 *   battleMessage
 * });
 * 
 * // In JSX:
 * {canUseAutoPlay && isGameActive && (
 *   <button onClick={handleAutoPlayToggle}>
 *     {autoPlayEnabled ? 'Stop AutoPlay' : 'AutoPlay'}
 *   </button>
 * )}
 */
const useAutoPlay = ({
  gameInstance,
  eraConfig,
  isPlayerTurn,
  isGameActive,
  handleShotFired,
  userProfile,
  battleMessage
}) => {
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const autoPlayTimerRef = useRef(null);
  
  // Check if user has permission to use autoplay
  const canUseAutoPlay = ['admin', 'developer', 'tester'].includes(userProfile?.role);

  // Fire random valid shot
  const fireRandomShot = useCallback(() => {
    if (!gameInstance || !isPlayerTurn || !isGameActive) {
      return;
    }

    const humanPlayerFromGame = gameInstance.players.find(p => p.type === 'human');
    if (!humanPlayerFromGame) {
      console.log('[AUTOPLAY]', version, 'No human player found in game instance');
      return;
    }

    // Find all valid targets
    const validTargets = [];
    for (let row = 0; row < eraConfig.rows; row++) {
      for (let col = 0; col < eraConfig.cols; col++) {
        if (gameInstance.isValidAttack(row, col, humanPlayerFromGame)) {
          validTargets.push({ row, col });
        }
      }
    }

    if (validTargets.length === 0) {
      console.log('[AUTOPLAY]', version, 'No valid targets remaining - stopping');
      setAutoPlayEnabled(false);
      return;
    }

    // Select random target
    const randomIndex = Math.floor(Math.random() * validTargets.length);
    const target = validTargets[randomIndex];
    
    console.log('[AUTOPLAY]', version, 'Firing at', target, `(${validTargets.length} targets remaining)`);
    handleShotFired(target.row, target.col);
  }, [gameInstance, isPlayerTurn, isGameActive, eraConfig, handleShotFired]);

  // Manage autoplay timer
  useEffect(() => {
    // Clear existing timer
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    // Start new timer if enabled and ready
    if (autoPlayEnabled && isGameActive && isPlayerTurn) {
      autoPlayTimerRef.current = setTimeout(() => {
        fireRandomShot();
      }, 200); // 200ms delay between shots
    }

    // Cleanup on unmount
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayEnabled, isGameActive, isPlayerTurn, fireRandomShot, battleMessage]);

  // Disable autoplay when game ends
  useEffect(() => {
    if (!isGameActive) {
      setAutoPlayEnabled(false);
    }
  }, [isGameActive]);

  // Toggle handler
  const handleAutoPlayToggle = () => {
    setAutoPlayEnabled(prev => {
      const newState = !prev;
      console.log('[AUTOPLAY]', version, 'Toggled:', newState);
      return newState;
    });
  };

  return {
    autoPlayEnabled,
    canUseAutoPlay,
    handleAutoPlayToggle
  };
};

export default useAutoPlay;
// EOF
