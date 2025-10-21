// src/components/InfoButton.js v0.1.0
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';

const version = "v0.1.0"

const InfoButton = ({ onClick }) => {
  return (
    <button
      className="info-button"
      onClick={onClick}
      aria-label="Show help"
      title="Help"
    >
      <span className="info-button__icon">i</span>
    </button>
  );
};

export default InfoButton;

// EOF
