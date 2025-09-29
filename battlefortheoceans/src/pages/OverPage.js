// src/pages/OverPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import PromotionalBox from '../components/PromotionalBox';
import PurchasePage from './PurchasePage';

const version = 'v0.2.1';

const OverPage = () => {
  const {
    dispatch,
    events,
    gameInstance,
    eraConfig,
    selectedOpponent,
    userProfile,
    hasEraAccess
  } = useGame();
  
  const [showGameLog, setShowGameLog] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showPromotion, setShowPromotion] = useState(false);
  const [showPurchasePage, setShowPurchasePage] = useState(false);
  const [purchaseEraId, setPurchaseEraId] = useState(null);

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

  // Format game log for display/export
  const formatGameLog = () => {
    const header = `Battle for the Oceans - Game Log\n` +
                   `Era: ${eraConfig?.name || 'Unknown'}\n` +
                   `Opponent: ${selectedOpponent?.name || 'Unknown'}\n` +
                   `Date: ${new Date().toISOString()}\n` +
                   `Winner: ${gameStats.winner || 'Draw'}\n\n`;
    
    const entries = gameLog.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `[${time}] Turn ${entry.turn}: ${entry.message}`;
    }).join('\n');
    
    return header + entries;
  };

  // Copy game log to clipboard
  const copyGameLog = () => {
    const logText = formatGameLog();
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

  // Handle restart - go back to SelectEra
  const handleRestart = () => {
    // Don't reset game - CoreEngine will handle it on state transition
    if (dispatch && events) {
      dispatch(events.ERA);
    }
  };

  // Handle play again with same settings - replays with same era and opponent
  const handlePlayAgain = () => {
    // Don't reset game - CoreEngine will reinitialize on PLACEMENT transition
    if (dispatch && events) {
      dispatch(events.PLACEMENT);
    }
  };

  // Handle purchase flow from promotional box
  const handlePurchase = (eraId) => {
    console.log(version, 'Initiating purchase flow for era:', eraId);
    setPurchaseEraId(eraId);
    setShowPurchasePage(true);
  };

  // Handle purchase completion
  const handlePurchaseComplete = (eraId) => {
    console.log(version, 'Purchase completed for era:', eraId);
    setShowPurchasePage(false);
    setPurchaseEraId(null);
    setShowPromotion(false);
    alert(`${eraId} has been unlocked! You can now access it from the Era Selection page.`);
  };

  // Handle purchase cancellation
  const handlePurchaseCancel = () => {
    console.log(version, 'Purchase cancelled');
    setShowPurchasePage(false);
    setPurchaseEraId(null);
  };

  return (
    <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
      <div className="content-pane content-pane-wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <h2 className="card-title">Battle Complete</h2>
          <p className="card-subtitle">{eraConfig?.name || 'Naval Combat'}</p>
        </div>

        <div className="battle-results">
          <div className="result-header">
            <h3 className={`result-title ${gameStats.winner ? 'winner' : 'draw'}`}>
              {gameStats.winner ? `${gameStats.winner} Wins!` : 'Battle Draw!'}
            </h3>
            <p className="battle-summary">
              vs {selectedOpponent?.name || 'Unknown Opponent'}
            </p>
          </div>

          {showStats && gameStats.players && (
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

        {showPromotion && (
          <PromotionalBox
            eraConfig={eraConfig}
            userProfile={userProfile}
            onPurchase={handlePurchase}
          />
        )}

        <div className="over-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? 'Hide' : 'Show'} Statistics
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowGameLog(!showGameLog)}
          >
            {showGameLog ? 'Hide' : 'Show'} Battle Log
          </button>

          <button
            className="btn btn-warning"
            onClick={copyGameLog}
          >
            Copy Log
          </button>

          <button
            className="btn btn-secondary"
            onClick={emailGameLog}
          >
            Email Results
          </button>

          <button
            className="btn btn-primary"
            onClick={handlePlayAgain}
            title="Battle Again - same era, same opponent"
          >
            Battle Again
          </button>

          <button
            className="btn btn-primary"
            onClick={handleRestart}
          >
            Choose New Era
          </button>
        </div>

        {showGameLog && (
          <div className="game-log-display">
            <h4>Battle Log</h4>
            <div className="log-content">
              {gameLog.length > 0 ? gameLog.map((entry, index) => (
                <div key={index} className={`log-entry ${entry.type || 'info'}`}>
                  <span className="log-time">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="log-turn">[T{entry.turn || '0'}]</span>
                  <span className="log-message">{entry.message}</span>
                </div>
              )) : (
                <p>No battle log available</p>
              )}
            </div>
          </div>
        )}

        {showPurchasePage && (
          <PurchasePage
            eraId={purchaseEraId}
            onComplete={handlePurchaseComplete}
            onCancel={handlePurchaseCancel}
          />
        )}
      </div>
    </div>
  );
};

export default OverPage;

// EOF
