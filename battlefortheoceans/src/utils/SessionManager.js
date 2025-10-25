// src/utils/SessionManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.2: Fixed profile property name (was userProfile, should be profile)
//         - save() now correctly accesses context.humanPlayer.userProfile
//         - Saves as 'profile' not 'userProfile' in session data
//         - restore() returns profile data correctly
// v0.1.1: Updated to save/restore Player objects instead of separate user/profile
//         - save() now reads context.humanPlayer (Player object)
//         - Saves player.id, player.name, player.type, player.userProfile
//         - restore() returns humanPlayer data for CoreEngine to reconstruct
//         - Cleaner: Player object contains everything needed
// v0.1.0: Initial SessionManager - extracted from CoreEngine
//         - Handles all sessionStorage operations
//         - Save/restore/clear session context
//         - No dependencies on CoreEngine (pure utility)

const version = 'v0.1.2';
const SESSION_KEY = 'game_session';

class SessionManager {
  /**
   * Save session context to sessionStorage
   * v0.1.2: Fixed to use humanPlayer.userProfile 
   * @param {Object} context - Session data to save (typically CoreEngine instance)
   * @param {Object} context.humanPlayer - Player object with embedded profile
   * @param {string} context.eraId - Current era ID
   * @param {Array} context.selectedOpponents - Selected opponent data
   * @param {string} context.selectedAlliance - Selected alliance
   * @returns {boolean} Success/failure
   */
  static save(context) {
    if (typeof window === 'undefined') {
      console.warn('[SessionManager]', version, 'Not in browser environment');
      return false;
    }

    try {
      const sessionData = {
        // v0.1.2: Save Player object (includes profile)
        humanPlayer: context.humanPlayer ? {
          id: context.humanPlayer.id,
          name: context.humanPlayer.name,
          type: context.humanPlayer.type,
          difficulty: context.humanPlayer.difficulty || 1.0,
          
          // v0.1.2: Save embedded profile (lifetime stats)
          profile: context.humanPlayer.userProfile ? {
            id: context.humanPlayer.userProfile.id,
            game_name: context.humanPlayer.userProfile.game_name,
            total_games: context.humanPlayer.userProfile.total_games || 0,
            total_wins: context.humanPlayer.userProfile.total_wins || 0,
            total_score: context.humanPlayer.userProfile.total_score || 0,
            best_accuracy: context.humanPlayer.userProfile.best_accuracy || 0,
            total_ships_sunk: context.humanPlayer.userProfile.total_ships_sunk || 0,
            total_damage: context.humanPlayer.userProfile.total_damage || 0
          } : null
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
      console.log('[SessionManager]', version, 'Session saved - Player:', context.humanPlayer?.name);
      return true;

    } catch (error) {
      console.error('[SessionManager]', version, 'Error saving session:', error);
      return false;
    }
  }

  /**
   * Restore session context from sessionStorage
   * v0.1.2: Returns humanPlayer data for CoreEngine to reconstruct Player object
   * @returns {Object|null} Session data or null if none exists
   */
  static restore() {
    if (typeof window === 'undefined') {
      console.warn('[SessionManager]', version, 'Not in browser environment');
      return null;
    }

    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      
      if (!stored) {
        console.log('[SessionManager]', version, 'No stored session found');
        return null;
      }

      const sessionData = JSON.parse(stored);
      
      if (sessionData.humanPlayer) {
        console.log('[SessionManager]', version, 'Session restored - Player:', sessionData.humanPlayer.name);
      } else {
        console.log('[SessionManager]', version, 'Session restored - No player data');
      }
      
      return sessionData;

    } catch (error) {
      console.error('[SessionManager]', version, 'Error restoring session:', error);
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
    if (typeof window === 'undefined') {
      console.warn('[SessionManager]', version, 'Not in browser environment');
      return false;
    }

    try {
      sessionStorage.removeItem(SESSION_KEY);
      console.log('[SessionManager]', version, 'Session cleared');
      return true;

    } catch (error) {
      console.error('[SessionManager]', version, 'Error clearing session:', error);
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
    const sessionData = this.restore();
    
    if (!sessionData || !sessionData.timestamp) {
      return null;
    }

    return Date.now() - sessionData.timestamp;
  }
}

export default SessionManager;
// EOF
