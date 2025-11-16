// src/pages/StatsPage.js v0.1.5
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.5: Use singleton LeaderboardService instance
//         - Changed import from LeaderboardService (class) to leaderboardService (instance)
//         - Removed line 38: const leaderboardService = new LeaderboardService()
//         - LeaderboardService now exports singleton per v0.1.6
// v0.1.4: Use singleton GameStatsService instance
//         - Changed import from GameStatsService (class) to gameStatsService (instance)
//         - Removed line 34: const gameStatsService = new GameStatsService()
//         - GameStatsService now exports singleton per v0.3.3
// v0.1.3: Added leaderboard, toggle for Last 10/All Time stats, load last 100 games
// v0.1.2: Added AI captain performance tracking
// v0.1.1: Removed modal-overlay wrapper (now provided by App.js) to match AchievementsPage pattern

import React, { useState, useEffect } from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import gameStatsService from '../services/GameStatsService';
import leaderboardService from '../services/LeaderboardService';
import { supabase } from '../utils/supabaseClient';

const version = "v0.1.5";
const tag = "STATS";
const module = "StatsPage";
let method = "";

const CACHE_DURATION = 300000; // 5 minutes

function StatsPage({ onClose }) {
    // ===============
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
    // ===============

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
    const required = { gameConfig, eras, player, playerProfile, playerEmail };
    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key, value]) => `${key}=${value}`);
    if (missing.length > 0) {
        logerror(`key data missing: ${missing.join(', ')}`, required);
        throw new Error(`${module}: key data missing: ${missing.join(', ')}`);
    }
    const undefined = { selectedAlliance };
    if (Object.values(required).some(v => v === undefined)) {
        logerror('key data missing', undefined);
        throw new Error('StatsPage: key data missing');
    }

    const { dispatch, events } = useGame();
  const [stats, setStats] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [eraStats, setEraStats] = useState({});
  const [opponentStats, setOpponentStats] = useState({});
  const [ranking, setRanking] = useState(null);
  const [percentile, setPercentile] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Toggle states
  const [showAllAI, setShowAllAI] = useState(false);
  const [showAllEra, setShowAllEra] = useState(false);

  useEffect(() => {
    loadAllStats();
  }, [playerId]);

  const loadAllStats = async () => {
      method = 'loadAllStats';

    if (!playerProfile) {
      setLoading(false);
      return;
    }

    try {
      log('Loading stats for user:', playerProfile?.id);
      
      // Check cache first
      const cacheKey = `stats_${playerId}`;
      const cached = sessionStorage.getItem(cacheKey);
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        if (Date.now() - parsedCache.timestamp < CACHE_DURATION) {
          log('Using cached stats data');
          setAllGames(parsedCache.allGames);
          setRecentGames(parsedCache.allGames.slice(0, 10));
          processEraStats(parsedCache.allGames, false);
          processEraStats(parsedCache.allGames, true);
          processOpponentStats(parsedCache.allGames, false);
          processOpponentStats(parsedCache.allGames, true);
        }
      }
      
      const [gamesData, rankingData, percentileData, leaderboardData, totalGames] = await Promise.all([
        loadAllGames(),
        leaderboardService.getPlayerRanking(playerProfile?.id),
        leaderboardService.getPlayerPercentile(playerProfile?.id),
        leaderboardService.getLeaderboard(100),
        gameStatsService.getTotalGamesPlayed()
      ]);
        console.log('[STATS] Setting stats from playerProfile:', playerProfile);
        setStats(playerProfile);
      setStats(playerProfile);
      setRanking(rankingData);
      setPercentile(percentileData);
      setTotalPlayers(leaderboardData.length);
      setLeaderboard(leaderboardData);
      setTotalGamesPlayed(totalGames);
      
      // Cache the results
      sessionStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        allGames: gamesData
      }));
      
      setLoading(false);
    } catch (error) {
      console.error(version, 'Error loading stats:', error);
      setLoading(false);
    }
  };

  const loadAllGames = async () => {
      method = 'loadAllGames';

    try {
      // Load last 100 games for "All Time" stats (free-tier safe)
      const { data, error } = await supabase
        .from('game_results')
        .select('*')
        .eq('player_id', playerProfile?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const games = data || [];
      setAllGames(games);
      setRecentGames(games.slice(0, 10));
      
      // Process both Last 10 and All Time stats
      processEraStats(games, false); // Last 10
      processEraStats(games, true);  // All Time
      processOpponentStats(games, false); // Last 10
      processOpponentStats(games, true);  // All Time
      
      return games;
    } catch (error) {
      console.error(version, 'Error loading games:', error);
      return [];
    }
  };

  const processEraStats = (games, allTime = false) => {
      method = 'processEraStats';

    const dataToProcess = allTime ? games : games.slice(0, 10);
    const eraData = {};
    
    dataToProcess.forEach(game => {
      if (!eraData[game.era_name]) {
        eraData[game.era_name] = { games: 0, wins: 0, totalScore: 0, totalAccuracy: 0, shipsSunk: 0 };
      }
      
      const era = eraData[game.era_name];
      era.games++;
      if (game.won) era.wins++;
      era.totalScore += game.score;
      era.totalAccuracy += game.accuracy;
      era.shipsSunk += game.sunk;
    });
    
    Object.keys(eraData).forEach(eraName => {
      const era = eraData[eraName];
      era.winRate = ((era.wins / era.games) * 100).toFixed(1);
      era.avgScore = Math.round(era.totalScore / era.games);
      era.avgAccuracy = (era.totalAccuracy / era.games).toFixed(1);
    });
    
    if (allTime) {
      setEraStats(prev => ({ ...prev, allTime: eraData }));
    } else {
      setEraStats(prev => ({ ...prev, recent: eraData }));
    }
  };

  const processOpponentStats = (games, allTime = false) => {
      method = 'processOpponentStats';

    const dataToProcess = allTime ? games : games.slice(0, 10);
    const opponentData = {};
    
    dataToProcess.forEach(game => {
      if (!opponentData[game.opponent_name]) {
        opponentData[game.opponent_name] = { games: 0, wins: 0 };
      }
      
      const opponent = opponentData[game.opponent_name];
      opponent.games++;
      if (game.won) opponent.wins++;
    });
    
    Object.keys(opponentData).forEach(opponentName => {
      const opponent = opponentData[opponentName];
      opponent.winRate = ((opponent.wins / opponent.games) * 100).toFixed(1);
    });
    
    if (allTime) {
      setOpponentStats(prev => ({ ...prev, allTime: opponentData }));
    } else {
      setOpponentStats(prev => ({ ...prev, recent: opponentData }));
    }
  };

  const formatDate = (dateString) => {
      method = 'formatDate';

    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleGuestSignup = () => {
    method = 'handleGuestSignup';

      log('Guest requesting signup - setting URL parameter');
    
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('signup', 'true');
    window.history.replaceState({}, '', currentUrl);
    
    dispatch(events.LOGIN);
  };

  if (loading) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <p>Loading statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
      console.log('[STATS] DEBUG stats is null, playerProfile=', playerProfile);
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane">
          <div className="card-header card-header--with-close">
            <h2 className="card-title">Statistics</h2>
            {onClose && (
              <button className="btn btn--secondary btn--sm" onClick={onClose}>
                ✕
              </button>
            )}
          </div>
          <div className="card-body">
            <p className="text-center">Play some games to see your stats!</p>
          </div>
        </div>
      </div>
    );
  }

  const winRate = stats.total_games > 0 ? ((stats.total_wins / stats.total_games) * 100).toFixed(1) : 0;
  const currentOpponentStats = showAllAI ? opponentStats.allTime : opponentStats.recent;
  const currentEraStats = showAllEra ? eraStats.allTime : eraStats.recent;

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header card-header--with-close">
          <div>
            <h2 className="card-title">Combat Statistics</h2>
          </div>
          {onClose && (
            <button className="btn btn--secondary btn--sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div>
          {/* Hero Stats */}
          <div className="stats-hero">
            <div className="rank-badge">
              {ranking ? `#${ranking}` : '--'}
            </div>
            <div>
              <h3>{stats.game_name}</h3>
              <p className="text-secondary">
                {percentile ? `Top ${percentile}%` : 'Unranked'} • {totalPlayers} Players
              </p>
            </div>
            <div className="win-rate">
              <div className="win-rate__value">{winRate}%</div>
              <div className="win-rate__label">Win Rate</div>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card__icon">🎮</div>
              <div className="stat-card__value">{stats.total_games}</div>
              <div className="stat-card__label">Games</div>
              <div className="text-secondary">{stats.total_wins}W - {stats.total_games - stats.total_wins}L</div>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">🎯</div>
              <div className="stat-card__value">{stats.best_accuracy.toFixed(1)}%</div>
              <div className="stat-card__label">Best Accuracy</div>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">⚓</div>
              <div className="stat-card__value">{stats.total_ships_sunk}</div>
              <div className="stat-card__label">Ships Sunk</div>
            </div>

            <div className="stat-card">
              <div className="stat-card__icon">💥</div>
              <div className="stat-card__value">{Math.round(stats.total_damage)}</div>
              <div className="stat-card__label">Total Damage</div>
            </div>

            <div className="stat-card stat-card--highlight">
              <div className="stat-card__icon">🏆</div>
              <div className="stat-card__value">{stats.total_score}</div>
              <div className="stat-card__label">Total Score</div>
            </div>
          </div>

          {/* Leaderboard Section */}
          <h3 className="section-title">Top 10 Leaderboard</h3>
          {totalGamesPlayed > 0 && (
            <p className="text-secondary text-center mb-md">
              Total Games Played: {totalGamesPlayed.toLocaleString()}
            </p>
          )}
          
          {leaderboard.length === 0 ? (
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
                    {leaderboard.slice(0, 10).map((entry, index) => {
                      const isCurrentPlayer = !isGuest && entry.game_name === playerProfile?.game_name;
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
              
              {!isGuest && ranking && ranking > 10 && (
                <div className="player-rank-info text-center mt-md">
                  <p className="text-secondary">
                    <strong>Your Rank:</strong> #{ranking}
                  </p>
                </div>
              )}

              {isGuest && (
                <div className="guest-leaderboard-note text-center mt-md">
                  <p>
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={handleGuestSignup}
                    >
                      Create Account
                    </button>
                    {' '}to track your ranking and compete for the top spot!
                  </p>
                </div>
              )}
            </>
          )}

          {/* Performance vs AI Captains */}
          {currentOpponentStats && Object.keys(currentOpponentStats).length > 0 && (
            <>
              <div className="section-header">
                <h3 className="section-title">Performance vs AI Captains</h3>
                <div className="toggle-group">
                  <button
                    className={`btn btn--sm ${!showAllAI ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setShowAllAI(false)}
                  >
                    Last 10
                  </button>
                  <button
                    className={`btn btn--sm ${showAllAI ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setShowAllAI(true)}
                  >
                    Last 100
                  </button>
                </div>
              </div>
              <div className="stats-grid">
                {Object.entries(currentOpponentStats).map(([captainName, data]) => (
                  <div key={captainName} className="stat-card">
                    <div className="stat-card__icon">⚔️</div>
                    <div className="stat-card__value">{data.winRate}%</div>
                    <div className="stat-card__label">{captainName}</div>
                    <div className="text-secondary">{data.wins}W - {data.games - data.wins}L</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Era Breakdown */}
          {currentEraStats && Object.keys(currentEraStats).length > 0 && (
            <>
              <div className="section-header">
                <h3 className="section-title">Era Performance</h3>
                <div className="toggle-group">
                  <button
                    className={`btn btn--sm ${!showAllEra ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setShowAllEra(false)}
                  >
                    Last 10
                  </button>
                  <button
                    className={`btn btn--sm ${showAllEra ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setShowAllEra(true)}
                  >
                    All Time
                  </button>
                </div>
              </div>
              <div className="stats-grid">
                {Object.entries(currentEraStats).map(([eraName, data]) => (
                  <div key={eraName} className="stat-card">
                    <h4>{eraName}</h4>
                    <div className="text-secondary">{data.games} games • {data.winRate}% wins</div>
                    <div className="mt-sm text-sm">
                      <div>Avg Score: {data.avgScore}</div>
                      <div>Avg Accuracy: {data.avgAccuracy}%</div>
                      <div>Ships Sunk: {data.shipsSunk}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Recent Games */}
          {recentGames.length > 0 && (
            <>
              <h3 className="section-title">Recent Battles</h3>
              <div className="scrollable-list">
                {recentGames.map((game, index) => (
                  <div key={game.id || index} className={`selectable-item ${game.won ? 'border-success' : 'border-error'}`}>
                    <div className="flex-between">
                      <div>
                        <div className="item-name">{game.era_name}</div>
                        <div className="text-secondary">vs {game.opponent_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="badge badge--primary">{game.score} pts</div>
                        <div className="text-secondary text-sm mt-xs">
                          {game.accuracy.toFixed(1)}% • {game.sunk} sunk • {formatDate(game.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatsPage;
// EOF
