// src/components/GameModeSelector.js
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import './GameModeSelector.css';

const version = "v0.1.0"

const GameModeSelector = ({
  eraConfig,
  selectedMode,
  onModeSelect,
  disabled = false
}) => {
  if (!eraConfig?.game_modes?.available) {
    return null;
  }

  const { available: gameModes, default: defaultMode } = eraConfig.game_modes;
  const currentSelection = selectedMode || defaultMode;

  return (
    <div className="game-mode-selector">
      <h3>Game Mode</h3>
      <div className="mode-options">
        {gameModes.map((mode) => (
          <div
            key={mode.id}
            className={`mode-option ${currentSelection === mode.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && onModeSelect(mode)}
          >
            <div className="mode-header">
              <div className="mode-radio">
                <input
                  type="radio"
                  id={`mode-${mode.id}`}
                  name="gameMode"
                  value={mode.id}
                  checked={currentSelection === mode.id}
                  onChange={() => !disabled && onModeSelect(mode)}
                  disabled={disabled}
                />
                <label htmlFor={`mode-${mode.id}`}>
                  <span className="mode-name">{mode.name}</span>
                </label>
              </div>
              {mode.rapid_fire && (
                <span className="mode-badge rapid">RAPID</span>
              )}
            </div>
            
            <div className="mode-description">
              {mode.description}
            </div>
            
            <div className="mode-details">
              <div className="mode-rule">
                <span className="rule-label">On Hit:</span>
                <span className="rule-value">
                  {mode.turn_on_hit ? 'Continue Turn' : 'End Turn'}
                </span>
              </div>
              <div className="mode-rule">
                <span className="rule-label">On Miss:</span>
                <span className="rule-value">
                  {mode.turn_on_miss ? 'Continue Turn' : 'End Turn'}
                </span>
              </div>
              {mode.simultaneous_fire && (
                <div className="mode-rule">
                  <span className="rule-label">Style:</span>
                  <span className="rule-value">Simultaneous Fire</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameModeSelector;
// EOF
