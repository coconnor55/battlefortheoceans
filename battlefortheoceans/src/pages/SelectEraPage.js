// src/components/SelectEraPage.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import './SelectEraPage.css';

const SelectEraPage = ({ onPlay }) => (
  <div className="select-era-page">
    <div className="era-list">
      <h2>Select an Era</h2>
      <div className="scrollable-eras">
        <div>Traditional Battleship</div>
        <div>Pirates in the Gulf</div>
      </div>
    </div>
    <div className="opponent-list">
      <h2>Opponents</h2>
      <div className="scrollable-opponents">
        <div>Opponent 1</div>
        <div>Opponent 2</div>
      </div>
    </div>
    <button onClick={onPlay}>Play Now</button>
  </div>
);

export default SelectEraPage;

// EOF - EOF - EOF
