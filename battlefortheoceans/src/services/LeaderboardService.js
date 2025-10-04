
// src/services/LeaderboardService.js v0.1.5
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.5: Removed getTotalGamesPlayed() - moved to GameStatsService

import { supabase } from '../utils/supabaseClient';

const version = "v0.1.5";

class LeaderboardService {
  constructor() {
    this.version = version;
    this.log('LeaderboardService initialized');
  }

  /**
   * Get leaderboard (top players by total score)
   * Excludes guest and AI players - filtered in JavaScript since Supabase API doesn't support UUID::text casting
   */
  async getLeaderboard(limit = 10) {
    try {
      // Fetch more rows than needed to account for guest/AI filtering
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, game_name, total_score, total_wins, total_games, best_accuracy')
        .order('total_score', { ascending: false })
        .limit(limit * 3); // Get 3x to ensure enough after filtering

      if (error) throw error;
      
      // Filter out guests and AI in JavaScript
      const filtered = (data || []).filter(profile => {
        const idStr = String(profile.id);
        return !idStr.startsWith('guest-') && !idStr.startsWith('ai-');
      }).slice(0, limit);
      
      return filtered;
    } catch (error) {
      console.error('[LeaderboardService]', version, 'getLeaderboard error:', error);
      throw error;
    }
  }

  /**
   * Get recent champions (winners from last 30 days)
   * Excludes guest and AI players
   */
  async getRecentChampions(limit = 5) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: champions, error } = await supabase
        .from('game_results')
        .select(`
          player_id,
          era_name,
          score,
          created_at,
          user_profiles!inner(game_name, id)
        `)
        .eq('won', true)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('score', { ascending: false})
        .limit(limit * 3); // Get extra to account for filtering

      if (error) {
        console.error(version, 'Error fetching recent champions:', error);
        return [];
      }

      // Filter out guests and AI in JavaScript
      const filtered = (champions || [])
        .filter(champion => {
          const idStr = String(champion.player_id);
          return !idStr.startsWith('guest-') && !idStr.startsWith('ai-');
        })
        .slice(0, limit)
        .map(champion => ({
          game_name: champion.user_profiles.game_name,
          era_name: champion.era_name,
          score: champion.score,
          date: champion.created_at
        }));

      return filtered;

    } catch (error) {
      console.error(version, 'Failed to fetch recent champions:', error);
      return [];
    }
  }

  /**
   * Get player ranking by total score
   */
  async getPlayerRanking(userId) {
    // Skip ranking for guests/AI
    if (userId.startsWith('guest-') || userId.startsWith('ai-')) {
      return null;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('total_score')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        console.error(version, 'Error fetching player profile for ranking:', profileError);
        return null;
      }

      // Get all profiles with higher scores, then filter in JavaScript
      const { data: allProfiles, error } = await supabase
        .from('user_profiles')
        .select('id, total_score')
        .gt('total_score', profile.total_score)
        .order('total_score', { ascending: false });

      if (error) {
        console.error(version, 'Error calculating player ranking:', error);
        return null;
      }

      // Filter out guests and AI
      const filtered = (allProfiles || []).filter(p => {
        const idStr = String(p.id);
        return !idStr.startsWith('guest-') && !idStr.startsWith('ai-');
      });

      return filtered.length + 1;

    } catch (error) {
      console.error(version, 'Failed to get player ranking:', error);
      return null;
    }
  }

  /**
   * Get player percentile ranking
   */
  async getPlayerPercentile(userId) {
    // Skip percentile for guests/AI
    if (userId.startsWith('guest-') || userId.startsWith('ai-')) {
      return null;
    }

    try {
      const ranking = await this.getPlayerRanking(userId);
      if (!ranking) return null;

      // Get all profiles, filter in JavaScript
      const { data: allProfiles, error } = await supabase
        .from('user_profiles')
        .select('id')
        .order('total_score', { ascending: false });

      if (error) {
        console.error(version, 'Error fetching total player count:', error);
        return null;
      }

      // Filter out guests and AI
      const filtered = (allProfiles || []).filter(p => {
        const idStr = String(p.id);
        return !idStr.startsWith('guest-') && !idStr.startsWith('ai-');
      });

      const totalPlayers = filtered.length;
      if (!totalPlayers) return null;

      const percentile = Math.round(((totalPlayers - ranking + 1) / totalPlayers) * 100);
      return percentile;

    } catch (error) {
      console.error(version, 'Failed to calculate player percentile:', error);
      return null;
    }
  }

  /**
   * Logging utility
   */
  log(message) {
    console.log(`[LeaderboardService ${version}] ${message}`);
  }
}

export default LeaderboardService;
// EOF
