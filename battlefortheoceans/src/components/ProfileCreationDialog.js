// src/components/ProfileCreationDialog.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import './Dialog.css';

const version = 'v0.1.1';

const ProfileCreationDialog = ({ userData, onComplete }) => {
  const { createUserProfile } = useGame();
  
  const [gameName, setGameName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Final validation
    const validation = validateGameName(gameName);
    if (validation) {
      setValidationError(validation);
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log(version, 'Creating profile for user:', userData.id, 'with name:', gameName.trim());
      
      const profile = await createUserProfile(userData.id, gameName.trim());
      
      if (profile) {
        console.log(version, 'Profile created successfully:', profile.game_name);
        onComplete(profile);
      } else {
        setError('Failed to create profile. Please try again.');
      }
    } catch (err) {
      console.error(version, 'Profile creation error:', err);
      setError(err.message || 'Failed to create profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = gameName.trim().length >= 3 && !validationError && !isLoading;

  return (
    <div className="dialog-overlay">
      <div className="dialog-container profile-creation-dialog">
        <div className="dialog-header">
          <h2>Choose Your Game Handle</h2>
          <p>Welcome to Battle for the Oceans! Choose a unique name that other players will see.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="dialog-form">
          <div className="form-group">
            <label htmlFor="gameName">Game Handle</label>
            <input
              id="gameName"
              type="text"
              value={gameName}
              onChange={handleGameNameChange}
              placeholder="Enter your game handle..."
              maxLength="32"
              disabled={isLoading}
              className={validationError ? 'error' : ''}
              autoFocus
            />
            
            <div className="input-help">
              <div className="character-count">
                {gameName.length}/32 characters
              </div>
              <div className="input-rules">
                Letters, numbers, spaces, hyphens, and underscores only
              </div>
            </div>
            
            {validationError && (
              <div className="field-error">{validationError}</div>
            )}
          </div>
          
          {error && (
            <div className="form-error">{error}</div>
          )}
          
          <div className="dialog-actions">
            <button
              type="submit"
              className={`btn btn-primary ${!canSubmit ? 'disabled' : ''}`}
              disabled={!canSubmit}
            >
              {isLoading ? 'Creating Profile...' : '              Create Game Handle Profile'}
            </button>
          </div>
        </form>
        
        <div className="dialog-footer">
          <p className="privacy-note">
            Your game handle will be visible to other players in battles and leaderboards.
            Choose carefully - this cannot be changed later.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileCreationDialog;
// EOF

