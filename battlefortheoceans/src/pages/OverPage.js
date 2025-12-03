// src/pages/OverPage.js v0.5.16
// Copyright(c) 2025, Clint H. O'Connor
// v0.5.16: Sanitize HTML in snapshot display to prevent XSS attacks
//          - Use sanitizeSnapshotHTML() before rendering snapshot HTML
//          - Prevents malicious scripts in user-generated snapshot content
// v0.5.15: Allow null playerEmail for guest users in key data check
//          - Guest users don't have email, so playerEmail check is conditional
//          - Only require playerEmail for non-guest users
// v0.5.14: Improved session recovery navigation
//          - Navigate to Launch page instead of Login when session expires
//          - Only if gameConfig and eras are valid (core app data intact)
//          - Better UX: User sees launch page, can re-login smoothly
//          - Falls back to Login if core data missing
// v0.5.13: Add snapshot recovery with working navigation
//          - Capture page DOM + inline styles to sessionStorage after 2s delay
//          - Show frozen snapshot with warning banner when session data missing
//          - Add working navigation buttons to snapshot (checks playerProfile)
//          - Clear snapshot on logout
// v0.5.12: Move promotable eras within OverPage
// v0.5.11: Use coreEngine for all game data
//          - Get gameConfig from coreEngine (already loaded)
//          - Get eraConfig, playerProfile, etc. from coreEngine
//          - Remove local gameConfig loading
//          - Consistent with GetAccessPage and SelectEraPage pattern
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

import React, { useState, useEffect, useRef } from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import PromotionalBox from '../components/PromotionalBox';
import PurchasePage from './PurchasePage';
import Player from '../classes/Player';
import VideoPopup from '../components/VideoPopup';
import AchievementService from '../services/AchievementService';
import configLoader from '../utils/ConfigLoader';
import { sanitizeSnapshotHTML } from '../utils/sanitizeHTML';
import * as LucideIcons from 'lucide-react';

const version = 'v0.5.15';
const tag = "OVER";
const module = "OverPage";
let method = "";

const SESSION_KEY = 'battleForOceans_gameResults';
const SNAPSHOT_KEY = 'battleForOceans_resultsSnapshot';

const OverPage = () => {
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

    // Ref for capturing page content
    const pageRef = useRef(null);

    // Log component mount
    useEffect(() => {
      method = 'useEffect-mount';
      console.log(`[${tag}] ${version} ${module}: OverPage component mounted`);
      return () => {
        console.log(`[${tag}] ${version} ${module}: OverPage component unmounting`);
      };
    }, []);

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
        ? { gameConfig, eras, player, playerProfile, selectedEraId, selectedOpponents, gameInstance, board }
        : { gameConfig, eras, player, playerProfile, playerEmail, selectedEraId, selectedOpponents, gameInstance, board };
    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key, value]) => `${key}=${value}`);
    
    if (missing.length > 0) {
        logerror(`key data missing: ${missing.join(', ')}`, required);
    }

    const {
        dispatch,
        events,
      } = useGame();

    // State for game results (from CoreEngine or sessionStorage)
    const [gameResults, setGameResults] = useState(null);
    const [showSnapshot, setShowSnapshot] = useState(false);
    
    // State for achievements
    const [newAchievements, setNewAchievements] = useState([]);
    const [loadingAchievements, setLoadingAchievements] = useState(false);
    const [showAchievementModal, setShowAchievementModal] = useState(false);
 
    // InfoPanel state
    const [selectedAchievement, setSelectedAchievement] = useState(null);

    // State for achievement video
    const [videoData, setVideoData] = useState(null);
    const [showVideo, setShowVideo] = useState(false);

    // State for promotional era
    const [showPromotion, setShowPromotion] = useState(false);
    const [promotionalEra, setPromotionalEra] = useState(null);

    // State for purchase page
    const [showPurchasePage, setShowPurchasePage] = useState(false);
    const [purchaseEraId, setPurchaseEraId] = useState(null);

  // Check for missing key data and handle snapshot fallback
    useEffect(() => {
      // Only run snapshot recovery if required data is actually missing
      if (missing.length === 0) {
        return;
      }
      
      // Check if we have a saved snapshot to show
      const snapshotData = sessionStorage.getItem(SNAPSHOT_KEY);
      
      if (snapshotData) {
        try {
          JSON.parse(snapshotData); // validate JSON
          log('Session expired - showing saved snapshot');
          setShowSnapshot(true);
          // Don't throw error - we'll show the snapshot instead
          return;
        } catch (error) {
          logerror('Failed to parse snapshot data:', error);
        }
      }
      
      // No snapshot available - redirect based on what data we have
      if (gameConfig && eras) {
        log('No snapshot but core data valid - redirecting to launch');
        dispatch(events.LAUNCH);
      } else {
        log('No snapshot and core data missing - redirecting to login');
        dispatch(events.LOGIN);
      }
    }, [missing.length, gameConfig, eras, dispatch, events]);

  const selectedEraConfig = coreEngine.selectedEraConfig;



  // Load game results on mount
  useEffect(() => {
    method = 'useEffect-loadGameResults';
    log(`Loading game results - gameInstance=${!!gameInstance}, selectedEraConfig=${!!selectedEraConfig}, selectedOpponents=${!!selectedOpponents}, player=${!!player}`);
    
    // Try to get from CoreEngine first (normal flow)
    if (gameInstance && selectedEraConfig && selectedOpponents && player) {
      const results = {
        gameStats: gameInstance.getGameStats(),
        gameLog: gameInstance.gameLog || [],
        finalBoardImage: gameInstance.finalBoardImage,
        eraName: selectedEraConfig.name,
        playerName: player.name,
        opponents: selectedOpponents || [],
      };
      
      log('Saving game results to sessionStorage');
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(results));
      setGameResults(results);
    } else if (playerProfile && !showSnapshot) {
      // Try to restore from sessionStorage (after refresh)
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        log('Restoring game results from sessionStorage');
        setGameResults(JSON.parse(saved));
      } else {
        log('No game results available - redirecting to era selection');
        dispatch(events.SELECTERA);
      }
    }
  }, [gameInstance, selectedEraConfig, selectedOpponents, player, playerProfile, showSnapshot, dispatch, events]);

  // Capture page snapshot after results render
  useEffect(() => {
    if (!gameResults || !pageRef.current) return;
    
    // Wait 2 seconds for all content to render
    const captureTimer = setTimeout(() => {
      try {
        log('Capturing page snapshot');
        
        // Get all computed styles
        const allElements = pageRef.current.querySelectorAll('*');
        const styleMap = new Map();
        
        allElements.forEach(element => {
          const computed = window.getComputedStyle(element);
          const inlineStyle = Array.from(computed).reduce((acc, prop) => {
            acc[prop] = computed.getPropertyValue(prop);
            return acc;
          }, {});
          styleMap.set(element, inlineStyle);
        });
        
        // Clone the DOM
        const clone = pageRef.current.cloneNode(true);
        
        // Apply inline styles to cloned elements
        const clonedElements = clone.querySelectorAll('*');
        Array.from(allElements).forEach((original, index) => {
          const cloned = clonedElements[index];
          const styles = styleMap.get(original);
          if (cloned && styles) {
            Object.entries(styles).forEach(([prop, value]) => {
              cloned.style[prop] = value;
            });
          }
        });
        
        // Save snapshot
        const snapshot = {
          html: clone.outerHTML,
          timestamp: new Date().toISOString()
        };
        
        sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
        log('Snapshot saved to sessionStorage');
      } catch (error) {
        logerror('Failed to capture snapshot:', error);
      }
    }, 2000);
    
    return () => clearTimeout(captureTimer);
  }, [gameResults]);

  // Check for new achievements when game results are available
  useEffect(() => {
    const checkForAchievements = async () => {
      if (!gameResults || !playerProfile || playerProfile?.id.startsWith('guest-')) {
        return;
      }

      // TEMPORARY: Mock achievements for testing
      const ENABLE_MOCK_ACHIEVEMENTS = false;
      
      if (ENABLE_MOCK_ACHIEVEMENTS) {
        log('Loading mock achievements for testing');
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
            // Use ConfigLoader to resolve relative path (CDN or public)
            const fullVideoPath = configLoader.getAssetPath(videoPath);
            log('Playing achievement video before modal:', fullVideoPath);
            // Show video first
            setVideoData({ type: 'new_achievement', url: fullVideoPath });
            setShowVideo(true);
            // Don't show modal yet - will show after video closes
          } else {
            log('No achievement video configured - showing modal immediately');
            // No video - show modal immediately
            setShowAchievementModal(true);
          }
        }
        return;
      }

      setLoadingAchievements(true);
      try {
        log('Checking for new achievements');
        
        // Get human player stats from game results
        const playerStats = gameResults.gameStats.players?.find(p => p.name === gameResults.playerName);
        
        if (!playerStats) {
          log('No human player stats found');
          return;
        }

        // Prepare game results for achievement checking
        const achievementCheckData = {
          won: gameResults.gameStats.winner === gameResults.playerName,
          accuracy: parseFloat(playerStats.accuracy) || 0,
          turns: gameResults.gameStats.totalTurns || 0,
          ships_sunk: playerStats.sunk || 0,
          hits: playerStats.hits || 0,
          misses: playerStats.misses || 0,
          damage: playerStats.hitsDamage || 0,
          score: playerStats.score || 0
        };

        log('Achievement check data:', achievementCheckData);

        const unlocked = await AchievementService.checkAchievements(playerProfile?.id, achievementCheckData);
        log('New achievements unlocked:', unlocked);
        
        if (unlocked.length > 0) {
          setNewAchievements(unlocked);
          
          // Check if achievement video exists
          const videoPath = gameConfig?.videos?.new_achievement;
          if (videoPath) {
            // Use ConfigLoader to resolve relative path (CDN or public)
            const fullVideoPath = configLoader.getAssetPath(videoPath);
            log('Playing achievement video before modal:', fullVideoPath);
            // Show video first
            setVideoData({ type: 'new_achievement', url: fullVideoPath });
            setShowVideo(true);
            // Don't show modal yet - will show after video closes
          } else {
            log('No achievement video configured - showing modal immediately');
            // No video - show modal immediately
            setShowAchievementModal(true);
          }
        }
      } catch (error) {
        logerror('Error checking achievements:', error);
      } finally {
        setLoadingAchievements(false);
      }
    };

    checkForAchievements();
  }, [gameResults, playerProfile, gameConfig]);

  // Check if user should see promotional content
  useEffect(() => {
    if (!playerProfile || !selectedEraConfig || !coreEngine.eras) return;
    
    const allEras = Array.from(coreEngine.eras.values());
    log(`# eras=${allEras.length}`);
    
    const promotableEras = allEras.filter(era => {
      if (era.free) return false;
      // Check if user owns it
      // const hasAccess = userRights?.get(era.id);
      // return !hasAccess;
      return true;
    });
    
    log(`promotableEras=${promotableEras.length}`);
    
    if (promotableEras.length > 0) {
      setPromotionalEra(promotableEras[0]);
      setShowPromotion(true);
    }
  }, [playerProfile, selectedEraConfig, coreEngine.eras]);

    
  const handlePlayAgain = () => {
    log('User clicked Play Again - returning to opponent selection');
    dispatch(events.SELECTOPPONENT);
  };

  const handleChangeEra = () => {
    log('User clicked Change Era - returning to era selection');
    dispatch(events.SELECTERA);
  };

  const handleLogOut = () => {
    log('User clicked Log Out - clearing session and returning to launch');
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SNAPSHOT_KEY);
    dispatch(events.LAUNCH);
  };

  const handleSnapshotNavigate = () => {
    log('User clicked navigation from snapshot');
    sessionStorage.removeItem(SNAPSHOT_KEY);
    
    // Smart navigation based on available core data
    // If gameConfig and eras are valid, go to Launch page (best UX)
    // Otherwise fall back to Login
    if (coreEngine.gameConfig && coreEngine.eras) {
      log('Core data valid - navigating to Launch page');
      dispatch(events.LAUNCH);
    } else {
      log('Core data missing - navigating to Login');
      dispatch(events.LOGIN);
    }
  };

  const handlePurchase = (eraId) => {
    log('User initiated purchase for era:', eraId);
    setPurchaseEraId(eraId);
    setShowPurchasePage(true);
  };

  const handlePurchaseComplete = () => {
    log('Purchase complete - closing purchase page');
    setShowPurchasePage(false);
    setShowPromotion(false);
  };

  const handlePurchaseCancel = () => {
    log('Purchase cancelled - closing purchase page');
    setShowPurchasePage(false);
  };

  const handleVideoClose = () => {
    log('Achievement video closed - showing modal');
    setShowVideo(false);
    // After video closes, show the achievement modal
    if (newAchievements.length > 0) {
      setShowAchievementModal(true);
    }
  };

  // Handle achievement card click
  const handleAchievementClick = (achievement) => {
    log('Achievement clicked:', achievement.name);
    setSelectedAchievement(achievement);
  };

  const handleAchievementModalClose = () => {
    log('Achievement modal closed');
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
      .then(() => log('Game log copied to clipboard'))
      .catch(err => logerror('Failed to copy log:', err));
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

  // Show snapshot fallback if session expired
  if (showSnapshot) {
    const snapshotData = sessionStorage.getItem(SNAPSHOT_KEY);
    if (snapshotData) {
      try {
        const snapshot = JSON.parse(snapshotData);
        const canNavigateToLaunch = coreEngine.gameConfig && coreEngine.eras;
        
        return (
          <div className="over-page">
            <div className="content-pane content-pane--wide">
              <div className="alert alert--warning" style={{ marginBottom: '1rem' }}>
                <strong>⚠️ Session Expired</strong>
                <p>Your session has expired, but here are your saved results. Navigation and interactive features are disabled.</p>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={handleSnapshotNavigate}
                  style={{ marginTop: '0.5rem' }}
                >
                  {canNavigateToLaunch ? 'Return to Launch Page' : 'Return to Login'}
                </button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: sanitizeSnapshotHTML(snapshot.html) }} />
            </div>
          </div>
        );
      } catch (error) {
        logerror('Failed to render snapshot:', error);
      }
    }
    
    // Snapshot failed - redirect based on available data
    if (gameConfig && eras) {
      dispatch(events.LAUNCH);
    } else {
      dispatch(events.LOGIN);
    }
    return null;
  }

  if (!gameResults) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="loading loading--lg">
          <div className="spinner spinner--lg"></div>
          <p>Loading game results...</p>
        </div>
      </div>
    );
  }

  const { gameStats, gameLog } = gameResults;
  const isWinner = gameStats.winner === gameResults.playerName;

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide" ref={pageRef}>
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
            <div className="final-board-section">
              <h4 className="text-center final-board-title">Final Battle Board</h4>
              <div className="game-board-container">
                <img
                  src={gameResults.finalBoardImage}
                  alt="Final battle board showing all ship positions"
                />
                <p className="text-center text-muted">
                  All enemy ship locations revealed
                </p>
              </div>
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

            </div>
          )}
        </div>

        {showPromotion && promotionalEra && (
          <PromotionalBox
            selectedEraConfig={promotionalEra}
            playerProfile={playerProfile}
            onPurchase={handlePurchase}
          />
        )}
                                 
        <div className="over-actions">
          <button
            className="btn btn--primary btn--lg"
            onClick={handleChangeEra}
            title="Select a different era"
          >
            Play Again
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
