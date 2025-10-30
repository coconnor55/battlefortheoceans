// src/pages/OverPage.js v0.5.5
// Copyright(c) 2025, Clint H. O'Connor
// v0.5.10: Added final board snapshot display
//         - Shows captured board image after game stats
//         - Reveals all enemy ship positions to player
//         - Uses finalBoardImage captured by GameLifecycleManager
//         - Reuses game-board-container styling from PlayingPage
// v0.5.9: Changed to support multiple opponents
// v0.5.8: Removed unused import GameStatsService
// v0.5.7: Added inline achievement display after battle duration (belt and braces)
//         - Shows newly unlocked achievements in results section
//         - Reuses achievement styling patterns
//         - Added navigation message to stats/achievements
// v0.5.6: Changed ERA to SELECTERA (Claude error)
// v0.5.5: Fixed VideoPopup props to match component interface
//         - Changed videoData={videoData} to videoSrc={videoData.url}
//         - Changed onClose={handleVideoClose} to onComplete={handleVideoClose}
//         - Matches PlayingPage.js pattern (which works correctly)
// v0.5.4: Fixed missing closing div for over-content section
//         - Added missing </div> before showPromotion conditional (line 467)
// v0.5.3: Use ConfigLoader singleton instead of manual fetch
//         - Replaced fetch('/config/game-config.json') with configLoader.loadGameConfig()
//         - Consistent with rest of app, proper caching and error handling
// v0.5.2: Fixed game-config.json fetch path and JSX structure
//         - Changed fetch from /game-config.json to /config/game-config.json
//         - Fixed missing closing </div> tag for over-page container
// v0.5.1: Added achievement video before modal
//         - Plays /assets/videos/new-achievement.mp4 when achievements unlocked
//         - Uses existing VideoPopup component and styling
//         - Video plays first, then achievement modal shows
//         - Config stored in game-config.json
// v0.5.0: New achievement popup modal - more prominent celebration
//         - Moved achievements from inline cards to modal overlay
//         - Shows immediately after game over (before stats)
//         - User must acknowledge to dismiss
//         - Reuses existing modal-overlay CSS
// v0.4.9: Removed leaderboard section (now in Stats page)

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import PromotionalBox from '../components/PromotionalBox';
import PurchasePage from './PurchasePage';
import VideoPopup from '../components/VideoPopup';
import AchievementService from '../services/AchievementService';
import configLoader from '../utils/ConfigLoader';
import * as LucideIcons from 'lucide-react';

const version = 'v0.5.10';
// Detect if we're in production (battlefortheoceans.com) or local development
const isProduction = window.location.hostname === 'battlefortheoceans.com';
const SESSION_KEY = 'battleForOceans_gameResults';

const OverPage = () => {
  const {
    dispatch,
    events,
    gameInstance,
    eraConfig,
    humanPlayer,
    selectedOpponents,
    userProfile,
    hasEraAccess,
    getPromotableEras,
    appVersion
  } = useGame();

  // State for game results (from CoreEngine or sessionStorage)
  const [gameResults, setGameResults] = useState(null);
  
  // State for game config (fetched from public/)
  const [gameConfig, setGameConfig] = useState(null);
  
  // State for achievements
  const [newAchievements, setNewAchievements] = useState([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
 
    // InfoPanel state
    const [showInfo, setShowInfo] = useState(false);
    const [selectedAchievement, setSelectedAchievement] = useState(null);

  // State for achievement video
  const [videoData, setVideoData] = useState(null);
  const [showVideo, setShowVideo] = useState(false);

  // Load game config on mount using ConfigLoader singleton
  useEffect(() => {
    configLoader.loadGameConfig()
      .then(config => {
        console.log(version, 'Loaded game config:', config.version);
        setGameConfig(config);
      })
      .catch(err => {
        console.error(version, 'Failed to load game config:', err);
      });
  }, []);

  // Redirect to login if no user profile
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);

  // Load game results on mount
  useEffect(() => {
    // Try to get from CoreEngine first (normal flow)
    if (gameInstance && eraConfig && selectedOpponents && humanPlayer) {
      const results = {
        gameStats: gameInstance.getGameStats(),
        gameLog: gameInstance.gameLog || [],
        finalBoardImage: gameInstance.finalBoardImage,
        eraName: eraConfig.name,
        playerName: humanPlayer.name,
        opponents: selectedOpponents || [],
      };
      
      console.log(version, 'Saving game results to sessionStorage');
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(results));
      setGameResults(results);
    } else if (userProfile) {
      // Try to restore from sessionStorage (after refresh)
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        console.log(version, 'Restoring game results from sessionStorage');
        setGameResults(JSON.parse(saved));
      } else {
        console.log(version, 'No game results available - redirecting to era selection');
        dispatch(events.SELECTERA);
      }
    }
  }, [gameInstance, eraConfig, selectedOpponents, humanPlayer, userProfile, dispatch, events]);

  // Check for new achievements when game results are available
  useEffect(() => {
    const checkForAchievements = async () => {
      if (!gameResults || !userProfile || userProfile.id.startsWith('guest-')) {
        return;
      }

      // TEMPORARY: Mock achievements for testing
      const ENABLE_MOCK_ACHIEVEMENTS = false;
      
      if (ENABLE_MOCK_ACHIEVEMENTS) {
        console.log(version, 'Loading mock achievements for testing');
        const mockAchievements = [
          {
            id: 'first-victory',
            name: 'First Victory',
            description: 'Win your first battle',
            badge_icon: 'Trophy',
            points: 10,
            tier: 'bronze'
          },
          {
            id: 'sharpshooter',
            name: 'Sharpshooter',
            description: 'Achieve 75% accuracy',
            badge_icon: 'Target',
            points: 25,
            tier: 'silver'
          }
        ];
        
        if (mockAchievements.length > 0) {
          setNewAchievements(mockAchievements);
          
          // Check if achievement video exists
          const videoPath = gameConfig?.videos?.new_achievement;
          if (videoPath) {
            console.log(version, 'Playing achievement video before modal:', videoPath);
            // Show video first
            setVideoData({ type: 'new_achievement', url: videoPath });
            setShowVideo(true);
            // Don't show modal yet - will show after video closes
          } else {
            console.log(version, 'No achievement video configured - showing modal immediately');
            // No video - show modal immediately
            setShowAchievementModal(true);
          }
        }
        return;
      }

      setLoadingAchievements(true);
      try {
        console.log(version, 'Checking for new achievements');
        
        // Get human player stats from game results
        const humanPlayerStats = gameResults.gameStats.players?.find(p => p.name === gameResults.playerName);
        
        if (!humanPlayerStats) {
          console.log(version, 'No human player stats found');
          return;
        }

        // Prepare game results for achievement checking
        const achievementCheckData = {
          won: gameResults.gameStats.winner === gameResults.playerName,
          accuracy: parseFloat(humanPlayerStats.accuracy) || 0,
          turns: gameResults.gameStats.totalTurns || 0,
          ships_sunk: humanPlayerStats.sunk || 0,
          hits: humanPlayerStats.hits || 0,
          misses: humanPlayerStats.misses || 0,
          damage: humanPlayerStats.hitsDamage || 0,
          score: humanPlayerStats.score || 0
        };

        console.log(version, 'Achievement check data:', achievementCheckData);

        const unlocked = await AchievementService.checkAchievements(userProfile.id, achievementCheckData);
        console.log(version, 'New achievements unlocked:', unlocked);
        
        if (unlocked.length > 0) {
          setNewAchievements(unlocked);
          
          // Check if achievement video exists
          const videoPath = gameConfig?.videos?.new_achievement;
          if (videoPath) {
            console.log(version, 'Playing achievement video before modal:', videoPath);
            // Show video first
            setVideoData({ type: 'new_achievement', url: videoPath });
            setShowVideo(true);
            // Don't show modal yet - will show after video closes
          } else {
            console.log(version, 'No achievement video configured - showing modal immediately');
            // No video - show modal immediately
            setShowAchievementModal(true);
          }
        }
      } catch (error) {
        console.error(version, 'Error checking achievements:', error);
      } finally {
        setLoadingAchievements(false);
      }
    };

    checkForAchievements();
  }, [gameResults, userProfile, gameConfig]);

  // State for promotional era
  const [showPromotion, setShowPromotion] = useState(false);
  const [promotionalEra, setPromotionalEra] = useState(null);

  // State for purchase page
  const [showPurchasePage, setShowPurchasePage] = useState(false);
  const [purchaseEraId, setPurchaseEraId] = useState(null);

  // Check if user should see promotional content
  useEffect(() => {
    if (!userProfile || !eraConfig) return;

    const promotableEras = getPromotableEras();
    if (promotableEras.length > 0) {
      // Show promo for first era user doesn't have access to
      setPromotionalEra(promotableEras[0]);
      setShowPromotion(true);
    }
  }, [userProfile, eraConfig, getPromotableEras]);

  const handlePlayAgain = () => {
    console.log(version, 'User clicked Play Again - returning to opponent selection');
    dispatch(events.SELECTOPPONENT);
  };

  const handleChangeEra = () => {
    console.log(version, 'User clicked Change Era - returning to era selection');
    dispatch(events.SELECTERA);
  };

  const handleLogOut = () => {
    console.log(version, 'User clicked Log Out - clearing session and returning to launch');
    sessionStorage.removeItem(SESSION_KEY);
    dispatch(events.LAUNCH);
  };

  const handlePurchase = (eraId) => {
    console.log(version, 'User initiated purchase for era:', eraId);
    setPurchaseEraId(eraId);
    setShowPurchasePage(true);
  };

  const handlePurchaseComplete = () => {
    console.log(version, 'Purchase complete - closing purchase page');
    setShowPurchasePage(false);
    setShowPromotion(false);
  };

  const handlePurchaseCancel = () => {
    console.log(version, 'Purchase cancelled - closing purchase page');
    setShowPurchasePage(false);
  };

  const handleVideoClose = () => {
    console.log(version, 'Achievement video closed - showing modal');
    setShowVideo(false);
    // After video closes, show the achievement modal
    if (newAchievements.length > 0) {
      setShowAchievementModal(true);
    }
  };

    // Handle achievement card click
    const handleAchievementClick = (achievement) => {
      console.log(version, 'Achievement clicked:', achievement.name);
      setSelectedAchievement(achievement);
      setShowInfo(true);
    };

    const handleAchievementModalClose = () => {
    console.log(version, 'Achievement modal closed');
    setShowAchievementModal(false);
  };

  // Helper to get Lucide icon component by name
  const getLucideIcon = (iconName) => {
    return LucideIcons[iconName] || LucideIcons.Award;
  };

  // Helper to get tier badge class
  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'bronze': return 'badge--bronze';
      case 'silver': return 'badge--silver';
      case 'gold': return 'badge--gold';
      case 'platinum': return 'badge--platinum';
      default: return 'badge--bronze';
    }
  };

    // Format opponent fleet names for victory message
    const formatOpponentFleets = (opponents) => {
      if (!opponents || opponents.length === 0) return "the enemy fleet";
      if (opponents.length === 1) return `${opponents[0].name}'s fleet`;
      if (opponents.length === 2) return `${opponents[0].name}'s fleet and ${opponents[1].name}'s fleet`;
      const lastOpponent = opponents[opponents.length - 1];
      const otherOpponents = opponents.slice(0, -1);
      const otherNames = otherOpponents.map(opp => `${opp.name}'s fleet`).join(', ');
      return `${otherNames}, and ${lastOpponent.name}'s fleet`;
    };

  const copyGameLog = () => {
    if (!gameResults?.gameLog) return;
    
    const logText = gameResults.gameLog
      .filter(entry => entry.message?.includes('[BATTLE]'))
      .map(entry => {
        const elapsed = entry.elapsed || '0.0';
        const msg = entry.message.replace('[BATTLE] ', '');
        return `[+${elapsed}s] ${msg}`;
      })
      .join('\n');
    
    navigator.clipboard.writeText(logText)
      .then(() => console.log(version, 'Game log copied to clipboard'))
      .catch(err => console.error(version, 'Failed to copy log:', err));
  };

  const emailGameLog = () => {
    if (!gameResults?.gameLog) return;
    
    const logText = gameResults.gameLog
      .filter(entry => entry.message?.includes('[BATTLE]'))
      .map(entry => {
        const elapsed = entry.elapsed || '0.0';
        const msg = entry.message.replace('[BATTLE] ', '');
        return `[+${elapsed}s] ${msg}`;
      })
      .join('\n');
    
    const subject = `Battle for the Oceans - ${gameResults.eraName} Results`;
    const body = `Battle Results:\n\n${logText}`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (!gameResults) {
    return (
      <div className="over-page">
        <div className="content-pane">
          <div className="loading loading--lg">
            <div className="spinner spinner--lg"></div>
            <p>Loading game results...</p>
          </div>
        </div>
      </div>
    );
  }

  const { gameStats, gameLog } = gameResults;
  const isWinner = gameStats.winner === gameResults.playerName;
  const isGuest = userProfile?.id?.startsWith('guest-');

  return (
    <div className="over-page">
      <div className="content-pane content-pane--wide">
        <div className="over-header">
          <h1 className={`over-title ${isWinner ? 'over-title--victory' : 'over-title--defeat'}`}>
            {isWinner ? '🎉 Victory!' : '💥 Defeat'}
          </h1>
          <p className="over-subtitle">
            {isWinner
              ? `You destroyed ${formatOpponentFleets(gameResults.opponents)}!`
              : `${formatOpponentFleets(gameResults.opponents)} destroyed your entire fleet!`
            }
          </p>
          <p className="over-era">
            Era: {gameResults.eraName}
          </p>
        </div>

        <div className="over-content">
          {/* Guest user notice */}
          {isGuest && (
            <div className="guest-notice guest-notice--warning">
              <p>
                <strong>Guest Mode:</strong> Your statistics are not saved.
                Create an account to track your progress and compete on leaderboards!
              </p>
            </div>
          )}

          {/* Final Board Snapshot */}
          {gameResults.finalBoardImage && (
            <div className="game-board-container">
              <h4 className="text-center">Final Battle Board</h4>
              <img
                src={gameResults.finalBoardImage}
                alt="Final battle board showing all ship positions"
              />
              <p className="text-center text-muted">
                All enemy ship locations revealed
              </p>
            </div>
          )}
          
          {/* Loading achievements indicator */}
          {loadingAchievements && !isGuest && (
            <div className="achievements-section">
              <div className="loading loading--sm">
                <div className="spinner spinner--sm"></div>
                <p>Checking achievements...</p>
              </div>
            </div>
          )}
          
          {gameStats.players && (
            <div className="battle-stats">
              <h4>Battle Statistics</h4>
              <div className="stats-grid">
                {gameStats.players.map((player, index) => {
                  const isWinner = player.name === gameStats.winner;
                  
                  return (
                    <div
                      key={index}
                      className={`player-stats ${isWinner ? 'player-stats--winner' : 'player-stats--loser'}`}
                    >
                      <div className="player-name">{player.name}</div>
                      <div className="stat-row">
                        <span>Hits:</span>
                        <span>{player.hits || 0}</span>
                      </div>
                      <div className="stat-row">
                        <span>Misses:</span>
                        <span>{player.misses || 0}</span>
                      </div>
                      <div className="stat-row">
                        <span>Accuracy:</span>
                        <span>{player.accuracy}%</span>
                      </div>
                      <div className="stat-row">
                        <span>Damage Dealt:</span>
                        <span>{player.hitsDamage?.toFixed(1) || '0.0'}</span>
                      </div>
                      <div className="stat-row">
                        <span>Ships Sunk:</span>
                        <span>{player.sunk || 0}</span>
                      </div>
                      <div className="stat-row">
                        <span>Score:</span>
                        <span>{Math.round(player.score || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {gameStats.duration && (
                <div className="game-duration">
                  <span>Battle Duration: {Math.floor(gameStats.duration / 60)} minutes</span>
                </div>
              )}

              {/* NEW v0.5.7: Inline Achievement Display (Belt and Braces) */}
              {newAchievements.length > 0 && !isGuest && (
                <div className="achievements-section">
                  <h4 className="achievements-title">
                    🏆 New Achievements Unlocked!
                  </h4>
                  <div className="achievements-grid">
                    {newAchievements.map((achievement) => {
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
                              <div className="achievement-card__description">
                                {achievement.description}
                              </div>
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
                  <p className="text-secondary text-center mb-md">
                    <br />Check your stats and achievements in the menu bar above!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {showPromotion && promotionalEra && (
          <PromotionalBox
            eraConfig={promotionalEra}
            userProfile={userProfile}
            onPurchase={handlePurchase}
          />
        )}
                                 
        <div className="over-actions">
          <button
            className="btn btn--primary btn--lg"
            onClick={handlePlayAgain}
            title="Play another battle - choose a different opponent"
          >
            Play Again
          </button>
          <button
            className="btn btn--primary btn--lg"
            onClick={handleChangeEra}
            title="Select a different era"
          >
            Play Another Era
          </button>
          <button
            className="btn btn--secondary btn--lg"
            onClick={handleLogOut}
            title="Log out and return to login screen"
          >
            Log Out
          </button>
        </div>

        <div className="section-divider"></div>

        <div className="game-log-section">
          <div className="log-header">
            <h4>Battle Log</h4>
            <div className="log-actions">
              <button
                className="btn btn--sm btn--secondary"
                onClick={copyGameLog}
                title="Copy log to clipboard"
              >
                Copy
              </button>
              <button
                className="btn btn--sm btn--secondary"
                onClick={emailGameLog}
                title="Email results"
              >
                Email
              </button>
            </div>
          </div>
          
          <div className="divider"></div>
          
          <div className="log-content">
            {gameLog.filter(entry => entry.message?.includes('[BATTLE]')).length > 0 ?
              gameLog
                .filter(entry => entry.message?.includes('[BATTLE]'))
                .map((entry, index) => {
                  const elapsed = entry.elapsed || '0.0';
                  const msg = entry.message.replace('[BATTLE] ', '');
                  return (
                    <div key={index} className={`log-entry ${entry.type || 'info'}`}>
                      <span className="log-time">[+{elapsed}s]</span>
                      <span className="log-message">{msg}</span>
                    </div>
                  );
                }) : (
              <p>No battle log available</p>
            )}
          </div>
        </div>

         <div className="divider"></div>

        {/* Achievement Video - Shows before modal */}
        {showVideo && videoData && (
          <VideoPopup
            videoSrc={videoData.url}
            onComplete={handleVideoClose}
          />
        )}

        {/* Achievement Modal - Shows after video */}
        {showAchievementModal && newAchievements.length > 0 && !isGuest && (
          <div >
            <div className="achievements-section">
              <div >
                <h2 className="achievements-title">🎉 Achievements Unlocked!</h2>
              </div>
              
              <div >
                <div className="achievement-grid achievement-grid--compact">
                  {newAchievements.map((achievement, index) => {
                    const Icon = getLucideIcon(achievement.badge_icon);
                    return (
                      <div
                        key={achievement.id}
                        className={`achievement-card achievement-card--${achievement.tier} achievement-card--clickable`}
                          >
                        <div className="achievement-card__icon achievement-card__icon--large">
                          <Icon size={48} />
                        </div>
                        <div className="achievement-card__text">
                          <div className="achievement-card__name">
                            {achievement.name}
                          </div>
                          <div className="achievement-card__description">
                            {achievement.description}
                          </div>
                          <div className="achievement-card__points">
                            <span className={`badge ${getTierBadgeClass(achievement.tier)}`}>
                              +{achievement.points} Points
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="modal-footer">
                <button
                  className="btn btn--primary btn--lg"
                  onClick={handleAchievementModalClose}
                >
                  Awesome!
                </button>
              </div>
            </div>
          </div>
        )}

        {showPurchasePage && (
          <div className="modal-overlay modal-overlay--transparent">
            <PurchasePage
              eraId={purchaseEraId}
              onComplete={handlePurchaseComplete}
              onCancel={handlePurchaseCancel}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OverPage;

// EOF
