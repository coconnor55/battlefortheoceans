// src/pages/LaunchPage.js v0.3.12
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.12: Add fullscreen checkbox option under Play Game button, default checked
// v0.3.11: Fix keyDataError persistence - don't clear in handleEvent_launch
//          - keyDataError now persists until user clicks "Play Game" button
//          - Clear keyDataError in handlePlayGame so message shows on LaunchPage
// v0.3.10: Display key data error message when game restarts due to lost data
//          - Shows "Lost key data during {state}, restarting game" above version number
//          - Error message appears below Play button and horizontal line
// v0.3.9: Rollback-compatible version with working auth detection from v0.3.25
//         - Fixed: Get events from useGame() context (not GameEvents.js)
//         - Kept: All working auth logic from v0.3.25
//         - Shows "Preparing your session..." while checking auth
//         - Auto-routes if user confirmed but no profile (game_name)
//         - 3-second fallback shows button if auth is slow
//         - Keeps listening indefinitely for auth state changes
// [v0.3.25 working logic preserved, imports fixed for v0.5.5 compatibility]

import { useState, useEffect } from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import { events } from '../constants/GameEvents';

const version = 'v0.3.12';
const tag = "LAUNCH";
const module = "LaunchPage";
let method = "";

const LaunchPage = () => {
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

  const { dispatch, events } = useGame();  // ← Fixed: get events from context
  const [showButton, setShowButton] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(true);
  const [, forceUpdate] = useState(0);
  
  // Get game config version
  const gameConfig = coreEngine.gameConfig;
  const gameVersion = gameConfig?.version;
  
  // Subscribe to CoreEngine updates to see keyDataError changes
  useEffect(() => {
    const unsubscribe = coreEngine.subscribe(() => {
      forceUpdate(n => n + 1);
    });
    return unsubscribe;
  }, []);
  
  // Get key data error from CoreEngine if it exists
  const keyDataError = coreEngine.keyDataError;

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
          playerId: session.user.id,
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
            playerId: session.user.id,
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
        if (authSubscription?.data?.subscription) {
          authSubscription.data.subscription.unsubscribe();
        }
    };
  }, []);

  useEffect(() => {
    console.log('[LAUNCH]', version, 'LaunchPage mounted');
  }, []);

  const handlePlayGame = async () => {
    console.log('[LAUNCH]', version, 'Play Game button clicked - manual login');
    
    // Enter fullscreen mode if checkbox is checked
    if (fullscreenEnabled) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          console.log('[LAUNCH]', version, 'Entered fullscreen mode');
        } else if (document.documentElement.webkitRequestFullscreen) {
          // Safari
          await document.documentElement.webkitRequestFullscreen();
          console.log('[LAUNCH]', version, 'Entered fullscreen mode (webkit)');
        } else if (document.documentElement.msRequestFullscreen) {
          // IE/Edge
          await document.documentElement.msRequestFullscreen();
          console.log('[LAUNCH]', version, 'Entered fullscreen mode (ms)');
        } else if (document.documentElement.mozRequestFullScreen) {
          // Firefox
          await document.documentElement.mozRequestFullScreen();
          console.log('[LAUNCH]', version, 'Entered fullscreen mode (moz)');
        }
      } catch (error) {
        console.warn('[LAUNCH]', version, 'Failed to enter fullscreen:', error);
        // Continue with game start even if fullscreen fails
      }
    }
    
    // Clear key data error when user clicks Play Game
    if (coreEngine.keyDataError) {
      coreEngine.keyDataError = null;
      coreEngine.notifySubscribers();
    }
    
    if (dispatch) {
        log('exit Launch: coreEngine.gameConfig already set', coreEngine.gameConfig);
        log('exit Launch: coreEngine.eras already set', coreEngine.eras);
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
        <div className="card-body flex flex-center flex-column">
          {!showButton ? (
            <p className="text-muted">Preparing your session...</p>
          ) : (
            <>
              <button
                className="btn btn--primary btn--lg"
                onClick={handlePlayGame}
              >
                Play Game
              </button>
              <label style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={fullscreenEnabled}
                  onChange={(e) => setFullscreenEnabled(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Full screen mode (Esc to exit)
              </label>
            </>
          )}
        </div>
        {keyDataError && (
          <div className="message message--warning" style={{ margin: 0, borderRadius: 0, borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
            <p style={{ margin: 0, textAlign: 'center' }}>
              {keyDataError.message || `Lost key data during ${keyDataError.state}, restarting game`}
            </p>
          </div>
        )}
        <div className="card-footer">
          {gameVersion && (
            <p className="game-version">{gameVersion}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaunchPage;

// EOF
