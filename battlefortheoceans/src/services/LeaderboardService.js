// src/services/LeaderboardService.js
// Copyright(c) 2025, Clint H. O'Connor

import { supabase } from '../utils/supabaseClient';

const version = "v0.1.1";

class LeaderboardService {
  constructor() {
    this.version = version;
    this.log('LeaderboardService initialized');
  }

  /**
   * Get leaderboard (top players by total score)
   * Excludes guest and AI players
   */
  async getLeaderboard(limit = 10) {
    try {
      console.log(version, 'Fetching leaderboard, limit:', limit);
      
      const { data: leaderboard, error } = await supabase
        .from('user_profiles')
        .select('game_name, total_score, total_wins, total_games, best_accuracy, total_ships_sunk')
        .not('id', 'like', 'guest-%')
        .not('id', 'like', 'ai-%')
        .order('total_score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error(version, 'Error fetching leaderboard:', error);
        return [];
      }

      console.log(version, 'Leaderboard fetched:', leaderboard.length, 'players');
      return leaderboard;

    } catch (error) {
      console.error(version, 'Failed to fetch leaderboard:', error);
      return [];
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
        .not('player_id', 'like', 'guest-%')
        .not('player_id', 'like', 'ai-%')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error(version, 'Error fetching recent champions:', error);
        return [];
      }

      return champions.map(champion => ({
        game_name: champion.user_profiles.game_name,
        era_name: champion.era_name,
        score: champion.score,
        date: champion.created_at
      }));

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

      const { count, error: countError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .gt('total_score', profile.total_score)
        .not('id', 'like', 'guest-%')
        .not('id', 'like', 'ai-%');

      if (countError) {
        console.error(version, 'Error calculating player ranking:', countError);
        return null;
      }

      return count + 1;

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

      const { count: totalPlayers, error } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .not('id', 'like', 'guest-%')
        .not('id', 'like', 'ai-%');

      if (error || !totalPlayers) {
        console.error(version, 'Error fetching total player count:', error);
        return null;
      }

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
