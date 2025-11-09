// src/components/PromotionalBox.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.1: Use singleton StripeService instance
//         - Changed import from StripeService (class) to stripeService (instance)
//         - Removed line 14: const stripeService = new StripeService()
//         - StripeService now exports singleton per v0.1.1
// v0.2.0: Previous version

import React, { useState, useEffect } from 'react';
import stripeService from '../services/StripeService';

const version = 'v0.2.1';
// Detect if we're in production (battlefortheoceans.com) or local development
const isProduction = window.location.hostname === 'battlefortheoceans.com';
const gameCDN = process.env.REACT_APP_GAME_CDN || '';

const PromotionalBox = ({ currentEra, availableEras, userRights, onPurchase }) => {
  const [promotionalEra, setPromotionalEra] = useState(null);
  const [priceInfo, setPriceInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    findPromotionalEra();
  }, [currentEra, availableEras, userRights]);

  useEffect(() => {
    if (promotionalEra?.promotional?.stripe_price_id) {
      fetchPriceInfo(promotionalEra.promotional.stripe_price_id);
    }
  }, [promotionalEra]);

  // Find the next purchasable era to promote
  const findPromotionalEra = () => {
    if (!currentEra || !availableEras || availableEras.length === 0) {
      setPromotionalEra(null);
      return;
    }

    // Only show promotions after free eras (like Traditional Battleship)
    if (!currentEra.free) {
      setPromotionalEra(null);
      return;
    }

    // Find eras with promotional data that user doesn't own
    const promotableEras = availableEras.filter(era => {
      // Must have promotional data
      if (!era.promotional || !era.promotional.stripe_price_id) {
        return false;
      }

      // Must not be free
      if (era.free) {
        return false;
      }

      // User must not already own it
      const hasAccess = userRights?.get(era.id);
      if (hasAccess) {
        return false;
      }

      return true;
    });

    if (promotableEras.length > 0) {
      // For now, promote the first available era
      // Later could implement prioritization logic
      setPromotionalEra(promotableEras[0]);
    } else {
      setPromotionalEra(null);
    }
  };

  const fetchPriceInfo = async (priceId) => {
    setLoading(true);
    try {
      const price = await stripeService.fetchPrice(priceId);
      setPriceInfo(price);
    } catch (error) {
      console.error(version, 'Failed to fetch price info:', error);
      setPriceInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLearnMore = () => {
    console.log(version, 'User clicked learn more for:', promotionalEra.name);
    if (onPurchase) {
      onPurchase(promotionalEra.id);
    }
  };

  // Don't show anything if no promotional era found
  if (!promotionalEra) {
    return null;
  }

    const promotionalImageUrl = promotionalEra.promontional.promotional_image
      ? isProduction
        ? `${gameCDN}/assets/eras/${promotionalEra.id}/${promotionalEra.promontional.promotional_image}`
        : `/assets/eras/${promotionalEra.id}/${promotionalEra.promontional.promotional_image}`
      : null;
    console.log('[DEBUG]', version, 'Setting promotional image:', promotionalImageUrl);

  return (
    <div className="promotional-box">
      <div className="promo-header">
        <h3>Tired of {currentEra.name}?</h3>
      </div>
      
      <div className="promo-content">
        <div className="promo-text">
          <h4>{promotionalEra.tagline || `Try ${promotionalEra.name}!`}</h4>
          <p>
            {promotionalEra.marketing_description || promotionalEra.era_description}
          </p>
          
          {promotionalEra.features && promotionalEra.features.length > 0 && (
            <div className="promo-features">
              {promotionalEra.features.map((feature, index) => (
                <div key={index} className="feature-item">
                  <span className="feature-icon">⚓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {promotionalImageUrl && (
          <div className="promo-image">
            <div className="promo-image-container">
              <img
                src={promotionalImageUrl}
                alt={`${promotionalEra.name} - Historic naval combat`}
                className="battle-photo"
              />
              <div className="image-overlay">
                {loading ? (
                  <span className="price-badge">Loading...</span>
                ) : priceInfo ? (
                  <span className="price-badge">{priceInfo.formatted}</span>
                ) : (
                  <span className="price-badge">$4.99</span>
                )}
              </div>
            </div>
          </div>
        )}
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
