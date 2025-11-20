// src/services/GameStatsService.js v0.3.5
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.6: Improve error handling for game results insertion
//         - Throw errors instead of returning false so failures are visible
//         - Ensures game results are properly saved to Supabase
//         - Storage estimate: ~300 bytes per game result row
//           Supabase Pro tier (8GB database): ~27 million rows capacity
//           Even with 1000 active players @ 10 games/day = 3.65M/year
//           Well within Pro tier limits for many years
// v0.3.5: Refactored for PlayerProfile architecture
//         - Added insertGameResult() method for game_results table only
//         - Updated logging to match new pattern (tag, module, method)
//         - updateGameStats() marked as DEPRECATED (use PlayerProfile.applyGameResults + insertGameResult)
//         - Removed duplicate profile update logic (now handled by PlayerProfile class)
// v0.3.4: Three new stats: total_damage, eras_played, eras_won
// v0.3.3: Export singleton instance instead of class
//         - Matches pattern of PlayerProfileService, RightsService, AchievementService
//         - Services are stateless and should be shared singletons
//         - Simplifies usage in components and CoreEngine
// v0.3.2: CRITICAL FIX - Round scores to integers to match database schema
// v0.3.1: Added getTotalGamesPlayed() method

import { supabase } from '../utils/supabaseClient';

const version = "v0.3.6";
const tag = "SERVICE";
const module = "GameStatsService";
let method = "";

class GameStatsService {
  constructor() {
    method = 'constructor';
    this.version = version;
    this.log('initialized');
  }

  /**
   * Logging utilities
   */
  log(message) {
    console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
  }
  
  logerror(message, error) {
    console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
  }

  /**
   * Insert game result record into game_results table
   * Called after PlayerProfile.applyGameResults() and PlayerProfileService.save()
   *
   * @param {string} playerId - Player ID
   * @param {Object} gameResults - Game results from calculateGameResults()
   * @returns {Promise<boolean>} Success
   */
  async insertGameResults(playerId, gameResults) {
    method = 'insertGameResults';

    if (!playerId) {
      throw new Error('playerId is required');
    }

    if (!gameResults) {
      throw new Error('gameResults is required');
    }

    try {
      this.log(`Inserting game result for player ${playerId}`);
      
      const insertData = {
        player_id: playerId,
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
      };
      
      this.log(`Insert data: ${JSON.stringify(insertData)}`);

      const { data, error } = await supabase
        .from('game_results')
        .insert([insertData])
        .select();

      if (error) {
        this.logerror('Error inserting game result:', error);
        this.logerror(`Error details: code=${error.code}, message=${error.message}, details=${error.details}`);
        throw new Error(`Failed to insert game result: ${error.message}`);
      }

      if (data && data.length > 0) {
        const insertedId = data[0].id;
        this.log(`Game result inserted successfully with id: ${insertedId}`);
        
        // Verify the record is actually readable (RLS check)
        const { data: verifyData, error: verifyError } = await supabase
          .from('game_results')
          .select('id')
          .eq('id', insertedId)
          .eq('player_id', playerId)
          .single();
        
        if (verifyError) {
          this.logerror('RLS POLICY ISSUE: Insert succeeded but cannot read record back:', verifyError);
          this.logerror(`Verify error details: code=${verifyError.code}, message=${verifyError.message}`);
          throw new Error(`RLS policy prevents reading inserted record: ${verifyError.message}`);
        }
        
        if (!verifyData) {
          this.logerror('RLS POLICY ISSUE: Insert succeeded but record not found on read');
          throw new Error('RLS policy prevents reading inserted record - record not found');
        }
        
        this.log(`Verified: Record ${insertedId} is readable after insert`);
      } else {
        this.logerror('Insert returned no data - check RLS policies');
        throw new Error('Insert succeeded but no data returned - RLS policy may be blocking SELECT');
      }
      return true;

    } catch (error) {
      this.logerror('Failed to insert game result:', error);
      // Re-throw so caller can handle it
      throw error;
    }
  }

  /**
   * DEPRECATED: Use PlayerProfile.applyGameResults() + PlayerProfileService.save() + insertGameResult()
   *
   * Update game statistics after game completion
   * This method is kept for backward compatibility but should not be used in new code
   */
  async updateGameStats(playerProfile, gameResults) {
    method = 'updateGameStats';
    
    if (!playerProfile || !gameResults) {
      this.logerror('Cannot update stats without profile and results');
      return false;
    }

    try {
      this.log('DEPRECATED METHOD - use PlayerProfile.applyGameResults() instead');
      this.log('Updating game stats:', gameResults);

      const playerId = playerProfile?.id;
        
      // Track unique eras played and won for achievements
      const { data: existingStats } = await supabase
        .from('user_profiles')
        .select('eras_played, eras_won')
        .eq('id', playerId)
        .single();

      const erasPlayed = new Set(existingStats?.eras_played || []);
      erasPlayed.add(gameResults.era_id);

      const erasWon = new Set(existingStats?.eras_won || []);
      if (gameResults.won) {
        erasWon.add(gameResults.era_id);
      }
      
      // Calculate new totals - ROUND score to integer to match database schema
      const newTotalGames = playerProfile.total_games + 1;
      const newTotalWins = playerProfile.total_wins + (gameResults.won ? 1 : 0);
      const newTotalScore = playerProfile.total_score + Math.round(gameResults.score);
      const newBestAccuracy = Math.max(playerProfile.best_accuracy || 0, gameResults.accuracy);
      const newTotalShipsSunk = (playerProfile.total_ships_sunk || 0) + gameResults.ships_sunk;
      const newTotalDamage = (playerProfile.total_damage || 0) + gameResults.hits_damage;

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
          eras_played: Array.from(erasPlayed),
          eras_won: Array.from(erasWon),
          updated_at: new Date().toISOString()
        })
        .eq('id', playerId)
        .select()
        .single();
        
      if (profileError) {
        this.logerror('Error updating profile stats:', profileError);
        return false;
      }

      // Insert game result record
      const { error: resultError } = await supabase
        .from('game_results')
        .insert([{
          player_id: playerId,
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
        this.logerror('Error inserting game result:', resultError);
        // Profile was updated, so don't return false
      }

      this.log('Game stats updated successfully');
      return updatedProfile;

    } catch (error) {
      this.logerror('Failed to update game stats:', error);
      return false;
    }
  }

  /**
   * Get total games played across all players (from game_results table)
   * v0.3.1: Moved from LeaderboardService for better separation of concerns
   */
  async getTotalGamesPlayed() {
    method = 'getTotalGamesPlayed';

    try {
      // Get count of all game_results records (excludes guests/AI via player_id foreign key)
      const { count, error } = await supabase
        .from('game_results')
        .select('*', { count: 'exact', head: true });

      if (error) {
        this.logerror('Error fetching total games count:', error);
        return 0;
      }

      return count || 0;

    } catch (error) {
      this.logerror('Failed to get total games played:', error);
      return 0;
    }
  }

  /**
   * Calculate game results from game instance using standardized statistics
   */
  calculateGameResults(gameInstance, eraConfig, selectedOpponents) {
    method = 'calculateGameResults';

    if (!gameInstance) {
      this.logerror('Cannot calculate results without game instance');
      return null;
    }

    try {
      // Get final game stats
      const gameStats = gameInstance.getGameStats();
      const humanPlayer = gameInstance.players.find(p => p.type === 'human');
      
      if (!humanPlayer || !gameStats) {
        this.logerror('Cannot find human player or game stats');
        return null;
      }

      // Handle single opponent or array of opponents
      const selectedOpponent = Array.isArray(selectedOpponents)
        ? selectedOpponents[0]
        : selectedOpponents;

      // Use standardized statistics from Player.js
      const gameResults = {
        era_id: eraConfig?.id || 'unknown',
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

      this.log('Calculated game results');
      return gameResults;

    } catch (error) {
      this.logerror('Error calculating game results:', error);
      return null;
    }
  }

  /**
   * DEPRECATED: Use PlayerProfile.applyGameResults() + PlayerProfileService.save() + insertGameResult()
   * Record game completion (convenience method)
   */
  async recordGameCompletion(gameInstance, playerProfile, eraConfig, selectedOpponent) {
    method = 'recordGameCompletion';
    
    const gameResults = this.calculateGameResults(gameInstance, eraConfig, selectedOpponent);
    
    if (!gameResults) {
      this.logerror('Cannot record completion without valid game results');
      return false;
    }

    return await this.updateGameStats(playerProfile, gameResults);
  }
}

// Export singleton instance (not class)
const gameStatsServiceSingleton = new GameStatsService();
export default gameStatsServiceSingleton;
// EOF
