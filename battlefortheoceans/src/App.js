// src/App.js (v0.2.4)
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

const version = 'v0.2.4';

const SceneRenderer = () => {
  const { currentState, eraConfig, subscribeToUpdates } = useGame();
  
  // Force re-render trigger when game logic changes
  const [, setRenderTrigger] = useState(0);

  // Subscribe to game logic updates for state machine transitions
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      setRenderTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);
  
  // Apply era theme to body
  useEffect(() => {
    if (eraConfig?.name) {
      const eraMap = {
        'Traditional Battleship': 'traditional',
        'Midway Island': 'midway'
      };
      const eraKey = eraMap[eraConfig.name] || 'traditional';
      document.body.dataset.era = eraKey;
      console.log(`${version} Theme switched to: ${eraKey}`);
    } else {
      document.body.dataset.era = 'traditional';
    }
  }, [eraConfig]);
  
  // Check if current URL is for password reset
  const isResetPasswordRoute = window.location.pathname === '/reset-password' ||
                               window.location.hash.includes('type=recovery');
  
  if (isResetPasswordRoute) {
    console.log(version, 'Rendering reset password page (URL-based routing)');
    return <ResetPasswordPage />;
  }
  
  console.log(version, 'Rendering scene for', currentState);
  
  return (
    <div className="scene">
      {(() => {
        switch (currentState) {
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
