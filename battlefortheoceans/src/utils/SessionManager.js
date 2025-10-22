// src/utils/SessionManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial SessionManager - extracted from CoreEngine
//         - Handles all sessionStorage operations
//         - Save/restore/clear session context
//         - No dependencies on CoreEngine (pure utility)

const version = 'v0.1.0';
const SESSION_KEY = 'game_session';

class SessionManager {
  /**
   * Save session context to sessionStorage
   * @param {Object} context - Session data to save
   * @param {Object} context.user - User profile data
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
        user: context.user ? {
          id: context.user.id,
          game_name: context.user.game_name,
          type: context.user.id.startsWith('guest-') ? 'guest' : 'registered',
          email: context.user.email || null,
          total_games: context.user.total_games || 0,
          total_wins: context.user.total_wins || 0,
          total_score: context.user.total_score || 0,
          best_accuracy: context.user.best_accuracy || 0,
          total_ships_sunk: context.user.total_ships_sunk || 0,
          total_damage: context.user.total_damage || 0
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
      console.log('[SessionManager]', version, 'Session saved');
      return true;

    } catch (error) {
      console.error('[SessionManager]', version, 'Error saving session:', error);
      return false;
    }
  }

  /**
   * Restore session context from sessionStorage
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
      console.log('[SessionManager]', version, 'Session restored');
      
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
