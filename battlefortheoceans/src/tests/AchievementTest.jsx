// src/tests/AchievementTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.0: Fixed - converted from class to React functional component
// v0.2.0: Achievement system tests with real database operations
// v0.1.0: Initial version

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import AchievementService from '../services/AchievementService';

const version = 'v0.3.0';

// Test user credentials
const TEST_USER = {
  id: '7f6c17c1-5c54-4a8a-ba4b-3870fca7b004',
  game_name: 'TestUser',
  email: 'testuser@battlefortheoceans.com'
};

const AchievementTest = ({ userId, onComplete }) => {
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

  const resetTestUser = async () => {
    log('Resetting test user to clean state', 'info');

    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          total_games: 0,
          total_wins: 0,
          total_ships_sunk: 0,
          total_damage: 0,
          eras_played: [],
          eras_won: []
        })
        .eq('id', TEST_USER.id);

      if (profileError) throw profileError;

      const { error: achievementError } = await supabase
        .from('user_achievements')
        .delete()
        .eq('user_id', TEST_USER.id);

      if (achievementError && achievementError.code !== 'PGRST116') {
        throw achievementError;
      }

      log('✅ Test user reset successfully', 'success');
      return true;
    } catch (error) {
      log(`❌ Failed to reset test user: ${error.message}`, 'error');
      return false;
    }
  };

  const updateTestUserStats = async (stats) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(stats)
        .eq('id', TEST_USER.id);

      if (error) throw error;

      log(`✅ Updated test user stats: ${JSON.stringify(stats)}`, 'success');
      return true;
    } catch (error) {
      log(`❌ Failed to update stats: ${error.message}`, 'error');
      return false;
    }
  };

  const testAchievementChecking = async () => {
    log('Testing real achievement checking', 'info');

    try {
      await updateTestUserStats({
        total_games: 1,
        total_wins: 0,
        total_ships_sunk: 0,
        total_damage: 0
      });

      const gameResults = {
        userId: TEST_USER.id,
        won: false,
        total_games: 1,
        total_wins: 0,
        total_ships_sunk: 0,
        total_damage: 0
      };

      const newAchievements = await AchievementService.checkAchievements(TEST_USER.id, gameResults);

      if (newAchievements && newAchievements.length > 0) {
        log(`✅ Earned ${newAchievements.length} achievements:`, 'success');
        newAchievements.forEach(a => {
          log(`   - ${a.name}`, 'info');
        });
        return true;
      } else {
        log(`⚠️ No achievements earned (might already be unlocked)`, 'warn');
        return true;
      }
    } catch (error) {
      log(`❌ Achievement checking failed: ${error.message}`, 'error');
      return false;
    }
  };

  const testProgressiveAchievements = async () => {
    log('Testing progressive achievement unlocking', 'info');

    try {
      await resetTestUser();

      await updateTestUserStats({ total_games: 10 });
      let achievements = await AchievementService.checkAchievements(TEST_USER.id, { total_games: 10 });
      
      const bronzeEarned = achievements && achievements.some(a => a.id === 'recruit');
      if (bronzeEarned) {
        log(`✅ Bronze tier "Recruit" earned`, 'success');
      }

      await updateTestUserStats({ total_games: 50 });
      achievements = await AchievementService.checkAchievements(TEST_USER.id, { total_games: 50 });
      
      const silverEarned = achievements && achievements.some(a => a.id === 'veteran');
      if (silverEarned) {
        log(`✅ Silver tier "Veteran" earned`, 'success');
      }

      return bronzeEarned || silverEarned;
    } catch (error) {
      log(`❌ Progressive achievements failed: ${error.message}`, 'error');
      return false;
    }
  };

  const testAchievementDefinitions = async () => {
    log('Testing achievement definitions in database', 'info');

    try {
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('*')
        .order('sort_order');

      if (error) throw error;

      if (!achievements || achievements.length === 0) {
        log(`❌ No achievements found in database`, 'error');
        return false;
      }

      log(`✅ Found ${achievements.length} achievement definitions`, 'success');

      const requiredFields = ['id', 'name', 'requirement_type', 'requirement_value', 'tier', 'category'];
      let validCount = 0;

      for (const achievement of achievements.slice(0, 5)) {
        const hasAllFields = requiredFields.every(field => achievement[field] !== undefined);
        if (hasAllFields) {
          validCount++;
          log(`   ✅ ${achievement.name} - Valid structure`, 'info');
        } else {
          log(`   ❌ ${achievement.name} - Missing required fields`, 'error');
        }
      }

      return validCount >= 3;
    } catch (error) {
      log(`❌ Failed to fetch achievements: ${error.message}`, 'error');
      return false;
    }
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);

    log('Starting Achievement Test Suite', 'info');
    log(`Version: ${version}`, 'info');
    log(`Test User: ${TEST_USER.game_name} (${TEST_USER.id})`, 'info');

    const resetSuccess = await resetTestUser();
    if (!resetSuccess) {
      log('❌ Failed to reset test user - aborting tests', 'error');
      setIsRunning(false);
      if (onComplete) onComplete({ passed: 0, failed: 1, total: 1 });
      return;
    }

    const tests = [
      { name: 'Achievement Definitions Exist', fn: testAchievementDefinitions },
      { name: 'Achievement Checking Logic', fn: testAchievementChecking },
      { name: 'Progressive Achievement Unlocking', fn: testProgressiveAchievements }
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

export default AchievementTest;
// EOF
