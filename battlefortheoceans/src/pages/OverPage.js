// src/pages/OverPage.js v0.3.6
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import PromotionalBox from '../components/PromotionalBox';
import PurchasePage from './PurchasePage';
import LeaderboardService from '../services/LeaderboardService';

const version = 'v0.3.9';

const OverPage = () => {
  const {
    dispatch,
    events,
    gameInstance,
    eraConfig,
      humanPlayer,
    selectedOpponent,
    userProfile,
    hasEraAccess
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

    // Format game log for display/export - UPDATE THIS FUNCTION
    const formatGameLog = (includeImage = false) => {
      const header = `Battle for the Oceans - Game Log\n` +
                     `Era: ${eraConfig?.name || 'Unknown'}\n` +
                     `Opponent: ${selectedOpponent?.name || 'Unknown'}\n` +
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
      
//      if (includeImage && gameInstance?.finalBoardImage) {
//        // For markdown format (clipboard)
//        return header + `![Final Board](${gameInstance.finalBoardImage})\n\n` + entries;
//      }
      
      return header + entries;
    };

    // Copy game log to clipboard - UPDATE
    const copyGameLog = () => {
      const logText = formatGameLog(true); // Include image reference
      navigator.clipboard.writeText(logText).then(() => {
        alert('Game log copied to clipboard with board image!');
      }).catch(err => {
        console.error('Failed to copy log:', err);
        alert('Failed to copy log. Check console for details.');
      });
    };

    // Email game log - UPDATE TO USE HTML
    const emailGameLog = () => {
      const logText = formatGameLog();
      const subject = encodeURIComponent(`Battle for the Oceans - ${eraConfig?.name || 'Game'} Results`);
      
      // Build HTML email body with inline image
      let htmlBody = `<h2>Battle for the Oceans - Game Log</h2>`;
      htmlBody += `<p><strong>Era:</strong> ${eraConfig?.name || 'Unknown'}</p>`;
      htmlBody += `<p><strong>Opponent:</strong> ${selectedOpponent?.name || 'Unknown'}</p>`;
      htmlBody += `<p><strong>Date:</strong> ${new Date().toLocaleString()}</p>`;
      htmlBody += `<p><strong>Winner:</strong> ${gameStats.winner || 'Draw'}</p>`;
      
//      // Include board image if available
//      if (gameInstance?.finalBoardImage) {
//        htmlBody += `<h3>Final Board State</h3>`;
//        htmlBody += `<img src="${gameInstance.finalBoardImage}" alt="Final Board" style="max-width: 600px; border: 2px solid #00D9FF; border-radius: 8px;" />`;
//      }
      
      htmlBody += `<h3>Battle Log</h3><pre style="background: #f5f5f5; padding: 16px; border-radius: 4px;">`;
      htmlBody += gameLog
        .filter(entry => entry.message?.includes('[BATTLE]'))
        .map(entry => {
          const elapsed = entry.elapsed || '0.0';
          const msg = entry.message.replace('[BATTLE] ', '');
          return `[+${elapsed}s] ${msg}`;
        })
        .join('\n');
      htmlBody += `</pre>`;
      
      const body = encodeURIComponent(htmlBody);
      const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
      window.open(mailtoLink);
    };
    
  // Handle play again - go back to opponent selection
  const handlePlayAgain = () => {
    if (dispatch && events) {
      dispatch(events.SELECTOPPONENT);
    }
  };

  // v0.3.6: Restored - go back to era selection
  const handleChangeEra = () => {
    if (dispatch && events) {
      dispatch(events.ERA);
    }
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

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header">
          <h2 className="card-title">Battle Complete</h2>
          <p className="card-subtitle">{eraConfig?.name || 'Naval Combat'}</p>
          <p className="battle-summary">
        {humanPlayer?.name || 'Player'} vs {selectedOpponent?.name || 'Unknown Opponent'}
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
            <div className="final-board-section" style={{ marginTop: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: 'var(--space-md)',
                background: 'var(--bg-overlay)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-subtle)'
              }}>
                <img
                  src={gameInstance.finalBoardImage}
                  alt="Final battle board state"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: 'var(--border-radius)',
                    border: '2px solid var(--border-color)'
                  }}
                />
              </div>
            </div>
          )}
          
          {gameStats.players && (
            <div className="battle-stats">
              <h4>Battle Statistics</h4>
              <div className="stats-grid">
                {gameStats.players.map((player, index) => (
                  <div key={index} className="player-stats">
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
                  </div>
                ))}
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
                  <p>Create an account to track your ranking and compete for the top spot!</p>
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

        {/* v0.3.6: Restored "Change Era" button */}
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
