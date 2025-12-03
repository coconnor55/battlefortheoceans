// src/hooks/useVideoTriggers.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.1: BUGFIX - Proper null checks and dependency array fix
//         - Remove coreEngine from dependency array (it's a singleton)
//         - Add defensive null check before accessing gameInstance methods
//         - Prevents "can't access property setOnShipSunk, gameInstance is null" error
// v0.3.0: Use coreEngine.gameConfig instead of loading separately
//         - Removed local config loading and caching
//         - Use gameConfig from GameContext (loaded in CoreEngine)
//         - Simplified: no useEffect for config, no refs, no async loading
//         - Cleaner and more consistent with architecture
// v0.2.2: BUGFIX - Set up callbacks immediately, don't wait for gameConfig
//         - Callbacks are set when gameInstance exists
//         - gameConfig is used only when video actually plays
//         - Fixes issue where videos wouldn't trigger if config loaded slowly
// v0.2.1: Load generic fallback videos from game-config.json
//         - No hardcoded video paths
//         - Reads generic_fallbacks from game-config.json
//         - Gracefully handles missing config (no videos shown)
//         - Async config loading on mount

import { useState, useEffect } from 'react';
import { coreEngine } from '../context/GameContext';
import configLoader from '../utils/ConfigLoader';

const version = 'v0.3.1';

/**
 * Get video path - era-specific or generic fallback
 *
 * @param {Object} eraConfig - Era configuration
 * @param {string} videoKey - Video key (sunkplayer, sunkopponent, victory, defeat)
 * @param {Object} gameConfig - Game configuration with generic_fallbacks
 * @returns {string|null} Video path or null if no video available
 */
const getVideoPath = (eraConfig, videoKey, gameConfig) => {
  // Try era-specific video first - use ConfigLoader for CDN support
  if (eraConfig?.videos?.[videoKey]) {
    // Config provides relative path like "videos/victory.mp4"
    const path = configLoader.getEraAssetPath(eraConfig.id, eraConfig.videos[videoKey]);
    console.log('[VIDEO] Era-specific path:', path);
    return path;
  }
  
  // Fallback to generic video from game config
  if (gameConfig?.videos?.generic_fallbacks?.[videoKey]) {
    // Generic fallbacks are relative paths like "assets/eras/traditional/videos/playersunk.mp4"
    // Use getAssetPath to add leading slash for public folder
    const path = configLoader.getAssetPath(gameConfig.videos.generic_fallbacks[videoKey]);
    console.log('[VIDEO] Generic fallback path:', path);
    return path;
  }
  
  // No video available
  return null;
};

/**
 * useVideoTriggers - Manages video popup triggers for game events
 *
 * Sets up callbacks on gameInstance for:
 * - Ship sunk (player/opponent) - shows era-specific or generic ship sunk video
 * - Game over (victory/defeat) - shows era-specific or generic victory/defeat video
 *
 * Generic fallback videos are loaded from game-config.json via CoreEngine:
 * - config.videos.generic_fallbacks.sunkplayer
 * - config.videos.generic_fallbacks.sunkopponent
 * - config.videos.generic_fallbacks.victory
 * - config.videos.generic_fallbacks.defeat
 *
 * Uses callback pattern (not useEffect monitoring) for synchronous event handling.
 *
 * @param {Game} gameInstance - Game instance
 * @param {Object} eraConfig - Era configuration with optional video paths
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

  // Set up callbacks when gameInstance exists
  useEffect(() => {
    // Defensive null checks
    if (!gameInstance) {
      console.log('[VIDEO]', version, 'No gameInstance available, skipping video trigger setup');
      return;
    }

    if (typeof gameInstance.setOnShipSunk !== 'function' ||
        typeof gameInstance.setOnGameOver !== 'function') {
      console.warn('[VIDEO]', version, 'gameInstance missing required callback methods');
      return;
    }

    console.log('[VIDEO]', version, 'Setting up video triggers');

    // Ship sunk callback
    gameInstance.setOnShipSunk((eventType, details) => {
      console.log('[VIDEO]', version, `Ship sunk event: ${eventType}`, details);

      const videoKey = eventType === 'player' ? 'sunkplayer' : 'sunkopponent';
      const videoPath = getVideoPath(eraConfig, videoKey, coreEngine.gameConfig);
      
      if (videoPath) {
        console.log('[VIDEO]', version, `Playing ${videoKey} video:`, videoPath);
        setCurrentVideo(videoPath);
        setShowVideo(true);
      } else {
        console.warn('[VIDEO]', version, `No video found for ${videoKey}`);
      }
    });

    // Game over callback
    gameInstance.setOnGameOver((eventType, details) => {
      console.log('[VIDEO]', version, `Game over event: ${eventType}`, details);

      const videoKey = eventType; // 'victory' or 'defeat'
      const videoPath = getVideoPath(eraConfig, videoKey, coreEngine.gameConfig);
      
      if (videoPath) {
        console.log('[VIDEO]', version, `Playing ${videoKey} video:`, videoPath);
        setCurrentVideo(videoPath);
        setShowVideo(true);
      } else {
        console.warn('[VIDEO]', version, `No video found for ${videoKey}`);
      }
    });

    // Cleanup function (though Game.js doesn't support unsubscribe yet)
    return () => {
      console.log('[VIDEO]', version, 'Cleaning up video triggers');
    };
  }, [gameInstance, eraConfig]); // Removed coreEngine - it's a singleton and shouldn't trigger re-runs

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
