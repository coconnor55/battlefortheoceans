// src/App.js
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { VideoProvider } from './context/VideoContext'; // New context
import LaunchPage from './pages/LaunchPage';
import LoginPage from './pages/LoginPage';
import SelectEraPage from './pages/SelectEraPage';
import PlacementPage from './pages/PlacementPage';
import PlayingPage from './pages/PlayingPage';
import OverPage from './pages/OverPage';
import './App.css';

const version = 'v.1.39'
const App = () => {
  const { stateMachine, dispatch } = useGame();

  const PageRenderer = () => {
    const currentState = stateMachine.getCurrentState();
    console.log(version, 'Rendering ${currentState}');
    return (
      <div key={currentState}>
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
              return <div>Unknown state</div>;
          }
        })()}
      </div>
    );
  };

  return (
    <div className="App">
      <main>
        <PageRenderer />
      </main>
    </div>
  );
};

const WrappedApp = () => (
  <VideoProvider>
    <GameProvider>
      <App />
    </GameProvider>
  </VideoProvider>
);

export default WrappedApp;

// EOF - EOF - EOF
