// src/pages/LoginPage.js v0.3.13
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.13: SINGLETON PATTERN - Set coreEngine.humanPlayer directly
//          - Added coreEngine from useGame()
//          - Set coreEngine.humanPlayer = player before dispatch
//          - Removed player from all dispatch() calls (4 places)
//          - Guest flow, registered flow, continue flow, profile creation
//          - CoreEngine.userProfile getter reads from humanPlayer.userProfile
// v0.3.12: FIX - Create Player object in checkExistingAuth for welcome-back flow
// v0.3.11: Use player singleton pattern correctly
// v0.3.10: Call coreEngine.logout() on logout to clear all game state

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../utils/supabaseClient';
import LoginDialog from '../components/LoginDialog';
import ProfileCreationDialog from '../components/ProfileCreationDialog';
import HumanPlayer from '../classes/HumanPlayer';

const version = 'v0.3.13';

const LoginPage = () => {
  const { coreEngine, dispatch, events, getUserProfile, logout } = useGame();
  
  const [authStep, setAuthStep] = useState('login');
  const [authenticatedUser, setAuthenticatedUser] = useState(null); // Supabase user object
  const [authenticatedPlayer, setAuthenticatedPlayer] = useState(null); // Player instance
  const [existingProfile, setExistingProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  // Check if user already authenticated (from email confirmation or existing session)
  useEffect(() => {
    const checkExistingAuth = async () => {
      console.log('[LOGIN]', version, 'Checking for existing authentication...');
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('[LOGIN]', version, 'User authenticated:', session.user.id);
          
          // Check if user has profile
          const profile = await getUserProfile(session.user.id);
          
          if (!profile || !profile.game_name) {
            // New user (from signup) - no profile yet
            console.log('[LOGIN]', version, 'No profile found - routing to ProfileCreation');
            setAuthenticatedUser(session.user);
            setAuthStep('profile-creation');
          } else {
            // Existing user with profile - CREATE PLAYER OBJECT
            console.log('[LOGIN]', version, 'Profile found - creating Player for welcome back:', profile.game_name);
            
            const player = new HumanPlayer(
              session.user.id,
              profile.game_name,
              'human',
              1.0,
              profile
            );
            
            console.log('[LOGIN]', version, 'Player created for welcome-back:', player.name);
              console.log('[LOGIN] DEBUG - Player set on CoreEngine:', player.name);
              console.log('[LOGIN] DEBUG - Player.userProfile:', player.userProfile);
            setAuthenticatedUser(session.user);
              
            setAuthenticatedPlayer(player);
            setExistingProfile(profile);
            setAuthStep('login'); // LoginDialog will show welcome mode
          }
        } else {
          console.log('[LOGIN]', version, 'No existing session, showing login dialog');
          setAuthStep('login');
        }
      } catch (err) {
        console.error('[LOGIN]', version, 'Error checking session:', err);
        setAuthStep('login');
      }
    };
    
    checkExistingAuth();
  }, [getUserProfile]);

  // Check for showSignup flag in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signup') === 'true') {
      setShowSignup(true);
    }
  }, []);
  
  const handleAuthenticatedPlayer = async (player) => {
    console.log('[LOGIN]', version, 'Player authenticated:', player.name, 'ID:', player.id);
    setAuthenticatedPlayer(player);
    setIsLoading(true);
    
    try {
      // v0.3.13: Set CoreEngine singleton directly
      coreEngine.humanPlayer = player;
      console.log('[LOGIN]', version, 'Set coreEngine.humanPlayer =', player.name);
        console.log('[LOGIN] DEBUG - Player set on CoreEngine:', player.name);
        console.log('[LOGIN] DEBUG - Player.userProfile:', player.userProfile);
        
      // Check if guest user
      if (player.id.startsWith('guest-')) {
        console.log('[LOGIN]', version, 'Guest player detected, proceeding directly to game');
      } else {
        console.log('[LOGIN]', version, 'Registered player, proceeding to era selection');
      }
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // v0.3.13: Dispatch with NO data (player already in CoreEngine)
      dispatch(events.SELECTERA);
      
    } catch (error) {
      console.error('[LOGIN]', version, 'Error during authentication flow:', error);
      setError(error.message || 'An unexpected error occurred');
      setAuthStep('login');
      setIsLoading(false);
    }
  };
  
  const handleLoginComplete = async (player) => {
    if (player) {
      console.log('[LOGIN]', version, 'Player received from LoginDialog:', player.name);
      await handleAuthenticatedPlayer(player);
    } else {
      console.log('[LOGIN]', version, 'Login dialog closed without authentication');
      handleReset();
    }
  };

  const handleContinue = () => {
    console.log('[LOGIN]', version, 'User continuing with existing profile:', existingProfile.game_name);
    
    if (authenticatedPlayer) {
      console.log('[LOGIN]', version, 'Using existing Player object:', authenticatedPlayer.name);
      
      // v0.3.13: Set CoreEngine singleton directly
      coreEngine.humanPlayer = authenticatedPlayer;
      console.log('[LOGIN]', version, 'Set coreEngine.humanPlayer =', authenticatedPlayer.name);
      
      // v0.3.13: Dispatch with NO data
      dispatch(events.SELECTERA);
    } else {
      console.error('[LOGIN]', version, 'ERROR: No Player object available for continue');
      setError('Unable to continue. Please try logging in again.');
    }
  };

  const handleLogout = async () => {
    console.log('[LOGIN]', version, 'User logging out - clearing all state');
    
    // Clear CoreEngine state and session storage
    logout();
    
    // Clear Supabase auth session
    await supabase.auth.signOut();
    
    console.log('[LOGIN]', version, 'Logout complete');
    // No need to dispatch LAUNCH - logout() already transitions to 'launch'
  };

  const handleProfileCreationComplete = async (player) => {
    console.log('[LOGIN]', version, 'Profile creation completed, Player:', player.name);
    setIsLoading(true);
    
    // v0.3.13: Set CoreEngine singleton directly
    coreEngine.humanPlayer = player;
    console.log('[LOGIN]', version, 'Set coreEngine.humanPlayer =', player.name);
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // v0.3.13: Dispatch with NO data
    dispatch(events.SELECTERA);
    setIsLoading(false);
  };

  const handleReset = () => {
    console.log('[LOGIN]', version, 'Resetting authentication flow');
    setAuthStep('login');
    setAuthenticatedUser(null);
    setAuthenticatedPlayer(null);
    setExistingProfile(null);
    setIsLoading(false);
    setError(null);
    setShowSignup(false);
  };

  console.log('[LOGIN]', version, 'Current state:', {
    authStep,
    hasUser: !!authenticatedUser,
    hasPlayer: !!authenticatedPlayer,
    hasProfile: !!existingProfile,
    isLoading,
    hasError: !!error,
    showSignup
  });

  return (
    <div className="container flex flex-column flex-center">
      {authStep === 'login' && !isLoading && (
        <>
          <LoginDialog
            existingUser={authenticatedUser}
            existingProfile={existingProfile}
            onClose={handleLoginComplete}
            onContinue={handleContinue}
            onLogout={handleLogout}
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
