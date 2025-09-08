// src/components/PlayingPage.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import './PlayingPage.css';

const PlayingPage = ({ onOver }) => (
  <div className="playing-page">
    <div className="game-board">
      {/* Placeholder for grid */}
      <div className="grid">10x10 Grid</div>
    </div>
    <div className="message-console">Your turn - call a shot (e.g., J4).</div>
  </div>
);

export default PlayingPage;

// EOF - EOF - EOF
