// src/tests/GameStatsTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.2: Always use dedicated TEST_USER, verify profile exists first
// v0.3.1: Fixed mock game to include getGameStats() method
// v0.3.0: Fixed - converted from class to React functional component

import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import GameStatsService from '../services/GameStatsService';
import ConfigLoader from '../utils/ConfigLoader';

const version = 'v0.3.2';

// Test user credentials - ALWAYS use this, never the logged-in user
const TEST_USER = {
  id: '7f6c17c1-5c54-4a8a-ba4b-3870fca7b004',
  game_name: 'TestUser',
  email: 'testuser@battlefortheoceans.com'
};

const GameStatsTest = ({ userId, onComplete }) => {
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, type, message };
    setResults(prev => [...prev, logEntry]);
    console.log(`[TESTS] ${type.toUpperCase()} ${message}`);
  };

  const verifyTestUserExists = async () => {
    log('Verifying test user profile exists', 'info');

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, game_name')
        .eq('id', TEST_USER.id)
        .single();

      if (error || !data) {
        log(`❌ Test user profile not found: ${error?.message || 'No data'}`, 'error');
        log(`Please create test user profile in database with ID: ${TEST_USER.id}`, 'error');
        return false;
      }

      log(`✅ Test user profile exists: ${data.game_name}`, 'success');
      return true;
    } catch (error) {
      log(`❌ Failed to verify test user: ${error.message}`, 'error');
      return false;
    }
  };

  const resetTestUser = async () => {
    log('Resetting test user stats', 'info');

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          total_games: 0,
          total_wins: 0,
          total_ships_sunk: 0,
          total_damage: 0,
          total_score: 0,
          best_accuracy: 0,
          eras_played: [],
          eras_won: []
        })
        .eq('id', TEST_USER.id);

      if (error) throw error;

      log('✅ Test user stats reset', 'success');
      return true;
    } catch (error) {
      log(`❌ Failed to reset: ${error.message}`, 'error');
      return false;
    }
  };

  const getMockGame = () => {
    const humanPlayer = {
      id: TEST_USER.id,
      name: TEST_USER.game_name,
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
      await resetTestUser();

      // Fetch TEST_USER profile with ALL required fields
      const { data: beforeProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('id, game_name, total_games, total_wins, total_ships_sunk, total_damage, total_score, best_accuracy')
        .eq('id', TEST_USER.id)
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
        .eq('id', TEST_USER.id)
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

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    log('Starting Game Stats Test Suite', 'info');
    log(`Version: ${version}`, 'info');
    log(`Test User: ${TEST_USER.game_name} (${TEST_USER.id})`, 'info');
    log(`⚠️ Tests will ONLY modify test user data, not logged-in user`, 'warn');

    // Verify test user exists
    const userExists = await verifyTestUserExists();
    if (!userExists) {
      log('❌ Test user not found - aborting tests', 'error');
      setIsRunning(false);
      if (onComplete) onComplete({ passed: 0, failed: 1, total: 1 });
      return;
    }

    const resetSuccess = await resetTestUser();
    if (!resetSuccess) {
      log('❌ Failed to reset test user - aborting tests', 'error');
      setIsRunning(false);
      if (onComplete) onComplete({ passed: 0, failed: 1, total: 1 });
      return;
    }

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

  useEffect(() => {
    runAllTests();
  }, []);

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
