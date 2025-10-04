// src/services/GameStatsService.js v0.3.2
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.2: CRITICAL FIX - Round scores to integers to match database schema
// v0.3.1: Added getTotalGamesPlayed() method

import { supabase } from '../utils/supabaseClient';

const version = "v0.3.2";

class GameStatsService {
  constructor() {
    this.version = version;
    this.log('GameStatsService initialized');
  }

  /**
   * Update game statistics after game completion
   */
  async updateGameStats(userProfile, gameResults) {
    if (!userProfile || !gameResults) {
      console.error(version, 'Cannot update stats without profile and results');
      return false;
    }

    try {
      console.log(version, 'Updating game stats:', gameResults);

      const userId = userProfile.id;
      
      // Calculate new totals - ROUND score to integer to match database schema
      const newTotalGames = userProfile.total_games + 1;
      const newTotalWins = userProfile.total_wins + (gameResults.won ? 1 : 0);
      const newTotalScore = userProfile.total_score + Math.round(gameResults.score);
      const newBestAccuracy = Math.max(userProfile.best_accuracy || 0, gameResults.accuracy);
      const newTotalShipsSunk = (userProfile.total_ships_sunk || 0) + gameResults.ships_sunk;
      const newTotalDamage = (userProfile.total_damage || 0) + gameResults.hits_damage;

      // Update user_profiles table
      const { data: updatedProfile, error: profileError } = await supabase
        .from('user_profiles')
        .update({
          total_games: newTotalGames,
          total_wins: newTotalWins,
          total_score: newTotalScore,
          best_accuracy: newBestAccuracy,
          total_ships_sunk: newTotalShipsSunk,
          total_damage: newTotalDamage,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (profileError) {
        console.error(version, 'Error updating profile stats:', profileError);
        return false;
      }

      // Insert game result record - also round score here for consistency
      const { error: resultError } = await supabase
        .from('game_results')
        .insert([{
          player_id: userId,
          era_name: gameResults.era_name,
          opponent_type: gameResults.opponent_type,
          opponent_name: gameResults.opponent_name,
          won: gameResults.won,
          shots: gameResults.shots,
          hits: gameResults.hits,
          misses: gameResults.misses,
          sunk: gameResults.ships_sunk,
          hits_damage: gameResults.hits_damage,
          score: Math.round(gameResults.score),
          accuracy: gameResults.accuracy,
          turns: gameResults.turns,
          duration_seconds: gameResults.duration_seconds
        }]);

      if (resultError) {
        console.error(version, 'Error inserting game result:', resultError);
        // Profile was updated, so don't return false
      }

      console.log(version, 'Game stats updated successfully');
      return updatedProfile;

    } catch (error) {
      console.error(version, 'Failed to update game stats:', error);
      return false;
    }
  }

  /**
   * Get total games played across all players (from game_results table)
   * v0.3.1: Moved from LeaderboardService for better separation of concerns
   */
  async getTotalGamesPlayed() {
    try {
      // Get count of all game_results records (excludes guests/AI via player_id foreign key)
      const { count, error } = await supabase
        .from('game_results')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(version, 'Error fetching total games count:', error);
        return 0;
      }

      return count || 0;

    } catch (error) {
      console.error(version, 'Failed to get total games played:', error);
      return 0;
    }
  }

  /**
   * Calculate game results from game instance using standardized statistics
   */
  calculateGameResults(gameInstance, eraConfig, selectedOpponent) {
    if (!gameInstance) {
      console.error(version, 'Cannot calculate results without game instance');
      return null;
    }

    try {
      // Get final game stats
      const gameStats = gameInstance.getGameStats();
      const humanPlayer = gameInstance.players.find(p => p.type === 'human');
      
      if (!humanPlayer || !gameStats) {
        console.error(version, 'Cannot find human player or game stats');
        return null;
      }

      // Use standardized statistics from Player.js
      const gameResults = {
        era_name: eraConfig?.name || 'Unknown',
        opponent_type: 'ai',
        opponent_name: selectedOpponent?.name || 'Unknown',
        won: gameStats.winner === humanPlayer.name,
        shots: humanPlayer.shots || 0,              // hits + misses
        hits: humanPlayer.hits || 0,                // successful shots
        misses: humanPlayer.misses || 0,            // missed shots
        ships_sunk: humanPlayer.sunk || 0,          // ships sunk by player
        hits_damage: humanPlayer.hitsDamage || 0.0, // cumulative damage dealt
        score: humanPlayer.score || 0,              // calculated game score (may have decimals)
        accuracy: parseFloat(humanPlayer.accuracy) || 0,  // computed from hits/shots
        turns: gameStats.totalTurns || 0,
        duration_seconds: gameStats.duration || 0
      };

      console.log(version, 'Calculated game results:', gameResults);
      return gameResults;

    } catch (error) {
      console.error(version, 'Error calculating game results:', error);
      return null;
    }
  }

  /**
   * Record game completion (convenience method)
   */
  async recordGameCompletion(gameInstance, userProfile, eraConfig, selectedOpponent) {
    const gameResults = this.calculateGameResults(gameInstance, eraConfig, selectedOpponent);
    
    if (!gameResults) {
      console.error(version, 'Cannot record completion without valid game results');
      return false;
    }

    return await this.updateGameStats(userProfile, gameResults);
  }

  /**
   * Logging utility
   */
  log(message) {
    console.log(`[GameStatsService ${version}] ${message}`);
  }
}

export default GameStatsService;
// EOF
