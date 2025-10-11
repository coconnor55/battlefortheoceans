// src/pages/LaunchPage.js v0.3.7
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.7: Updated tagline to marketing-focused copy
// v0.3.6: Get appVersion from GameContext instead of props

import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const version = 'v0.3.7';

const LaunchPage = () => {
  const { dispatch, events, appVersion } = useGame();
  const [canProceed, setCanProceed] = useState(false);

  // Minimum 1-second display time for readability
  useEffect(() => {
    console.log('[DEBUG]', version, 'LaunchPage mounted');
    const timer = setTimeout(() => {
      setCanProceed(true);
      console.log('[DEBUG]', version, 'LaunchPage ready to proceed');
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleCloseDialog = () => {
    if (!canProceed) {
      console.log('[DEBUG]', version, 'Button clicked too early, waiting for minimum display time');
      return;
    }
    
    if (dispatch) {
      console.log('[DEBUG]', version, 'Firing LOGIN event');
      dispatch(events.LOGIN);
    } else {
      console.error('[DEBUG]', version, 'Dispatch not available');
    }
  };

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--medium">
        <div className="card-header">
          <h1 className="card-title">Battle for the Oceans</h1>
          <p className="card-subtitle hero-tagline">
            Command history's greatest naval battles.<br />
            One perfect shot at a time.
          </p>
        </div>
        <div className="card-body flex flex-center">
          <button
            className={`btn btn--primary btn--lg ${!canProceed ? 'btn--disabled' : ''}`}
            onClick={handleCloseDialog}
            disabled={!canProceed}
          >
            Play Game
          </button>
        </div>
        <div className="card-footer">
          {appVersion && (
            <p className="game-version">{appVersion}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaunchPage;

// EOF
