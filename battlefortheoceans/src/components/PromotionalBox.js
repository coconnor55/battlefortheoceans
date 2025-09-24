// src/components/PromotionalBox.js
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';

const version = 'v0.1.1';

const PromotionalBox = ({ eraConfig, userProfile, onPurchase }) => {
  // Only show promotion after Traditional Battleship games
  if (eraConfig?.name !== 'Traditional Battleship') {
    return null;
  }

  const handleLearnMore = () => {
    console.log(version, 'User clicked learn more for Midway Island');
    if (onPurchase) {
      onPurchase('midway_island');
    }
  };

  return (
    <div className="promotional-box">
      <div className="promo-header">
        <h3>Tired of Traditional Battleship?</h3>
      </div>
      
      <div className="promo-content">
        <div className="promo-text">
          <h4>Try Midway Island!</h4>
          <p>
            Take command of the US Navy or Imperial Navy and fight the historic
            Battle of Midway, June 4-7, 1942. Experience carrier warfare with
            authentic ship rosters and strategic Pacific theater combat.
          </p>
          
          <div className="promo-features">
            <div className="feature-item">
              <span className="feature-icon">⚓</span>
              <span>Choose your alliance: US Navy or Imperial Navy</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🚢</span>
              <span>Command legendary ships: USS Enterprise, Akagi, Yorktown</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🗺️</span>
              <span>12x12 battlefield with authentic Pacific terrain</span>
            </div>
          </div>
        </div>
        
        <div className="promo-image">
          <div className="promo-image-container">
            <img
              src="https://battlefortheoceans.b-cdn.net/midway-battle.jpg"
              alt="Battle of Midway - Historic WWII naval combat"
              className="battle-photo"
            />
            <div className="image-overlay">
              <span className="price-badge">$2.99</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="promo-actions">
        <button
          className="btn btn-primary promo-button"
          onClick={handleLearnMore}
        >
          More...
        </button>
        
        <div className="promo-disclaimer">
          <p>One-time purchase • Unlock forever • No subscriptions</p>
        </div>
      </div>
    </div>
  );
};

export default PromotionalBox;
// EOF
