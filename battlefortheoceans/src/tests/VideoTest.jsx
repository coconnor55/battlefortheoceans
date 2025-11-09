// src/tests/VideoTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.4: Fix path to /config/game-config.json (not /data/)
//         - Use correct path from useVideoTriggers.js
//         - Path is /config/game-config.json
// v0.1.3: Fix to read game-config.json instead of era config
// v0.1.2: Add detailed reasons for each test result
// v0.1.1: Fix duplicate test runs and add skip status
// v0.1.0: Video popup system testing

import React, { useState, useEffect, useRef } from 'react';
import { coreEngine, useGame } from '../context/GameContext';

const version = 'v0.1.4';

const VideoTest = ({ playerId, onComplete }) => {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double-run in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;
    
    runTests();
  }, []);

  const addResult = (name, status, message, reason = null, data = null) => {
    setResults(prev => [...prev, {
      name,
      status,
      message,
      reason,
      data,
      timestamp: new Date().toISOString()
    }]);
  };

  const runTests = async () => {
    setRunning(true);
    const testResults = [];

    try {
      // Test 1: Load game-config.json
      let gameConfig = null;
      try {
        const response = await fetch('/config/game-config.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        gameConfig = await response.json();
        
        addResult(
          'Game Config Loading',
          'pass',
          'Successfully loaded game-config.json',
          null,
          { configKeys: Object.keys(gameConfig) }
        );
        testResults.push({
          name: 'Game Config Loading',
          status: 'pass'
        });
      } catch (error) {
        addResult(
          'Game Config Loading',
          'fail',
          'Failed to load game-config.json',
          `Error: ${error.message}. File path: /config/game-config.json`,
          { error: error.message }
        );
        testResults.push({
          name: 'Game Config Loading',
          status: 'fail',
          reason: `Error: ${error.message}. File path: /config/game-config.json`
        });
        
        // Can't continue without config
        const summary = {
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          details: testResults
        };
        onComplete(summary);
        setRunning(false);
        return;
      }

      // Test 2: Check videos object exists
      const hasVideos = gameConfig.videos && typeof gameConfig.videos === 'object';
      const videosReason = hasVideos ? null :
        'Missing "videos" object in game-config.json';
      addResult(
        'Videos Configuration',
        hasVideos ? 'pass' : 'fail',
        hasVideos
          ? 'Videos configuration exists in game-config.json'
          : 'No videos configuration found',
        videosReason,
        { hasVideos, videos: gameConfig.videos }
      );
      testResults.push({
        name: 'Videos Configuration',
        status: hasVideos ? 'pass' : 'fail',
        reason: videosReason
      });

      if (!hasVideos) {
        const summary = {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'pass').length,
          failed: testResults.filter(r => r.status === 'fail').length,
          skipped: 0,
          details: testResults
        };
        onComplete(summary);
        setRunning(false);
        return;
      }

      // Test 3: Check generic_fallbacks object
      const hasFallbacks = gameConfig.videos.generic_fallbacks &&
        typeof gameConfig.videos.generic_fallbacks === 'object';
      const fallbacksReason = hasFallbacks ? null :
        'Missing "generic_fallbacks" object in videos config. Expected path: videos.generic_fallbacks';
      addResult(
        'Generic Fallbacks',
        hasFallbacks ? 'pass' : 'fail',
        hasFallbacks
          ? 'Generic fallback videos configured'
          : 'No generic_fallbacks found',
        fallbacksReason,
        { generic_fallbacks: gameConfig.videos?.generic_fallbacks }
      );
      testResults.push({
        name: 'Generic Fallbacks',
        status: hasFallbacks ? 'pass' : 'fail',
        reason: fallbacksReason
      });

      if (!hasFallbacks) {
        const summary = {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'pass').length,
          failed: testResults.filter(r => r.status === 'fail').length,
          skipped: 0,
          details: testResults
        };
        onComplete(summary);
        setRunning(false);
        return;
      }

      const fallbacks = gameConfig.videos.generic_fallbacks;

      // Test 4: Check sunkplayer video
      const hasSunkPlayer = typeof fallbacks.sunkplayer === 'string' && fallbacks.sunkplayer.length > 0;
      const sunkPlayerReason = hasSunkPlayer ? null :
        `Missing or invalid "sunkplayer" path. Expected: string path, Got: ${JSON.stringify(fallbacks.sunkplayer)}`;
      addResult(
        'Sunk Player Video',
        hasSunkPlayer ? 'pass' : 'fail',
        hasSunkPlayer
          ? `Configured: ${fallbacks.sunkplayer}`
          : 'No sunkplayer video path found',
        sunkPlayerReason,
        { path: fallbacks.sunkplayer }
      );
      testResults.push({
        name: 'Sunk Player Video',
        status: hasSunkPlayer ? 'pass' : 'fail',
        reason: sunkPlayerReason
      });

      // Test 5: Check sunkopponent video
      const hasSunkOpponent = typeof fallbacks.sunkopponent === 'string' && fallbacks.sunkopponent.length > 0;
      const sunkOpponentReason = hasSunkOpponent ? null :
        `Missing or invalid "sunkopponent" path. Expected: string path, Got: ${JSON.stringify(fallbacks.sunkopponent)}`;
      addResult(
        'Sunk Opponent Video',
        hasSunkOpponent ? 'pass' : 'fail',
        hasSunkOpponent
          ? `Configured: ${fallbacks.sunkopponent}`
          : 'No sunkopponent video path found',
        sunkOpponentReason,
        { path: fallbacks.sunkopponent }
      );
      testResults.push({
        name: 'Sunk Opponent Video',
        status: hasSunkOpponent ? 'pass' : 'fail',
        reason: sunkOpponentReason
      });

      // Test 6: Check victory video
      const hasVictory = typeof fallbacks.victory === 'string' && fallbacks.victory.length > 0;
      const victoryReason = hasVictory ? null :
        `Missing or invalid "victory" path. Expected: string path, Got: ${JSON.stringify(fallbacks.victory)}`;
      addResult(
        'Victory Video',
        hasVictory ? 'pass' : 'fail',
        hasVictory
          ? `Configured: ${fallbacks.victory}`
          : 'No victory video path found',
        victoryReason,
        { path: fallbacks.victory }
      );
      testResults.push({
        name: 'Victory Video',
        status: hasVictory ? 'pass' : 'fail',
        reason: victoryReason
      });

      // Test 7: Check defeat video
      const hasDefeat = typeof fallbacks.defeat === 'string' && fallbacks.defeat.length > 0;
      const defeatReason = hasDefeat ? null :
        `Missing or invalid "defeat" path. Expected: string path, Got: ${JSON.stringify(fallbacks.defeat)}`;
      addResult(
        'Defeat Video',
        hasDefeat ? 'pass' : 'fail',
        hasDefeat
          ? `Configured: ${fallbacks.defeat}`
          : 'No defeat video path found',
        defeatReason,
        { path: fallbacks.defeat }
      );
      testResults.push({
        name: 'Defeat Video',
        status: hasDefeat ? 'pass' : 'fail',
        reason: defeatReason
      });

      // Test 8: Check new_achievement video (top level)
      const hasAchievement = typeof gameConfig.videos.new_achievement === 'string' &&
        gameConfig.videos.new_achievement.length > 0;
      const achievementReason = hasAchievement ? null :
        `Missing or invalid "new_achievement" path. Expected: string path, Got: ${JSON.stringify(gameConfig.videos.new_achievement)}`;
      addResult(
        'New Achievement Video',
        hasAchievement ? 'pass' : 'fail',
        hasAchievement
          ? `Configured: ${gameConfig.videos.new_achievement}`
          : 'No new_achievement video path found',
        achievementReason,
        { path: gameConfig.videos.new_achievement }
      );
      testResults.push({
        name: 'New Achievement Video',
        status: hasAchievement ? 'pass' : 'fail',
        reason: achievementReason
      });

        // Test 9: Check video callback methods exist on Game class
        const hasGame = coreEngine?.gameInstance != null;
        if (hasGame) {
          const hasCallbackMethods =
            typeof coreEngine.gameInstance.setOnShipSunk === 'function' &&
            typeof coreEngine.gameInstance.setOnGameOver === 'function';
          const callbackReason = hasCallbackMethods ? null :
            'Game class missing setOnShipSunk or setOnGameOver methods';
          addResult(
            'Video Callbacks',
            hasCallbackMethods ? 'pass' : 'fail',
            hasCallbackMethods
              ? 'Game has video callback setter methods'
              : 'Video callback methods not found on Game class',
            callbackReason,
            { hasGame, hasCallbackMethods }
          );
          testResults.push({
            name: 'Video Callbacks',
            status: hasCallbackMethods ? 'pass' : 'fail',
            reason: callbackReason
          });
        } else {
          addResult(
            'Video Callbacks',
            'skip',
            '⊘ Skipped - no active game instance',
            'Start a game to test video callbacks',
            { hasGame: false }
          );
          testResults.push({
            name: 'Video Callbacks',
            status: 'skip',
            reason: 'Start a game to test video callbacks'
          });
        }

      // Test 10: Video system readiness
      const allVideosConfigured = hasSunkPlayer && hasSunkOpponent && hasVictory && hasDefeat && hasAchievement;
      const readinessReason = allVideosConfigured ? null :
        'One or more required video paths missing - check previous test failures for details';
      addResult(
        'Video System Ready',
        allVideosConfigured ? 'pass' : 'fail',
        allVideosConfigured
          ? 'All required video paths configured'
          : 'Video system incomplete',
        readinessReason,
        {
          sunkplayer: hasSunkPlayer,
          sunkopponent: hasSunkOpponent,
          victory: hasVictory,
          defeat: hasDefeat,
          new_achievement: hasAchievement
        }
      );
      testResults.push({
        name: 'Video System Ready',
        status: allVideosConfigured ? 'pass' : 'fail',
        reason: readinessReason
      });

    } catch (error) {
      const errorReason = `Unexpected error: ${error.message}\nStack: ${error.stack}`;
      addResult(
        'Test Suite Error',
        'fail',
        `Unexpected error: ${error.message}`,
        errorReason,
        { error: error.message, stack: error.stack }
      );
      testResults.push({
        name: 'Test Suite Error',
        status: 'fail',
        reason: errorReason
      });
    }

    // Calculate summary
    const passed = testResults.filter(r => r.status === 'pass').length;
    const failed = testResults.filter(r => r.status === 'fail').length;
    const skipped = testResults.filter(r => r.status === 'skip').length;

    const summary = {
      total: testResults.length,
      passed,
      failed,
      skipped,
      details: testResults
    };

    onComplete(summary);
    setRunning(false);
  };

  return (
    <div className="test-component">
      {running && <div className="test-running">Running video system tests...</div>}
      <div className="test-results">
        {results.map((result, index) => (
          <div
            key={index}
            className={`test-result test-result-${
              result.status === 'pass' ? 'success' :
              result.status === 'skip' ? 'skip' :
              'error'
            }`}
          >
            <div className="test-result-header">
              <span className="test-result-name">
                {result.status === 'pass' ? '✓' : result.status === 'skip' ? '⊘' : '✗'} {result.name}
              </span>
              <span className="test-result-time">
                {new Date(result.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="test-result-message">{result.message}</div>
            {result.reason && (
              <div className="test-result-reason">
                <strong>Reason:</strong> {result.reason}
              </div>
            )}
            {result.data && (
              <details className="test-result-data">
                <summary>View Data</summary>
                <pre>{JSON.stringify(result.data, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoTest;
// EOF
