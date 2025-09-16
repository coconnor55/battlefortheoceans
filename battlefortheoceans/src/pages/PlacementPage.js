// src/pages/PlacementPage.js (v0.1.7)
// Copyright(c) 2025, Clint H. O'Connor

import React, { useContext, useEffect, useState } from 'react';
import { GameContext } from '../context/GameContext';
import Board from '../classes/Board';
import Placer from '../classes/Placer';
import PlacerRenderer from '../components/PlacerRenderer';
import './PlacementPage.css';

const version = 'v0.1.7';

const PlacementPage = () => {
  const { dispatch, stateMachine, eraConfig, player, updatePlacementBoard } = useContext(GameContext);
  const [placer, setPlacer] = useState(null);
  const [error, setError] = useState(null);

  const userId = player?.id;

  useEffect(() => {
    console.log(version, 'PlacementPage useEffect triggered');
    console.log(version, 'Era config:', eraConfig?.name);
    console.log(version, 'Player ID:', userId);
    
    // Early return if no player - this shouldn't happen after login
    if (!userId) {
      setError('Player session lost. Please log in again.');
      return;
    }

    // Validate era configuration
    if (!eraConfig) {
      setError('Era configuration not found. Please select an era first.');
      return;
    }

    // Check for required properties
    const required = ['rows', 'cols', 'terrain', 'playerfleet'];
    const missing = required.filter(prop => !eraConfig[prop]);
    
    if (missing.length > 0) {
      setError(`Invalid Era Configuration - Missing: ${missing.join(', ')}`);
      return;
    }

    // Check for ships in playerfleet
    if (!eraConfig.playerfleet.ships || !Array.isArray(eraConfig.playerfleet.ships)) {
      setError('Invalid Era Configuration - Missing: ships in playerfleet');
      return;
    }

    try {
      const { rows, cols, terrain, playerfleet } = eraConfig;
      
      console.log(version, 'Creating board with dimensions:', rows, 'x', cols);
      console.log(version, 'Fleet ships:', playerfleet.ships.map(s => `${s.name}(${s.size})`));
      
      // Create the board
      const board = new Board(rows, cols, terrain);
      
      // Create the placer with the ships from playerfleet
      const newPlacer = new Placer(board, playerfleet.ships, userId);
      
      setPlacer(newPlacer);
      setError(null);
      
      console.log(version, 'Placer created successfully');
      
    } catch (err) {
      console.error(version, 'Error creating placer:', err);
      setError(`Failed to initialize placement: ${err.message}`);
    }
  }, [eraConfig, userId]);

  const handlePlacementComplete = () => {
    // Store the board with placed ships in GameContext
    updatePlacementBoard(placer.board);
    
    if (dispatch) {
      console.log(version, 'Firing PLAY event with placement board');
      dispatch(stateMachine.event.PLAY);
    } else {
      console.error(version, 'Dispatch is not available in handlePlacementComplete');
    }
  };

  if (error) {
    return (
      <div className="placement-page error">
        <div className="error-message">
          <h2>Configuration Error</h2>
          <p>{error}</p>
          <button onClick={() => dispatch(stateMachine.event.ERA)}>
            Back to Era Selection
          </button>
        </div>
      </div>
    );
  }

  if (!placer || !eraConfig) {
    return (
      <div className="placement-page loading">
        <div className="loading-message">
          <p>Loading placement board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="placement-page">
      <div className="game-info">
        <h2>Place Your Fleet</h2>
        <p>Era: {eraConfig.name}</p>
      </div>
      <div className="game-board">
        <PlacerRenderer
          placer={placer}
          userId={userId}
          onClose={handlePlacementComplete}
          rows={eraConfig.rows}
          cols={eraConfig.cols}
          terrain={eraConfig.terrain}
        />
      </div>
    </div>
  );
};

export default PlacementPage;

// EOF - EOF - EOF
