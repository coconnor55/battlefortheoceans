// src/services/AchievementService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.0: Refactored to use reward_type and reward_count instead of reward_passes
//         - Supports era-specific vouchers (e.g., 'pirates') via reward_type
//         - Pirate achievements now properly reward Pirates vouchers
// v0.2.4: Pirates achievement gives voucher instead of passes (if Pirates is exclusive)
// v0.2.3: Actually credit passes for achievements
// v0.2.2: Change progress value from decimal to integer
// v0.2.1: Added total_damage, eras_played, eras_won, pirate_fleets_sunk

import Player from '../classes/Player';
import { supabase } from '../utils/supabaseClient';
import RightsService from './RightsService';
import VoucherService from './VoucherService';
import ConfigLoader from '../utils/ConfigLoader';

const version = 'v0.3.0';

class AchievementService {
  constructor() {
    this.log('[ACHIEVEMENT]', 'AchievementService initialized');
  }

  log(...args) {
    console.log(`[ACHIEVEMENT] ${version}| AchievementService: `, ...args);
  }

  error(...args) {
    console.error(`[ACHIEVEMENT] ${version}| AchievementService: `, ...args);
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
   * @param {string} playerId - User ID
   * @returns {Promise<Object>} Achievement progress data
   */
  async getUserAchievements(playerId) {
    try {
        // skip if not current user
      // Skip for guest/AI users
      if (Player.isGuest(playerId) || Player.isAi(playerId)) {
        this.log('Skipping achievements for guest/AI:', playerId);
        return { unlocked: [], inProgress: [], locked: [], total: 0 };
      }

      this.log('Fetching achievements for user:', playerId);

      // Get all achievement definitions
      const allAchievements = await this.getAllAchievements();

      // Get user's achievement records
      const { data: userRecords, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('player_id', playerId);

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
   * @param {string} playerId - User ID
   * @param {string} achievementId - Achievement ID
   * @param {number} progress - Current progress value
   * @returns {Promise<Object>} Updated or created record
   */
  async updateProgress(playerId, achievementId, progress) {
    try {
      // Skip for guest/AI users
        if (Player.isGuest(playerId) || Player.isAi(playerId)) {
        return null;
      }

      this.log('Updating progress:', { playerId, achievementId, progress });

        // Round progress to integer for database storage
        const progressInt = Math.floor(progress);

      // Get achievement definition to check if unlocked
      const { data: achievement, error: achievementError } = await supabase
        .from('achievements')
        .select('requirement_value')
        .eq('id', achievementId)
        .single();

      if (achievementError) throw achievementError;

      const unlocked = progressInt >= achievement.requirement_value;

      // Upsert user achievement record
      const { data, error } = await supabase
        .from('user_achievements')
        .upsert({
          player_id: playerId,
          achievement_id: achievementId,
          progress: progressInt,
          unlocked: unlocked,
          unlocked_at: unlocked ? new Date().toISOString() : null
        }, {
          onConflict: 'player_id,achievement_id'
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
   * @param {string} playerId - User ID
   * @param {Object} gameResults - Game completion data
   * @returns {Promise<Array>} Newly unlocked achievements
   */
  async checkAchievements(playerId, gameResults) {
      console.log(`[ACHIEVEMENT] ${version}| AchievementService.checkAchievements parameters playerId=${playerId}, gameResults=${gameResults}`);
    try {
      // Skip for guest/AI users
        if (Player.isGuest(playerId) || Player.isAi(playerId)) {
        this.log('Skipping achievement check for guest/AI:', playerId);
        return [];
      }

      this.log('Checking achievements for user:', playerId);

      // Get user profile for lifetime stats
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', playerId)
        .single();

      if (profileError) throw profileError;

      // Get all achievements
      const allAchievements = await this.getAllAchievements();

      // Get current user achievements
      const { data: currentAchievements, error: currentError } = await supabase
        .from('user_achievements')
        .select('achievement_id, unlocked, progress')
        .eq('player_id', playerId);

      if (currentError) throw currentError;

      const newlyUnlocked = [];

      // Check each achievement
      for (const achievement of allAchievements) {
        const userRecord = currentAchievements?.find(r => r.achievement_id === achievement.id);

        // Skip if already unlocked
        if (userRecord?.unlocked) {
          continue;
        }

        // Filter by reward_type: era-specific achievements (reward_type = era name) only apply to that era
        // If reward_type is 'passes' or NULL, achievement applies to all eras
        if (achievement.reward_type && achievement.reward_type !== 'passes') {
          // reward_type is an era name (e.g., 'pirates') - only check this achievement for that era
          if (achievement.reward_type !== gameResults.era_id) {
            // This achievement is era-specific and doesn't match the current game era
            continue;
          }
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
            case 'total_damage':
              currentProgress = profile.total_damage || 0;
              break;
            case 'eras_played':
              // Count unique eras played (JSONB array length)
              currentProgress = profile.eras_played?.length || 0;
              break;
            case 'eras_won':
              // Count unique eras won (JSONB array length)
              currentProgress = profile.eras_won?.length || 0;
              break;
            case 'pirate_fleets_sunk':
              currentProgress = profile.pirate_fleets_sunk || 0;
              break;
            case 'alliance_size_defeated':
              // Check if current game defeated an alliance of required size
              if (gameResults.won && gameResults.opponents_defeated >= achievement.requirement_value) {
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

          // DEBUG: Log progress for total_games achievements
          if (achievement.requirement_type === 'total_games') {
            this.log(`DEBUG: ${achievement.id} - currentProgress: ${currentProgress}, requirement: ${achievement.requirement_value}, userRecord.progress: ${userRecord?.progress || 0}`);
          }

          // Update progress if changed
          if (currentProgress > (userRecord?.progress || 0)) {
            const updated = await this.updateProgress(playerId, achievement.id, currentProgress);
            
            // If newly unlocked, add to list
            if (updated?.unlocked && !userRecord?.unlocked) {
              newlyUnlocked.push(achievement);
              
              // Credit rewards if achievement has reward
              const rewardType = achievement.reward_type;
              const rewardCount = achievement.reward_count || 0;
                  
              if (rewardType && rewardCount > 0) {
                try {
                  if (rewardType === 'passes') {
                    // Credit generic passes
                  await RightsService.creditPasses(
                    playerId,
                      rewardCount,
                    'achievement',
                    {
                      achievement_id: achievement.id,
                      achievement_name: achievement.name
                    }
                  );
                    this.log(`Credited ${rewardCount} passes for achievement: ${achievement.name}`);
                  } else {
                    // rewardType is an era name (e.g., 'pirates') - generate era voucher
                    this.log(`Generating ${rewardCount} ${rewardType} voucher(s) for achievement: ${achievement.name}`);
                    const voucherCode = await VoucherService.generateVoucher(
                      rewardType, // era name (e.g., 'pirates')
                      rewardCount,
                      'achievement',
                      null, // created_by = null for system rewards
                      null, // emailSentTo = null
                      0, // rewardPasses not applicable for era vouchers
                      0, // signupBonus not applicable
                      playerId // created_for = player who earned the achievement
                    );
                    await VoucherService.redeemVoucher(playerId, voucherCode);
                    this.log(`Credited ${rewardCount} ${rewardType} voucher(s) for achievement: ${achievement.name}`);
                  }
                } catch (rewardError) {
                  this.error('Failed to credit reward for achievement:', rewardError);
                  // Don't throw - achievement was still unlocked
                }
              }
            }
          }      }

      this.log('New achievements unlocked:', newlyUnlocked.length);
      return newlyUnlocked;

    } catch (error) {
      this.error('Failed to check achievements:', error);
      throw error;
    }
  }

  /**
   * Get recently unlocked achievements (for notifications)
   * @param {string} playerId - User ID
   * @param {number} limit - Number of achievements to return
   * @returns {Promise<Array>} Recent achievements
   */
  async getRecentAchievements(playerId, limit = 5) {
    try {
      // Skip for guest/AI users
        if (Player.isGuest(playerId) || Player.isAi(playerId)) {
        return [];
      }

      this.log('Fetching recent achievements for user:', playerId);

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
        .eq('player_id', playerId)
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
   * @param {string} playerId - User ID
   * @returns {Promise<number>} Total points
   */
  async getTotalPoints(playerId) {
    try {
      // Skip for guest/AI users
        if (Player.isGuest(playerId) || Player.isAi(playerId)) {
        return 0;
      }

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          achievements (
            points
          )
        `)
        .eq('player_id', playerId)
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

// Export singleton instance (not class)
const achievementServiceSingleton = new AchievementService();
export default achievementServiceSingleton;

// EOF
