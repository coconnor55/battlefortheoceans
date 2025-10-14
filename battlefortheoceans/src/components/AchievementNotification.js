// src/components/AchievementNotification.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';

const version = 'v0.1.0';

const AchievementNotification = ({ achievements, onClose }) => {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (achievements && achievements.length > 0) {
      console.log('[ACHIEVEMENT]', version, 'Showing notification for:', achievements[currentIndex]?.name);
      setVisible(true);
      
      // Auto-advance to next achievement after 3 seconds
      const timer = setTimeout(() => {
        if (currentIndex < achievements.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          // All achievements shown, close notification
          setVisible(false);
          setTimeout(() => {
            onClose && onClose();
          }, 300); // Wait for fade-out animation
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [achievements, currentIndex, onClose]);

  if (!achievements || achievements.length === 0 || !visible) {
    return null;
  }

  const achievement = achievements[currentIndex];
  const remaining = achievements.length - currentIndex - 1;

  const getTierColor = (tier) => {
    switch (tier) {
      case 'bronze': return '#CD7F32';
      case 'silver': return '#C0C0C0';
      case 'gold': return '#FFD700';
      case 'platinum': return '#E5E4E2';
      default: return '#00D9FF';
    }
  };

  const getTierEmoji = (tier) => {
    switch (tier) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      case 'platinum': return '💎';
      default: return '⭐';
    }
  };

  return (
    <div className="achievement-notification achievement-notification--visible">
      <div className="achievement-notification__content">
        <div className="achievement-notification__header">
          <span className="achievement-notification__badge">Achievement Unlocked!</span>
          {remaining > 0 && (
            <span className="achievement-notification__counter">+{remaining} more</span>
          )}
        </div>
        
        <div className="achievement-notification__body">
          <div 
            className="achievement-notification__icon"
            style={{ color: getTierColor(achievement.tier) }}
          >
            {achievement.badge_icon || getTierEmoji(achievement.tier)}
          </div>
          
          <div className="achievement-notification__details">
            <h3 className="achievement-notification__name">{achievement.name}</h3>
            <p className="achievement-notification__description">{achievement.description}</p>
            <div className="achievement-notification__points">
              <span className="achievement-notification__points-value">
                +{achievement.points} points
              </span>
              <span 
                className="achievement-notification__tier"
                style={{ color: getTierColor(achievement.tier) }}
              >
                {achievement.tier.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        
        <button 
          className="achievement-notification__close"
          onClick={() => {
            setVisible(false);
            setTimeout(() => onClose && onClose(), 300);
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default AchievementNotification;

// EOF
