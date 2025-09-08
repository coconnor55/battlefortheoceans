// src/components/PlacementPage.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import './PlacementPage.css';

const PlacementPage = ({ onGo }) => (
  <div className="placement-page">
    <div className="game-board">
      {/* Placeholder for grid */}
      <div className="grid">10x10 Grid</div>
    </div>
    <div className="message-console">Place your carrier (5 squares).</div>
    <button onClick={onGo}>Go!</button>
  </div>
);

export default PlacementPage;

// EOF - EOF - EOF
