// src/services/UserProfileService.js
// Copyright(c) 2025, Clint H. O'Connor

import { supabase } from '../utils/supabaseClient';

const version = "v0.1.0";

class UserProfileService {
  constructor() {
    this.version = version;
    this.log('UserProfileService initialized');
  }

  /**
   * Get user profile by UUID
   */
  async getUserProfile(userId) {
    if (!userId) {
      console.error(version, 'Cannot get profile without user ID');
      return null;
    }

    try {
      console.log(version, 'Fetching user profile for:', userId);
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error(version, 'Error fetching user profile:', error);
        return null;
      }

      if (profile) {
        console.log(version, 'Found existing profile:', profile.game_name);
        return profile;
      }

      console.log(version, 'No profile found for user:', userId);
      return null;

    } catch (error) {
      console.error(version, 'Failed to fetch user profile:', error);
      return null;
    }
  }

  /**
   * Create new user profile
   */
  async createUserProfile(userId, gameName) {
    if (!userId || !gameName) {
      console.error(version, 'Cannot create profile without user ID and game name');
      return null;
    }

    // Validate game name
    if (gameName.length < 3 || gameName.length > 32) {
      throw new Error('Game name must be between 3 and 32 characters');
    }

    try {
      console.log(version, 'Creating user profile:', { userId, gameName });
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .insert([{
          id: userId,
          game_name: gameName.trim(),
          total_games: 0,
          total_wins: 0,
          total_score: 0,
          best_accuracy: 0.00,
          total_ships_sunk: 0,
          total_damage: 0.00
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('Game name already taken');
        }
        console.error(version, 'Error creating user profile:', error);
        throw new Error('Failed to create profile');
      }

      console.log(version, 'Profile created successfully:', profile.game_name);
      return profile;

    } catch (error) {
      console.error(version, 'Failed to create user profile:', error);
      throw error;
    }
  }

  /**
   * Validate game name format
   */
  validateGameName(gameName) {
    if (!gameName || typeof gameName !== 'string') {
      return { valid: false, error: 'Game name is required' };
    }

    const trimmed = gameName.trim();
    
    if (trimmed.length < 3) {
      return { valid: false, error: 'Game name must be at least 3 characters' };
    }

    if (trimmed.length > 32) {
      return { valid: false, error: 'Game name must be 32 characters or less' };
    }

    // Allow alphanumeric, spaces, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validPattern.test(trimmed)) {
      return { valid: false, error: 'Game name can only contain letters, numbers, spaces, hyphens, and underscores' };
    }

    return { valid: true, trimmed };
  }

  /**
   * Check if game name is available
   */
  async checkGameNameAvailability(gameName) {
    const validation = this.validateGameName(gameName);
    if (!validation.valid) {
      return { available: false, error: validation.error };
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('game_name')
        .eq('game_name', validation.trimmed)
        .single();

      if (error && error.code === 'PGRST116') {
        // Not found = available
        return { available: true };
      }

      if (error) {
        console.error(version, 'Error checking game name availability:', error);
        return { available: false, error: 'Unable to check availability' };
      }

      // Found existing name
      return { available: false, error: 'Game name already taken' };

    } catch (error) {
      console.error(version, 'Failed to check game name availability:', error);
      return { available: false, error: 'Unable to check availability' };
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

