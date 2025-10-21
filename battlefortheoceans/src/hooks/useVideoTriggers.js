// src/hooks/useVideoTriggers.js v0.1.0
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial video triggers hook
//         - Extracts video logic from PlayingPage
//         - Sets up Game.onShipSunk callback
//         - Sets up Game.onGameOver callback
//         - Manages showVideo and currentVideo state
//         - Returns state and handler for VideoPopup rendering

import { useState, useEffect } from 'react';

const version = 'v0.1.0';

/**
 * useVideoTriggers - Manages video popup triggers for game events
 *
 * Sets up callbacks on gameInstance for:
 * - Ship sunk (player/opponent)
 * - Game over (victory/defeat)
 *
 * Uses callback pattern (not useEffect monitoring) for synchronous event handling.
 *
 * @param {Game} gameInstance - Game instance
 * @param {Object} eraConfig - Era configuration with video paths
 * @returns {Object} { showVideo, currentVideo, handleVideoComplete }
 *
 * @example
 * const { showVideo, currentVideo, handleVideoComplete } = useVideoTriggers(gameInstance, eraConfig);
 *
 * // In JSX:
 * {showVideo && currentVideo && (
 *   <VideoPopup videoSrc={currentVideo} onComplete={handleVideoComplete} />
 * )}
 */
const useVideoTriggers = (gameInstance, eraConfig) => {
  const [showVideo, setShowVideo] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  useEffect(() => {
    if (!gameInstance) return;

    console.log('[VIDEO]', version, 'Setting up video triggers');

    // Ship sunk callback
    gameInstance.setOnShipSunk((eventType, details) => {
      console.log('[VIDEO]', version, `Ship sunk event: ${eventType}`, details);

      if (eventType === 'player' && eraConfig?.videos?.sunkplayer) {
        setCurrentVideo(eraConfig.videos.sunkplayer);
        setShowVideo(true);
      } else if (eventType === 'opponent' && eraConfig?.videos?.sunkopponent) {
        setCurrentVideo(eraConfig.videos.sunkopponent);
        setShowVideo(true);
      }
    });

    // Game over callback
    gameInstance.setOnGameOver((eventType, details) => {
      console.log('[VIDEO]', version, `Game over event: ${eventType}`, details);

      if (eventType === 'victory' && eraConfig?.videos?.victory) {
        setCurrentVideo(eraConfig.videos.victory);
        setShowVideo(true);
      } else if (eventType === 'defeat' && eraConfig?.videos?.defeat) {
        setCurrentVideo(eraConfig.videos.defeat);
        setShowVideo(true);
      }
    });
  }, [gameInstance, eraConfig]);

  const handleVideoComplete = () => {
    setShowVideo(false);
    setCurrentVideo(null);
  };

  return {
    showVideo,
    currentVideo,
    handleVideoComplete
  };
};

export default useVideoTriggers;
// EOF
