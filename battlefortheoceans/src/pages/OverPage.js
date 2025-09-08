// src/components/OverPage.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import './OverPage.css';

const OverPage = ({ onRestart }) => (
  <div className="over-page">
    <h2>Game Over</h2>
    <div className="score">Score: 100</div>
    <button onClick={onRestart}>Restart Game</button>
  </div>
);

export default OverPage;

// EOF - EOF - EOF

