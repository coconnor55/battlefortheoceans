// src/components/InactivityWarning.js
// Copyright(c) 2025, Clint H. O'Connor

/**
 * v0.1.1: Simplified styling to match LaunchPage format
 *         - Uses same card structure as LaunchPage
 *         - Cleaner, centered layout
 *         - Minimal inline styles (countdown timer only)
 * v0.1.0: Initial inactivity warning modal
 *         - Shows countdown timer before auto-logout
 *         - "I'm Still Here" button dismisses and resets timer
 *         - Uses existing modal-overlay CSS classes
 *         - Integrates with App.js inactivity tracking
 */

import React, { useEffect } from 'react';

const version = 'v0.1.1';

/**
 * InactivityWarning - Modal warning for inactive users
 *
 * Displays countdown timer and allows user to confirm they're still active.
 * If user doesn't respond, App.js will auto-logout when timer reaches 0.
 *
 * @param {boolean} show - Whether to show the modal
 * @param {number} remainingSeconds - Seconds until auto-logout
 * @param {function} onDismiss - Callback when user clicks "I'm Still Here"
 *
 * @example
 * <InactivityWarning
 *   show={showWarning}
 *   remainingSeconds={180}
 *   onDismiss={handleDismiss}
 * />
 */
const InactivityWarning = ({ show, remainingSeconds, onDismiss }) => {
  if (!show) return null;

  // Format time as M:SS
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Color changes to red when under 1 minute
  const timerColor = remainingSeconds < 60 ? '#dc3545' : '#0066cc';

  return (
    <div className="modal-overlay modal-overlay--visible">
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--small">
          <div className="card-header">
            <h1 className="card-title text-center">⏰ Are You Still There?</h1>
            <p className="card-subtitle text-center">
              You've been inactive for a while.
            </p>
          </div>
          
          <div className="card-body flex flex-column flex-center">
            <p className="text-center" style={{ marginBottom: '1.5rem' }}>
              For security, we'll log you out in:
            </p>

            <div style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              marginBottom: '2rem',
              color: timerColor
            }}>
              {displayTime}
            </div>

            <button
              className="btn btn--primary btn--lg"
              onClick={onDismiss}
            >
              I'm Still Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InactivityWarning;
// EOF
