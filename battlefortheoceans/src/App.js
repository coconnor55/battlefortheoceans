// src/App.js v0.3.4
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.4: Fixed overlay scrolling - wrapped achievements/stats in modal-overlay
// v0.3.3: Added StatsPage overlay integration
// v0.3.2: Refactor to overlay pattern - achievements/stats as overlays, not game states

import React, { useState, useEffect } from 'react';
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
import AchievementsPage from './pages/AchievementsPage';
import StatsPage from './pages/StatsPage';
import './App.css';

export const APP_VERSION = 'dev1.3';

const version = 'v0.3.4';

const SceneRenderer = () => {
  const { currentState, eraConfig, subscribeToUpdates } = useGame();
  const [overlayPage, setOverlayPage] = useState(null); // 'stats' | 'achievements' | null
  const [, setRenderTrigger] = useState(0);

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
      console.log('[DEBUG]', version, 'Loading theme from era config:', eraConfig.name);
      
      Object.entries(eraConfig.theme).forEach(([key, value]) => {
        const cssVar = `--${key.replace(/_/g, '-')}`;
        document.body.style.setProperty(cssVar, value);
        console.log('[DEBUG]', version, `Set ${cssVar} = ${value}`);
      });
      
      if (eraConfig.promotional?.background_image) {
        const cdnBase = process.env.REACT_APP_GAME_CDN || '';
        const imageUrl = cdnBase
          ? `${cdnBase}/assets/images/${eraConfig.promotional.background_image}`
          : `/assets/images/${eraConfig.promotional.background_image}`;
        console.log('[DEBUG]', version, 'Setting background image:', imageUrl);
        
        const backgroundValue = `url('${imageUrl}')`;
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
      
      const eraMap = {
        'Traditional Battleship': 'traditional',
        'Midway Island': 'midway'
      };
      const eraKey = eraMap[eraConfig.name] || 'traditional';
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
  
  const isResetPasswordRoute = window.location.pathname === '/reset-password' ||
                               window.location.hash.includes('type=recovery');
  
  if (isResetPasswordRoute) {
    console.log('[DEBUG]', version, 'Rendering reset password page');
    return <ResetPasswordPage />;
  }
  
  console.log('[DEBUG]', version, 'Rendering scene for state:', currentState);
    
  const closeOverlay = () => setOverlayPage(null);

  return (
    <>
      <NavBar
        onShowStats={() => setOverlayPage('stats')}
        onShowAchievements={() => setOverlayPage('achievements')}
        onCloseOverlay={closeOverlay}
        hasActiveOverlay={overlayPage !== null}
      />
          
      <div className="scene">
        {currentState === 'launch' && <LaunchPage />}
        {currentState === 'login' && <LoginPage />}
        {currentState === 'era' && <SelectEraPage />}
        {currentState === 'opponent' && <SelectOpponentPage />}
        {currentState === 'placement' && <PlacementPage />}
        {currentState === 'play' && <PlayingPage />}
        {currentState === 'over' && <OverPage />}
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
