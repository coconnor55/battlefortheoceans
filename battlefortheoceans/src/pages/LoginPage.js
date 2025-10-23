// src/pages/LoginPage.js v0.3.8
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.8: Remove "Checking authentication..." intermediate UI
//         - Check still runs but doesn't show loading screen
//         - Smoother flow from email confirmation via LaunchPage
//         - Goes straight to profile creation without visual interruption
// v0.3.7: Check if user already authenticated on mount (from email confirmation)
//         Skip LoginDialog and go straight to profile check/creation

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../utils/supabaseClient';
import LoginDialog from '../components/LoginDialog';
import ProfileCreationDialog from '../components/ProfileCreationDialog';

const version = 'v0.3.8';

const LoginPage = () => {
  const { dispatch, events, getUserProfile } = useGame();
  
  const [authStep, setAuthStep] = useState('login'); // Start at 'login', not 'checking'
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // Don't show loading initially
  const [error, setError] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  // Check if user already authenticated (from email confirmation)
  useEffect(() => {
    const checkExistingAuth = async () => {
      console.log(version, 'Silently checking for existing authentication...');
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log(version, 'User already authenticated:', session.user.id);
          // User is authenticated, proceed to profile check
          await handleAuthenticatedUser(session.user);
        } else {
          console.log(version, 'No existing session, showing login dialog');
          setAuthStep('login');
        }
      } catch (err) {
        console.error(version, 'Error checking session:', err);
        setAuthStep('login');
      }
    };
    
    checkExistingAuth();
  }, []);

  // Check for showSignup flag in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signup') === 'true') {
      setShowSignup(true);
    }
  }, []);
  
  const handleAuthenticatedUser = async (userData) => {
    setAuthenticatedUser(userData);
    setIsLoading(true);
    
    try {
      // Check if guest user - bypass profile system
      if (userData.id.startsWith('guest-')) {
        console.log(version, 'Guest user detected, proceeding directly to game');
        await new Promise(resolve => setTimeout(resolve, 400));
        dispatch(events.SELECTERA, { userData });
        return;
      }
      
      // Check if registered user has a profile
      console.log(version, 'Checking for existing profile...');
      const profile = await getUserProfile(userData.id);
      
      if (profile && profile.game_name) {
        console.log(version, 'Existing profile found:', profile.game_name);
        await new Promise(resolve => setTimeout(resolve, 400));
        dispatch(events.SELECTERA, { userData });
      } else {
        console.log(version, 'No profile found, showing profile creation');
        setAuthStep('profile-creation');
        setIsLoading(false);
      }
    } catch (error) {
      console.error(version, 'Error during authentication flow:', error);
      setError(error.message || 'An unexpected error occurred');
      setAuthStep('login');
      setIsLoading(false);
    }
  };
  
  const handleLoginComplete = async (userData) => {
    if (userData) {
      console.log(version, 'User authenticated via LoginDialog:', userData.id);
      await handleAuthenticatedUser(userData);
    } else {
      console.log(version, 'Login dialog closed without authentication');
      handleReset();
    }
  };

  const handleProfileCreationComplete = async (profile) => {
    console.log(version, 'Profile creation completed:', profile.game_name);
    setIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    dispatch(events.SELECTERA, { userData: authenticatedUser });
    setIsLoading(false);
  };

  const handleReset = () => {
    console.log(version, 'Resetting authentication flow');
    setAuthStep('login');
    setAuthenticatedUser(null);
    setIsLoading(false);
    setError(null);
    setShowSignup(false);
  };

  console.log(version, 'Current state:', {
    authStep,
    hasUser: !!authenticatedUser,
    isLoading,
    hasError: !!error,
    showSignup
  });

  return (
    <div className="container flex flex-column flex-center">
      {authStep === 'login' && !isLoading && (
        <>
          <LoginDialog
            onClose={handleLoginComplete}
            showSignup={showSignup}
          />
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
      
      {isLoading && authStep !== 'login' && (
        <div className="content-pane content-pane--narrow">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <h2>Welcome!</h2>
            <p>Retrieving your profile...</p>
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
