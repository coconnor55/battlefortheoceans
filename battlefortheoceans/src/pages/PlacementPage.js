// src/pages/PlacementPage.js (v0.1.4)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import { useGame } from '../context/GameContext';
import Placer from '../classes/Placer';
import PlacerRenderer from '../components/PlacerRenderer';
import Board from '../classes/Board';
import './PlacementPage.css';

const version = 'v0.1.4';

const PlacementPage = () => {
  const {
    dispatch,
    stateMachine,
    playerId,
    eraConfig,
    selectedEra,
    selectedOpponent
  } = useGame();

  const handleCloseDialog = () => {
    if (dispatch) {
      console.log(version, 'Firing PLAY event from handleCloseDialog');
      dispatch(stateMachine.event.PLAY);
    } else {
      console.error(version, 'Dispatch is not available in handleCloseDialog');
    }
  };

  // Validate required data
  if (!playerId) {
    return (
      <div className="placement-page">
        <div className="error-message">
          <h2>Authentication Required</h2>
          <p>Player ID not found. Please log in again.</p>
        </div>
      </div>
    );
  }

  if (!eraConfig) {
    return (
      <div className="placement-page">
        <div className="error-message">
          <h2>Era Not Selected</h2>
          <p>No era configuration found. Please select an era first.</p>
        </div>
      </div>
    );
  }

  const { rows, cols, terrain, ships: fleetConfig } = eraConfig;

  // Validate era config completeness
  if (!rows || !cols || !terrain || !fleetConfig) {
    return (
      <div className="placement-page">
        <div className="error-message">
          <h2>Invalid Era Configuration</h2>
          <p>Era configuration is incomplete. Missing: {
            [
              !rows && 'rows',
              !cols && 'cols',
              !terrain && 'terrain',
              !fleetConfig && 'ships'
            ].filter(Boolean).join(', ')
          }</p>
        </div>
      </div>
    );
  }

  console.log(version, 'PlacementPage initialized with:', {
    playerId,
    era: selectedEra?.name,
    opponent: selectedOpponent?.name,
    gridSize: `${rows}x${cols}`,
    shipCount: fleetConfig.length,
    terrainCount: terrain.length
  });

  return (
    <div className="placement-page">
      <div className="placement-header">
        <h2>Place Your Fleet</h2>
        <div className="game-info">
          <span className="era-name">{selectedEra?.name}</span>
          <span className="vs">vs</span>
          <span className="opponent-name">{selectedOpponent?.name}</span>
        </div>
      </div>
      <div className="game-board">
        <PlacerRenderer
          placer={new Placer(new Board(rows, cols, terrain), fleetConfig, playerId)}
          userId={playerId}
          onClose={handleCloseDialog}
        />
      </div>
    </div>
  );
};

export default PlacementPage;

// EOF - EOF - EOF
