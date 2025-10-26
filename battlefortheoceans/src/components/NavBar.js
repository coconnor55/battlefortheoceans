// src/components/NavBar.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.10: Added Help menu item to user dropdown
//          - Help appears between username header and Logout
//          - Calls onShowHelp prop to trigger GameGuide in App.js
//          - GameGuide centralized at App level, not page level
// v0.2.9: Added user menu dropdown with logout functionality
//         - Click username to show dropdown menu
//         - Menu shows username header + Logout button
//         - Logout calls CoreEngine.logout() → returns to LaunchPage
//         - Close on backdrop click or after logout
//         - Uses action menu styling from game-ui.css
// v0.2.8: Enabled Stats button
// v0.2.7: Show Return to Game for all states when overlay is active
// v0.2.6: Only show Return to Game button when overlay is active

import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { LogOut } from 'lucide-react';
import { HelpCircle } from 'lucide-react';

const version = 'v0.2.10';

const NavBar = ({ onShowStats, onShowAchievements, onShowHelp, onCloseOverlay, hasActiveOverlay }) => {
  const { currentState, userProfile, subscribeToUpdates, logout } = useGame();
  const [, forceUpdate] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  
  // Force re-render when game state changes
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      forceUpdate(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToUpdates]);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);
  
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
  
  const handleLogout = () => {
    console.log('[NAVBAR]', version, 'User clicked logout');
    setShowUserMenu(false);
    
    if (logout) {
      logout();
    } else {
      console.error('[NAVBAR]', version, 'No logout function available from GameContext');
    }
  };
  
    const handleHelp = () => {
      console.log('[NAVBAR]', version, 'User clicked help');
      setShowUserMenu(false);
      
      if (onShowHelp) {
        onShowHelp();
      }
    };
    
    const toggleUserMenu = () => {
    setShowUserMenu(prev => !prev);
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
          <div className="nav-bar__user" ref={menuRef}>
            <span
              className="nav-bar__username"
              onClick={toggleUserMenu}
              style={{ cursor: 'pointer' }}
              title="Click for user menu"
            >
              {userProfile.game_name || 'Guest'}
            </span>
            
            {showUserMenu && (
              <>
                <div
                  className="action-menu-backdrop"
                  onClick={() => setShowUserMenu(false)}
                  style={{ background: 'transparent' }}
                />
                <div
                  className="action-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    marginTop: '0.5rem'
                  }}
                >
                  <div className="action-menu__items">
                    <div
                      className="action-menu__item action-menu__item--header"
                      style={{
                        cursor: 'default',
                        background: 'var(--bg-medium)',
                        borderColor: 'var(--border-subtle)',
                        fontSize: '0.85rem',
                        padding: 'var(--space-xs) var(--space-md)'
                      }}
                    >
                      <span>{userProfile.game_name || 'Guest'}</span>
                    </div>
                    
                      <div
                        className="action-menu__item"
                        onClick={handleHelp}
                      >
                              <HelpCircle size={20} className="action-menu__emoji" />
                        <span className="action-menu__emoji"></span>
                        <span className="action-menu__label">Help</span>
                      </div>
                    <div
                      className="action-menu__item"
                      onClick={handleLogout}
                    >
                      <LogOut size={20} className="action-menu__emoji" />
                      <span className="action-menu__label">Logout</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
// EOF
