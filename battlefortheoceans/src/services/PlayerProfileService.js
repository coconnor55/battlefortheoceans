// src/services/PlayerProfileService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.7: Added save() method for persisting PlayerProfile instances
//         - Fixed template literal syntax errors throughout (backticks → parentheses)
//         - Removed duplicate guest check in disableGameGuide()
//         - Added save() method to persist PlayerProfile.toDatabase() to user_profiles table
//         - Supports the new PlayerProfile class architecture
// v0.1.6: Edited logging, messages
// v0.1.5: Added increment/decrement incomplete game counter
// v0.1.4: Added disableGameGuide method
// v0.1.3: Export singleton instance instead of class
//         - Fixes "getPlayerProfile is not a function" error in LoginDialog
//         - Methods are instance methods, not static methods
//         - Export instantiated service so components can call methods directly

import { supabase } from '../utils/supabaseClient';
import Player from '../classes/Player';
import { Filter } from 'bad-words';

const version = "v0.1.7";
const tag = "PROFILE";
const module = "PlayerProfileService";
let method = "";

class PlayerProfileService {
    constructor() {
        method = 'constructor';

        this.version = version;
        this.profanityFilter = new Filter();
        
        // Add reserved system names
        this.profanityFilter.addWords('guest', 'ai', 'admin', 'moderator', 'mod', 'system');
        
        this.log(module, 'initialized');
    }
    
    //  Logging
    log(message) {
        console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    }
    logerror(message) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
    }

//
//     Get user profile by ID
//
    async getPlayerProfile(playerId) {
        method = 'getPlayerProfile';

        // playerId check
        if (!playerId) {
            throw new Error(`[SERVICE] ${version} PlayerProfileService.${method} : Null or undefined playerId`);
        }
        try {
            const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', playerId)
            .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            this.logerror('Error fetching user profile:', error);
            throw error;
        }
    }
    
//
//  Create new user profile
//
    async createPlayerProfile(playerId, gameName) {
        method = 'createPlayerProfile';

        // playerId check
        if (!playerId) {
            throw new Error(`[SERVICE] ${version} PlayerProfileService.${method} : Null or undefined playerId`);
        }
        try {
            const validation = await this.validateGameName(gameName);
            
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            const { data, error } = await supabase
            .from('user_profiles')
            .insert([
                     {
                         id: playerId,
                         game_name: validation.gameName,
                         total_games: 0,
                         total_wins: 0,
                         total_score: 0,
                         best_accuracy: 0,
                         total_ships_sunk: 0,
                         total_damage: 0
                     }
                     ])
            .select()
            .single();
            
            if (error) throw error;
            
            this.log(`Profile created for player ${playerId} with name ${validation.gameName}`);
            return data;
        } catch (error) {
            this.logerror('Error creating user profile:', error);
            throw error;
        }
    }
    
    /**
     * Save/update player profile to database
     * Persists a PlayerProfile instance using its toDatabase() method
     *
     * @param {PlayerProfile} playerProfile - PlayerProfile instance to save
     * @returns {Promise<Object>} Updated profile data from database
     */
    async save(playerProfile) {
        method = 'save';

        if (!playerProfile) {
            throw new Error('Cannot save null playerProfile');
        }
        
        if (!playerProfile.id) {
            throw new Error('PlayerProfile must have an id to save');
        }
        
        try {
            this.log(`Saving profile for user ${playerProfile.id}`);
            
            const profileData = playerProfile.toDatabase();
            
            const { data, error } = await supabase
                .from('user_profiles')
                .update(profileData)
                .eq('id', playerProfile.id)
                .select()
                .single();
            
            if (error) throw error;
            
            this.log(`Profile saved successfully for user ${playerProfile.id}`);
            return data;
            
        } catch (error) {
            this.logerror('Error saving player profile:', error);
            throw error;
        }
    }
    
    /**
     * Validate game name
     * Checks length, profanity, reserved words, and availability
     */
    async validateGameName(gameName) {
        method = 'validateGameName';
        if (!gameName || typeof gameName !== 'string') {
            return {
                valid: false,
                error: 'Game name is required'
            };
        }
        
        const trimmed = gameName.trim();
        
        // Length validation
        if (trimmed.length < 3) {
            return {
                valid: false,
                error: 'Game name must be at least 3 characters'
            };
        }
        
        if (trimmed.length > 32) {
            return {
                valid: false,
                error: 'Game name must be 32 characters or less'
            };
        }
        
        // Profanity and reserved words check
        if (this.profanityFilter.isProfane(trimmed)) {
            return {
                valid: false,
                error: 'Please choose an appropriate name'
            };
        }
        
        // Check availability
        try {
            const isAvailable = await this.checkGameNameAvailability(trimmed);
            if (!isAvailable) {
                return {
                    valid: false,
                    error: 'This name is already taken'
                };
            }
        } catch (error) {
            this.logerror('Error checking game name availability:', error);
            return {
                valid: false,
                error: 'Unable to verify name availability'
            };
        }
        
        return {
            valid: true,
            gameName: trimmed
        };
    }
    
    /**
     * Check if game name is available
     */
    async checkGameNameAvailability(gameName) {
        method = 'checkGameNameAvailability';

        try {
            const { data, error } = await supabase
            .from('user_profiles')
            .select('id')
            .ilike('game_name', gameName)
            .limit(1);
            
            if (error) throw error;
            
            return !data || data.length === 0;
        } catch (error) {
            this.logerror('Error checking game name availability:', error);
            throw error;
        }
    }
    
    
    /**
     * Disable game guide auto-show for user
     * Sets show_game_guide = false in user_profiles
     */
    async disableGameGuide(playerId) {
        method = 'disableGameGuide';

        // Skip database query for guest users
        if (!playerId || Player.isGuest(playerId)) {
          this.log('Guest user cannot disable game guide');
          return [];
        }

        this.log('Disabling game guide for player:', playerId);
        
        const { error } = await supabase
        .from('user_profiles')
        .update({ show_game_guide: false })
        .eq('id', playerId);
        
        if (error) {
            this.logerror('Error disabling game guide:', error);
            throw error;
        }
        
        this.log('Game guide disabled successfully');
    }
    
    /**
     * Increment incomplete_games counter when game starts
     * Called by GameLifecycleManager.startGame()
     *
     * @param {string} playerId - User ID
     */
    async incrementIncompleteGames(playerId) {
        method = 'incrementIncompleteGames';

        // playerId check
        if (!playerId) {
            throw new Error(`[SERVICE] ${version} PlayerProfileService.${method} : Null or undefined playerId`);
        }
      try {
        // First get current value
        const { data: profile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('incomplete_games')
          .eq('id', playerId)
          .single();

        if (fetchError) {
          this.logerror('Error fetching incomplete_games:', fetchError);
          return;
        }

        // Increment by 1
        const newValue = (profile?.incomplete_games || 0) + 1;

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ incomplete_games: newValue })
          .eq('id', playerId);

        if (updateError) {
          this.logerror('Error incrementing incomplete_games:', updateError);
        } else {
          this.log(`Incremented incomplete_games to ${newValue} for user ${playerId}`);
        }
      } catch (error) {
        this.logerror('Exception incrementing incomplete_games:', error);
      }
    }

    /**
     * Decrement incomplete_games counter when game ends
     * Called by GameLifecycleManager.endGame()
     *
     * @param {string} playerId - User ID
     */
    async decrementIncompleteGames(playerId) {
        method = 'decrementIncompleteGames';

        // playerId check
        if (!playerId) {
            throw new Error(`[SERVICE] ${version} PlayerProfileService.${method} : Null or undefined playerId`);
        }
      try {
        // First get current value
        const { data: profile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('incomplete_games')
          .eq('id', playerId)
          .single();

        if (fetchError) {
          this.logerror('Error fetching incomplete_games:', fetchError);
          return;
        }

        // Decrement by 1 (don't go below 0)
        const newValue = Math.max((profile?.incomplete_games || 0) - 1, 0);

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ incomplete_games: newValue })
          .eq('id', playerId);

        if (updateError) {
          this.logerror('Error decrementing incomplete_games:', updateError);
        } else {
          this.log(`Decremented incomplete_games to ${newValue} for user ${playerId}`);
        }
      } catch (error) {
        this.logerror('Exception decrementing incomplete_games:', error);
      }
    }
    
    /**
     * Reset user's own scores and achievements to zero
     * Admin-only function (client checks role before calling)
     * @param {string} playerId - User ID to reset
     * @returns {Promise<boolean>} Success
     */
    async resetOwnProgress(playerId) {
        method = 'resetOwnProgress';

        // playerId check
        if (!playerId) {
            throw new Error(`[SERVICE] ${version} PlayerProfileService.${method} : Null or undefined playerId`);
        }
      try {
        // Reset user_profiles
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            total_games: 0,
            total_wins: 0,
            total_score: 0,
            best_accuracy: 0.00,
            total_ships_sunk: 0,
            total_damage: 0.00,
            updated_at: new Date().toISOString()
          })
          .eq('id', playerId);

        if (profileError) throw profileError;
          this.log('Reset user_profiles');

        // Delete all game_results for this user
        const { error: resultsError } = await supabase
          .from('game_results')
          .delete()
          .eq('player_id', playerId);

        if (resultsError) throw resultsError;
          this.log('Reset game_results');

        // Delete all achievements for this user
        const { error: achievementsError } = await supabase
          .from('user_achievements')
          .delete()
          .eq('player_id', playerId);

        if (achievementsError) throw achievementsError;
          this.log('Reset user_achievements');

          // DELETE all user_rights for this user  ← ADD THIS BLOCK
          const { error: rightsError } = await supabase
            .from('user_rights')
            .delete()
            .eq('user_id', playerId);

          if (rightsError) throw rightsError;
            this.log('Reset user_rights');

          this.log('Reset progress for player:', playerId);
          return true;        this.log('Reset progress for player:', playerId);
        return true;

      } catch (error) {
        this.logerror('Error resetting progress:', error);
        throw error;
      }
    }
}

// Export singleton instance (not class)
// This allows LoginDialog.js and other components to call methods directly:
// await PlayerProfileService.getPlayerProfile(playerId)
const playerProfileServiceSingleton = new PlayerProfileService();
export default playerProfileServiceSingleton;
// EOF
