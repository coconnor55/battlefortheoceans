// src/App.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.6: Added code to reposition help for achievements
// v0.4.5: Refactored for PlayerProfile architecture
//         - Fixed playerProfile reference to use coreEngine.playerProfile
//         - Updated logging to match new pattern (tag, module, method)
// v0.4.4: Added Test overlay for admin/developer testing
//         - Added onShowTest prop to NavBar
//         - Renders TestSuite component in modal overlay
//         - Test option only visible to admins/developers (handled in NavBar)
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
import AboutPage from './pages/AboutPage';
import TestSuite from './tests/TestSuite';
import './App.css';

export const APP_VERSION = '1.4';

const version = 'v0.4.6';
const tag = "APP";
const module = "App";
let method = "";

// Detect if we're in production (battlefortheoceans.com) or local development
const isProduction = window.location.hostname === 'battlefortheoceans.com';
const gameCDN = process.env.REACT_APP_GAME_CDN || '';

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

// Map game state to help section
const getHelpSection = (state) => {
  const sectionMap = {
    'era': 'era',
    'opponent': 'opponent',
    'placement': 'placement',
    'play': 'battle'
  };
  const section = sectionMap[state] || 'era';
  method = 'getHelpSection';
  log(`getHelpSection for state: ${state} → ${section}`);
  return sectionMap[state] || 'era';
};

const SceneRenderer = () => {
  const { currentState, eraConfig, subscribeToUpdates, coreEngine } = useGame();
  const [overlayPage, setOverlayPage] = useState(null); // 'stats' | 'achievements' | 'about' | 'help' | 'test' | null
    const [achievementsPosition, setAchievementsPosition] = useState(null);  // ← ADD THIS LINE
  const [autoShowedSections, setAutoShowedSections] = useState(new Set());

  // Auto-show guide on state change (first time only per session)
  useEffect(() => {
    method = 'useEffect-autoShowGuide';
    const validStates = ['era', 'opponent', 'placement', 'play'];
    
    // Check if should auto-show for current state
    if (validStates.includes(currentState) && !autoShowedSections.has(currentState)) {
      // Check user preference from CoreEngine
      const playerProfile = coreEngine.playerProfile;
      
      // Don't auto-show if user has disabled it
      if (playerProfile?.show_game_guide === false) {
        log('Auto-show disabled by user preference');
        return;
      }
      
      log(`Auto-showing guide for first visit to: ${currentState}`);
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
    method = 'useEffect-loadConfig';
    fetch('/config/game-config.json')
      .then(response => response.json())
      .then(config => {
        setGameConfig(config);
        log(`Game config loaded: ${config.version}`);
      })
      .catch(error => {
        logerror('Failed to load game-config.json:', error);
      });
  }, []);
  
  // Reset inactivity timers
  const resetInactivityTimers = useCallback(() => {
    method = 'resetInactivityTimers';
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
    
    log(`Timers reset - warning in ${warningTimeout / 1000} seconds`);
    
    // Set warning timer
    warningTimer.current = setTimeout(() => {
      log('Warning timeout reached - showing modal');
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
        log('Logout timeout reached - logging out');
        handleInactivityLogout();
      }, logoutTimeout);
      
    }, warningTimeout);
  }, [gameConfig, coreEngine]);
  
  // Handle inactivity logout
  const handleInactivityLogout = useCallback(() => {
    method = 'handleInactivityLogout';
    log('Auto-logout due to inactivity');
    
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
    method = 'handleDismissWarning';
    log('User dismissed warning - resetting timers');
    resetInactivityTimers();
  }, [resetInactivityTimers]);
  
  // Track user activity
  useEffect(() => {
    method = 'useEffect-trackActivity';
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
    
    log('Activity tracking initialized');
    
    return () => {
      // Cleanup
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('click', handleActivity);
      
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      
      log('Activity tracking cleaned up');
    };
  }, [gameConfig, showInactivityWarning, resetInactivityTimers]);
  
  // Apply dynamic theme from era config
  useEffect(() => {
    method = 'useEffect-applyTheme';
    log('Applying era theme');
    
    if (eraConfig?.theme) {
      log(`Loading theme from era config: ${eraConfig.name}`);
      
      Object.entries(eraConfig.theme).forEach(([key, value]) => {
        const cssVar = `--${key.replace(/_/g, '-')}`;
        document.body.style.setProperty(cssVar, value);
        log(`Set ${cssVar} = ${value}`);
      });
      
      if (eraConfig.promotional?.background_image) {
        const backgroundImageUrl = eraConfig.promotional?.background_image
          ? isProduction
            ? `${gameCDN}/assets/eras/${eraConfig.id}/${eraConfig.promotional.background_image}`
            : `/assets/eras/${eraConfig.id}/${eraConfig.promotional.background_image}`
          : null;
        log(`Setting background image: ${backgroundImageUrl}`);
        
        const backgroundValue = `url('${backgroundImageUrl}')`;
        document.body.style.backgroundImage = backgroundValue;
        document.body.setAttribute('data-has-background-image', 'true');
        document.body.style.setProperty('--app-background', 'none');
        document.body.style.setProperty('--body-before-opacity', '0');
        
        log('Background image applied');
      } else {
        log('No background image, using gradient');
        document.body.style.backgroundImage = '';
        document.body.removeAttribute('data-has-background-image');
        document.body.style.removeProperty('--app-background');
        document.body.style.setProperty('--body-before-opacity', '0.3');
      }
      
      const eraKey = eraConfig.id || 'traditional';
      document.body.setAttribute('data-era', eraKey);
      log(`Theme applied for: ${eraKey}`);
      
    } else if (eraConfig?.name) {
      log('No theme object, using fallback mapping');
      
      const eraKey = eraConfig.id || 'traditional';
      document.body.setAttribute('data-era', eraKey);
      
      document.body.style.backgroundImage = '';
      document.body.removeAttribute('data-has-background-image');
      document.body.style.removeProperty('--app-background');
      document.body.style.setProperty('--body-before-opacity', '0.3');
      
      log(`Fallback theme switched to: ${eraKey}`);
      
    } else {
      log('No era config, using default theme');
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
    method = 'render-resetPassword';
    log('Rendering reset password page');
    return <ResetPasswordPage />;
  }
  
  if (isEmailConfirmedRoute) {
    method = 'render-emailConfirmed';
    log('Rendering email confirmed page');
    return <EmailConfirmedPage />;
  }
  
  method = 'render-scene';
  log(`Rendering scene for state: ${currentState}`);
  
  const closeOverlay = () => setOverlayPage(null);

  return (
    <>
      <NavBar
        onShowAbout={() => setOverlayPage('about')}
        onShowStats={() => setOverlayPage('stats')}
          onShowAchievements={(scrollPos) => {  // ← CHANGE THIS
            setOverlayPage('achievements');
            setAchievementsPosition(scrollPos);
          }}
        onShowHelp={() => setOverlayPage('help')}
        onShowTest={() => setOverlayPage('test')}
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
              <AchievementsPage
                onClose={closeOverlay}
                scrollPosition={achievementsPosition}  // ← ADD THIS LINE
              />
            </div>
          )}
          
      {overlayPage === 'stats' && (
        <div className="modal-overlay">
          <StatsPage onClose={closeOverlay} />
        </div>
      )}
      
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
      
      {overlayPage === 'test' && (
        <div className="modal-overlay">
          <TestSuite onClose={closeOverlay} />
        </div>
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
  method = 'App';
  log('App initialized');
  
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
