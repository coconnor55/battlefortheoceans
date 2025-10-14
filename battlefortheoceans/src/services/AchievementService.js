// src/services/AchievementService.js
// Copyright(c) 2025, Clint H. O'Connor

import { supabase } from '../utils/supabaseClient';

const version = 'v0.2.0';

class AchievementService {
  constructor() {
    this.log('[Constructor]', 'AchievementService initialized');
  }

  log(...args) {
    console.log('[ACHIEVEMENT]', version, ...args);
  }

  error(...args) {
    console.error('[ACHIEVEMENT]', version, ...args);
  }

  /**
   * Get all available achievements
   * @returns {Promise<Array>} Array of achievement definitions
   */
  async getAllAchievements() {
    try {
      this.log('Fetching all achievements');
      
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('points', { ascending: true }); // Bronze → Platinum

      if (error) throw error;

      this.log('Retrieved achievements:', data?.length || 0);
      return data || [];
      
    } catch (error) {
      this.error('Failed to get achievements:', error);
      throw error;
    }
  }

  /**
   * Get user's achievement progress
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Achievement progress data
   */
  async getUserAchievements(userId) {
    try {
      // Skip for guest/AI users
      if (userId.startsWith('guest-') || userId.startsWith('ai-')) {
        this.log('Skipping achievements for guest/AI:', userId);
        return { unlocked: [], inProgress: [], locked: [], total: 0 };
      }

      this.log('Fetching achievements for user:', userId);

      // Get all achievement definitions
      const allAchievements = await this.getAllAchievements();

      // Get user's achievement records
      const { data: userRecords, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      // Organize achievements by status
      const unlocked = [];
      const inProgress = [];
      const locked = [];

      for (const achievement of allAchievements) {
        const userRecord = userRecords?.find(r => r.achievement_id === achievement.id);

        if (userRecord?.unlocked) {
          // Achievement unlocked
          unlocked.push({
            ...achievement,
            unlocked_at: userRecord.unlocked_at,
            progress: userRecord.progress
          });
        } else if (userRecord && userRecord.progress > 0) {
          // Achievement in progress
          inProgress.push({
            ...achievement,
            current: userRecord.progress,
            target: achievement.requirement_value,
            percentage: Math.min(100, Math.round((userRecord.progress / achievement.requirement_value) * 100))
          });
        } else {
          // Achievement locked (not started)
          locked.push({
            ...achievement,
            current: 0,
            target: achievement.requirement_value,
            percentage: 0
          });
        }
      }

      const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);

      this.log('User achievements:', {
        unlocked: unlocked.length,
        inProgress: inProgress.length,
        locked: locked.length,
        total: allAchievements.length,
        points: totalPoints
      });

      return {
        unlocked,
        inProgress,
        locked,
        total: allAchievements.length,
        points: totalPoints
      };

    } catch (error) {
      this.error('Failed to get user achievements:', error);
      throw error;
    }
  }

  /**
   * Update achievement progress for user
   * @param {string} userId - User ID
   * @param {string} achievementId - Achievement ID
   * @param {number} progress - Current progress value
   * @returns {Promise<Object>} Updated or created record
   */
  async updateProgress(userId, achievementId, progress) {
    try {
      // Skip for guest/AI users
      if (userId.startsWith('guest-') || userId.startsWith('ai-')) {
        return null;
      }

      this.log('Updating progress:', { userId, achievementId, progress });

      // Get achievement definition to check if unlocked
      const { data: achievement, error: achievementError } = await supabase
        .from('achievements')
        .select('requirement_value')
        .eq('id', achievementId)
        .single();

      if (achievementError) throw achievementError;

      const unlocked = progress >= achievement.requirement_value;

      // Upsert user achievement record
      const { data, error } = await supabase
        .from('user_achievements')
        .upsert({
          user_id: userId,
          achievement_id: achievementId,
          progress: progress,
          unlocked: unlocked,
          unlocked_at: unlocked ? new Date().toISOString() : null
        }, {
          onConflict: 'user_id,achievement_id'
        })
        .select()
        .single();

      if (error) throw error;

      if (unlocked) {
        this.log('Achievement unlocked:', achievementId);
      }

      return data;

    } catch (error) {
      this.error('Failed to update progress:', error);
      throw error;
    }
  }

  /**
   * Check if user earned any achievements after a game
   * @param {string} userId - User ID
   * @param {Object} gameResults - Game completion data
   * @returns {Promise<Array>} Newly unlocked achievements
   */
  async checkAchievements(userId, gameResults) {
    try {
      // Skip for guest/AI users
      if (userId.startsWith('guest-') || userId.startsWith('ai-')) {
        this.log('Skipping achievement check for guest/AI:', userId);
        return [];
      }

      this.log('Checking achievements for user:', userId);

      // Get user profile for lifetime stats
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get all achievements
      const allAchievements = await this.getAllAchievements();

      // Get current user achievements
      const { data: currentAchievements, error: currentError } = await supabase
        .from('user_achievements')
        .select('achievement_id, unlocked, progress')
        .eq('user_id', userId);

      if (currentError) throw currentError;

      const newlyUnlocked = [];

      // Check each achievement
      for (const achievement of allAchievements) {
        const userRecord = currentAchievements?.find(r => r.achievement_id === achievement.id);

        // Skip if already unlocked
        if (userRecord?.unlocked) {
          continue;
        }

        // Calculate current progress based on requirement type
        let currentProgress = 0;
        
        switch (achievement.requirement_type) {
          case 'total_wins':
            currentProgress = profile.total_wins || 0;
            break;
          case 'total_games':
            currentProgress = profile.total_games || 0;
            break;
          case 'total_ships_sunk':
            currentProgress = profile.total_ships_sunk || 0;
            break;
          case 'accuracy':
            // Check if current game meets accuracy requirement
            if (gameResults.accuracy >= achievement.requirement_value) {
              currentProgress = achievement.requirement_value;
            }
            break;
          case 'turns':
            // Check if current game meets turn requirement
            if (gameResults.won && gameResults.turns <= achievement.requirement_value) {
              currentProgress = achievement.requirement_value;
            }
            break;
          case 'ships_sunk':
            // Per-game achievement (like "First Blood")
            if (gameResults.ships_sunk >= achievement.requirement_value) {
              currentProgress = achievement.requirement_value;
            }
            break;
          case 'win_streak':
            // TODO: Implement win streak tracking
            // For now, skip these achievements
            continue;
          case 'defeat_all_captains':
          case 'defeat_ai_hunt':
            // TODO: Implement captain tracking
            // For now, skip these achievements
            continue;
          default:
            this.log('Unknown requirement type:', achievement.requirement_type);
            continue;
        }

        // Update progress if changed
        if (currentProgress > (userRecord?.progress || 0)) {
          const updated = await this.updateProgress(userId, achievement.id, currentProgress);
          
          // If newly unlocked, add to list
          if (updated?.unlocked && !userRecord?.unlocked) {
            newlyUnlocked.push(achievement);
          }
        }
      }

      this.log('New achievements unlocked:', newlyUnlocked.length);
      return newlyUnlocked;

    } catch (error) {
      this.error('Failed to check achievements:', error);
      throw error;
    }
  }

  /**
   * Get recently unlocked achievements (for notifications)
   * @param {string} userId - User ID
   * @param {number} limit - Number of achievements to return
   * @returns {Promise<Array>} Recent achievements
   */
  async getRecentAchievements(userId, limit = 5) {
    try {
      // Skip for guest/AI users
      if (userId.startsWith('guest-') || userId.startsWith('ai-')) {
        return [];
      }

      this.log('Fetching recent achievements for user:', userId);

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          achievement_id,
          unlocked_at,
          achievements (
            id,
            name,
            description,
            badge_icon,
            points,
            tier
          )
        `)
        .eq('user_id', userId)
        .eq('unlocked', true)
        .order('unlocked_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      this.log('Recent achievements:', data?.length || 0);
      return data || [];

    } catch (error) {
      this.error('Failed to get recent achievements:', error);
      throw error;
    }
  }

  /**
   * Get total achievement points for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total points
   */
  async getTotalPoints(userId) {
    try {
      // Skip for guest/AI users
      if (userId.startsWith('guest-') || userId.startsWith('ai-')) {
        return 0;
      }

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          achievements (
            points
          )
        `)
        .eq('user_id', userId)
        .eq('unlocked', true);

      if (error) throw error;

      const totalPoints = data?.reduce((sum, record) => {
        return sum + (record.achievements?.points || 0);
      }, 0) || 0;

      this.log('Total achievement points:', totalPoints);
      return totalPoints;

    } catch (error) {
      this.error('Failed to get total points:', error);
      return 0;
    }
  }
}

// Export singleton instance
export default new AchievementService();

// EOF
