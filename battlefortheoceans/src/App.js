// src/App.js v0.2.12
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import LaunchPage from './pages/LaunchPage';
import LoginPage from './pages/LoginPage';
import SelectEraPage from './pages/SelectEraPage';
import SelectOpponentPage from './pages/SelectOpponentPage';
import PlacementPage from './pages/PlacementPage';
import PlayingPage from './pages/PlayingPage';
import OverPage from './pages/OverPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import './App.css';

const version = 'v0.2.12';

const SceneRenderer = () => {
  const { currentState, eraConfig, subscribeToUpdates, coreEngine } = useGame();
  
  // Force re-render trigger when game logic changes
  const [, setRenderTrigger] = useState(0);

//  // Initialize from URL on mount
//  useEffect(() => {
//    console.log('[DEBUG]', version, 'Initializing from URL');
//    if (coreEngine?.initializeFromURL) {
//      coreEngine.initializeFromURL();
//    }
//  }, [coreEngine]);
//
  // Subscribe to game logic updates for state machine transitions
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);
  
  // Apply dynamic theme from era config
  useEffect(() => {
    console.log('[DEBUG]', version, 'Applying era theme');
    
    if (eraConfig?.theme) {
      // Apply theme CSS variables from era config
      console.log('[DEBUG]', version, 'Loading theme from era config:', eraConfig.name);
      
      Object.entries(eraConfig.theme).forEach(([key, value]) => {
        const cssVar = `--${key.replace(/_/g, '-')}`;
        document.body.style.setProperty(cssVar, value);
        console.log('[DEBUG]', version, `Set ${cssVar} = ${value}`);
      });
      
      // Apply background image if present in promotional section
      if (eraConfig.promotional?.background_image) {
        const cdnBase = process.env.REACT_APP_GAME_CDN || '';
          const imageUrl = cdnBase
            ? `${cdnBase}/assets/images/${eraConfig.promotional.background_image}`
            : `/assets/images/${eraConfig.promotional.background_image}`;        
        console.log('[DEBUG]', version, 'Setting background image:', imageUrl);
        
        // Apply background image with gradient overlay for readability
//        const bgDark = eraConfig.theme?.bg_dark || 'rgba(43, 79, 95, 0.9)';
//        const backgroundValue = `linear-gradient(to bottom, ${bgDark}cc, ${bgDark}dd), url('${imageUrl}')`;
          const backgroundValue = `url('${imageUrl}')`;
          
        // Set body background image
        document.body.style.backgroundImage = backgroundValue;
        document.body.setAttribute('data-has-background-image', 'true');
        
        // Hide .App background by setting CSS variable
        document.body.style.setProperty('--app-background', 'none');
        
        // Hide the body::before gradient pattern overlay
        document.body.style.setProperty('--body-before-opacity', '0');
        
        console.log('[DEBUG]', version, 'Background image applied');
      } else {
        // Reset to gradient-only background if no image
        console.log('[DEBUG]', version, 'No background image, using gradient');
        
        // Clear body background and show .App default background
        document.body.style.backgroundImage = '';
        document.body.removeAttribute('data-has-background-image');
        document.body.style.removeProperty('--app-background');
        
        // Restore the body::before pattern overlay
        document.body.style.setProperty('--body-before-opacity', '0.3');
      }
      
      // Set data-era attribute for any era-specific CSS rules
      const eraKey = eraConfig.era || 'traditional';
      document.body.setAttribute('data-era', eraKey);
      console.log('[DEBUG]', version, 'Theme applied for:', eraKey);
      
    } else if (eraConfig?.name) {
      // Fallback: Use hardcoded era mapping if theme object missing
      console.log('[DEBUG]', version, 'No theme object, using fallback mapping');
      
      const eraMap = {
        'Traditional Battleship': 'traditional',
        'Midway Island': 'midway'
      };
      const eraKey = eraMap[eraConfig.name] || 'traditional';
      document.body.setAttribute('data-era', eraKey);
      
      // Clear body background and show .App default background
      document.body.style.backgroundImage = '';
      document.body.removeAttribute('data-has-background-image');
      document.body.style.removeProperty('--app-background');
      document.body.style.setProperty('--body-before-opacity', '0.3');
      
      console.log('[DEBUG]', version, 'Fallback theme switched to:', eraKey);
      
    } else {
      // No era config, use default theme and .App background
      console.log('[DEBUG]', version, 'No era config, using default theme');
      document.body.setAttribute('data-era', 'traditional');
      
      // Clear body background and show .App default background
      document.body.style.backgroundImage = '';
      document.body.removeAttribute('data-has-background-image');
      document.body.style.removeProperty('--app-background');
      document.body.style.setProperty('--body-before-opacity', '0.3');
    }
  }, [eraConfig]);
  
  // Check if current URL is for password reset
  const isResetPasswordRoute = window.location.pathname === '/reset-password' ||
                               window.location.hash.includes('type=recovery');
  
  if (isResetPasswordRoute) {
    console.log('[DEBUG]', version, 'Rendering reset password page');
    return <ResetPasswordPage />;
  }
  
  console.log('[DEBUG]', version, 'Rendering scene for state:', currentState);
  
  return (
    <div className="scene">
      {(() => {
          console.log('[DEBUG App.js] Rendering scene for currentState:', currentState);        switch (currentState) {
          case 'launch':
            return <LaunchPage />;
          case 'login':
            return <LoginPage />;
          case 'era':
            return <SelectEraPage />;
          case 'opponent':
            return <SelectOpponentPage />;
          case 'placement':
            return <PlacementPage />;
          case 'play':
            return <PlayingPage />;
          case 'over':
            return <OverPage />;
          default:
            return (
              <div className="error-state">
                <h2>Unknown State: {currentState}</h2>
                <p>The application is in an unexpected state.</p>
                <button onClick={() => window.location.reload()}>
                  Reload Application
                </button>
              </div>
            );
        }
      })()}
    </div>
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
