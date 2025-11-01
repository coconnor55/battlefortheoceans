// src/tests/VideoTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Fix duplicate test runs and add skip status
//         - Run tests only once (not on every visibility toggle)
//         - Add 'skip' status for missing prerequisites
//         - Clear skip message: "Video tests skipped - select an era first"
//         - Don't count skips as failures in summary
// v0.1.0: Video popup system testing

import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';

const version = 'v0.1.1';

const VideoTest = ({ userId, onComplete }) => {
  const { coreEngine } = useGame();
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!hasRunRef.current) {
      hasRunRef.current = true;
      runTests();
    }
  }, []);

  const addResult = (name, status, message, data = null) => {
    setResults(prev => [...prev, {
      name,
      status,
      message,
      data,
      timestamp: new Date().toISOString()
    }]);
  };

  const runTests = async () => {
    setRunning(true);

    try {
      // Test 1: Check era config
      const hasEraConfig = coreEngine?.eraConfig !== null && coreEngine?.eraConfig !== undefined;
      
      addResult(
        'Era Config Available',
        hasEraConfig ? 'pass' : 'skip',
        hasEraConfig
          ? `Era config found: ${coreEngine.eraConfig?.name || 'Unknown'}`
          : '⊘ Video tests skipped - select an era first',
        { hasEraConfig, eraName: coreEngine?.eraConfig?.name }
      );

      if (!hasEraConfig) {
        const summary = {
          total: 1,
          passed: 0,
          failed: 0,
          skipped: 1,
          details: [{ name: 'Era Config Available', status: 'skip' }]
        };
        onComplete(summary);
        setRunning(false);
        return;
      }

      const eraConfig = coreEngine.eraConfig;

      // Test 2: Check videos configuration
      const hasVideos = eraConfig.videos && typeof eraConfig.videos === 'object';
      addResult(
        'Videos Configuration',
        hasVideos ? 'pass' : 'fail',
        hasVideos
          ? 'Videos configuration exists in era config'
          : 'No videos configuration found',
        { hasVideos, videos: eraConfig.videos }
      );

      // Test 3: Check ship_sunk videos
      const hasShipSunkVideos = hasVideos && Array.isArray(eraConfig.videos.ship_sunk);
      addResult(
        'Ship Sunk Videos',
        hasShipSunkVideos ? 'pass' : 'fail',
        hasShipSunkVideos
          ? `${eraConfig.videos.ship_sunk.length} ship sunk videos configured`
          : 'No ship sunk videos found',
        { count: eraConfig.videos?.ship_sunk?.length, videos: eraConfig.videos?.ship_sunk }
      );

      // Test 4: Check game_over videos
      const hasGameOverVideos = hasVideos &&
        eraConfig.videos.game_over &&
        typeof eraConfig.videos.game_over === 'object';
      addResult(
        'Game Over Videos',
        hasGameOverVideos ? 'pass' : 'fail',
        hasGameOverVideos
          ? 'Game over videos (victory/defeat) configured'
          : 'No game over videos found',
        { gameOverVideos: eraConfig.videos?.game_over }
      );

      // Test 5: Check victory videos
      const hasVictoryVideos = hasGameOverVideos &&
        Array.isArray(eraConfig.videos.game_over.victory);
      addResult(
        'Victory Videos',
        hasVictoryVideos ? 'pass' : 'fail',
        hasVictoryVideos
          ? `${eraConfig.videos.game_over.victory.length} victory videos configured`
          : 'No victory videos found',
        { count: eraConfig.videos?.game_over?.victory?.length, videos: eraConfig.videos?.game_over?.victory }
      );

      // Test 6: Check defeat videos
      const hasDefeatVideos = hasGameOverVideos &&
        Array.isArray(eraConfig.videos.game_over.defeat);
      addResult(
        'Defeat Videos',
        hasDefeatVideos ? 'pass' : 'fail',
        hasDefeatVideos
          ? `${eraConfig.videos.game_over.defeat.length} defeat videos configured`
          : 'No defeat videos found',
        { count: eraConfig.videos?.game_over?.defeat?.length, videos: eraConfig.videos?.game_over?.defeat }
      );

      // Test 7: Check video URL format
      if (hasShipSunkVideos) {
        const firstVideo = eraConfig.videos.ship_sunk[0];
        const hasValidUrl = firstVideo && typeof firstVideo.url === 'string' && firstVideo.url.length > 0;
        addResult(
          'Video URL Format',
          hasValidUrl ? 'pass' : 'fail',
          hasValidUrl
            ? `Valid URL format: ${firstVideo.url}`
            : 'Invalid or missing video URL',
          { firstVideo }
        );
      }

      // Test 8: Check video title format
      if (hasShipSunkVideos) {
        const firstVideo = eraConfig.videos.ship_sunk[0];
        const hasTitle = firstVideo && typeof firstVideo.title === 'string';
        addResult(
          'Video Title',
          hasTitle ? 'pass' : 'fail',
          hasTitle
            ? `Video has title: "${firstVideo.title}"`
            : 'Video missing title',
          { title: firstVideo?.title }
        );
      }

      // Test 9: Check useVideoTriggers hook availability
      // Note: Can't directly test the hook, but we can check if game has video callbacks
      const hasGame = coreEngine?.gameInstance !== undefined;
      const hasVideoCallbacks = hasGame && (
        typeof coreEngine.gameInstance.onShipSunk === 'function' ||
        typeof coreEngine.gameInstance.onGameOver === 'function'
      );
      addResult(
        'Video Callbacks',
        hasVideoCallbacks ? 'pass' : 'fail',
        hasVideoCallbacks
          ? 'Game has video callback hooks'
          : 'No game instance or video callbacks not set',
        { hasGame, hasVideoCallbacks }
      );

      // Test 10: Check VideoPopup component integration
      // This is indirect - we check if the video system is ready
      const videoSystemReady = hasVideos && hasShipSunkVideos && hasGameOverVideos;
      addResult(
        'Video System Ready',
        videoSystemReady ? 'pass' : 'fail',
        videoSystemReady
          ? 'Video system fully configured and ready'
          : 'Video system incomplete',
        {
          hasVideos,
          hasShipSunkVideos,
          hasGameOverVideos,
          hasVictoryVideos,
          hasDefeatVideos
        }
      );

    } catch (error) {
      addResult(
        'Test Suite Error',
        'fail',
        `Unexpected error: ${error.message}`,
        { error: error.message, stack: error.stack }
      );
    }

    // Calculate summary
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;

    const summary = {
      total: results.length,
      passed,
      failed,
      skipped,
      details: results.map(r => ({ name: r.name, status: r.status }))
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
