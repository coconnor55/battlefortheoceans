// src/pages/LaunchPage.js
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const version = 'v0.3.4';

const LaunchPage = () => {
  const { dispatch, events } = useGame();
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
      <div className="content-pane content-pane--narrow">
        <div className="card-header">
          <h1 className="card-title">Battle for the Oceans</h1>
          <p className="card-subtitle">Strategic Naval Combat</p>
        </div>
        <div className="card-body flex flex-center">
          <button
            className="btn btn--primary btn--lg"
            onClick={handleCloseDialog}
            disabled={!canProceed}
            style={{
              opacity: canProceed ? 1 : 0.6,
              cursor: canProceed ? 'pointer' : 'not-allowed'
            }}
          >
            Play Game
          </button>
        </div>
        <div className="card-footer">
        </div>
      </div>
    </div>
  );
};

export default LaunchPage;

// EOF
