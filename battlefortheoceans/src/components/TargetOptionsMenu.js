// src/components/TargetOptionsMenu.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.2: Filter out munitions with zero count from menu display
// v0.2.1: Added torpedo option (only when submarine has torpedoes)
// v0.2.0: Renamed from ActionMenu to TargetOptionsMenu (semantic accuracy)
//         - Removed munitions prop drilling - now reads from useGameState directly
//         - Component name reflects purpose: options when targeting a cell
// v0.1.3: Munitions refactoring - use munitions object instead of starShellsRemaining// v0.1.1: Added backdrop to close menu on outside click
// v0.1.1: Added backdrop to close menu on outside click
// v0.1.0: Radial menu for attack actions (Shot/Star Shell/Scatter Shot)

import React from 'react';
import useGameState from '../hooks/useGameState';

const version = 'v0.2.2';

const TargetOptionsMenu = ({ x, y, onAction, onClose }) => {
  const { munitions, humanPlayer } = useGameState();
    console.log('[MUNITIONS] Received munitions:', munitions);  // ADD THIS LINE

    // Check if player has any submarine with torpedoes available
    const getTotalTorpedoes = () => {
      if (!humanPlayer?.fleet?.ships) {
        console.log('[MUNITIONS] No humanPlayer or fleet.ships');
        return 0;
      }
      
      const submarines = humanPlayer.fleet.ships.filter(ship => {
        const isSub = ship.class?.toLowerCase() === 'submarine';
        const notSunk = !ship.isSunk();
        const hasTorpedoes = ship.getTorpedoes && ship.getTorpedoes() > 0;
        console.log('[MUNITIONS] Ship:', ship.name, 'class:', ship.class, 'isSub:', isSub, 'notSunk:', notSunk, 'torpedoes:', ship.getTorpedoes ? ship.getTorpedoes() : 'no method');
        return isSub && notSunk && hasTorpedoes;
      });
      
      const total = submarines.reduce((sum, ship) => {
        const count = ship.getTorpedoes ? ship.getTorpedoes() : 0;
        return sum + count;
      }, 0);
      
      console.log('[MUNITIONS] Found', submarines.length, 'submarines with', total, 'total torpedoes');
      return total;
    };
    
    const totalTorpedoes = getTotalTorpedoes();
    console.log('[MUNITIONS] Total torpedoes available:', totalTorpedoes);

    const allActions = [
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
      enabled: munitions.scatterShot > 0,
      count: munitions.scatterShot
    },
    {
      id: 'torpedo',
      label: 'Torpedo',
      emoji: '🚀',
      enabled: totalTorpedoes > 0,
      count: totalTorpedoes
    }
  ];
  
  // Filter out munitions with zero count (always show 'shot' as it's always available)
  const actions = allActions.filter(action => 
    action.id === 'shot' || (action.enabled && (action.count === undefined || action.count > 0))
  );

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
