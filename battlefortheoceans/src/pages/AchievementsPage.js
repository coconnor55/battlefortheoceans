// src/pages/AchievementsPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Added badge click handler with InfoPanel details
//         - Click any achievement card to see full details
//         - InfoPanel shows description, tooltip, requirements, progress
//         - Reuses existing InfoPanel component and styles

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import AchievementService from '../services/AchievementService';
import InfoPanel from '../components/InfoPanel';
import * as LucideIcons from 'lucide-react';

const version = 'v0.1.1';

const AchievementsPage = ({ onClose }) => {
  const { userProfile, dispatch, events } = useGame();
  
  const [achievements, setAchievements] = useState({
    unlocked: [],
    inProgress: [],
    locked: [],
    total: 0,
    points: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // InfoPanel state
  const [showInfo, setShowInfo] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  const isGuest = userProfile?.id?.startsWith('guest-');

  // Redirect to login if no user profile
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);

  // Load achievements on mount
  useEffect(() => {
    const loadAchievements = async () => {
      if (!userProfile?.id) return;

      setLoading(true);
      setError(null);

      try {
        console.log(version, 'Loading achievements for user:', userProfile.id);
        const data = await AchievementService.getUserAchievements(userProfile.id);
        console.log(version, 'Achievement data received:', data);
        setAchievements(data);
      } catch (err) {
        console.error(version, 'Error loading achievements:', err);
        setError(err.message || 'Failed to load achievements');
      } finally {
        setLoading(false);
      }
    };

    loadAchievements();
  }, [userProfile]);

  // Helper function to get Lucide icon component by name
  const getLucideIcon = (iconName) => {
    const Icon = LucideIcons[iconName];
    return Icon || LucideIcons.Award; // Fallback to Award icon
  };

  // Helper function to get tier badge class
  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'bronze': return 'badge--bronze';
      case 'silver': return 'badge--silver';
      case 'gold': return 'badge--gold';
      case 'platinum': return 'badge--platinum';
      case 'diamond': return 'badge--diamond';
      default: return 'badge--primary';
    }
  };
  
  // Helper function to get tier display name
  const getTierDisplayName = (tier) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  // Get top 5 achievements (highest tier, then highest points, then most recent)
  const getTop5 = () => {
    const tierOrder = { diamond: 5, platinum: 4, gold: 3, silver: 2, bronze: 1 };
    
    return [...achievements.unlocked]
      .sort((a, b) => {
        // First by tier
        const tierDiff = (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0);
        if (tierDiff !== 0) return tierDiff;
        
        // Then by points
        const pointsDiff = (b.points || 0) - (a.points || 0);
        if (pointsDiff !== 0) return pointsDiff;
        
        // Then by date (most recent first)
        return new Date(b.unlocked_at) - new Date(a.unlocked_at);
      })
      .slice(0, 5);
  };

  // Get next challenges (sorted by percentage complete)
  const getChallenges = () => {
    return [...achievements.inProgress]
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .slice(0, 5);
  };

  // Get all earned achievements (most recent first)
  const getAllEarned = () => {
    return [...achievements.unlocked]
      .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at));
  };
  
  // Handle achievement card click
  const handleAchievementClick = (achievement) => {
    console.log(version, 'Achievement clicked:', achievement.name);
    setSelectedAchievement(achievement);
    setShowInfo(true);
  };
  
  // Handle info panel close
  const handleInfoClose = () => {
    setShowInfo(false);
    setSelectedAchievement(null);
  };

  const handleGuestSignup = () => {
    console.log(version, 'Guest requesting signup - setting URL parameter');
    
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('signup', 'true');
    window.history.replaceState({}, '', currentUrl);
    
    dispatch(events.LOGIN);
  };

  if (!userProfile) {
    return null;
  }

  if (loading) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--wide">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <h2>Loading Achievements</h2>
            <p>Retrieving your progress...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="card-header">
            <h2 className="card-title">Error</h2>
          </div>
          <div className="card-body">
            <p className="message message--error">{error}</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn--primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="card-header">
            <h2 className="card-title">Achievements</h2>
          </div>
          <div className="card-body">
            <p>Achievements are only available for registered players.</p>
            <p className="mt-md">
              <button
                className="btn btn--primary"
                onClick={handleGuestSignup}
              >
                Create Account
              </button>
              {' '}to start earning achievements and track your progress!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const top5 = getTop5();
  const challenges = getChallenges();
  const allEarned = getAllEarned();

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        
        {/* Header */}
        <div className="card-header card-header--with-close">
          <div>
              <h2 className="card-title">Your Achievements</h2>
              <p className="card-subtitle">
                {achievements.unlocked.length} of {achievements.total} unlocked • {achievements.points} points earned
              </p>
          </div>
          {onClose && (
            <button className="btn btn--secondary btn--sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {/* InfoPanel for achievement details */}
        <InfoPanel
          isOpen={showInfo}
          onClose={handleInfoClose}
          title={selectedAchievement?.name || 'Achievement Details'}
        >
          {selectedAchievement && (
            <>
              <div className="achievement-detail">
                <div className="achievement-detail__icon">
                  {React.createElement(getLucideIcon(selectedAchievement.badge_icon), { size: 64 })}
                </div>
                
                <div className="achievement-detail__tier">
                  <span className={`badge ${getTierBadgeClass(selectedAchievement.tier)}`}>
                    {getTierDisplayName(selectedAchievement.tier)} - {selectedAchievement.points} Points
                  </span>
                </div>
                
                <h4 className="mt-md">Description</h4>
                <p>{selectedAchievement.description}</p>
                
                {selectedAchievement.tooltip && (
                  <>
                    <h4 className="mt-md">How to Earn</h4>
                    <p>{selectedAchievement.tooltip}</p>
                  </>
                )}
                
                {selectedAchievement.requirement_type && (
                  <>
                    <h4 className="mt-md">Requirement</h4>
                    <p>
                      <strong>Type:</strong> {selectedAchievement.requirement_type.replace(/_/g, ' ')}<br />
                      <strong>Target:</strong> {selectedAchievement.requirement_value}
                    </p>
                  </>
                )}
                
                {selectedAchievement.current !== undefined && (
                  <>
                    <h4 className="mt-md">Your Progress</h4>
                    <div className="progress-bar mb-sm">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${selectedAchievement.percentage || 0}%` }}
                      ></div>
                    </div>
                    <p>
                      {selectedAchievement.current} / {selectedAchievement.target} ({selectedAchievement.percentage || 0}%)
                    </p>
                  </>
                )}
                
                {selectedAchievement.unlocked_at && (
                  <>
                    <h4 className="mt-md">Unlocked</h4>
                    <p>{new Date(selectedAchievement.unlocked_at).toLocaleDateString()}</p>
                  </>
                )}
              </div>
            </>
          )}
        </InfoPanel>

        {/* Top 5 Achievements */}
        {top5.length > 0 && (
          <>
            <div className="achievements-section">
              <h3 className="achievements-title">🏆 Top 5 Achievements</h3>
              <p className="text-secondary text-center mb-md">Your most prestigious accomplishments (click for details)</p>
              <div className="achievement-grid achievement-grid--compact">
                {top5.map((achievement) => {
                  const Icon = getLucideIcon(achievement.badge_icon);
                  return (
                    <div
                      key={achievement.id}
                      className={`achievement-card achievement-card--${achievement.tier} achievement-card--clickable`}
                      onClick={() => handleAchievementClick(achievement)}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => e.key === 'Enter' && handleAchievementClick(achievement)}
                    >
                      <div className="achievement-card__icon">
                        <Icon size={48} />
                      </div>
                      <div className="achievement-card__text">
                        <div className="achievement-card__name">{achievement.name}</div>
                        <div className="achievement-card__points">
                          <span className={`badge ${getTierBadgeClass(achievement.tier)}`}>
                            {achievement.points} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="divider"></div>
          </>
        )}

        {/* Challenges - Next to Unlock */}
        {challenges.length > 0 && (
          <>
            <div className="challenges-section">
              <h3 className="achievements-title">🎯 Challenges - Get These Next!</h3>
              <p className="text-secondary text-center mb-md">You're making progress toward these achievements (click for details)</p>
              
              {challenges.map((achievement) => {
                const Icon = getLucideIcon(achievement.badge_icon);
                return (
                  <div
                    key={achievement.id}
                    className="challenge-item challenge-item--clickable"
                    onClick={() => handleAchievementClick(achievement)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && handleAchievementClick(achievement)}
                  >
                    <div className="challenge-header">
                      <div className="challenge-icon">
                        <Icon size={32} />
                      </div>
                      <div className="challenge-info">
                        <div className="challenge-name">
                          {achievement.name}
                          <span className={`badge ${getTierBadgeClass(achievement.tier)} ml-sm`}>
                            {achievement.points} pts
                          </span>
                        </div>
                        <div className="challenge-description">{achievement.description}</div>
                      </div>
                    </div>
                    <div className="challenge-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-bar__fill"
                          style={{ width: `${achievement.percentage}%` }}
                        ></div>
                      </div>
                      <div className="progress-text">
                        {achievement.current} / {achievement.target} ({achievement.percentage}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="divider"></div>
          </>
        )}

        {/* All Earned Achievements */}
        {allEarned.length > 0 && (
          <div className="achievements-section">
            <h3 className="achievements-title">📜 All Earned Achievements</h3>
            <p className="text-secondary text-center mb-md">Sorted by most recent first (click for details)</p>
            <div className="achievement-grid achievement-grid--compact">
              {allEarned.map((achievement) => {
                const Icon = getLucideIcon(achievement.badge_icon);
                return (
                  <div
                    key={achievement.id}
                    className={`achievement-card achievement-card--${achievement.tier} achievement-card--clickable`}
                    onClick={() => handleAchievementClick(achievement)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && handleAchievementClick(achievement)}
                  >
                    <div className="achievement-card__icon">
                      <Icon size={48} />
                    </div>
                    <div className="achievement-card__text">
                      <div className="achievement-card__name">{achievement.name}</div>
                      <div className="achievement-card__points">
                        <span className={`badge ${getTierBadgeClass(achievement.tier)}`}>
                          {achievement.points} pts
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No achievements yet */}
        {allEarned.length === 0 && (
          <div className="empty-state">
            <h3>No Achievements Yet</h3>
            <p>Play games to start earning achievements!</p>
            <button
              className="btn btn--primary mt-md"
              onClick={() => dispatch(events.ERA)}
            >
              Play a Game
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AchievementsPage;

// EOF
