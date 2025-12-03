// src/utils/SoundManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Extracted from Game.js v0.8.4
//         - Sound initialization with CDN support
//         - Sound playback with optional delay
//         - Sound enable/disable toggle
//         - Reduces Game.js by ~40 lines

const version = "v0.1.1";
const tag = "SOUND";
const module = "SoundManager";
let method = "";

// Environment-aware CDN path
const SOUND_BASE_URL = process.env.REACT_APP_GAME_CDN || '';

/**
 * SoundManager
 * 
 * Handles all sound effects for the game.
 * Extracted from Game.js to separate audio concerns.
 * 
 * Responsibilities:
 * - Load and preload sound files
 * - Play sounds with optional delay
 * - Enable/disable sound globally
 * - Track loading errors
 * 
 * @example
 * const soundManager = new SoundManager();
 * soundManager.playSound('cannonBlast');
 * soundManager.playSound('explosionBang', 500); // 500ms delay
 * soundManager.toggleSound(false); // Mute all sounds
 */
class SoundManager {
  constructor() {
    method = 'constructor';
    
    this.soundEnabled = true;
    this.soundEffects = {};
    this.soundLoadErrors = [];
    
    this.initializeSounds();
    this.log('SoundManager initialized');
  }
  
  /**
   * Initialize and preload all sound effects
   * Loads from CDN if REACT_APP_GAME_CDN is set
   */
  initializeSounds() {
    method = 'initializeSounds';
    const soundFiles = {
      cannonBlast: 'cannon-blast.mp3',
      incomingWhistle: 'incoming-whistle.mp3',
      explosionBang: 'explosion-bang.mp3',
      splash: 'splash.mp3',
      sinkingShip: 'sinking-ship.mp3',
      victoryFanfare: 'victory-fanfare.mp3',
      funeralMarch: 'funeral-march.mp3'
    };

    Object.entries(soundFiles).forEach(([key, filename]) => {
      try {
        const fullPath = `${SOUND_BASE_URL}/sounds/${filename}`;
        const audio = new Audio(fullPath);
        audio.preload = 'auto';
        audio.load();
        this.soundEffects[key] = audio;
        
        // Log successful load
        audio.addEventListener('canplaythrough', () => {
          this.log(`Loaded: ${key}`);
        }, { once: true });
        
      } catch (error) {
        this.logerror(`Failed to load: ${key}`, error);
        this.soundLoadErrors.push(key);
      }
    });
    
    if (this.soundLoadErrors.length > 0) {
      this.logerror(`Failed to load ${this.soundLoadErrors.length} sounds: ${this.soundLoadErrors.join(', ')}`);
    }
  }
  
  /**
   * Play a sound effect with optional delay
   * 
   * @param {string} soundType - Sound effect key (e.g., 'cannonBlast')
   * @param {number} delay - Delay in milliseconds (default: 0)
   */
  playSound(soundType, delay = 0) {
    method = 'playSound';
    if (!this.soundEnabled) {
      return;
    }
    
    setTimeout(() => {
      const audio = this.soundEffects[soundType];
      if (audio && audio.readyState >= 2) {
        audio.currentTime = 0;
        audio.play().catch((error) => {
          // Silently fail if autoplay is blocked
          console.debug(`[SoundManager ${version}] Playback blocked for ${soundType}:`, error.message);
        });
      } else if (!audio) {
        console.warn(`[${tag}] ${version} ${module}.${method}: Sound not found: ${soundType}`);
      }
    }, delay);
  }
  
  /**
   * Enable or disable all sounds
   * 
   * @param {boolean} enabled - True to enable sounds, false to disable
   */
  toggleSound(enabled) {
    method = 'toggleSound';
    this.soundEnabled = enabled;
    this.log(`Sound ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if a sound is loaded and ready
   * 
   * @param {string} soundType - Sound effect key
   * @returns {boolean} True if sound is ready to play
   */
  isSoundReady(soundType) {
    const audio = this.soundEffects[soundType];
    return audio && audio.readyState >= 2;
  }
  
  /**
   * Get all loaded sound keys
   * 
   * @returns {Array<string>} Array of sound keys
   */
  getLoadedSounds() {
    return Object.keys(this.soundEffects).filter(key => 
      this.isSoundReady(key)
    );
  }
  
  /**
   * Get sound loading errors
   * 
   * @returns {Array<string>} Array of failed sound keys
   */
  getLoadErrors() {
    return [...this.soundLoadErrors];
  }
  
  /**
   * Check if sounds are currently enabled
   * 
   * @returns {boolean} True if sounds are enabled
   */
  isEnabled() {
    method = 'isEnabled';
    return this.soundEnabled;
  }
  
  log(message) {
    console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
  }
  
  logerror(message, error = null) {
    if (error) {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
    } else {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
    }
  }
}

export default SoundManager;
// EOF
