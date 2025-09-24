// src/services/GameStatsService.js
// Copyright(c) 2025, Clint H. O'Connor

import { supabase } from '../utils/supabaseClient';

const version = "v0.1.0";

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
      
      // Calculate new totals
      const newTotalGames = userProfile.total_games + 1;
      const newTotalWins = userProfile.total_wins + (gameResults.won ? 1 : 0);
      const newTotalScore = userProfile.total_score + gameResults.score;
      const newBestAccuracy = Math.max(userProfile.best_accuracy, gameResults.accuracy);
      const newTotalShipsSunk = userProfile.total_ships_sunk + (gameResults.ships_sunk || 0);
      const newTotalDamage = userProfile.total_damage + gameResults.damage_dealt;

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

      // Insert game result record
      const { error: resultError } = await supabase
        .from('game_results')
        .insert([{
          player_id: userId,
          era_name: gameResults.era_name,
          opponent_type: gameResults.opponent_type,
          opponent_name: gameResults.opponent_name,
          won: gameResults.won,
          score: gameResults.score,
          accuracy: gameResults.accuracy,
          damage_dealt: gameResults.damage_dealt,
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
   * Calculate game results from game instance
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

      // Extract ships sunk count
      const aiPlayer = gameInstance.players.find(p => p.type === 'ai');
      const shipsSunk = aiPlayer ? (aiPlayer.initialShipCount || 0) - (aiPlayer.shipsRemaining || 0) : 0;
      
      // Calculate duration in seconds
      const duration = gameStats.duration ? Math.floor(gameStats.duration / 1000) : 0;
      
      const gameResults = {
        era_name: eraConfig?.name || 'Unknown',
        opponent_type: 'ai',
        opponent_name: selectedOpponent?.name || 'Unknown',
        won: gameStats.winner === humanPlayer.name,
        score: humanPlayer.score || 0,
        accuracy: humanPlayer.accuracy || 0,
        damage_dealt: humanPlayer.shotDamage || 0,
        ships_sunk: shipsSunk,
        turns: gameStats.totalTurns || 0,
        duration_seconds: duration
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
