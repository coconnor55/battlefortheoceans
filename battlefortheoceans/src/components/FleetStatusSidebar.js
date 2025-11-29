// src/components/FleetStatusSidebar.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.2: Compact munitions display - all on one line separated by |
//         - Shows star shells, scatter shot, and torpedoes
//         - Only displays when non-zero
//         - Calculates torpedoes from fleet submarines
//
// v0.2.1: Munitions refactoring - use munitions object instead of starShellsRemaining
// v0.2.0: Added multi-fleet support for Pirates era
//         - Can now display multiple opponent fleets with captain names
//         - Uses last name as header (e.g., "Cofresí", "Lafitte")
//         - Maintains single-fleet support for traditional eras
// v0.1.2: Removed health status indicators to preserve progressive fog of war
// v0.1.1: Fixed ship health check to use getHealthPercent()
// v0.1.0: Initial fleet status sidebar component

import React from 'react';

const version = 'v0.2.2';

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

const FleetStatusSidebar = ({ fleet, fleets, title = 'Fleet', playerId, munitions }) => {
  // Debug log
  if (title === 'Home' && munitions) {
    console.log('[MUNITIONS]', 'Munitions:', munitions);
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
      
      {/* Munitions counter (only for Home/player fleet) - compact one-line display */}
      {title === 'Home' && munitions && (() => {
        // Calculate total torpedoes from fleet submarines
        const totalTorpedoes = fleet?.ships?.reduce((total, ship) => {
          if (ship.class?.toLowerCase() === 'submarine' && !ship.isSunk() && ship.getTorpedoes) {
            return total + (ship.getTorpedoes() || 0);
          }
          return total;
        }, 0) || 0;
        
        // Build munitions array (only non-zero)
        const munitionsList = [];
        if (munitions.starShells > 0) {
          munitionsList.push({ icon: '✨', count: munitions.starShells });
        }
        if (munitions.scatterShot > 0) {
          munitionsList.push({ icon: '💥', count: munitions.scatterShot });
        }
        if (totalTorpedoes > 0) {
          munitionsList.push({ icon: '🚀', count: totalTorpedoes });
        }
        
        // Only render if there are any munitions
        if (munitionsList.length === 0) return null;
        
        return (
          <div className="fleet-status-resource" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {munitionsList.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span style={{ color: 'var(--text-dim)', margin: '0 0.25rem' }}>|</span>}
                <span className="fleet-status-resource-emoji">{item.icon}</span>
                <span className="fleet-status-resource-count">{item.count}</span>
              </React.Fragment>
            ))}
          </div>
        );
      })()}
          
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
