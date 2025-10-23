// src/pages/LaunchPage.js v0.3.25
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.25: Keep listening for auth even after showing button
//          - Auth listener stays active indefinitely
//          - If INITIAL_SESSION comes through at ANY time → auto-proceed
//          - Button shown after 3s timeout as manual fallback
//          - Handles slow auth processing gracefully
// v0.3.24: Show "Preparing..." message while waiting for auth
// v0.3.23: Improved UX - hide button initially, show only if no auto-auth
// v0.3.22: Handle INITIAL_SESSION event for email confirmations

import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { events } from '../constants/GameEvents';
import { APP_VERSION } from '../App.js';

const version = 'v0.3.25';

const LaunchPage = () => {
  const { dispatch } = useGame();
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    console.log('[DEBUG]', version, 'Setting up auth state listener');

    let authSubscription = null;
    let buttonTimer = null;

    const initializeAuth = async () => {
      // Load Supabase and let it handle any hash fragments naturally
      const { supabase } = await import('../utils/supabaseClient');
      console.log('[DEBUG]', version, 'Supabase client loaded');

      // Check current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[DEBUG]', version, 'Error getting session:', error);
      }
      
      if (session?.user) {
        console.log('[DEBUG]', version, 'Found authenticated user:', session.user.email);
        console.log('[DEBUG]', version, 'Email confirmed at:', session.user.email_confirmed_at);
        
        // Check if user has a profile (game_name)
        const hasProfile = session.user.user_metadata?.game_name;
        console.log('[DEBUG]', version, 'User has profile?', hasProfile);
        
        if (!hasProfile) {
          console.log('[DEBUG]', version, 'User confirmed but no profile - auto-routing to ProfileCreation');
          // User confirmed email but hasn't created profile yet - auto-proceed
          dispatch(events.LOGIN);
          return; // Stop further execution
        }
        
        // User has profile, let them proceed normally
        console.log('[DEBUG]', version, 'User has profile, proceeding to game');
      } else {
        console.log('[DEBUG]', version, 'No immediate session, waiting for auth events...');
        // No immediate auth - show button after 3 seconds as fallback
        // But keep listening - auth might still come through!
        buttonTimer = setTimeout(() => {
          console.log('[DEBUG]', version, 'No auto-auth after 3s, showing Play Game button as fallback');
          console.log('[DEBUG]', version, '(Still listening for auth in background)');
          setShowButton(true);
        }, 3000);
      }

      // Listen for auth state changes - STAYS ACTIVE INDEFINITELY
      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[DEBUG]', version, 'Auth state change:', event);
        
        // Handle both SIGNED_IN and INITIAL_SESSION (email confirmations)
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          console.log('[DEBUG]', version, 'User authenticated:', session.user.email);
          
          // Check for profile
          const hasProfile = session.user.user_metadata?.game_name;
          if (!hasProfile) {
            console.log('[DEBUG]', version, 'Authentication received - auto-routing to ProfileCreation');
            dispatch(events.LOGIN);
          }
        }
      });
    };

    initializeAuth();

    return () => {
      console.log('[DEBUG]', version, 'Cleaning up auth state listener');
      if (buttonTimer) clearTimeout(buttonTimer);
      authSubscription?.data?.subscription?.unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    console.log('[DEBUG]', version, 'LaunchPage mounted');
  }, []);

  const handlePlayGame = () => {
    console.log('[DEBUG]', version, 'Play Game button clicked - manual login');
    if (dispatch) {
      dispatch(events.LOGIN);
    } else {
      console.error('[DEBUG]', version, 'Dispatch not available');
    }
  };

  // Launch page UI - show "Preparing..." or button based on state
  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--small">
        <div className="card-header">
          <h1 className="card-title text-center">Battle for the Oceans</h1>
          <p className="card-subtitle hero-tagline">
            Command history's greatest naval battles.<br />
            One perfect shot at a time.
          </p>
        </div>
        <div className="card-body flex flex-center">
          {!showButton ? (
            <p className="text-muted">Preparing your session...</p>
          ) : (
            <button
              className="btn btn--primary btn--lg"
              onClick={handlePlayGame}
            >
              Play Game
            </button>
          )}
        </div>
        <div className="card-footer">
          {APP_VERSION && (
            <p className="game-version">{APP_VERSION}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaunchPage;

// EOF
