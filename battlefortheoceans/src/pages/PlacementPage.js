// src/pages/PlacementPage.js (v0.1.3)
// Copyright(c) 2025, Clint H. O’Connor

import React, { useContext } from 'react';
import { GameContext } from '../context/GameContext';
import Debug from '../utils/Debug';
import Placer from '../classes/Placer';
import PlacerRenderer from '../classes/PlacerRenderer';
import './PlacementPage.css';

const version = 'v0.1.3';

const PlacementPage = () => {
  const { dispatch, stateMachine } = useContext(GameContext);
  const userId = stateMachine.context.player?.id || 'defaultPlayer';
  const { rows, cols, terrain, ships: fleetConfig } = stateMachine.context.config || { rows: 10, cols: 10, terrain: [], ships: [] };

  const handleCloseDialog = () => {
    if (dispatch) {
      console.log(version, 'Firing PLAY event from handleCloseDialog');
      dispatch(stateMachine.event.PLAY);
    } else {
      console.error(version, 'Dispatch is not available in handleCloseDialog');
    }
  };

  useEffect(() => {
    const placer = new Placer(new Board(rows, cols, terrain), fleetConfig, userId);
    const renderer = new PlacerRenderer(placer, userId);
    // Assuming PlacerRenderer integrates with the page; adjust if needed
  }, [rows, cols, terrain, fleetConfig, userId]);

  return (
    <div className="placement-page">
      <div className="game-board">
        <PlacerRenderer placer={new Placer(new Board(rows, cols, terrain), fleetConfig, userId)} userId={userId} onClose={handleCloseDialog} />
      </div>
    </div>
  );
};

export default PlacementPage;

// EOF - EOF - EOF
