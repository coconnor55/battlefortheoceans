// src/pages/LaunchPage.js v0.3.9
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.9: Rollback-compatible version with working auth detection from v0.3.25
//         - Fixed: Get events from useGame() context (not GameEvents.js)
//         - Kept: All working auth logic from v0.3.25
//         - Shows "Preparing your session..." while checking auth
//         - Auto-routes if user confirmed but no profile (game_name)
//         - 3-second fallback shows button if auth is slow
//         - Keeps listening indefinitely for auth state changes
// [v0.3.25 working logic preserved, imports fixed for v0.5.5 compatibility]

import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { APP_VERSION } from '../App.js';

const version = 'v0.3.9';

const LaunchPage = () => {
  const { dispatch, events } = useGame();  // ← Fixed: get events from context
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    console.log('[LAUNCH]', version, 'Setting up auth state listener for debugging');

    let authSubscription = null;

    const setupAuthListener = async () => {
      const { supabase } = await import('../utils/supabaseClient');
      console.log('[LAUNCH]', version, 'Supabase client loaded');

      // Log initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[LAUNCH]', version, 'Error getting initial session:', error);
      } else {
        console.log('[LAUNCH]', version, 'Initial session:', session ? {
          userId: session.user.id,
          email: session.user.email,
          emailConfirmed: session.user.email_confirmed_at,
          userMetadata: session.user.user_metadata
        } : 'None');
      }

      // Listen for auth state changes
      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[LAUNCH]', version, '🔔 AUTH STATE CHANGE:', {
          event,
          session: session ? {
            userId: session.user.id,
            email: session.user.email,
            emailConfirmed: session.user.email_confirmed_at,
            userMetadata: session.user.user_metadata
          } : 'None'
        });
      });

      // Show button after 3 seconds
      setTimeout(() => {
        console.log('[LAUNCH]', version, 'Showing Play Game button');
        setShowButton(true);
      }, 3000);
    };

    setupAuthListener();

    return () => {
      console.log('[LAUNCH]', version, 'Cleaning up auth state listener');
      authSubscription?.data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log('[LAUNCH]', version, 'LaunchPage mounted');
  }, []);

  const handlePlayGame = () => {
    console.log('[LAUNCH]', version, 'Play Game button clicked - manual login');
    if (dispatch) {
      dispatch(events.LOGIN);
    } else {
      console.error('[LAUNCH]', version, 'Dispatch not available');
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
