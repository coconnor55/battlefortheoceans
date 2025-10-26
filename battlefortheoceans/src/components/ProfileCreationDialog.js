<<<<<<< HEAD
// src/components/ProfileCreationDialog.js v0.1.5
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.5: Add retry logic for auth.users timing issue
//         - Wait for user to be committed to auth.users before creating profile
//         - Retry up to 5 times with exponential backoff (1s, 2s, 3s...)
//         - Prevents foreign key constraint violation from email confirmation flow
=======
// src/components/ProfileCreationDialog.js v0.1.7
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.7: Create and return Player objects instead of profile objects
//          - Import HumanPlayer
//          - handleSubmit: Create HumanPlayer with profile, return player
//          - handleContinue: Create HumanPlayer with existing profile, return player
//          - Simplifies downstream flow: ProfileCreation → Player object → CoreEngine
// v0.1.6: Combined defensive check + retry logic
//          - Defensive: Check existing profile on mount, prevent overwrite
//          - Retry: Wait for auth.users with exponential backoff (5 attempts)
//          - Prevents foreign key constraint from email confirmation timing
//          - Shows read-only UI if user already has game_name
// v0.1.5: (my version) Defensive check for existing profile
// v0.1.5: (branch version) Retry logic for auth timing issue
>>>>>>> rollback-to-v0.5.5-plus-auth

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../utils/supabaseClient';
<<<<<<< HEAD

const version = 'v0.1.5';
=======
import HumanPlayer from '../classes/HumanPlayer';

const version = 'v0.1.7';
>>>>>>> rollback-to-v0.5.5-plus-auth

const ProfileCreationDialog = ({ userData, onComplete }) => {
  const { createUserProfile, getUserProfile } = useGame();
  
  const [gameName, setGameName] = useState('');
  const [existingProfile, setExistingProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Start true while checking
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
<<<<<<< HEAD
=======

  // Defensive check: Load existing profile on mount
  useEffect(() => {
    const checkExistingProfile = async () => {
      try {
        console.log(version, 'Checking for existing profile for user:', userData.id);
        const profile = await getUserProfile(userData.id);
        
        if (profile && profile.game_name) {
          console.log(version, 'DEFENSIVE: User already has game_name:', profile.game_name);
          setExistingProfile(profile);
        } else {
          console.log(version, 'No existing profile, allowing creation');
        }
      } catch (err) {
        console.error(version, 'Error checking profile:', err);
        // Continue to allow creation on error
      } finally {
        setIsLoading(false);
      }
    };
    
    checkExistingProfile();
  }, [userData.id, getUserProfile]);
>>>>>>> rollback-to-v0.5.5-plus-auth

  // Real-time validation
  const validateGameName = (name) => {
    if (!name || name.trim().length === 0) {
      return 'Game name is required';
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length < 3) {
      return 'Game name must be at least 3 characters';
    }
    
    if (trimmed.length > 32) {
      return 'Game name must be 32 characters or less';
    }
    
    // Allow alphanumeric, spaces, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validPattern.test(trimmed)) {
      return 'Game name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    
    return '';
  };

  const handleGameNameChange = (e) => {
    const value = e.target.value;
    setGameName(value);
    
    // Clear previous errors
    setError('');
    
    // Real-time validation
    const validation = validateGameName(value);
    setValidationError(validation);
  };

  // Check if user exists in auth.users
  const checkUserExists = async (userId) => {
    try {
<<<<<<< HEAD
      // Query auth.users via admin API or check session
=======
>>>>>>> rollback-to-v0.5.5-plus-auth
      const { data: { user } } = await supabase.auth.getUser();
      return user && user.id === userId;
    } catch (err) {
      console.error(version, 'Error checking user existence:', err);
      return false;
    }
  };

  // Retry profile creation with exponential backoff
  const createProfileWithRetry = async (userId, gameName, maxAttempts = 5) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(version, `Profile creation attempt ${attempt}/${maxAttempts}`);
      
      // Wait before attempting (exponential backoff: 1s, 2s, 3s, 4s, 5s)
      if (attempt > 1) {
        const waitTime = attempt * 1000;
        console.log(version, `Waiting ${waitTime}ms before retry...`);
        setStatusMessage(`Preparing your account... (${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        setStatusMessage('Creating your profile...');
        // Initial 1 second delay to let auth.users commit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Check if user exists in auth.users
      const userExists = await checkUserExists(userId);
      if (!userExists) {
        console.log(version, `User not yet in auth.users, attempt ${attempt}`);
        if (attempt === maxAttempts) {
          throw new Error('Account not fully initialized. Please try again in a moment.');
        }
        continue; // Retry
      }
      
      // Try to create profile
      try {
        console.log(version, 'User exists in auth.users, creating profile...');
        const profile = await createUserProfile(userId, gameName);
        console.log(version, 'Profile created successfully:', profile.game_name);
        return profile;
      } catch (err) {
        console.error(version, `Profile creation failed on attempt ${attempt}:`, err);
        
        // If it's a foreign key constraint error, retry
        if (err.message && err.message.includes('foreign key constraint')) {
          if (attempt === maxAttempts) {
            throw new Error('Unable to create profile. Please try again in a moment.');
          }
          continue; // Retry
        }
        
        // Other errors - don't retry
        throw err;
      }
    }
    
    throw new Error('Profile creation timed out. Please try again.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Defensive check: Prevent submission if profile exists
    if (existingProfile && existingProfile.game_name) {
      console.warn(version, 'DEFENSIVE: Blocked profile creation - user already has game_name');
      setError('You already have a game handle. You cannot change it.');
      return;
    }
    
    // Final validation
    const validation = validateGameName(gameName);
    if (validation) {
      setValidationError(validation);
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusMessage('Creating your profile...');
    
    try {
      console.log(version, 'Creating profile for user:', userData.id, 'with name:', gameName.trim());
      
      const profile = await createProfileWithRetry(userData.id, gameName.trim());
      
      if (profile) {
        console.log(version, 'Profile creation completed successfully');
<<<<<<< HEAD
        setStatusMessage('Success!');
        onComplete(profile);
=======
        setStatusMessage('Success! Creating player...');
        
        // Create HumanPlayer with profile
        const player = new HumanPlayer(
          userData.id,
          profile.game_name,
          'human',
          1.0,
          profile
        );
        
        console.log(version, 'HumanPlayer created:', player.name);
        
        // Return Player object
        onComplete(player);
>>>>>>> rollback-to-v0.5.5-plus-auth
      } else {
        setError('Failed to create profile. Please try again.');
        setStatusMessage('');
      }
    } catch (err) {
      console.error(version, 'Profile creation error:', err);
      setError(err.message || 'Failed to create profile. Please try again.');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    console.log(version, 'User continuing with existing profile:', existingProfile.game_name);
    
    // Create HumanPlayer with existing profile
    const player = new HumanPlayer(
      existingProfile.id,
      existingProfile.game_name,
      'human',
      1.0,
      existingProfile
    );
    
    console.log(version, 'HumanPlayer created from existing profile:', player.name);
    
    // Return Player object
    onComplete(player);
  };

  const canSubmit = gameName.trim().length >= 3 && !validationError && !isLoading;

  // Loading state while checking for existing profile
  if (isLoading && !existingProfile) {
    return (
      <div className="modal-overlay">
        <div className="card">
          <div className="card-body">
            <div className="loading">
              <div className="spinner spinner--lg"></div>
              <p>Checking your profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DEFENSIVE MODE: User already has a game_name
  if (existingProfile && existingProfile.game_name) {
    return (
      <div className="modal-overlay">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Welcome Back!</h2>
            <p className="card-subtitle">You already have a game handle.</p>
          </div>
          
          <div className="card-body">
            <div className="existing-profile-display">
              <label className="form-label">Your Game Handle</label>
              <div className="profile-name-display">
                {existingProfile.game_name}
              </div>
              <p className="text-muted text-sm">Game handles cannot be changed once created.</p>
            </div>
            
            <div className="form-actions">
              <button
                className="btn btn--primary btn--lg"
                onClick={handleContinue}
              >
                Continue to Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // NORMAL MODE: Create new profile
  return (
    <div className="modal-overlay">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Choose Your Game Handle</h2>
          <p className="card-subtitle">Welcome to Battle for the Oceans! Choose a unique name which other players will see and know you by. You will not be able to change it later.</p>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="gameName" className="form-label">Game Handle</label>
              <input
                id="gameName"
                type="text"
                className={`form-input ${validationError ? 'form-input--error' : ''}`}
                value={gameName}
                onChange={handleGameNameChange}
                placeholder="Enter your game handle..."
                maxLength="32"
                disabled={isLoading}
                autoFocus
              />
              
              <div className="character-count italics">
                {gameName.length}/32
              </div>
              
              <div className="input-rules italics">
                Letters, numbers, spaces, hyphens, and underscores only
              </div>
              
              {validationError && (
                <div className="form-error">{validationError}</div>
              )}
            </div>
            
            {statusMessage && (
              <div className="message message--info">{statusMessage}</div>
            )}
            
            {error && (
              <div className="message message--error">{error}</div>
            )}
            
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={!canSubmit}
              >
                {isLoading ? statusMessage : 'Create Game Handle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileCreationDialog;

// EOF
