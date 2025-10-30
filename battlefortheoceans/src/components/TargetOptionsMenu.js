// src/components/TargetOptionsMenu.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.0: Renamed from ActionMenu to TargetOptionsMenu (semantic accuracy)
//         - Removed munitions prop drilling - now reads from useGameState directly
//         - Component name reflects purpose: options when targeting a cell
// v0.1.3: Munitions refactoring - use munitions object instead of starShellsRemaining// v0.1.1: Added backdrop to close menu on outside click
// v0.1.1: Added backdrop to close menu on outside click
// v0.1.0: Radial menu for attack actions (Shot/Star Shell/Scatter Shot)

import React from 'react';
import useGameState from '../hooks/useGameState';

const version = 'v0.2.0';

const TargetOptionsMenu = ({ x, y, onAction, onClose }) => {
  const { munitions } = useGameState();
    console.log('[MUNITIONS] Received munitions:', munitions);  // ADD THIS LINE

    const actions = [
    {
      id: 'shot',
      label: 'Shot',
      emoji: '🎯',
      enabled: true
    },
    {
      id: 'star',
      label: 'Star Shell',
      emoji: '✨',
        enabled: munitions.starShells > 0,
        count: munitions.starShells
    },
    {
      id: 'scatter',
      label: 'Scatter Shot',
      emoji: '💥',
      enabled: false // Coming soon
    }
  ];

  const handleAction = (actionId) => {
    if (actions.find(a => a.id === actionId)?.enabled) {
      onAction(actionId);
    }
  };

  return (
    <>
      <div className="action-menu-backdrop" onClick={onClose} />
      <div
        className="action-menu"
        style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="action-menu__items">
          {actions.map((action) => (
            <button
              key={action.id}
              className={`action-menu__item ${!action.enabled ? 'action-menu__item--disabled' : ''}`}
              onClick={() => handleAction(action.id)}
              disabled={!action.enabled}
            >
              <span className="action-menu__emoji">{action.emoji}</span>
              <span className="action-menu__label">{action.label}</span>
              {action.count !== undefined && (
                <span className="action-menu__count">({action.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default TargetOptionsMenu;
// EOF
