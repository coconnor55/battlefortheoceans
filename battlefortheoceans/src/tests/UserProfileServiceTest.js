// src/tests/UserProfileServiceTest.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: UserProfileService test suite

import React, { useState, useEffect, useRef } from 'react';
import UserProfileService from '../services/UserProfileService';
import { supabase } from '../utils/supabaseClient';

const version = 'v0.1.0';

const UserProfileServiceTest = ({ userId, onComplete }) => {
  const [tests, setTests] = useState([]);
  const [running, setRunning] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double-run in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;
    
    runTests();
  }, []);

  const addTest = (name, status, message, data = null) => {
    setTests(prev => [...prev, {
      name,
      status,
      message,
      data,
      timestamp: new Date().toISOString()
    }]);
  };

  const runTests = async () => {
    setRunning(true);
    setTests([]);
    let passed = 0;
    let failed = 0;

    if (!userId) {
      addTest('No user ID', 'error', '❌ User ID required for UserProfileService tests');
      setRunning(false);
      if (onComplete) onComplete({ total: 1, passed: 0, failed: 1 });
      return;
    }

    try {
      // TEST 1: Incomplete games counter cycle
      addTest('Incomplete games counter', 'running', 'Testing increment/decrement cycle...');
      try {
        // Get initial value
        const { data: initialProfile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('incomplete_games')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;

        const initialCount = initialProfile?.incomplete_games || 0;

        // Increment
        await UserProfileService.incrementIncompleteGames(userId);

        // Verify increment
        const { data: afterIncrement } = await supabase
          .from('user_profiles')
          .select('incomplete_games')
          .eq('id', userId)
          .single();

        if (afterIncrement.incomplete_games !== initialCount + 1) {
          throw new Error(`Expected ${initialCount + 1}, got ${afterIncrement.incomplete_games}`);
        }

        // Decrement
        await UserProfileService.decrementIncompleteGames(userId);

        // Verify decrement
        const { data: afterDecrement } = await supabase
          .from('user_profiles')
          .select('incomplete_games')
          .eq('id', userId)
          .single();

        if (afterDecrement.incomplete_games !== initialCount) {
          throw new Error(`Expected ${initialCount}, got ${afterDecrement.incomplete_games}`);
        }

        addTest('Incomplete games counter', 'success', 
          `✅ Full cycle: ${initialCount} → ${afterIncrement.incomplete_games} → ${afterDecrement.incomplete_games}`,
          { initialCount, afterIncrement: afterIncrement.incomplete_games, afterDecrement: afterDecrement.incomplete_games });
        passed++;
      } catch (error) {
        addTest('Incomplete games counter', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 2: Decrement doesn't go below zero
      addTest('Zero floor check', 'running', 'Testing zero boundary...');
      try {
        // Set to 0
        await supabase
          .from('user_profiles')
          .update({ incomplete_games: 0 })
          .eq('id', userId);

        // Try to decrement
        await UserProfileService.decrementIncompleteGames(userId);

        // Verify still 0
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('incomplete_games')
          .eq('id', userId)
          .single();

        if (profile.incomplete_games !== 0) {
          throw new Error(`Expected 0, got ${profile.incomplete_games}`);
        }

        addTest('Zero floor check', 'success', '✅ Counter correctly stays at 0');
        passed++;
      } catch (error) {
        addTest('Zero floor check', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 3: Get user profile
      addTest('Get user profile', 'running', 'Fetching profile...');
      try {
        const profile = await UserProfileService.getUserProfile(userId);
        if (profile && profile.id === userId) {
          addTest('Get user profile', 'success', 
            `✅ Profile fetched: ${profile.game_name}`,
            { game_name: profile.game_name, total_games: profile.total_games });
          passed++;
        } else {
          throw new Error('Profile not found or invalid');
        }
      } catch (error) {
        addTest('Get user profile', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 4: Game name validation
      addTest('Game name validation', 'running', 'Testing validation rules...');
      try {
        const tests = [
          { name: 'ab', expected: false, reason: 'too short' },
          { name: 'a'.repeat(33), expected: false, reason: 'too long' },
          { name: 'guest-123', expected: false, reason: 'reserved word' },
          { name: 'ValidName123', expected: true, reason: 'valid' }
        ];

        let allPassed = true;
        const results = [];

        for (const test of tests) {
          const validation = await UserProfileService.validateGameName(test.name);
          const passed = validation.valid === test.expected;
          if (!passed) {
            allPassed = false;
          }
          results.push({ ...test, actual: validation.valid, passed });
        }

        if (allPassed) {
          addTest('Game name validation', 'success', '✅ All validation rules work', results);
          passed++;
        } else {
          throw new Error('Some validation rules failed');
        }
      } catch (error) {
        addTest('Game name validation', 'error', `❌ ${error.message}`);
        failed++;
      }

    } catch (error) {
      addTest('Test suite error', 'error', `❌ ${error.message}`);
      failed++;
    }

    setRunning(false);
    
    if (onComplete) {
      onComplete({
        total: passed + failed,
        passed,
        failed
      });
    }
  };

  return (
    <div className="test-component">
      <div className="test-header">
      </div>
      <div className="test-results">
        {tests.map((test, index) => (
          <div key={index} className={`test-result test-result-${test.status}`}>
            <div className="test-result-header">
              <span className="test-result-name">{test.name}</span>
              <span className="test-result-time">{new Date(test.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="test-result-message">{test.message}</div>
            {test.data && (
              <details className="test-result-data">
                <summary>View data</summary>
                <pre>{JSON.stringify(test.data, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
      {running && <div className="test-running">Running tests...</div>}
    </div>
  );
};

export default UserProfileServiceTest;

// EOF
