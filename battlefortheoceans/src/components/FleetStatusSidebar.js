// src/components/FleetStatusSidebar.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.0: Added multi-fleet support for Pirates era
//         - Can now display multiple opponent fleets with captain names
//         - Uses last name as header (e.g., "Cofresí", "Lafitte")
//         - Maintains single-fleet support for traditional eras
// v0.1.2: Removed health status indicators to preserve progressive fog of war
// v0.1.1: Fixed ship health check to use getHealthPercent()
// v0.1.0: Initial fleet status sidebar component

import React from 'react';

const version = 'v0.2.0';

// Ship class abbreviations
const CLASS_ABBREV = {
  'Carrier': 'CV',
  'Battleship': 'BB',
  'Heavy Cruiser': 'CA',
  'Light Cruiser': 'CL',
  'Cruiser': 'CA',
  'Submarine': 'SS',
  'Destroyer': 'DD',
  'PT Boat': 'PT',
  'Frigate': 'FG',
  'Schooner': 'SCH',
  'Sloop': 'SLP',
  'Cutter': 'CTR'
};

const FleetStatusSidebar = ({ fleet, fleets, title = 'Fleet', playerId, starShellsRemaining }) => {
  // Debug log
  if (title === 'Home' && starShellsRemaining !== undefined) {
    console.log('[FLEET-SIDEBAR]', 'Star shells remaining:', starShellsRemaining);
  }
  
  // Multi-fleet mode (Pirates era)
  if (fleets && fleets.length > 0) {
    return (
      <div className="fleet-status-sidebar">
        <div className="fleet-status-header">{title}</div>
        
        {fleets.map((opponentData, index) => {
          const { player, captainName } = opponentData;
          
          // Extract last name for compact display
          const lastName = captainName ? captainName.split(' ').pop() : `Opponent ${index + 1}`;
          
          return (
            <div key={player.id} className="fleet-status-group">
              <div className="fleet-status-subheader">{lastName}</div>
              <div className="fleet-status-ships">
                {player.fleet?.ships?.map((ship) => {
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
        })}
      </div>
    );
  }
  
  // Single-fleet mode (Traditional/Midway eras)
  if (!fleet || !fleet.ships || fleet.ships.length === 0) {
    return null;
  }

  return (
    <div className="fleet-status-sidebar">
      <div className="fleet-status-header">{title}</div>
      
      {/* Star shell counter (only for Home/player fleet) */}
      {title === 'Home' && starShellsRemaining !== undefined && (
        <div className="fleet-status-resource">
          <span className="fleet-status-resource-emoji">💥</span>
          <span className="fleet-status-resource-count">{starShellsRemaining}</span>
        </div>
      )}
      
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

// Helper functions
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

export default FleetStatusSidebar;
// EOF
