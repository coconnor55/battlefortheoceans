// src/pages/OverPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import PromotionalBox from '../components/PromotionalBox';
import RightsService from '../services/RightsService';
import './Pages.css';
import './OverPage.css';

const version = 'v0.1.5';

const OverPage = () => {
  const {
    dispatch,
    stateMachine,
    gameInstance,
    eraConfig,
    selectedOpponent,
    userProfile,
    resetGame
  } = useGame();
  
  const [showGameLog, setShowGameLog] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showPromotion, setShowPromotion] = useState(false);
  const rightsService = new RightsService();

  // Check if user needs to see Midway Island promotion
  useEffect(() => {
    const checkPromotionEligibility = async () => {
      // Only show promotion after Traditional Battleship games
      if (eraConfig?.name !== 'Traditional Battleship' || !userProfile?.id) {
        setShowPromotion(false);
        return;
      }

      // Check if user already has Midway Island access
      const hasAccess = await rightsService.hasEraAccess(userProfile.id, 'midway_island');
      setShowPromotion(!hasAccess);
    };

    checkPromotionEligibility();
  }, [eraConfig, userProfile]);

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
    resetGame();
    if (dispatch && stateMachine) {
      dispatch(stateMachine.event.ERA);
    }
  };

  // Handle play again with same settings
  const handlePlayAgain = () => {
    resetGame();
    if (dispatch && stateMachine) {
      dispatch(stateMachine.event.REPLAY);
    }
  };

  // Handle purchase flow from promotional box
  const handlePurchase = (eraId) => {
    console.log(version, 'Initiating purchase flow for era:', eraId);
    // TODO: Navigate to purchase page
    // For now, just log the intent
    alert(`Purchase flow for ${eraId} - Coming soon!`);
  };

  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="page-header">
            <h2>Battle Complete</h2>
            <p>{eraConfig?.name || 'Naval Combat'}</p>
          </div>

          {/* Game Results */}
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
                        <span>{player.shotDamage?.toFixed(1) || '0.0'}</span>
                      </div>
                      <div className="stat-row">
                        <span>Ships Lost:</span>
                        <span>{player.shipsRemaining !== undefined ?
                          Math.max(0, (player.type === 'human' ? 7 : 6) - player.shipsRemaining) : 0}</span>
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

          {/* Promotional Box - shown after Traditional Battleship games */}
          {showPromotion && (
            <PromotionalBox
              eraConfig={eraConfig}
              userProfile={userProfile}
              onPurchase={handlePurchase}
            />
          )}

          {/* Action Buttons */}
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

          {/* Game Log Display */}
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
        </div>
      </div>
    </div>
  );
};

export default OverPage;

// EOF
