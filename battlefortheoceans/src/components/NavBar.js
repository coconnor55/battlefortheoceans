// src/components/NavBar.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.8: Enabled Stats button
// v0.2.7: Show Return to Game for all states when overlay is active
// v0.2.6: Only show Return to Game button when overlay is active

import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';

const version = 'v0.2.8';

const NavBar = ({ onShowStats, onShowAchievements, onCloseOverlay, hasActiveOverlay }) => {
  const { currentState, userProfile, subscribeToUpdates } = useGame();
  const [, forceUpdate] = useState(0);
  
  // Force re-render when game state changes
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      forceUpdate(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);
  
  if (currentState === 'launch' || currentState === 'login') {
    return null;
  }
  
  console.log('[NAVBAR]', version, 'Rendering for state:', currentState, 'hasOverlay:', hasActiveOverlay);
  
  const handleNavigate = (destination) => {
    console.log('[NAVBAR]', version, 'Navigate to:', destination);
    
    switch (destination) {
      case 'game':
        if (onCloseOverlay) {
          onCloseOverlay();
        }
        break;
        
      case 'stats':
        if (onShowStats) {
          onShowStats();
        }
        break;
        
      case 'achievements':
        if (onShowAchievements) {
          onShowAchievements();
        }
        break;
        
      default:
        console.warn('[NAVBAR]', version, 'Unknown destination:', destination);
    }
  };
  
  // Show "Return to Game" whenever there's an active overlay (any state except launch/login)
  const showReturnButton = hasActiveOverlay;
  const showStatsButton = ['era', 'opponent', 'placement', 'play', 'over'].includes(currentState);
  const showAchievementsButton = ['era', 'opponent', 'placement', 'play', 'over'].includes(currentState);
  
  // Don't show stats for guest users (no persistent data)
  const isGuest = userProfile?.id?.startsWith('guest-');
  
  return (
    <nav className="nav-bar">
      <div className="nav-bar__container">
        <div className="nav-bar__logo">
          Battle for the Oceans
        </div>
        
        <div className="nav-bar__links">
          {showReturnButton && (
            <button
              className="btn btn--secondary btn--thin"
              onClick={() => handleNavigate('game')}
              aria-label="Return to game"
            >
              Return to Game
            </button>
          )}
          
          {showStatsButton && !isGuest && (
            <button
              className="btn btn--secondary btn--thin"
              onClick={() => handleNavigate('stats')}
              aria-label="View statistics"
              title="View your combat statistics"
            >
              Stats
            </button>
          )}
          
          {showAchievementsButton && (
            <button
              className="btn btn--secondary btn--thin"
              onClick={() => handleNavigate('achievements')}
              aria-label="View achievements"
            >
              Achievements
            </button>
          )}
        </div>
        
        {userProfile && (
          <div className="nav-bar__user">
            <span className="nav-bar__username">{userProfile.game_name || 'Guest'}</span>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
// EOF
