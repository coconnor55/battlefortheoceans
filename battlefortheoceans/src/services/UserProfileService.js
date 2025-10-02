// src/services/UserProfileService.js
// Copyright(c) 2025, Clint H. O'Connor

import { supabase } from '../utils/supabaseClient';
import { Filter } from 'bad-words';

const version = "v0.1.2";

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
      console.error(this.version, 'Error fetching user profile:', error);
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
      console.error(this.version, 'Error creating user profile:', error);
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
    
    if (trimmed.length > 20) {
      return {
        valid: false,
        error: 'Game name must be 20 characters or less'
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
      console.error(this.version, 'Error checking name availability:', error);
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
      console.error(this.version, 'Error checking game name availability:', error);
      throw error;
    }
  }

  /**
   * Logging utility
   */
  log(message) {
    console.log(`[UserProfileService ${version}] ${message}`);
  }
}

export default UserProfileService;
// EOF
