// src/App.js
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import LaunchPage from './pages/LaunchPage';
import LoginPage from './pages/LoginPage';
import SelectEraPage from './pages/SelectEraPage';
import PlacementPage from './pages/PlacementPage';
import PlayingPage from './pages/PlayingPage';
import OverPage from './pages/OverPage';
import './App.css';

const version = 'v0.1.46';

const SceneRenderer = () => {
  const { stateMachine } = useGame();
  
  const currentState = stateMachine.getCurrentState();
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
          case 'placement':
            return <PlacementPage />;
          case 'play':
            return <PlayingPage />;
          case 'over':
            return <OverPage />;
          default:
            return <div>Unknown state: {currentState}</div>;
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
