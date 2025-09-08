// src/App.js (v0.1.24)
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import LaunchPage from './pages/LaunchPage';
import LoginPage from './pages/LoginPage';
import SelectEraPage from './pages/SelectEraPage';
import PlacementPage from './pages/PlacementPage';
import PlayingPage from './pages/PlayingPage';
import OverPage from './pages/OverPage';
import './App.css';

const App = () => {
  const [currentPage, setCurrentPage] = useState('launch');
  const { stateMachine, dispatch } = useGame();

  useEffect(() => {
    console.log(`Transitioning from ${stateMachine.getCurrentState()} to ${currentPage} via event ${stateMachine.getLastEvent()}`);
    if (!dispatch) console.error('Dispatch is undefined in App.js useGame hook');
  }, [currentPage, stateMachine.getCurrentState(), stateMachine.getLastEvent()]);

  const handleTransition = (event) => {
    if (!dispatch) {
      console.error('Dispatch is not a function in handleTransition', event);
      return;
    }
    console.log('Dispatching event:', event);
    dispatch(event);
    setCurrentPage(stateMachine.getCurrentState());
  };

  const PageRenderer = () => {
    switch (currentPage) {
      case 'launch':
        return <LaunchPage onPlay={() => handleTransition({ type: 'X-LOGIN' })} />;
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
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Battle for the Oceans</h1>
      </header>
      <main>
        <PageRenderer />
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

// EOF - EOF - EOF
