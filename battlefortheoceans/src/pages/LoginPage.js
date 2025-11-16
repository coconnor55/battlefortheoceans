// src/pages/LoginPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.16: Refactored for PlayerProfile architecture
//          - Import PlayerProfile class
//          - Wrap profile data in PlayerProfile instance (3 places)
//          - Remove profile parameter from HumanPlayer constructor (3 places)
//          - Set coreEngine.playerProfile separately from humanPlayer (3 places)
//          - Updated logging to match new pattern (tag, module, method)
// v0.3.15: Set Player and PlayerProfile separately in CoreEngine
// v0.3.14: Store user email in CoreEngine on login
//          - Set coreEngine.userEmail in handleAuthenticatedPlayer
//          - Set coreEngine.userEmail in handleContinue
//          - Set coreEngine.userEmail in handleProfileCreationComplete
//          - Makes email available throughout app without repeated Supabase calls
// v0.3.13: SINGLETON PATTERN - Set coreEngine.player directly
//          - Added coreEngine from useGame()
//          - Set coreEngine.player = player before dispatch
//          - Removed player from all dispatch() calls (4 places)
//          - Guest flow, registered flow, continue flow, profile creation
//          - CoreEngine.playerProfile getter reads from humanPlayer.playerProfile
// v0.3.12: FIX - Create Player object in checkExistingAuth for welcome-back flow
// v0.3.11: Use player singleton pattern correctly
// v0.3.10: Call coreEngine.logout() on logout to clear all game state

import React, { useState, useEffect } from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import { supabase } from '../utils/supabaseClient';
import LoginDialog from '../components/LoginDialog';
import ProfileCreationDialog from '../components/ProfileCreationDialog';
import HumanPlayer from '../classes/HumanPlayer';
import PlayerProfile from '../classes/PlayerProfile';

const version = 'v0.3.16';
const tag = "LOGIN";
const module = "LoginPage";
let method = "";

const LoginPage = () => {
    // Logging utilities
    const log = (message) => {
      console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    };
    
    const logerror = (message, error = null) => {
      if (error) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
      } else {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
      }
    };

  const { dispatch, events, getPlayerProfile, logout } = useGame();
  
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
      method = 'checkExistingAuth';
      log('Checking for existing authentication...');
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          log(`User authenticated: ${session.user.id}`);
          
          // Check if user has profile
          const profileData = await getPlayerProfile(session.user.id);
          
          if (!profileData || !profileData.game_name) {
            // New user (from signup) - no profile yet
            log('No profile found - routing to ProfileCreation');
            setAuthenticatedUser(session.user);
            setAuthStep('profile-creation');
          } else {
            // Existing user with profile - CREATE PlayerProfile instance
            log(`Profile found - creating PlayerProfile and Player for welcome back: ${profileData.game_name}`);
            
            const playerProfile = new PlayerProfile(profileData);
            
            const player = new HumanPlayer(
              session.user.id,
              playerProfile.game_name,
              'human',
              1.0
            );
            
            log(`Player created for welcome-back: ${player.name}`);
            log(`PlayerProfile instance created: ${playerProfile.game_name}`);
            
            setAuthenticatedUser(session.user);
            setAuthenticatedPlayer(player);
            setExistingProfile(playerProfile);
            setAuthStep('login'); // LoginDialog will show welcome mode
          }
        } else {
          log('No existing session, showing login dialog');
          setAuthStep('login');
        }
      } catch (err) {
        logerror('Error checking session:', err);
        setAuthStep('login');
      }
    };
    
    checkExistingAuth();
  }, [getPlayerProfile]);

  // Check for showSignup flag in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signup') === 'true') {
      setShowSignup(true);
    }
  }, []);
  
  const handleAuthenticatedPlayer = async (player, playerProfile, playerEmail) => {
    method = 'handleAuthenticatedPlayer';
    log(`Player authenticated: ${player.name}, ID: ${player.id}`);
    setAuthenticatedPlayer(player);
    setIsLoading(true);
    
    try {
      // Set CoreEngine singleton directly
      coreEngine.player = player;
      log(`Set coreEngine.player = ${player}`);
      
      // Set PlayerProfile separately
        coreEngine.playerProfile = playerProfile;
        log(`Set coreEngine.playerProfile = ${playerProfile}`);
      
      // Get and store user email
        coreEngine.playerEmail = playerEmail;
        log(`Set coreEngine.playerEmail = ${playerEmail || 'null (guest)'}`);

        // Check if guest user
      if (player.id.startsWith('guest-')) {
        log('Guest player detected, proceeding directly to game');
      } else {
        log('Registered player, proceeding to era selection');
      }
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
        log('exit Login: coreEngine.player set: ', coreEngine.player);
        log('exit Login: coreEngine.playerProfile set: ', coreEngine.playerProfile);
        log('exit Login: coreEngine.playerEmail set: ', coreEngine.playerEmail);
      dispatch(events.SELECTERA);
      
    } catch (error) {
      logerror('Error during authentication flow:', error);
      setError(error.message || 'An unexpected error occurred');
      setAuthStep('login');
      setIsLoading(false);
    }
  };
  
    const handleLoginComplete = async (player, playerProfile, playerEmail) => {
        if (player) {
          log(`Player received, email: ${playerEmail}`);
          await handleAuthenticatedPlayer(player, playerProfile, playerEmail);      log(`Player received from LoginDialog: ${player.name}`);
        } else {
          log('Login dialog closed without authentication');
          handleReset();
        }
    };

  const handleContinue = () => {
    method = 'handleContinue';
    log(`User continuing with existing profile: ${existingProfile.game_name}`);
    
    if (authenticatedPlayer) {
      log(`Using existing Player object: ${authenticatedPlayer.name}`);
      
      // Set CoreEngine singleton directly
      coreEngine.player = authenticatedPlayer;
      log(`Set coreEngine.player = player(${authenticatedPlayer.name})`);
      
      // Set PlayerProfile separately (existingProfile is already PlayerProfile instance)
      coreEngine.playerProfile = existingProfile;
      log(`Set coreEngine.playerProfile = existingProfile(${existingProfile.game_name})`);
      
      // Store email (authenticatedUser already has it from checkExistingAuth)
        if (authenticatedUser?.email) {
          coreEngine.playerEmail = authenticatedUser.email;
          log(`Set coreEngine.playerEmail = ${authenticatedUser.email}`);
        }

        log('exit Login: coreEngine.player set: ', coreEngine.player);
        log('exit Login: coreEngine.playerProfile set: ', coreEngine.playerProfile);
        log('exit Login: coreEngine.playerEmail set: ', coreEngine.playerEmail);
      dispatch(events.SELECTERA);
    } else {
      logerror('ERROR: No Player object available for continue');
      setError('Unable to continue. Please try logging in again.');
    }
  };

  const handleLogout = async () => {
    method = 'handleLogout';
    log('User logging out - clearing all state');
    
    // Clear CoreEngine state and session storage
    logout();
    
    // Clear Supabase auth session
    await supabase.auth.signOut();
    
    log('Logout complete');
    // No need to dispatch LAUNCH - logout() already transitions to 'launch'
  };

  const handleProfileCreationComplete = async (player, playerProfile, playerEmail) => {
    method = 'handleProfileCreationComplete';
    log(`Profile creation completed, Player: ${player.name}`);
    setIsLoading(true);
    
    // Set CoreEngine singleton directly
    coreEngine.player = player;
    log(`Set coreEngine.player = ${player.name}`);
    
    // Set PlayerProfile separately
      coreEngine.playerProfile = playerProfile;
      log(`Set coreEngine.playerProfile = ${playerProfile}`);
    
    // Get and store user email
      coreEngine.playerEmail = playerEmail;
      log(`Set coreEngine.playerEmail = ${playerEmail}`);
      
    await new Promise(resolve => setTimeout(resolve, 400));
    
      log('exit Login: coreEngine.player set: ', coreEngine.player);
      log('exit Login: coreEngine.playerProfile set: ', coreEngine.playerProfile);
      log('exit Login: coreEngine.playerEmail set: ', coreEngine.playerEmail);
    dispatch(events.SELECTERA);
    setIsLoading(false);
  };

  const handleReset = () => {
    method = 'handleReset';
    log('Resetting authentication flow');
    setAuthStep('login');
    setAuthenticatedUser(null);
    setAuthenticatedPlayer(null);
    setExistingProfile(null);
    setIsLoading(false);
    setError(null);
    setShowSignup(false);
  };

  log(`Current state: authStep=${authStep}, hasUser=${!!authenticatedUser}, hasPlayer=${!!authenticatedPlayer}, hasProfile=${!!existingProfile}, isLoading=${isLoading}`);

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
