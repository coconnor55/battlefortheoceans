// src/components/InfoPanel.js
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';

const version = 'v0.1.0';

const InfoPanel = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Dark overlay */}
      <div 
        className="info-panel-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Info panel sidebar */}
      <div className="info-panel">
        <div className="info-panel__header">
          <h3 className="info-panel__title">{title}</h3>
          <button
            className="info-panel__close"
            onClick={onClose}
            aria-label="Close help panel"
          >
            ×
          </button>
        </div>
        
        <div className="info-panel__content">
          {children}
        </div>
      </div>
    </>
  );
};

export default InfoPanel;

// EOF
