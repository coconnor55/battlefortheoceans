// src/tests/MunitionsTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Fix duplicate test runs and add skip status
//         - Run tests only once (not on every visibility toggle)
//         - Add 'skip' status for missing prerequisites
//         - Clear skip message: "Test skipped - start a game first"
//         - Don't count skips as failures in summary
// v0.1.0: Munitions system testing

import React, { useState, useEffect, useRef } from 'react';
import { coreEngine, useGame } from '../context/GameContext';

const version = 'v0.1.1';

const MunitionsTest = ({ playerId, onComplete }) => {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const hasRun = useRef(false);  // <-- ADD THIS

  useEffect(() => {
    // Prevent double-run in StrictMode
    if (hasRun.current) return;  // <-- ADD THIS
    hasRun.current = true;        // <-- ADD THIS
    
    runTests();
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
      // Test 1: Check if game instance exists
      const hasGame = !!coreEngine?.gameInstance;
      
      addResult(
        'Game Instance Check',
        hasGame ? 'pass' : 'skip',
        hasGame
          ? 'Game instance available'
          : '⊘ Munitions tests skipped - start a game first',
        { hasGame }
      );

      if (!hasGame) {
        // Skip remaining tests
        const summary = {
          total: 1,
          passed: 0,
          failed: 0,
          skipped: 1,
          details: [{ name: 'Game Instance Check', status: 'skip' }]
        };
        onComplete(summary);
        setRunning(false);
        return;
      }

      const game = coreEngine.gameInstance;

      // Test 2: Check munitions initialization
      const hasMunitions = game.munitions && typeof game.munitions === 'object';
      addResult(
        'Munitions Object',
        hasMunitions ? 'pass' : 'fail',
        hasMunitions
          ? `Munitions object exists: ${JSON.stringify(game.munitions)}`
          : 'Munitions object not found',
        { munitions: game.munitions }
      );

      // Test 3: Check star shells
      const hasStarShells = typeof game.munitions?.starShells === 'number';
      addResult(
        'Star Shells Property',
        hasStarShells ? 'pass' : 'fail',
        hasStarShells
          ? `Star shells: ${game.munitions.starShells}`
          : 'Star shells property missing',
        { starShells: game.munitions?.starShells }
      );

      // Test 4: Check scatter shot
      const hasScatterShot = typeof game.munitions?.scatterShot === 'number';
      addResult(
        'Scatter Shot Property',
        hasScatterShot ? 'pass' : 'fail',
        hasScatterShot
          ? `Scatter shot: ${game.munitions.scatterShot}`
          : 'Scatter shot property missing',
        { scatterShot: game.munitions?.scatterShot }
      );

      // Test 5: Check initializeMunitions method
      const hasInitMethod = typeof game.initializeMunitions === 'function';
      addResult(
        'initializeMunitions Method',
        hasInitMethod ? 'pass' : 'fail',
        hasInitMethod
          ? 'Method exists and is callable'
          : 'Method not found',
        { hasMethod: hasInitMethod }
      );

      // Test 6: Check fireMunition method
      const hasFireMethod = typeof game.fireMunition === 'function';
      addResult(
        'fireMunition Method',
        hasFireMethod ? 'pass' : 'fail',
        hasFireMethod
          ? 'Method exists and is callable'
          : 'Method not found',
        { hasMethod: hasFireMethod }
      );

      // Test 7: Test initializeMunitions functionality
      if (hasInitMethod) {
        try {
          const testStarShells = 5;
          const testScatterShot = 3;
          game.initializeMunitions(testStarShells, testScatterShot);
          
          const correctInit =
            game.munitions.starShells === testStarShells &&
            game.munitions.scatterShot === testScatterShot;
          
          addResult(
            'Initialize Munitions',
            correctInit ? 'pass' : 'fail',
            correctInit
              ? `Successfully initialized: ${testStarShells} star shells, ${testScatterShot} scatter shot`
              : `Failed to initialize correctly. Got: ${JSON.stringify(game.munitions)}`,
            {
              expected: { starShells: testStarShells, scatterShot: testScatterShot },
              actual: game.munitions
            }
          );
        } catch (error) {
          addResult(
            'Initialize Munitions',
            'fail',
            `Error calling initializeMunitions: ${error.message}`,
            { error: error.message }
          );
        }
      }

      // Test 8: Test fireMunition validation (without actually firing)
      if (hasFireMethod) {
        try {
          // Save original munitions
          const originalMunitions = { ...game.munitions };
          
          // Try to fire with no munitions
          game.munitions.starShells = 0;
          game.munitions.scatterShot = 0;
          
          const resultNoMunitions = game.fireMunition('starShell', 5, 5);
          
          addResult(
            'Fire with Zero Munitions',
            !resultNoMunitions ? 'pass' : 'fail',
            !resultNoMunitions
              ? 'Correctly prevented firing with 0 munitions'
              : 'Should not allow firing with 0 munitions',
            { result: resultNoMunitions }
          );
          
          // Restore original munitions
          game.munitions = originalMunitions;
          
        } catch (error) {
          addResult(
            'Fire with Zero Munitions',
            'fail',
            `Error testing fireMunition: ${error.message}`,
            { error: error.message }
          );
        }
      }

      // Test 9: Check CoreEngine integration
      const hasFireMunitionInCore = typeof coreEngine.fireMunition === 'function';
      addResult(
        'CoreEngine Integration',
        hasFireMunitionInCore ? 'pass' : 'fail',
        hasFireMunitionInCore
          ? 'CoreEngine.fireMunition method exists'
          : 'CoreEngine.fireMunition not found',
        { hasMethod: hasFireMunitionInCore }
      );

      // Test 10: Check era config munitions
      const eraConfig = coreEngine.selectedEraConfig;
      const hasMunitionsConfig = eraConfig?.munitions && typeof eraConfig.munitions === 'object';
      addResult(
        'Era Config Munitions',
        hasMunitionsConfig ? 'pass' : 'fail',
        hasMunitionsConfig
          ? `Era config has munitions: ${JSON.stringify(eraConfig.munitions)}`
          : 'Era config missing munitions configuration',
        { munitionsConfig: eraConfig?.munitions }
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
      {running && <div className="test-running">Running munitions tests...</div>}
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

export default MunitionsTest;
// EOF
