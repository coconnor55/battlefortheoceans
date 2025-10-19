// src/components/FleetStatusSidebar.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.2: Removed health status indicators to preserve progressive fog of war
//         - Only shows 💀 for sunk ships (respects fog of war)
//         - No visual indication of damage until ship is sunk
// v0.1.1: Fixed ship health check to use getHealthPercent() instead of getCurrentHealth()
// v0.1.0: Initial fleet status sidebar component

import React from 'react';

const version = 'v0.1.2';

// Ship class abbreviations
const CLASS_ABBREV = {
  'Carrier': 'CV',
  'Battleship': 'BB',
  'Cruiser': 'CA',
  'Submarine': 'SS',
  'Destroyer': 'DD',
  'PT Boat': 'PT'
};

const FleetStatusSidebar = ({ fleet, title = 'Fleet', playerId }) => {
  if (!fleet || !fleet.ships || fleet.ships.length === 0) {
    return null;
  }

  const getShipStatus = (ship) => {
    if (ship.isSunk()) {
      return { emoji: '💀', status: 'sunk' };
    }
    
    // No status indicator for active ships (preserves fog of war)
    return { emoji: '', status: 'active' };
  };

  const getShipAbbrev = (ship) => {
    return CLASS_ABBREV[ship.class] || ship.class.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fleet-status-sidebar">
      <div className="fleet-status-header">
        {title}
      </div>
      
      <div className="fleet-status-ships">
        {fleet.ships.map((ship) => {
          const { emoji, status } = getShipStatus(ship);
          const abbrev = getShipAbbrev(ship);
          
          return (
            <div
              key={ship.id}
              className={`fleet-status-ship fleet-status-ship--${status}`}
            >
              <span className="fleet-status-emoji">{emoji}</span>
              <span className={`fleet-status-text ${status === 'sunk' ? 'fleet-status-text--strikethrough' : ''}`}>
                {abbrev}({ship.size})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FleetStatusSidebar;
// EOF
