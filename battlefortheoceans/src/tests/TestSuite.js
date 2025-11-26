// src/tests/TestSuite.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.6: Add skipped count to summary (minimal change - 6 lines modified)
// v0.1.5: Added UIComponentsTest, AchievementTest, and GameStatsTest (path corrected to ../tests/)
// v0.1.4: Keep original test output visible on collapse/expand
// v0.1.3: Added MunitionsTest, NavigationTest, and VideoTest
// v0.1.2: Separate run and expand/collapse controls
// v0.1.1: Use GameContext for user authentication
// v0.1.0: Main test suite orchestrator

import React, { useState } from 'react';
import { coreEngine,  useGame } from '../context/GameContext';
import VoucherServiceTest from './VoucherServiceTest';
import RightsServiceTest from './RightsServiceTest';
import MunitionsTest from './MunitionsTest';
import NavigationTest from './NavigationTest';
import VideoTest from './VideoTest';
import UIComponentsTest from './UIComponentsTest';
import AchievementTest from './AchievementTest';
import GameStatsTest from './GameStatsTest';
import PlayerProfileServiceTest from './PlayerProfileServiceTest';
import './TestSuite.css';

const version = 'v0.1.6';
const tag = "TEST";
const module = "TestSuite";
let method = "";
// Test user configuration

const TestSuite = ({ onClose }) => {
    // Logging utilities
    const log = (message) => {
      console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    };
    
    const logerror = (message, error = null) => {
      if (error) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
      } else {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
      }
    };

    // Key data - see CoreEngine handle{state}
    const gameConfig = coreEngine.gameConfig;
    const eras = coreEngine.eras;
    const player = coreEngine.player;
    const playerProfile = coreEngine.playerProfile;
    const playerEmail = coreEngine.playerEmail;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponents = coreEngine.selectedOpponents;

    // Derived data
    const playerId = coreEngine.playerId;
    const playerRole = coreEngine.playerRole;
    const playerGameName = coreEngine.playerGameName;
    const isGuest = player != null && player.isGuest;
    const isAdmin = player != null && playerProfile?.isAdmin;
    const isDeveloper = player != null && playerProfile?.isDeveloper;
    const isTester = player != null && playerProfile?.isTester;
    const selectedOpponent = selectedOpponents?.[0];
    const selectedGameMode = coreEngine.selectedGameMode;
    const gameInstance = coreEngine.gameInstance;
    const board = coreEngine.board;

    const [activeTest, setActiveTest] = useState(null);
    const [expandedTests, setExpandedTests] = useState(new Set());
    const [completedTests, setCompletedTests] = useState(new Set());
    const [results, setResults] = useState({
      voucherService: null,
      rightsService: null,
      munitions: null,
      navigation: null,
      video: null,
      uiComponents: null,
      achievements: null,
      gameStats: null
    });

    log('TestSuite player: ', playerId, playerGameName, playerRole, isAdmin);

    // Admin check - only allow admins to run tests
    if (!isAdmin) {
      logerror('Admin check failed - not an admin', playerId, playerGameName, playerRole, isAdmin);
      return (
        <div className="test-suite-overlay">
          <div className="test-suite-container">
            <div className="test-suite-header">
              <h1>🧪 Test Suite</h1>
              <button onClick={onClose} className="test-suite-close">✕</button>
            </div>
            <div className="test-suite-info">
              <p className="test-warning">⚠️ Admin access required</p>
              <p>Tests are only available to administrators.</p>
            </div>
            <div className="test-suite-actions">
              <button onClick={onClose} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      );
    }


  const tests = [
    {
      id: 'voucherService',
      name: 'VoucherService',
      description: 'Voucher parsing, redemption, and generation',
      component: VoucherServiceTest,
      version: 'v0.1.0'
    },
    {
      id: 'rightsService',
      name: 'RightsService',
      description: 'Pass management and access control',
      component: RightsServiceTest,
      version: 'v0.2.0'
    },
    {
      id: 'munitions',
      name: 'Munitions System',
      description: 'Star shell and scatter shot functionality',
      component: MunitionsTest,
      version: 'v0.1.0'
    },
    {
      id: 'navigation',
      name: 'Navigation System',
      description: 'State machine and navigation',
      component: NavigationTest,
      version: 'v0.1.0'
    },
    {
      id: 'video',
      name: 'Video System',
      description: 'Video popup configuration and integration',
      component: VideoTest,
      version: 'v0.1.0'
    },
    {
      id: 'playerProfile',
      name: 'User Profile Service',
      description: 'Profile management and incomplete games tracking',
      component: PlayerProfileServiceTest,
      version: 'v0.1.0'
    },
    {
      id: 'uiComponents',
      name: 'UI Components',
      description: 'Component instantiation and props validation',
      component: UIComponentsTest,
      version: 'v0.3.0'
    },
    {
      id: 'achievements',
      name: 'Achievement System',
      description: 'Achievement checking and unlocking logic',
      component: AchievementTest,
      version: 'v0.3.0'
    },
    {
      id: 'gameStats',
      name: 'Game Statistics',
      description: 'Statistics calculations and database updates',
      component: GameStatsTest,
      version: 'v0.3.0'
    }
  ];

  const handleTestComplete = (testId, result) => {
    setResults(prev => ({
      ...prev,
      [testId]: result
    }));
    setCompletedTests(prev => new Set([...prev, testId]));
    setActiveTest(null);
  };

  const runTest = (testId) => {
      // Don't re-run if already running or completed
      if (activeTest === testId || completedTests.has(testId)) {
        console.log('[TestSuite] Blocked re-run of', testId);
        return;
      }

      console.log('[TestSuite] Running test:', testId);
    setActiveTest(testId);
    setExpandedTests(prev => new Set([...prev, testId]));
    setCompletedTests(prev => {
      const newSet = new Set(prev);
      newSet.delete(testId);
      return newSet;
    });
  };

    const runAllTests = async () => {
      console.log('[TestSuite] Running all tests');
      
      // Don't reset results or unmount components
      setExpandedTests(new Set(tests.map(t => t.id)));
      
      // Run tests sequentially, waiting for each to complete
      for (const test of tests) {
        setActiveTest(test.id);
        
        // Wait for the test to actually complete before moving to next
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (completedTests.has(test.id)) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }
      
      setActiveTest(null);
    };
    
  const toggleExpanded = (testId) => {
    setExpandedTests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  const getTestStatus = (testId) => {
    const result = results[testId];
    if (!result) return 'pending';
    if (result.failed === 0) return 'success';
    if (result.failed > 0) return 'error';
    return 'pending';
  };

  const getTotalStats = () => {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;  // ← CHANGE 1: Added skipped variable

    Object.values(results).forEach(result => {
      if (result) {
        total += result.total || (result.passed + result.failed + (result.skipped || 0));  // ← CHANGE 2: Include skipped in total
        passed += result.passed;
        failed += result.failed;
        skipped += result.skipped || 0;  // ← CHANGE 3: Track skipped count
      }
    });

    return { total, passed, failed, skipped };  // ← CHANGE 4: Return skipped
  };

  const stats = getTotalStats();

  return (
    <div className="test-suite-overlay">
      <div className="test-suite-container">
        <div className="test-suite-header">
          <h1>🧪 Test Suite</h1>
          <button onClick={onClose} className="test-suite-close">✕</button>
        </div>

        <div className="test-suite-info">
          <p>Battle for the Oceans - System Tests</p>
          <div className="test-user-info">
          {playerId ? (
            <p className="test-user-id">Testing as: <code>${playerId?.substring(0, 8)}...</code></p>
          ) : (
            <p className="test-warning">⚠️ Not logged in - tests will be skipped</p>
          )}          </div>
          </div>

        <div className="test-suite-actions">
          <button onClick={runAllTests} className="btn-primary">
            Run All Tests
          </button>
        </div>

        {stats.total > 0 && (
          <div className="test-suite-summary">
            <div className="test-stat">
              <span className="test-stat-label">Total:</span>
              <span className="test-stat-value">{stats.total}</span>
            </div>
            <div className="test-stat">
              <span className="test-stat-label">Passed:</span>
              <span className="test-stat-value test-stat-success">{stats.passed}</span>
            </div>
            <div className="test-stat">
              <span className="test-stat-label">Failed:</span>
              <span className="test-stat-value test-stat-error">{stats.failed}</span>
            </div>
            {stats.skipped > 0 && (  // ← CHANGE 5: Show skipped stat if > 0
              <div className="test-stat">
                <span className="test-stat-label">Skipped:</span>
                <span className="test-stat-value test-stat-warning">{stats.skipped}</span>
              </div>
            )}
          </div>
        )}

        <div className="test-suite-list">
          {tests.map(test => {
            const isExpanded = expandedTests.has(test.id);
            const testResult = results[test.id];
            const hasResults = testResult !== null && testResult !== undefined;
            const isCompleted = completedTests.has(test.id);
            const isRunning = activeTest === test.id;
            
            return (
              <div key={test.id} className="test-suite-item">
                <div className="test-suite-item-header">
                  <div className="test-suite-item-info">
                    <div className={`test-status-indicator test-status-${getTestStatus(test.id)}`} />
                    <div>
                      <h3>{test.name} <span className="test-version">{test.version}</span></h3>
                      <p className="test-description">{test.description}</p>
                      {hasResults && testResult && (
                        <p className="test-quick-stats">
                          ✓ {testResult.passed || 0} passed,
                          {testResult.failed > 0 ? ` ✗ ${testResult.failed} failed` : ' ✗ 0 failed'}
                          {testResult.skipped > 0 && `, ⊘ ${testResult.skipped} skipped`}  {/* ← CHANGE 6: Show skipped in quick stats */}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="test-suite-item-controls">
                    <button
                      onClick={() => runTest(test.id)}
                      className="btn-secondary"
                      disabled={isRunning}
                    >
                      {isRunning ? 'Running...' : 'Run'}
                    </button>
                    {hasResults && (
                      <button
                        onClick={() => toggleExpanded(test.id)}
                        className="btn-icon"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                  </div>
                </div>

                {(isRunning || isCompleted) && (
                  <div
                    className="test-suite-item-content"
                    style={{ display: isExpanded ? 'block' : 'none' }}
                  >
                    <test.component
                      key={test.id}
                      playerId={playerId}
                      onComplete={(result) => handleTestComplete(test.id, result)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="test-suite-footer">
          <p>Tests are non-destructive and safe to run in production</p>
          <p>Version: {version} - Phase 1: System Tests (October 31, 2025)</p>
        </div>
      </div>
    </div>
  );
};

export default TestSuite;
// EOF
