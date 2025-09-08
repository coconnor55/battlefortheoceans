// src/components/LaunchPage.js (v0.1.1)
// Copyright(c) 2025, Clint H. O'Connor
// Changes: Updated video source to 'battlefortheoceans.mp4'

import React from 'react';
import './LaunchPage.css';

const LaunchPage = ({ onPlay }) => (
  <div className="launch-page">
    <video autoPlay muted loop>
      <source src="/videos/battlefortheoceans.mp4" type="video/mp4" />
    </video>
    <button onClick={onPlay}>Play Now</button>
  </div>
);

export default LaunchPage;

// EOF - EOF - EOF
