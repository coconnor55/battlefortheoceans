// src/hooks/useAutoPlay.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.5: Fixed autoplay stopping frequently
//         - Removed battleMessage from useEffect dependencies (was causing timer resets)
//         - Made timer recursive to continue firing shots automatically
//         - Timer now schedules next shot after each fire, creating continuous loop
// v0.1.4: Reverted delay back to 200ms (5 shots/second is fast enough)
//         - Kept 200ms delay between shots for reasonable autoplay speed
//         - Animation delays are skipped via speedFactor=0, so no other delays
// v0.1.2: Fixed valid target detection to check canShootAt()
//         - fireRandomShot now checks BOTH isValidAttack() AND canShootAt()
//         - Prevents AutoPlay from firing at already-shot cells
//         - Fixes AutoPlay stopping when it tries to fire at same cell twice
// v0.1.1: Added detailed debug logging to diagnose timer stopping
//         - Logs every useEffect trigger with dependency values
//         - Logs timer creation and cleanup
//         - Logs why timer doesn't restart
// v0.1.0: Initial autoplay hook
//         - Extracts autoplay logic from PlayingPage
//         - Testing/debug utility for admin/developer/tester roles
//         - Automatically fires random valid shots at 200ms intervals
//         - Returns state and toggle handler

import { useState, useEffect, useCallback, useRef } from 'react';

const version = 'v0.1.5';
const tag = "AUTOPLAY";
const module = "useAutoPlay";
let method = "";

// Logging utilities
const log = (message) => {
  console.log(`[${tag}] ${version} ${module}.${method}: ${message}`);
};

const logwarn = (message) => {
  console.warn(`[${tag}] ${version} ${module}.${method}: ${message}`);
};

/**
 * useAutoPlay - Automated gameplay utility
 *
 * Fires random valid shots automatically at 200ms intervals.
 * Available to all players. Note: Uses random targeting and is not recommended when winning matters.
 *
 * @param {Object} params - Configuration object
 * @param {Game} params.gameInstance - Game instance
 * @param {Object} params.selectedEraConfig - Era configuration (for board dimensions)
 * @param {boolean} params.isPlayerTurn - Whether it's the player's turn
 * @param {boolean} params.isGameActive - Whether the game is active
 * @param {Function} params.handleShotFired - Callback to fire a shot (row, col)
 * @param {Object} params.playerProfile - User profile (to check role)
 * @param {string} params.battleMessage - Battle message (for render trigger)
 *
 * @returns {Object} { autoPlayEnabled, canUseAutoPlay, handleAutoPlayToggle }
 *
 * @example
 * const { autoPlayEnabled, canUseAutoPlay, handleAutoPlayToggle } = useAutoPlay({
 *   gameInstance,
 *   selectedEraConfig,
 *   isPlayerTurn,
 *   isGameActive,
 *   handleShotFired,
 *   playerProfile,
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
  selectedEraConfig,
  isPlayerTurn,
  isGameActive,
  handleShotFired,
  playerProfile,
  battleMessage
}) => {
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const autoPlayTimerRef = useRef(null);
  const autoPlayEnabledRef = useRef(false);
  const isPlayerTurnRef = useRef(isPlayerTurn);
  const isGameActiveRef = useRef(isGameActive);
  
  // Keep refs in sync with state
  useEffect(() => {
    autoPlayEnabledRef.current = autoPlayEnabled;
  }, [autoPlayEnabled]);
  
  useEffect(() => {
    isPlayerTurnRef.current = isPlayerTurn;
  }, [isPlayerTurn]);
  
  useEffect(() => {
    isGameActiveRef.current = isGameActive;
  }, [isGameActive]);
  
  // Autoplay is now available to everyone
  const canUseAutoPlay = true;

  // Fire random valid shot and schedule next shot
  const fireRandomShot = useCallback(() => {
    method = 'fireRandomShot';
    
    if (!gameInstance || !isPlayerTurnRef.current || !isGameActiveRef.current) {
      return;
    }

    const humanPlayerFromGame = gameInstance.players.find(p => p.type === 'human');
    if (!humanPlayerFromGame) {
      logwarn('No human player found in game instance');
      return;
    }

    // Find all valid targets (must pass BOTH checks)
    const validTargets = [];
    for (let row = 0; row < selectedEraConfig.rows; row++) {
      for (let col = 0; col < selectedEraConfig.cols; col++) {
        // Check board validity AND that we haven't shot here before
        if (gameInstance.isValidAttack(row, col, humanPlayerFromGame) &&
            humanPlayerFromGame.canShootAt(row, col)) {
          validTargets.push({ row, col });
        }
      }
    }

    if (validTargets.length === 0) {
      log('No valid targets remaining - stopping');
      setAutoPlayEnabled(false);
      return;
    }

    // Select random target
    const randomIndex = Math.floor(Math.random() * validTargets.length);
    const target = validTargets[randomIndex];
    
    log(`Firing at ${target.row},${target.col} (${validTargets.length} targets remaining)`);
    handleShotFired(target.row, target.col);
    
    // Schedule next shot (recursive timer) - check refs to avoid dependency issues
    if (autoPlayEnabledRef.current && isGameActiveRef.current && isPlayerTurnRef.current) {
      autoPlayTimerRef.current = setTimeout(() => {
        fireRandomShot();
      }, 200); // 200ms delay between shots (5 shots/second)
    }
  }, [gameInstance, selectedEraConfig, handleShotFired]);

  // Manage autoplay timer - start/stop based on state
  useEffect(() => {
    method = 'useEffect[timer]';

    // Clear existing timer
    if (autoPlayTimerRef.current) {
      log('Clearing existing timer');
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    // Start initial timer if enabled and ready (fireRandomShot will schedule subsequent shots)
    if (autoPlayEnabled && isGameActive && isPlayerTurn) {
      log('Starting initial timer (200ms)');
      autoPlayTimerRef.current = setTimeout(() => {
        fireRandomShot();
      }, 200); // 200ms delay before first shot
    }

    // Cleanup on unmount or when conditions change
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayEnabled, isGameActive, isPlayerTurn, fireRandomShot]);

  // Disable autoplay when game ends
  useEffect(() => {
    if (!isGameActive) {
      setAutoPlayEnabled(false);
    }
  }, [isGameActive]);

  // Toggle handler
  const handleAutoPlayToggle = () => {
    method = 'handleAutoPlayToggle';
    setAutoPlayEnabled(prev => {
      const newState = !prev;
      log(`Toggled: ${newState}`);
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
