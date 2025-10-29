
// src/App.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.3: added routing for About page, removed hardcoded era info
// v0.4.2: moved GameGuide handling into App.js
// v0.4.1: Added page-container wrapper for NavBar spacing
/**
 * v0.4.0: Added inactivity tracking and auto-logout
 *         - Tracks user activity across entire application
 *         - Shows warning modal after 15 minutes of inactivity
 *         - Auto-logout after 18 minutes (15m + 3m warning)
 *         - Configurable timings from game-config.json
 *         - Listens to mousemove, keydown, touchstart, click events
 *         - Calls coreEngine.logout() to clear session
 * v0.3.4: Fixed overlay scrolling - wrapped achievements/stats in modal-overlay
 * v0.3.3: Added StatsPage overlay integration
 * v0.3.2: Refactor to overlay pattern - achievements/stats as overlays, not game states
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import NavBar from './components/NavBar';
import LaunchPage from './pages/LaunchPage';
import LoginPage from './pages/LoginPage';
import SelectEraPage from './pages/SelectEraPage';
import SelectOpponentPage from './pages/SelectOpponentPage';
import PlacementPage from './pages/PlacementPage';
import PlayingPage from './pages/PlayingPage';
import OverPage from './pages/OverPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import EmailConfirmedPage from './pages/EmailConfirmedPage';
import AchievementsPage from './pages/AchievementsPage';
import StatsPage from './pages/StatsPage';
import InactivityWarning from './components/InactivityWarning';
import GameGuide from './components/GameGuide';
import AboutPage from './pages/AboutPage';  // ADD THIS LINE
import './App.css';

export const APP_VERSION = 'dev1.3';

const version = 'v0.4.3';
// Detect if we're in production (battlefortheoceans.com) or local development
const isProduction = window.location.hostname === 'battlefortheoceans.com';
const gameCDN = process.env.REACT_APP_GAME_CDN || '';

// Map game state to help section
const getHelpSection = (state) => {
  const sectionMap = {
    'era': 'era',
    'opponent': 'opponent',
    'placement': 'placement',
    'play': 'battle'
  };
    const section = sectionMap[state] || 'era';
    console.log('[GUIDE] App: ', version, 'getHelpSection for state:', state, '→', section);
  return sectionMap[state] || 'era';
};

const SceneRenderer = () => {
  const { currentState, eraConfig, subscribeToUpdates, coreEngine } = useGame();
  const [overlayPage, setOverlayPage] = useState(null); // 'stats' | 'achievements' | null
    const [autoShowedSections, setAutoShowedSections] = useState(new Set());

    // Auto-show guide on state change (first time only per session)
    useEffect(() => {
      const validStates = ['era', 'opponent', 'placement', 'play'];
      
      // Check if should auto-show for current state
      if (validStates.includes(currentState) && !autoShowedSections.has(currentState)) {
        // Check user preference from CoreEngine
        const userProfile = coreEngine.humanPlayer?.userProfile;
        
        // Don't auto-show if user has disabled it
        if (userProfile?.show_game_guide === false) {
          console.log('[APP]', version, 'Auto-show disabled by user preference');
          return;
        }
        
        console.log('[APP]', version, 'Auto-showing guide for first visit to:', currentState);
        setOverlayPage('help');
        setAutoShowedSections(prev => new Set([...prev, currentState]));
      }
    }, [currentState, coreEngine, autoShowedSections]);
    
    const [, setRenderTrigger] = useState(0);
  
  // Inactivity tracking state
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [gameConfig, setGameConfig] = useState(null);
  
  // Refs for inactivity timers
  const lastActivityTime = useRef(Date.now());
  const warningTimer = useRef(null);
  const logoutTimer = useRef(null);
  const countdownInterval = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);
  
  // Load game config for inactivity settings
  useEffect(() => {
    fetch('/config/game-config.json')
      .then(response => response.json())
      .then(config => {
        setGameConfig(config);
        console.log('[INACTIVITY]', version, 'Game config loaded:', config.version);
      })
      .catch(error => {
        console.error('[INACTIVITY]', version, 'Failed to load game-config.json:', error);
      });
  }, []);
  
  // Reset inactivity timers
  const resetInactivityTimers = useCallback(() => {
    lastActivityTime.current = Date.now();
    
    // Clear existing timers
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    
    // Hide warning if showing
    setShowInactivityWarning(false);
    
    // Only set timers if inactivity tracking is enabled
    if (!gameConfig?.inactivity?.enabled) return;
    
    const warningTimeout = gameConfig.inactivity.warning_timeout || 900000; // 15 minutes
    const logoutTimeout = gameConfig.inactivity.logout_timeout || 180000; // 3 minutes
    
    console.log('[INACTIVITY]', version, 'Timers reset - warning in', warningTimeout / 1000, 'seconds');
    
    // Set warning timer
    warningTimer.current = setTimeout(() => {
      console.log('[INACTIVITY]', version, 'Warning timeout reached - showing modal');
      setShowInactivityWarning(true);
      setRemainingSeconds(logoutTimeout / 1000);
      
      // Start countdown
      countdownInterval.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Set logout timer
      logoutTimer.current = setTimeout(() => {
        console.log('[INACTIVITY]', version, 'Logout timeout reached - logging out');
        handleInactivityLogout();
      }, logoutTimeout);
      
    }, warningTimeout);
  }, [gameConfig, coreEngine]);
  
  // Handle inactivity logout
  const handleInactivityLogout = useCallback(() => {
    console.log('[INACTIVITY]', version, 'Auto-logout due to inactivity');
    
    // Clear all timers
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    
    // Hide warning
    setShowInactivityWarning(false);
    
    // Logout via CoreEngine
    if (coreEngine) {
      coreEngine.logout();
    }
  }, [coreEngine]);
  
  // Handle "I'm Still Here" button
  const handleDismissWarning = useCallback(() => {
    console.log('[INACTIVITY]', version, 'User dismissed warning - resetting timers');
    resetInactivityTimers();
  }, [resetInactivityTimers]);
  
  // Track user activity
  useEffect(() => {
    if (!gameConfig?.inactivity?.enabled) return;
    
    const handleActivity = () => {
      // Only reset if not currently showing warning
      // (warning has its own "I'm Still Here" button)
      if (!showInactivityWarning) {
        resetInactivityTimers();
      }
    };
    
    // Listen to activity events on document level (global)
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('touchstart', handleActivity);
    document.addEventListener('click', handleActivity);
    
    // Initialize timers
    resetInactivityTimers();
    
    console.log('[INACTIVITY]', version, 'Activity tracking initialized');
    
    return () => {
      // Cleanup
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('click', handleActivity);
      
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      
      console.log('[INACTIVITY]', version, 'Activity tracking cleaned up');
    };
  }, [gameConfig, showInactivityWarning, resetInactivityTimers]);
  
  // Apply dynamic theme from era config
  useEffect(() => {
    console.log('[DEBUG]', version, 'Applying era theme');
    
    if (eraConfig?.theme) {
      console.log('[DEBUG]', version, 'Loading theme from era config:', eraConfig.name);
      
      Object.entries(eraConfig.theme).forEach(([key, value]) => {
        const cssVar = `--${key.replace(/_/g, '-')}`;
        document.body.style.setProperty(cssVar, value);
        console.log('[DEBUG]', version, `Set ${cssVar} = ${value}`);
      });
      
      if (eraConfig.promotional?.background_image) {
          const backgroundImageUrl = eraConfig.promotional?.background_image
            ? isProduction
              ? `${gameCDN}/assets/eras/${eraConfig.era}/${eraConfig.promotional.background_image}`
              : `/assets/eras/${eraConfig.era}/${eraConfig.promotional.background_image}`
            : null;
        console.log('[DEBUG]', version, 'Setting background image:', backgroundImageUrl);
        
        const backgroundValue = `url('${backgroundImageUrl}')`;
        document.body.style.backgroundImage = backgroundValue;
        document.body.setAttribute('data-has-background-image', 'true');
        document.body.style.setProperty('--app-background', 'none');
        document.body.style.setProperty('--body-before-opacity', '0');
        
        console.log('[DEBUG]', version, 'Background image applied');
      } else {
        console.log('[DEBUG]', version, 'No background image, using gradient');
        document.body.style.backgroundImage = '';
        document.body.removeAttribute('data-has-background-image');
        document.body.style.removeProperty('--app-background');
        document.body.style.setProperty('--body-before-opacity', '0.3');
      }
      
      const eraKey = eraConfig.era || 'traditional';
      document.body.setAttribute('data-era', eraKey);
      console.log('[DEBUG]', version, 'Theme applied for:', eraKey);
      
    } else if (eraConfig?.name) {
      console.log('[DEBUG]', version, 'No theme object, using fallback mapping');
      
      const eraKey = eraConfig.era || 'traditional';
      document.body.setAttribute('data-era', eraKey);
      
      document.body.style.backgroundImage = '';
      document.body.removeAttribute('data-has-background-image');
      document.body.style.removeProperty('--app-background');
      document.body.style.setProperty('--body-before-opacity', '0.3');
      
      console.log('[DEBUG]', version, 'Fallback theme switched to:', eraKey);
      
    } else {
      console.log('[DEBUG]', version, 'No era config, using default theme');
      document.body.setAttribute('data-era', 'traditional');
      
      document.body.style.backgroundImage = '';
      document.body.removeAttribute('data-has-background-image');
      document.body.style.removeProperty('--app-background');
      document.body.style.setProperty('--body-before-opacity', '0.3');
    }
  }, [eraConfig]);
  
  // Check for special routes
  const isResetPasswordRoute = window.location.pathname === '/reset-password' ||
                               window.location.hash.includes('type=recovery');
  
  const isEmailConfirmedRoute = window.location.pathname === '/email-confirmed';
  
  if (isResetPasswordRoute) {
    console.log('[DEBUG]', version, 'Rendering reset password page');
    return <ResetPasswordPage />;
  }
  
  if (isEmailConfirmedRoute) {
    console.log('[DEBUG]', version, 'Rendering email confirmed page');
    return <EmailConfirmedPage />;
  }
  
  console.log('[DEBUG]', version, 'Rendering scene for state:', currentState);
    
  const closeOverlay = () => setOverlayPage(null);

  return (
    <>
      <NavBar
          onShowAbout={() => setOverlayPage('about')}  // ADD THIS LINE
        onShowStats={() => setOverlayPage('stats')}
        onShowAchievements={() => setOverlayPage('achievements')}
          onShowHelp={() => setOverlayPage('help')}
        onCloseOverlay={closeOverlay}
        hasActiveOverlay={overlayPage !== null}
      />
          
      <div className="page-container">
          <div className="scene">
            {currentState === 'launch' && <LaunchPage />}
            {currentState === 'login' && <LoginPage />}
            {currentState === 'era' && <SelectEraPage />}
            {currentState === 'opponent' && <SelectOpponentPage />}
            {currentState === 'placement' && <PlacementPage />}
            {currentState === 'play' && <PlayingPage />}
            {currentState === 'over' && <OverPage />}
          </div>
        </div>
      
      {/* Overlays wrapped in modal-overlay to prevent background scroll */}
      {overlayPage === 'achievements' && (
        <div className="modal-overlay">
          <AchievementsPage onClose={closeOverlay} />
        </div>
      )}
      
      {overlayPage === 'stats' && (
        <div className="modal-overlay">
          <StatsPage onClose={closeOverlay} />
        </div>
      )}
      
          {/* ADD THIS SECTION */}
          {overlayPage === 'about' && (
            <div className="modal-overlay">
              <AboutPage onClose={closeOverlay} />
            </div>
          )}

          {overlayPage === 'help' && (
              <GameGuide
                section={getHelpSection(currentState)}
                manualOpen={overlayPage === 'help'}
                onClose={closeOverlay}
              />
          )}
          
          {/* Inactivity warning modal */}
      <InactivityWarning
        show={showInactivityWarning}
        remainingSeconds={remainingSeconds}
        onDismiss={handleDismissWarning}
      />
    </>
  );
};

const App = () => {
  console.log('[DEBUG]', version, 'App initialized');
  
  return (
    <div className="App">
      <main>
        <SceneRenderer />
      </main>
    </div>
  );
};

const WrappedApp = () => (
  <GameProvider>
    <App />
  </GameProvider>
);

export default WrappedApp;
// EOF
