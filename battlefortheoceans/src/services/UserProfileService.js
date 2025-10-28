// src/services/UserProfileService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.4: Added disableGameGuide method
// v0.1.3: Export singleton instance instead of class
//         - Fixes "getUserProfile is not a function" error in LoginDialog
//         - Methods are instance methods, not static methods
//         - Export instantiated service so components can call methods directly

import { supabase } from '../utils/supabaseClient';
import { Filter } from 'bad-words';

const version = "v0.1.4";

class UserProfileService {
    constructor() {
        this.version = version;
        this.profanityFilter = new Filter();
        
        // Add reserved system names
        this.profanityFilter.addWords('guest', 'ai', 'admin', 'moderator', 'mod', 'system');
        
        this.log('UserProfileService initialized');
    }
    
    /**
     * Get user profile by ID
     */
    async getUserProfile(userId) {
        try {
            const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('[SERVICE] UserProfileService: ', this.version, 'Error fetching user profile:', error);
            throw error;
        }
    }
    
    /**
     * Create new user profile
     */
    async createUserProfile(userId, gameName) {
        try {
            const validation = await this.validateGameName(gameName);
            
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            const { data, error } = await supabase
            .from('user_profiles')
            .insert([
                     {
                         id: userId,
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
            
            this.log(`Profile created for user ${userId} with name ${validation.gameName}`);
            return data;
        } catch (error) {
            console.error('[SERVICE] UserProfileService: ', this.version, 'Error creating user profile:', error);
            throw error;
        }
    }
    
    /**
     * Validate game name
     * Checks length, profanity, reserved words, and availability
     */
    async validateGameName(gameName) {
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
            console.error('[SERVICE] UserProfileService: ', this.version, 'Error checking name availability:', error);
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
        try {
            const { data, error } = await supabase
            .from('user_profiles')
            .select('id')
            .ilike('game_name', gameName)
            .limit(1);
            
            if (error) throw error;
            
            return !data || data.length === 0;
        } catch (error) {
            console.error('[SERVICE] UserProfileService: ', this.version, 'Error checking game name availability:', error);
            throw error;
        }
    }
    
    /**
     * Logging utility
     */
    log(message) {
        console.log(`[SERVICE] UserProfileService: ${version} ${message}`);
    }
    
    
    /**
     * Disable game guide auto-show for user
     * Sets show_game_guide = false in user_profiles
     */
    async disableGameGuide(userId) {
        // Skip database query for guest users
        if (!userId || userId.startsWith('guest-')) {
          console.log('[GUIDE] UserProfileService:', this.version, 'Guest user cannot disable game guide');
          return [];
        }

        console.log('[GUIDE] UserProfileService:', this.version, 'Disabling game guide for user:', userId);
        
        if (!userId || userId.startsWith('guest-')) {
            console.log('[GUIDE] UserProfileService:', this.version, 'Skipping game guide disable for guest user');
            return;
        }
        
        const { error } = await supabase
        .from('user_profiles')
        .update({ show_game_guide: false })
        .eq('id', userId);
        
        if (error) {
            console.error('[GUIDE] UserProfileService:', this.version, 'Error disabling game guide:', error);
            throw error;
        }
        
        console.log('[GUIDE] UserProfileService:', this.version, 'Game guide disabled successfully');
    }
}

// Export singleton instance (not class)
// This allows LoginDialog.js and other components to call methods directly:
// await UserProfileService.getUserProfile(userId)
const userProfileService = new UserProfileService();
export default userProfileService;
// EOF
