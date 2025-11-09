// src/utils/SessionManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.3: Refactored for PlayerProfile architecture
//         - Save playerProfile separately from humanPlayer
//         - Wrap restored playerProfile data in PlayerProfile instance
//         - Import PlayerProfile class
//         - Updated logging to match new pattern (tag, module, method)
//         - PlayerProfile is now managed separately from Player
// v0.1.2: Fixed profile property name (was playerProfile, should be profile)
//         - save() now correctly accesses context.humanPlayer.playerProfile
//         - Saves as 'profile' not 'playerProfile' in session data
//         - restore() returns profile data correctly
// v0.1.1: Updated to save/restore Player objects instead of separate user/profile
//         - save() now reads context.humanPlayer (Player object)
//         - Saves player.id, player.name, player.type, player.playerProfile
//         - restore() returns humanPlayer data for CoreEngine to reconstruct
//         - Cleaner: Player object contains everything needed
// v0.1.0: Initial SessionManager - extracted from CoreEngine
//         - Handles all sessionStorage operations
//         - Save/restore/clear session context
//         - No dependencies on CoreEngine (pure utility)

import PlayerProfile from '../classes/PlayerProfile';

const version = 'v0.1.3';
const tag = "SESSION";
const module = "SessionManager";
let method = "";

const SESSION_KEY = 'game_session';

class SessionManager {
  /**
   * Logging utilities
   */
  static log(message) {
    console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
  }
  
  static logerror(message, error = null) {
    if (error) {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
    } else {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
    }
  }

  /**
   * Save session context to sessionStorage
   * @param {Object} context - Session data to save (typically CoreEngine instance)
   * @param {Object} context.humanPlayer - Player object
   * @param {Object} context.playerProfile - PlayerProfile instance (separate from player)
   * @param {string} context.eraId - Current era ID
   * @param {Array} context.selectedOpponents - Selected opponent data
   * @param {string} context.selectedAlliance - Selected alliance
   * @returns {boolean} Success/failure
   */
  static save(context) {
    method = 'save';
    
    if (typeof window === 'undefined') {
      console.warn(`[${tag}] ${version} ${module}.${method}: Not in browser environment`);
      return false;
    }

    try {
      const sessionData = {
        // Save Player object (per-game data)
        humanPlayer: context.humanPlayer ? {
          id: context.humanPlayer.id,
          name: context.humanPlayer.name,
          type: context.humanPlayer.type,
          difficulty: context.humanPlayer.difficulty || 1.0
        } : null,
        
        // Save PlayerProfile separately (career stats)
        playerProfile: context.playerProfile ? {
          id: context.playerProfile.id,
          game_name: context.playerProfile.game_name,
          role: context.playerProfile.role,
          total_games: context.playerProfile.total_games,
          total_wins: context.playerProfile.total_wins,
          total_score: context.playerProfile.total_score,
          best_accuracy: context.playerProfile.best_accuracy,
          total_ships_sunk: context.playerProfile.total_ships_sunk,
          total_damage: context.playerProfile.total_damage,
          eras_played: context.playerProfile.eras_played,
          eras_won: context.playerProfile.eras_won,
          show_game_guide: context.playerProfile.show_game_guide,
          incomplete_games: context.playerProfile.incomplete_games,
          created_at: context.playerProfile.created_at,
          updated_at: context.playerProfile.updated_at
        } : null,
        
        eraId: context.eraId || null,
        
        selectedOpponents: context.selectedOpponents?.map(opp => ({
          id: opp.id,
          name: opp.name,
          strategy: opp.strategy,
          difficulty: opp.difficulty
        })) || [],
        
        selectedAlliance: context.selectedAlliance || null,
        
        timestamp: Date.now()
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      this.log(`Session saved - Player: ${context.humanPlayer?.name}, Profile: ${context.playerProfile?.game_name}`);
      return true;

    } catch (error) {
      this.logerror('Error saving session:', error);
      return false;
    }
  }

  /**
   * Restore session context from sessionStorage
   * Wraps playerProfile data in PlayerProfile instance
   * @returns {Object|null} Session data or null if none exists
   */
  static restore() {
    method = 'restore';
    
    if (typeof window === 'undefined') {
      console.warn(`[${tag}] ${version} ${module}.${method}: Not in browser environment`);
      return null;
    }

    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      
      if (!stored) {
        this.log('No stored session found');
        return null;
      }

      const sessionData = JSON.parse(stored);
      
      // Wrap playerProfile data in PlayerProfile instance
      if (sessionData.playerProfile) {
        sessionData.playerProfile = new PlayerProfile(sessionData.playerProfile);
        this.log(`Session restored - Player: ${sessionData.humanPlayer?.name}, Profile: ${sessionData.playerProfile.game_name}`);
      } else if (sessionData.humanPlayer) {
        this.log(`Session restored - Player: ${sessionData.humanPlayer.name}, No profile`);
      } else {
        this.log('Session restored - No player data');
      }
      
      return sessionData;

    } catch (error) {
      this.logerror('Error restoring session:', error);
      // Clear corrupted session
      this.clear();
      return null;
    }
  }

  /**
   * Clear session from sessionStorage
   * @returns {boolean} Success/failure
   */
  static clear() {
    method = 'clear';
    
    if (typeof window === 'undefined') {
      console.warn(`[${tag}] ${version} ${module}.${method}: Not in browser environment`);
      return false;
    }

    try {
      sessionStorage.removeItem(SESSION_KEY);
      this.log('Session cleared');
      return true;

    } catch (error) {
      this.logerror('Error clearing session:', error);
      return false;
    }
  }

  /**
   * Check if session exists
   * @returns {boolean}
   */
  static exists() {
    if (typeof window === 'undefined') {
      return false;
    }

    return sessionStorage.getItem(SESSION_KEY) !== null;
  }

  /**
   * Get session age in milliseconds
   * @returns {number|null} Age in ms or null if no session
   */
  static getAge() {
    method = 'getAge';
    const sessionData = this.restore();
    
    if (!sessionData || !sessionData.timestamp) {
      return null;
    }

    return Date.now() - sessionData.timestamp;
  }
}

export default SessionManager;
// EOF
