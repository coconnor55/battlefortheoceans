// src/components/ProfileCreationDialog.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';

const version = 'v0.1.4';

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
            
            {error && (
              <div className="message--error">{error}</div>
            )}
            
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={!canSubmit}
              >
                {isLoading ? 'Creating Profile...' : 'Create Game Handle'}
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
