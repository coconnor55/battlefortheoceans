// src/pages/LoginPage.js v0.3.5
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import LoginDialog from '../components/LoginDialog';
import ProfileCreationDialog from '../components/ProfileCreationDialog';

const version = 'v0.3.5';

const LoginPage = () => {
  const { dispatch, events, getUserProfile } = useGame();
  
  const [authStep, setAuthStep] = useState('login'); // 'login' | 'profile-creation' | 'complete'
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleLoginComplete = async (userData) => {
    if (userData) {
      console.log(version, 'User authenticated:', userData.id);
      setAuthenticatedUser(userData);
      setIsLoading(true);
      setError(null);
      
      try {
        // Check if this is a guest user - bypass profile system entirely
        if (userData.id.startsWith('guest-')) {
          console.log(version, 'Guest user detected, proceeding directly to game');
          
          // Minimum 1.5 second display for visual feedback
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          dispatch(events.SELECTERA, { userData });
          return;
        }
        
        // Check if registered user has a profile
        console.log(version, 'Checking for existing profile...');
        const profile = await getUserProfile(userData.id);
        
        if (profile && profile.game_name) {
          console.log(version, 'Existing profile found:', profile.game_name);
          // User has profile, proceed to game
          
          // Minimum 1.5 second display for visual feedback
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          dispatch(events.SELECTERA, { userData });
        } else {
          console.log(version, 'No profile found, requiring profile creation');
          // User needs to create profile
          setAuthStep('profile-creation');
        }
      } catch (error) {
        console.error(version, 'Error during login flow:', error);
        setError(error.message || 'An unexpected error occurred');
        setAuthStep('login');
        setIsLoading(false);
      }
    } else {
      console.log(version, 'Login dialog closed without authentication');
      // Reset if user cancels login
      handleReset();
    }
  };

  const handleProfileCreationComplete = async (profile) => {
    console.log(version, 'Profile creation completed:', profile.game_name);
    setIsLoading(true);
    
    // Minimum 1.5 second display for visual feedback
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Proceed to game with the authenticated user data
    dispatch(events.SELECTERA, { userData: authenticatedUser });
    setIsLoading(false);
  };

  const handleReset = () => {
    console.log(version, 'Resetting authentication flow');
    setAuthStep('login');
    setAuthenticatedUser(null);
    setIsLoading(false);
    setError(null);
  };

  // Debug logging for state changes
  console.log(version, 'Current state:', {
    authStep,
    hasUser: !!authenticatedUser,
    isLoading,
    hasError: !!error
  });

  return (
    <div className="container flex flex-column flex-center">
      {authStep === 'login' && !isLoading && (
        <>
          <LoginDialog onClose={handleLoginComplete} />
          {error && (
            <div className="content-pane content-pane--narrow mt-md">
              <p className="message message--error">{error}</p>
              <button className="btn btn--secondary" onClick={handleReset}>
                Try Again
              </button>
            </div>
          )}
        </>
      )}
      
      {isLoading && (
        <div className="content-pane content-pane--narrow">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <h2>Welcome!</h2>
            <p>Checking your profile...</p>
          </div>
        </div>
      )}
      
      {authStep === 'profile-creation' && authenticatedUser && !isLoading && (
        <ProfileCreationDialog
          userData={authenticatedUser}
          onComplete={handleProfileCreationComplete}
          onCancel={handleReset}
        />
      )}
    </div>
  );
};

export default LoginPage;

// EOF
