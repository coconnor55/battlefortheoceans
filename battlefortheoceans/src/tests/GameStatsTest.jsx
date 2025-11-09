// src/tests/GameStatsTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.3: Removed test user
// v0.3.2: Always use dedicated TEST_USER, verify profile exists first
// v0.3.1: Fixed mock game to include getGameStats() method
// v0.3.0: Fixed - converted from class to React functional component

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import GameStatsService from '../services/GameStatsService';
import ConfigLoader from '../utils/ConfigLoader';

const version = 'v0.3.2';

const GameStatsTest = ({ playerId, onComplete }) => {
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const hasRun = useRef(false);  // <-- ADD THIS

  useEffect(() => {
    // Prevent double-run in StrictMode
    if (hasRun.current) return;  // <-- ADD THIS
    hasRun.current = true;        // <-- ADD THIS
    
    runTests();
  }, []);

  const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, type, message };
    setResults(prev => [...prev, logEntry]);
    console.log(`[TESTS] ${type.toUpperCase()} ${message}`);
  };

  const getMockGame = () => {
    const humanPlayer = {
      id: playerId,
      name: 'test player',
      type: 'human',
      hits: 10,
      misses: 5,
      sunk: 3,
      hitsDamage: 30,
      score: 100,
      get shots() { return this.hits + this.misses; },
      get accuracy() { return this.shots > 0 ? (this.hits / this.shots) * 100 : 0; }
    };

    const aiPlayer = {
      id: 'ai-opponent',
      name: 'AI Captain',
      type: 'ai',
      hits: 8,
      misses: 7,
      sunk: 2,
      hitsDamage: 20,
      score: 80,
      get shots() { return this.hits + this.misses; },
      get accuracy() { return this.shots > 0 ? (this.hits / this.shots) * 100 : 0; }
    };

    return {
      players: [humanPlayer, aiPlayer],
      winner: humanPlayer,
      eraId: 'traditional',
      getGameStats() {
        return {
          winner: humanPlayer.name,
          totalTurns: 15,
          duration: 180
        };
      }
    };
  };

  const testAccuracyCalculation = () => {
    log('Testing accuracy calculation', 'info');

    const testCases = [
      { hits: 10, misses: 5, expected: 66.67 },
      { hits: 0, misses: 10, expected: 0 },
      { hits: 10, misses: 0, expected: 100 },
      { hits: 5, misses: 5, expected: 50 },
      { hits: 0, misses: 0, expected: 0 }
    ];

    try {
      for (const testCase of testCases) {
        const shots = testCase.hits + testCase.misses;
        const accuracy = shots > 0 ? (testCase.hits / shots) * 100 : 0;
        const roundedAccuracy = Math.round(accuracy * 100) / 100;

        if (Math.abs(roundedAccuracy - testCase.expected) < 0.01) {
          log(`✅ Accuracy: ${testCase.hits}/${shots} = ${roundedAccuracy}%`, 'success');
        } else {
          log(`❌ Accuracy mismatch: got ${roundedAccuracy}%, expected ${testCase.expected}%`, 'error');
          return false;
        }
      }

      return true;
    } catch (error) {
      log(`❌ Accuracy calculation failed: ${error.message}`, 'error');
      return false;
    }
  };

  const testGameResultsCalculation = async () => {
    log('Testing game results calculation', 'info');

    try {
      const mockGame = getMockGame();
      const eraConfig = await ConfigLoader.loadEraConfig('traditional');
      const opponent = { name: 'AI Captain' };

      const gameResults = GameStatsService.calculateGameResults(mockGame, eraConfig, opponent);

      if (!gameResults) {
        log('❌ calculateGameResults returned null', 'error');
        return false;
      }

      const requiredFields = ['era_name', 'won', 'accuracy', 'shots', 'hits', 'ships_sunk', 'hits_damage'];
      const hasAllFields = requiredFields.every(field => gameResults[field] !== undefined);

      if (!hasAllFields) {
        const missingFields = requiredFields.filter(field => gameResults[field] === undefined);
        log(`❌ Missing required fields: ${missingFields.join(', ')}`, 'error');
        return false;
      }

      const expectedAccuracy = (10 / 15) * 100;
      if (Math.abs(gameResults.accuracy - expectedAccuracy) < 0.1) {
        log(`✅ Accuracy calculated correctly: ${gameResults.accuracy.toFixed(2)}%`, 'success');
      } else {
        log(`❌ Accuracy mismatch: got ${gameResults.accuracy}%, expected ${expectedAccuracy}%`, 'error');
        return false;
      }

      log(`✅ Game results calculation works correctly`, 'success');
      return true;
    } catch (error) {
      log(`❌ Game results calculation failed: ${error.message}`, 'error');
      return false;
    }
  };

  const testDatabaseUpdate = async () => {
    log('Testing real database stats update', 'info');

    try {

      // Fetch TEST_USER profile with ALL required fields
      const { data: beforeProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('id, game_name, total_games, total_wins, total_ships_sunk, total_damage, total_score, best_accuracy')
        .eq('id', playerId)
        .single();

      if (fetchError) {
        log(`❌ Failed to fetch test user profile: ${fetchError.message}`, 'error');
        return false;
      }

      log(`Before: ${beforeProfile.total_games} games, ${beforeProfile.total_wins} wins`, 'info');

      const mockGame = getMockGame();
      const eraConfig = await ConfigLoader.loadEraConfig('traditional');
      const opponent = { name: 'AI Captain' };

      const gameResults = GameStatsService.calculateGameResults(mockGame, eraConfig, opponent);
      
      // Add era_id to gameResults
      gameResults.era_id = 'traditional';

      // Update using test user profile
      const updateResult = await GameStatsService.updateGameStats(beforeProfile, gameResults);

      if (!updateResult) {
        log(`❌ updateGameStats returned false/null`, 'error');
        return false;
      }

      // Verify update by fetching again
      const { data: afterProfile, error: afterError } = await supabase
        .from('user_profiles')
        .select('total_games, total_wins, total_ships_sunk, total_damage')
        .eq('id', playerId)
        .single();

      if (afterError) {
        log(`❌ Failed to fetch updated profile: ${afterError.message}`, 'error');
        return false;
      }

      log(`After: ${afterProfile.total_games} games, ${afterProfile.total_wins} wins`, 'info');
      log(`Ships sunk: ${afterProfile.total_ships_sunk}, Damage: ${afterProfile.total_damage}`, 'info');

      if (afterProfile.total_games === beforeProfile.total_games + 1 &&
          afterProfile.total_wins === beforeProfile.total_wins + 1 &&
          afterProfile.total_ships_sunk === 3 &&
          afterProfile.total_damage === 30) {
        log(`✅ Database stats updated correctly`, 'success');
        return true;
      } else {
        log(`❌ Stats not updated as expected`, 'error');
        log(`Expected: ${beforeProfile.total_games + 1} games, ${beforeProfile.total_wins + 1} wins, 3 ships, 30 damage`, 'error');
        log(`Got: ${afterProfile.total_games} games, ${afterProfile.total_wins} wins, ${afterProfile.total_ships_sunk} ships, ${afterProfile.total_damage} damage`, 'error');
        return false;
      }
    } catch (error) {
      log(`❌ Database update failed: ${error.message}`, 'error');
      return false;
    }
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);

    log('Starting Game Stats Test Suite', 'info');
    log(`Version: ${version}`, 'info');
    log(`Testing as user: ${playerId?.substring(0, 8)}...`, 'info');

    const tests = [
      { name: 'Accuracy Calculation', fn: () => testAccuracyCalculation() },
      { name: 'Game Results Calculation', fn: () => testGameResultsCalculation() },
      { name: 'Database Stats Update', fn: () => testDatabaseUpdate() }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      log(`\nRunning: ${test.name}`, 'info');
      
      try {
        const result = await test.fn();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        log(`❌ ${test.name} - Unexpected error: ${error.message}`, 'error');
        failed++;
      }
    }

    log(`\n=== Test Results ===`, 'info');
    log(`✅ Passed: ${passed}`, 'success');
    log(`❌ Failed: ${failed}`, 'error');
    log(`Total: ${passed + failed}`, 'info');

    setIsRunning(false);

    if (onComplete) {
      onComplete({ passed, failed, total: passed + failed });
    }
  };

  return (
    <div className="test-output">
      {results.map((result, index) => (
        <div key={index} className={`test-log test-log-${result.type}`}>
          <span className="test-timestamp">{new Date(result.timestamp).toLocaleTimeString()}</span>
          <span className="test-message">{result.message}</span>
        </div>
      ))}
      {isRunning && <div className="test-spinner">Running tests...</div>}
    </div>
  );
};

export default GameStatsTest;
// EOF
