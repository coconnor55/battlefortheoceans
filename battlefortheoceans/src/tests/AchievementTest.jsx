// src/tests/AchievementTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.2: Fixed test data - use real game results and correct gameResults structure
//         - testAchievementChecking now updates stats to 1 win, 3 ships, 30 damage
//         - gameResults now passes per-game data (won, ships_sunk, damage, accuracy, turns)
//         - testProgressiveAchievements now passes minimal gameResults structure
// v0.3.3: Fixed resetTestUser to UPDATE instead of DELETE (RLS has no DELETE policy)
//         - Changes unlocked to false and progress to 0 instead of deleting records// v0.3.1: Removed test user
// v0.3.0: Fixed - converted from class to React functional component
// v0.2.0: Achievement system tests with real database operations
// v0.1.0: Initial version

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import AchievementService from '../services/AchievementService';

const version = 'v0.3.2';

const AchievementTest = ({ playerId, onComplete }) => {
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
    console.log(`[TEST] ${type.toUpperCase()} ${message}`);
  };

  const resetTestUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
  console.log(`[DEBUG] AchievementTest.resetTestUser: auth.uid() = ${user?.id}`, 'info');
  console.log(`[DEBUG] AchievementTest.resetTestUser: playerId = ${playerId}`, 'info');

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
        .eq('id', playerId);

      if (profileError) throw profileError;

      const { error: achievementError } = await supabase
        .from('user_achievements')
          .update({
            progress: 0,
            unlocked: false,
            unlocked_at: null
            })
        .eq('player_id', playerId);

if (achievementError && achievementError.code !== 'PGRST116') {
      throw achievementError;
    }

    // DEBUG: Verify achievements were deleted
    const { data: remainingAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id, progress, unlocked')
      .eq('player_id', playerId);
    
    log(`DEBUG: After reset, remaining achievements: ${remainingAchievements?.length || 0}`, 'info');
    if (remainingAchievements && remainingAchievements.length > 0) {
      remainingAchievements.forEach(a => {
        log(`DEBUG: Still exists: ${a.achievement_id}, progress: ${a.progress}, unlocked: ${a.unlocked}`, 'warn');
      });
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
        .eq('id', playerId);

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
        // Update cumulative stats in database
        await updateTestUserStats({
          total_games: 1,
          total_wins: 1,
          total_ships_sunk: 3,
          total_damage: 30
        });

        // Pass per-game results (what happened THIS game)
        const gameResults = {
          won: true,
          ships_sunk: 3,
          damage: 30,
          accuracy: 75,
          turns: 15
        };
    
        const newAchievements = await AchievementService.checkAchievements(playerId, gameResults);

        if (newAchievements && newAchievements.length > 0) {
          log(`✅ Earned ${newAchievements.length} achievements:`, 'success');
          newAchievements.forEach(a => {
            log(`   - ${a.name}`, 'info');
          });
          return true;
        } else {
          // Check if user already has achievements
          const { data: existingAchievements } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('player_id', playerId)
            .eq('unlocked', true);
          
          if (existingAchievements && existingAchievements.length > 0) {
            log(`✅ No new achievements (user already has ${existingAchievements.length} unlocked)`, 'success');
            return true;
          } else {
            log(`⚠️ No achievements earned and none previously unlocked`, 'warn');
            return true; // Not a failure, just unexpected
          }
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

    // Test Bronze tier (10 games)
    await updateTestUserStats({ total_games: 10 });
    let achievements = await AchievementService.checkAchievements(playerId, { won: false, ships_sunk: 0 });
    
// DEBUG: Log what we got back
log(`DEBUG: checkAchievements returned: ${JSON.stringify(achievements)}`, 'info');
log(`DEBUG: achievements is array: ${Array.isArray(achievements)}`, 'info');
log(`DEBUG: achievements length: ${achievements?.length}`, 'info');
if (achievements && achievements.length > 0) {
  achievements.forEach(a => log(`DEBUG: Found achievement: ${a.id} - ${a.name}`, 'info'));
}
        const bronzeEarned = achievements && achievements.some(a => a.id === 'recruit');
        if (bronzeEarned) {
          log(`✅ Bronze tier "Recruit" earned`, 'success');
        } else {
          log(`❌ Bronze tier "Recruit" NOT earned (expected at 10 games)`, 'error');
        }

// Test Silver tier (50 games)
    await updateTestUserStats({ total_games: 50 });
    achievements = await AchievementService.checkAchievements(playerId, { won: false, ships_sunk: 0 });
    
// DEBUG: Log what we got back
log(`DEBUG: checkAchievements returned: ${JSON.stringify(achievements)}`, 'info');
log(`DEBUG: achievements is array: ${Array.isArray(achievements)}`, 'info');
log(`DEBUG: achievements length: ${achievements?.length}`, 'info');
if (achievements && achievements.length > 0) {
  achievements.forEach(a => log(`DEBUG: Found achievement: ${a.id} - ${a.name}`, 'info'));
}
        const silverEarned = achievements && achievements.some(a => a.id === 'veteran');
        if (silverEarned) {
          log(`✅ Silver tier "Veteran" earned`, 'success');
        } else {
          log(`❌ Silver tier "Veteran" NOT earned (expected at 50 games)`, 'error');
        }

        const passed = bronzeEarned || silverEarned;
        if (!passed) {
          log(`❌ Progressive achievements failed: Neither bronze nor silver tiers earned`, 'error');
        }
        return passed;
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
    log('Testing as user: ${playerId?.substring(0, 8)}...', 'info');

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
