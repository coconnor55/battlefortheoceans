// src/pages/OverPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.9: Removed leaderboard section (now in Stats page)
// v0.4.8: Fixed mock achievements with ENABLE_MOCK_ACHIEVEMENTS flag
// v0.4.7: Added achievement notifications between board and battle stats
// v0.4.6: Added Log Out button for quick testing and player handoff
// v0.4.5: Use sessionStorage to persist game results across page refresh

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import PromotionalBox from '../components/PromotionalBox';
import PurchasePage from './PurchasePage';
import GameStatsService from '../services/GameStatsService';
import AchievementService from '../services/AchievementService';
import * as LucideIcons from 'lucide-react';

const version = 'v0.4.9';
const SESSION_KEY = 'battleForOceans_gameResults';

const OverPage = () => {
  const {
    dispatch,
    events,
    gameInstance,
    eraConfig,
    humanPlayer,
    selectedOpponent,
    userProfile,
    hasEraAccess,
      getPromotableEras,
    appVersion
  } = useGame();

  // State for game results (from CoreEngine or sessionStorage)
  const [gameResults, setGameResults] = useState(null);
  
  // State for achievements
  const [newAchievements, setNewAchievements] = useState([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);

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
    if (gameInstance && eraConfig && selectedOpponent && humanPlayer) {
      const results = {
        gameStats: gameInstance.getGameStats(),
        gameLog: gameInstance.gameLog || [],
        finalBoardImage: gameInstance.finalBoardImage,
        eraName: eraConfig.name,
        playerName: humanPlayer.name,
        opponentName: selectedOpponent.name,
        opponentDifficulty: selectedOpponent.difficulty || 1.0
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
        dispatch(events.ERA);
      }
    }
  }, [gameInstance, eraConfig, selectedOpponent, humanPlayer, userProfile, dispatch, events]);

  // Check for new achievements when game results are available
  useEffect(() => {
    const checkForAchievements = async () => {
      if (!gameResults || !userProfile || userProfile.id.startsWith('guest-')) {
        return;
      }

      // TEMPORARY: Mock achievements for testing
      const ENABLE_MOCK_ACHIEVEMENTS = false; // Set to false when done testing
      
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
          },
          {
            id: 'perfect-game',
            name: 'Perfect Game',
            description: 'Win without missing',
            badge_icon: 'Crown',
            points: 100,
            tier: 'gold'
          },
          {
            id: 'fleet-admiral',
            name: 'Fleet Admiral',
            description: 'Win 100 battles',
            badge_icon: 'Medal',
            points: 500,
            tier: 'platinum'
          }
        ];
        setNewAchievements(mockAchievements);
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
        setNewAchievements(unlocked);
      } catch (error) {
        console.error(version, 'Error checking achievements:', error);
      } finally {
        setLoadingAchievements(false);
      }
    };

    checkForAchievements();
  }, [gameResults, userProfile]);
  
  const [showPromotion, setShowPromotion] = useState(false);
    const [promotionalEra, setPromotionalEra] = useState(null);  // ← ADD THIS
  const [showPurchasePage, setShowPurchasePage] = useState(false);
  const [purchaseEraId, setPurchaseEraId] = useState(null);

  const isGuest = userProfile?.id?.startsWith('guest-');

  // Check if user needs to see Midway Island promotion
    // Find a promotional era the user doesn't own
    useEffect(() => {
      const findPromotionalEra = async () => {
        if (!userProfile?.id) {
          setShowPromotion(false);
          return;
        }

        try {
          // Get all promotable eras (non-free eras with promotional content)
          const promotableEras = await getPromotableEras();
          
          if (promotableEras.length === 0) {
            setShowPromotion(false);
            return;
          }

          // Filter to eras user doesn't have access to
          const lockedEras = [];
          for (const era of promotableEras) {
            const hasAccess = await hasEraAccess(userProfile.id, era.id);
            if (!hasAccess) {
              lockedEras.push(era);
            }
          }

          if (lockedEras.length === 0) {
            setShowPromotion(false);
            return;
          }

          // Pick a random locked era to promote
          const randomEra = lockedEras[Math.floor(Math.random() * lockedEras.length)];
          
          console.log(version, 'Promoting era:', randomEra.name);
          setPromotionalEra(randomEra);
          setShowPromotion(true);

        } catch (error) {
          console.error(version, 'Error finding promotional era:', error);
          setShowPromotion(false);
        }
      };

      findPromotionalEra();
    }, [userProfile, hasEraAccess, getPromotableEras]);

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
      default: return 'badge--primary';
    }
  };

  const getDifficultyBadgeClass = (difficulty) => {
    if (difficulty < 1.0) return 'badge--success';
    if (difficulty === 1.0) return 'badge--primary';
    return 'badge--warning';
  };

  const getDifficultyLabel = (difficulty) => {
    if (difficulty < 1.0) return 'Easy';
    if (difficulty === 1.0) return 'Medium';
    return 'Hard';
  };

  const formatGameLog = (includeImage = false) => {
    if (!gameResults) return '';
    
    const opponentDifficulty = gameResults.opponentDifficulty || 1.0;
    const opponentLine = opponentDifficulty !== 1.0
      ? `Opponent: ${gameResults.opponentName} (${opponentDifficulty}x)\n`
      : `Opponent: ${gameResults.opponentName}\n`;
    
    const header = `Battle for the Oceans - Game Log\n` +
                   `Version: ${appVersion || 'Unknown'}\n` +
                   `Era: ${gameResults.eraName}\n` +
                   opponentLine +
                   `Date: ${new Date().toLocaleString()}\n` +
                   `Winner: ${gameResults.gameStats.winner || 'Draw'}\n\n`;
    
    const entries = gameResults.gameLog
      .filter(entry => entry.message?.includes('[BATTLE]'))
      .map(entry => {
        const elapsed = entry.elapsed || '0.0';
        const msg = entry.message.replace('[BATTLE] ', '');
        return `[+${elapsed}s] ${msg}`;
      })
      .join('\n');
    
    return header + entries;
  };

  const copyGameLog = () => {
    const logText = formatGameLog(true);
    navigator.clipboard.writeText(logText).then(() => {
      alert('Game log copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy log:', err);
      alert('Failed to copy log. Check console for details.');
    });
  };

  const emailGameLog = () => {
    const logText = formatGameLog();
    const subject = encodeURIComponent(`Battle for the Oceans - ${gameResults?.eraName || 'Game'} Results`);
    const body = encodeURIComponent(logText);
    
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
  };
    
  const handlePlayAgain = () => {
    sessionStorage.removeItem(SESSION_KEY);
    dispatch(events.SELECTOPPONENT);
  };

  const handleChangeEra = () => {
    sessionStorage.removeItem(SESSION_KEY);
    dispatch(events.ERA);
  };

  const handleLogOut = () => {
    console.log(version, 'User logging out - clearing session and returning to launch');
    sessionStorage.removeItem(SESSION_KEY);
    dispatch(events.LAUNCH);
  };

  const handleGuestSignup = () => {
    console.log(version, 'Guest requesting signup - setting URL parameter');
    
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('signup', 'true');
    window.history.replaceState({}, '', currentUrl);
    
    dispatch(events.LOGIN);
  };

  const handlePurchase = (eraId) => {
    console.log(version, 'Initiating purchase flow for era:', eraId);
    setPurchaseEraId(eraId);
    setShowPurchasePage(true);
  };

  const handlePurchaseComplete = (eraId) => {
    console.log(version, 'Purchase completed for era:', eraId);
    setShowPurchasePage(false);
    setPurchaseEraId(null);
    setShowPromotion(false);
    alert(`${eraId} has been unlocked! You can now access it from the Era Selection page.`);
  };

  const handlePurchaseCancel = () => {
    console.log(version, 'Purchase cancelled');
    setShowPurchasePage(false);
    setPurchaseEraId(null);
  };

  // Don't render until we have results and userProfile
  if (!userProfile || !gameResults) {
    return null;
  }

  const { gameStats, gameLog, finalBoardImage, eraName, playerName, opponentName, opponentDifficulty } = gameResults;
  const showDifficultyBadge = opponentDifficulty !== 1.0;

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header">
          <h2 className="card-title">Battle Complete</h2>
          <p className="card-subtitle">{eraName || 'Naval Combat'}</p>
          <p className="battle-summary">
            {playerName || 'Player'} vs {opponentName || 'Unknown Opponent'}
            {showDifficultyBadge && (
              <span className={`badge ${getDifficultyBadgeClass(opponentDifficulty)} ml-sm`}>
                {getDifficultyLabel(opponentDifficulty)} - {opponentDifficulty}x
              </span>
            )}
          </p>
        </div>

        <div className="battle-results">
          <div className="result-header">
            <h3 className={`result-title ${gameStats.winner ? 'winner' : 'draw'}`}>
              {gameStats.winner ? `${gameStats.winner} Wins!` : 'Battle Draw!'}
            </h3>
          </div>

          {finalBoardImage && (
            <div className="final-board-section">
              <div className="final-board-container">
                <img
                  src={finalBoardImage}
                  alt="Final battle board state"
                  className="final-board-image"
                />
              </div>
            </div>
          )}

          {/* Achievement Notifications */}
          {!isGuest && newAchievements.length > 0 && (
            <div className="achievements-section">
              <h4 className="achievements-title">🎉 Achievements Unlocked!</h4>
              <div className="achievements-grid">
                {newAchievements.map((achievement, index) => {
                  const Icon = getLucideIcon(achievement.badge_icon);
                  return (
                    <div
                      key={achievement.id}
                      className={`achievement-card achievement-card--${achievement.tier}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="achievement-card__icon">
                        <Icon size={32} />
                      </div>
                      <div className="achievement-card__text">
                        <div className="achievement-card__name">{achievement.name}</div>
                        <div className="achievement-card__points">
                          <span className={`badge ${getTierBadgeClass(achievement.tier)}`}>
                            +{achievement.points}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
            </div>
          )}
        </div>

         {showPromotion && promotionalEra && (
           <PromotionalBox
             eraConfig={promotionalEra}  // ← Changed from eraConfig
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
            className="btn btn--secondary btn--lg"
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
