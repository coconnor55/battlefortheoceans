// src/pages/AchievementsPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.4: Allow null playerEmail for guest users in key data check
//         - Guest users don't have email, so playerEmail check is conditional
//         - Only require playerEmail for non-guest users
// v0.1.3: Added passes reward badge to challenge cards
//         - Display "+X Passes" badge in upper right of each challenge card
//         - Only shows when achievement has reward_passes > 0
//         - Styled with success color and positioned absolutely
// v0.1.2: Changed ERA to SELECTERA (Claude error)
// v0.1.1: Added badge click handler with InfoPanel details
//         - Click any achievement card to see full details
//         - InfoPanel shows description, tooltip, requirements, progress
//         - Reuses existing InfoPanel component and styles

import React, { useState, useEffect } from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import AchievementService from '../services/AchievementService';
import InfoPanel from '../components/InfoPanel';
import Player from '../classes/Player';
import * as LucideIcons from 'lucide-react';

const version = 'v0.1.4';
const tag = "ACHIEVEMENTS";
const module = "AchievementsPage";
let method = "";

const AchievementsPage = ({ onClose, scrollPosition }) => {
    // Logging utilities
    const log = (message) => {
      console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    };
    
    const logwarn = (message) => {
        console.warn(`[${tag}] ${version} ${module}.${method}: ${message}`);
    };

    const logerror = (message, error = null) => {
      if (error) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
      } else {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
      }
    };

    //key data - see CoreEngine handle{state}
    const gameConfig = coreEngine.gameConfig;
    const eras = coreEngine.eras;
    const player = coreEngine.player
    const playerProfile = coreEngine.playerProfile;
    const playerEmail = coreEngine.playerEmail;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponents = coreEngine.selectedOpponents;

    // derived data
    const playerId = coreEngine.playerId;
    const playerRole = coreEngine.playerRole;
    const playerGameName = coreEngine.playerGameName;
    const isGuest = player != null && player.isGuest;
    const isAdmin = player != null && playerProfile.isAdmin;
    const isDeveloper = player != null && playerProfile.isDeveloper;
    const isTester = player != null && playerProfile.isTester;
    const selectedOpponent = coreEngine.selectedOpponents[0];

    const selectedGameMode = coreEngine.selectedGameMode;
    const gameInstance = coreEngine.gameInstance;
    const board = coreEngine.board;

    // stop game if key data is missing (selectedAlliance is allowed to be null)
    // playerEmail is allowed to be null for guest users
    const required = isGuest 
        ? { gameConfig, eras, player, playerProfile }
        : { gameConfig, eras, player, playerProfile, playerEmail };
    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key, value]) => `${key}=${value}`);
    if (missing.length > 0) {
        logerror(`key data missing: ${missing.join(', ')}`, required);
        throw new Error(`${module}: key data missing: ${missing.join(', ')}`);
    }

  const { dispatch, events } = useGame();

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

  // Load achievements on mount
  useEffect(() => {
    const loadAchievements = async () => {
      if (!playerId) return;

      setLoading(true);
      setError(null);

      try {
        console.log(version, 'Loading achievements for user:', playerId);
        const data = await AchievementService.getUserAchievements(playerId);
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
  }, [playerId]);

  // Helper function to get Lucide icon component by name
  const getLucideIcon = (iconName) => {
    const Icon = LucideIcons[iconName];
    return Icon || LucideIcons.Award; // Fallback to Award icon
  };

  // Helper function to get tier badge class
  const getTierBadgeClass = (tier) => {
      method = 'getTierBadgeClass';

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
      method = 'getChallenges';

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
      method = 'getChallenges';

    return [...achievements.inProgress]
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .slice(0, 5);
  };

  // Get all earned achievements (most recent first)
  const getAllEarned = () => {
      method = 'getAllEarned';

    return [...achievements.unlocked]
      .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at));
  };
  
  // Handle achievement card click
  const handleAchievementClick = (achievement) => {
      method = 'handleAchievementClick';

    log('Achievement clicked:', achievement.name);
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

  if (!playerProfile) {
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
    <div
      className="container flex flex-column flex-center-scrollable">
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
                    {achievement.reward_passes > 0 && (
                      <div className="challenge-passes-badge">
                        +{achievement.reward_passes} Passes
                      </div>
                    )}
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
                          +{achievement.points} pts
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
              onClick={() => dispatch(events.SELECTERA)}
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
