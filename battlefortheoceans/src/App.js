// src/App.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import StateMachine from './classes/StateMachine';
import LaunchPage from './pages/LaunchPage';
import LoginPage from './pages/LoginPage';
import SelectEraPage from './pages/SelectEraPage';
import PlacementPage from './pages/PlacementPage';
import PlayingPage from './pages/PlayingPage';
import OverPage from './pages/OverPage';

const PageRenderer = () => {
  const { stateMachine } = useGame();
  const [currentPage, setCurrentPage] = useState(stateMachine.getCurrentState());

  useEffect(() => {
    const handleTransition = (event) => {
      const nextPage = stateMachine.transition(event);
      if (nextPage) setCurrentPage(stateMachine.getCurrentState());
    };

    // Initial setup for event handling (e.g., from button clicks)
    window.addEventListener('X-LOGIN', () => handleTransition('X-LOGIN'));
    // Add other event listeners as needed (X-SELECTERA, X-PLACEMENT, etc.)

    return () => {
      window.removeEventListener('X-LOGIN', () => handleTransition('X-LOGIN'));
    };
  }, [stateMachine]);

  const renderPage = () => {
    switch (currentPage) {
      case 'launch': return <LaunchPage onPlay={() => window.dispatchEvent(new Event('X-LOGIN'))} />;
      case 'login': return <LoginPage />;
      case 'select_era': return <SelectEraPage />;
      case 'placement': return <PlacementPage />;
      case 'playing': return <PlayingPage />;
      case 'over': return <OverPage />;
      default: return <LaunchPage onPlay={() => window.dispatchEvent(new Event('X-LOGIN'))} />;
    }
  };

  return renderPage();
};

const App = () => (
  <GameProvider>
    <PageRenderer />
  </GameProvider>
);

export default App;

// EOF - EOF - EOF
