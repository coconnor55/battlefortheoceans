// src/hooks/useVideoTriggers.js
// Copyright(c) 2025, Clint H. O'Connor

/**
 * v0.2.2: BUGFIX - Set up callbacks immediately, don't wait for gameConfig
 *         - Callbacks are set when gameInstance exists
 *         - gameConfig is used only when video actually plays
 *         - Fixes issue where videos wouldn't trigger if config loaded slowly
 * v0.2.1: Load generic fallback videos from game-config.json
 *         - No hardcoded video paths
 *         - Reads generic_fallbacks from game-config.json
 *         - Gracefully handles missing config (no videos shown)
 *         - Async config loading on mount
 * v0.2.0: Added fallback videos for eras without specific videos
 *         - Falls back to generic videos if era doesn't provide them
 *         - Generic videos: /videos/generic/ship-sunk.mp4, victory.mp4, defeat.mp4
 *         - Ensures video experience even for new eras without custom content
 *         - Simplified logic: getVideoPath() helper determines era vs generic
 * v0.1.0: Initial video triggers hook
 *         - Extracts video logic from PlayingPage
 *         - Sets up Game.onShipSunk callback
 *         - Sets up Game.onGameOver callback
 *         - Manages showVideo and currentVideo state
 *         - Returns state and handler for VideoPopup rendering
 */

import { useState, useEffect, useRef } from 'react';

const version = 'v0.2.2';

/**
 * Load game config (with caching)
 */
let cachedGameConfig = null;
let configLoadPromise = null;

const loadGameConfig = async () => {
  // Return cached config if available
  if (cachedGameConfig) {
    return cachedGameConfig;
  }
  
  // Return existing promise if already loading
  if (configLoadPromise) {
    return configLoadPromise;
  }
  
  // Load config
  configLoadPromise = fetch('/config/game-config.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load game-config.json: ${response.status}`);
      }
      return response.json();
    })
    .then(config => {
      cachedGameConfig = config;
      configLoadPromise = null;
      console.log('[VIDEO]', version, 'Game config loaded:', config.version);
      return config;
    })
    .catch(error => {
      console.error('[VIDEO]', version, 'Failed to load game-config.json:', error);
      configLoadPromise = null;
      return null;
    });
  
  return configLoadPromise;
};

/**
 * Get video path - era-specific or generic fallback
 *
 * @param {Object} eraConfig - Era configuration
 * @param {string} videoKey - Video key (sunkplayer, sunkopponent, victory, defeat)
 * @param {Object} gameConfig - Game configuration with generic_fallbacks
 * @returns {string|null} Video path or null if no video available
 */
const getVideoPath = (eraConfig, videoKey, gameConfig) => {
  // Try era-specific video first
  if (eraConfig?.videos?.[videoKey]) {
    return eraConfig.videos[videoKey];
  }
  
  // Fallback to generic video from game config
  if (gameConfig?.videos?.generic_fallbacks?.[videoKey]) {
    return gameConfig.videos.generic_fallbacks[videoKey];
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
 * Generic fallback videos are loaded from game-config.json:
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
  const [gameConfig, setGameConfig] = useState(null);
  
  // Use ref to always have current gameConfig in callbacks
  const gameConfigRef = useRef(null);
  
  useEffect(() => {
    gameConfigRef.current = gameConfig;
  }, [gameConfig]);

  // Load game config on mount
  useEffect(() => {
    loadGameConfig().then(config => {
      if (config) {
        setGameConfig(config);
      }
    });
  }, []);

  // Set up callbacks as soon as gameInstance exists
  // Don't wait for gameConfig - it will be available when video plays
  useEffect(() => {
    if (!gameInstance) return;

    console.log('[VIDEO]', version, 'Setting up video triggers');

    // Ship sunk callback
    gameInstance.setOnShipSunk((eventType, details) => {
      console.log('[VIDEO]', version, `Ship sunk event: ${eventType}`, details);

      const videoKey = eventType === 'player' ? 'sunkplayer' : 'sunkopponent';
      const videoPath = getVideoPath(eraConfig, videoKey, gameConfigRef.current);
      
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
      const videoPath = getVideoPath(eraConfig, videoKey, gameConfigRef.current);
      
      if (videoPath) {
        console.log('[VIDEO]', version, `Playing ${videoKey} video:`, videoPath);
        setCurrentVideo(videoPath);
        setShowVideo(true);
      } else {
        console.warn('[VIDEO]', version, `No video found for ${videoKey}`);
      }
    });
  }, [gameInstance, eraConfig]); // Removed gameConfig from dependencies

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
