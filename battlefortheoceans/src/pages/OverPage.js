// src/pages/OverPage.js v0.4.0
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.0: Display opponent difficulty badge and include in battle log export

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import PromotionalBox from '../components/PromotionalBox';
import PurchasePage from './PurchasePage';
import LeaderboardService from '../services/LeaderboardService';

const version = 'v0.4.0';

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
    appVersion
  } = useGame();

  // Redirect to login if no user profile
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);
  
  const [showPromotion, setShowPromotion] = useState(false);
  const [showPurchasePage, setShowPurchasePage] = useState(false);
  const [purchaseEraId, setPurchaseEraId] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerRank, setPlayerRank] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(null);

  const leaderboardService = new LeaderboardService();
  const isGuest = userProfile?.id?.startsWith('guest-');

  // Fetch leaderboard on mount
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoadingLeaderboard(true);
      setLeaderboardError(null);
      
      try {
        const top10 = await leaderboardService.getLeaderboard(10);
        console.log(version, 'Leaderboard data received:', top10);
        setLeaderboard(top10 || []);
        
        // Get player's rank if not a guest
        if (userProfile?.id && !isGuest) {
          const rank = await leaderboardService.getPlayerRanking(userProfile.id);
          setPlayerRank(rank);
        }
      } catch (error) {
        console.error(version, 'Error fetching leaderboard:', error);
        setLeaderboardError(error.message || 'Failed to load leaderboard');
      } finally {
        setLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();
  }, [userProfile?.id, isGuest]);

  // Check if user needs to see Midway Island promotion
  useEffect(() => {
    const checkPromotionEligibility = async () => {
      if (eraConfig?.name !== 'Traditional Battleship' || !userProfile?.id) {
        setShowPromotion(false);
        return;
      }

      const hasAccess = await hasEraAccess(userProfile.id, 'midway_island');
      setShowPromotion(!hasAccess);
    };

    checkPromotionEligibility();
  }, [eraConfig, userProfile, hasEraAccess]);

  // Get game results
  const gameStats = gameInstance?.getGameStats() || {};
  const gameLog = gameInstance?.gameLog || [];
  
  // Determine if player won
  const didPlayerWin = gameStats.winner === humanPlayer?.name;

  // Helper function to get difficulty badge class
  const getDifficultyBadgeClass = (difficulty) => {
    if (difficulty < 1.0) return 'badge--success'; // Easy - green
    if (difficulty === 1.0) return 'badge--primary'; // Medium - blue
    return 'badge--warning'; // Hard - orange/red
  };

  // Helper function to get difficulty label
  const getDifficultyLabel = (difficulty) => {
    if (difficulty < 1.0) return 'Easy';
    if (difficulty === 1.0) return 'Medium';
    return 'Hard';
  };

  // Format game log for display/export
  const formatGameLog = (includeImage = false) => {
    // v0.4.0: Include opponent difficulty in header
    const opponentDifficulty = selectedOpponent?.difficulty || 1.0;
    const opponentLine = opponentDifficulty !== 1.0
      ? `Opponent: ${selectedOpponent?.name || 'Unknown'} (${opponentDifficulty}x)\n`
      : `Opponent: ${selectedOpponent?.name || 'Unknown'}\n`;
    
    const header = `Battle for the Oceans - Game Log\n` +
                   `Version: ${appVersion || 'Unknown'}\n` +
                   `Era: ${eraConfig?.name || 'Unknown'}\n` +
                   opponentLine +
                   `Date: ${new Date().toLocaleString()}\n` +
                   `Winner: ${gameStats.winner || 'Draw'}\n\n`;
    
    const entries = gameLog
      .filter(entry => entry.message?.includes('[BATTLE]'))
      .map(entry => {
        const elapsed = entry.elapsed || '0.0';
        const msg = entry.message.replace('[BATTLE] ', '');
        return `[+${elapsed}s] ${msg}`;
      })
      .join('\n');
    
    return header + entries;
  };

  // Copy game log to clipboard
  const copyGameLog = () => {
    const logText = formatGameLog(true);
    navigator.clipboard.writeText(logText).then(() => {
      alert('Game log copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy log:', err);
      alert('Failed to copy log. Check console for details.');
    });
  };

  // Email game log
  const emailGameLog = () => {
    const logText = formatGameLog();
    const subject = encodeURIComponent(`Battle for the Oceans - ${eraConfig?.name || 'Game'} Results`);
    const body = encodeURIComponent(logText);
    
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
  };
    
  // Handle play again - go back to opponent selection
  const handlePlayAgain = () => {
    if (dispatch && events) {
      dispatch(events.SELECTOPPONENT);
    }
  };

  // Go back to era selection
  const handleChangeEra = () => {
    if (dispatch && events) {
      dispatch(events.ERA);
    }
  };

  // Handle guest signup - sets URL parameter before state transition
  const handleGuestSignup = () => {
    console.log(version, 'Guest requesting signup - setting URL parameter');
    
    // Set URL parameter BEFORE dispatch so CoreEngine preserves it
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('signup', 'true');
    window.history.replaceState({}, '', currentUrl);
    
    // Now dispatch - CoreEngine will preserve the parameter
    dispatch(events.LOGIN);
  };

  // Handle purchase flow
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

  // Don't render if no userProfile (will redirect)
  if (!userProfile) {
    return null;
  }

  // Get opponent difficulty for display
  const opponentDifficulty = selectedOpponent?.difficulty || 1.0;
  const showDifficultyBadge = opponentDifficulty !== 1.0;

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header">
          <h2 className="card-title">Battle Complete</h2>
          <p className="card-subtitle">{eraConfig?.name || 'Naval Combat'}</p>
          <p className="battle-summary">
            {humanPlayer?.name || 'Player'} vs {selectedOpponent?.name || 'Unknown Opponent'}
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

          {/* Final Board Screenshot */}
          {gameInstance?.finalBoardImage && (
            <div className="final-board-section">
              <div className="final-board-container">
                <img
                  src={gameInstance.finalBoardImage}
                  alt="Final battle board state"
                  className="final-board-image"
                />
              </div>
            </div>
          )}
          
          {gameStats.players && (
            <div className="battle-stats">
              <h4>Battle Statistics</h4>
              <div className="stats-grid">
                {gameStats.players.map((player, index) => {
                  // Determine if this player won
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
                        <span>{player.score || 0}</span>
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

        {/* Top 10 Leaderboard */}
        <div className="leaderboard-section">
          <h4>Top 10 Leaderboard</h4>
          
          {loadingLeaderboard ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading leaderboard...</p>
            </div>
          ) : leaderboardError ? (
            <div className="error-message">
              <p>Unable to load leaderboard: {leaderboardError}</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="empty-state">
              <p>No players on the leaderboard yet.</p>
              <p className="text-secondary">Play more games to be the first!</p>
            </div>
          ) : (
            <>
              <div className="leaderboard-table">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Score</th>
                      <th>Accuracy</th>
                      <th>Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => {
                      const isCurrentPlayer = !isGuest && entry.game_name === userProfile?.game_name;
                      return (
                        <tr key={index} className={isCurrentPlayer ? 'player-row' : ''}>
                          <td className="rank-cell">#{index + 1}</td>
                          <td className="player-cell">
                            {entry.game_name}
                            {isCurrentPlayer && <span className="badge badge--primary ml-sm">You</span>}
                          </td>
                          <td>{entry.total_score?.toLocaleString() || 0}</td>
                          <td>{entry.best_accuracy ? `${entry.best_accuracy.toFixed(1)}%` : 'N/A'}</td>
                          <td>{entry.total_wins || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Show player's rank if not in top 10 */}
              {!isGuest && playerRank && playerRank > 10 && (
                <div className="player-rank-info">
                  <p>
                    <strong>Your Rank:</strong> #{playerRank}
                  </p>
                </div>
              )}

              {isGuest && (
                <div className="guest-leaderboard-note">
                  <p>
                    <button
                      className="link-button"
                      onClick={handleGuestSignup}
                    >
                      Create an account
                    </button>
                    {' '}to track your ranking and compete for the top spot!
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {showPromotion && (
          <PromotionalBox
            eraConfig={eraConfig}
            userProfile={userProfile}
            onPurchase={handlePurchase}
          />
        )}

        <div className="over-actions">
          <button
            className="btn btn--secondary btn--lg"
            onClick={handleChangeEra}
            title="Select a different era"
          >
            Change Era
          </button>
          <button
            className="btn btn--primary btn--lg"
            onClick={handlePlayAgain}
            title="Play another battle - choose a different opponent"
          >
            Change Opponent
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
