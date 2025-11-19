// src/classes/PlayerProfile.js v0.1.1
// Copyright(c) 2025, Clint H. O'Connor
// Represents a player's persistent profile and cumulative statistics
// v0.1.1: Add pirate_fleets_sunk tracking for achievements
//         - Track pirate fleet victories in Pirates era
//         - Increments when player wins a game in Pirates era
//         - Used by AchievementService for pirate fleet achievements
// v0.1.0: Initial class creation

const version = "v0.1.1";
const tag = "PROFILE";
const module = "PlayerProfile";
let method = "";

class PlayerProfile {
  constructor(data = {}) {
      method = 'constructor';

      // Identity
    this.id = data.id || null;
    this.game_name = data.game_name || '';
    this.role = data.role || 'player';
    
    // Cumulative Statistics (career totals)
    this.total_games = data.total_games || 0;
    this.total_wins = data.total_wins || 0;
    this.total_score = data.total_score || 0;
    this.best_accuracy = data.best_accuracy || 0.0;
    this.total_ships_sunk = data.total_ships_sunk || 0;
    this.total_damage = data.total_damage || 0.0;
    
    // Era tracking
    this.eras_played = data.eras_played || [];
    this.eras_won = data.eras_won || [];
    this.pirate_fleets_sunk = data.pirate_fleets_sunk || 0;
    
    // UI Preferences
    this.show_game_guide = data.show_game_guide !== false;
    
    // System tracking
    this.incomplete_games = data.incomplete_games || 0;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
      
      // log creation
      this.log(module, ' initialized');
  }
  

    //  Logging
    log(message) {
        console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    }
    logerror(message) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
    }

    /**
   * Update profile with game results
   * @param {Object} gameResults - Results from completed game
   */
  applyGameResults(gameResults) {
    this.total_games += 1;
    this.total_wins += (gameResults.won ? 1 : 0);
    this.total_score += Math.round(gameResults.score);
    this.best_accuracy = Math.max(this.best_accuracy, gameResults.accuracy);
    this.total_ships_sunk += gameResults.ships_sunk;
    this.total_damage += gameResults.hits_damage;
    
    // Track era participation
    if (!this.eras_played.includes(gameResults.era_id)) {
      this.eras_played.push(gameResults.era_id);
    }
    
    if (gameResults.won && !this.eras_won.includes(gameResults.era_id)) {
      this.eras_won.push(gameResults.era_id);
    }
    
    // Track pirate fleets sunk (only for Pirates era wins)
    if (gameResults.won && gameResults.era_id === 'pirates') {
      this.pirate_fleets_sunk += 1;
    }
    
    this.updated_at = new Date().toISOString();
  }
  
  /**
   * Reset all statistics to zero
   */
  resetStats() {
    this.total_games = 0;
    this.total_wins = 0;
    this.total_score = 0;
    this.best_accuracy = 0.0;
    this.total_ships_sunk = 0;
    this.total_damage = 0.0;
    this.eras_played = [];
    this.eras_won = [];
    this.pirate_fleets_sunk = 0;
    this.updated_at = new Date().toISOString();
  }
  
  /**
   * Get database representation
   * @returns {Object} Plain object for database insert/update
   */
  toDatabase() {
    return {
      id: this.id,
      game_name: this.game_name,
      role: this.role,
      total_games: this.total_games,
      total_wins: this.total_wins,
      total_score: this.total_score,
      best_accuracy: this.best_accuracy,
      total_ships_sunk: this.total_ships_sunk,
      total_damage: this.total_damage,
      eras_played: this.eras_played,
      eras_won: this.eras_won,
      pirate_fleets_sunk: this.pirate_fleets_sunk,
      show_game_guide: this.show_game_guide,
      incomplete_games: this.incomplete_games,
      updated_at: this.updated_at
    };
  }
  
  /**
   * Check if this is a guest profile
   */
    get isAi() {
      return this.id?.startsWith('ai-');
    }

    get isGuest() {
      return this.id?.startsWith('guest-');
    }

    get isAdmin() {
      return this.role === 'admin';
    }

    get isDeveloper() {
      return this.role === 'developer';
    }

    get isTester() {
      return this.role === 'tester';
    }
}

export default PlayerProfile;
