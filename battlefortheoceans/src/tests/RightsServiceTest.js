// src/tests/RightsServiceTest.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: RightsService test suite

import React, { useState, useEffect, useRef } from 'react';
import RightsService from '../services/RightsService';

const RightsServiceTest = ({ userId, onComplete }) => {
  const [tests, setTests] = useState([]);
  const [running, setRunning] = useState(false);
    const hasRun = useRef(false);  // <-- ADD THIS

    useEffect(() => {
      // Prevent double-run in StrictMode
      if (hasRun.current) return;  // <-- ADD THIS
      hasRun.current = true;        // <-- ADD THIS
      
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
      addTest('No user ID', 'error', '❌ User ID required for RightsService tests');
      setRunning(false);
      if (onComplete) onComplete({ total: 1, passed: 0, failed: 1 });
      return;
    }

    try {
      // TEST 1: Get pass balance
      addTest('Get pass balance', 'running', 'Fetching from database...');
      try {
        const balance = await RightsService.getPassBalance(userId);
        if (typeof balance === 'number' && balance >= 0) {
          addTest('Get pass balance', 'success', `✅ Pass balance: ${balance}`, { balance });
          passed++;
        } else {
          throw new Error('Invalid balance returned');
        }
      } catch (error) {
        addTest('Get pass balance', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 2: Check free era access
      addTest('Check free era', 'running', 'Testing Traditional Battleship...');
      try {
        const eraConfig = { id: 'traditional', passes_required: 0, exclusive: false };
        const access = await RightsService.canPlayEra(userId, 'traditional', eraConfig);
        if (access.canPlay && access.method === 'free') {
          addTest('Check free era', 'success', '✅ Free era access works', access);
          passed++;
        } else {
          throw new Error(`Expected free access, got: ${access.method}`);
        }
      } catch (error) {
        addTest('Check free era', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 3: Check exclusive era (no voucher)
      addTest('Check exclusive era', 'running', 'Testing Pirates (exclusive)...');
      try {
        const eraConfig = { id: 'pirates', passes_required: 2, exclusive: true };
        const access = await RightsService.canPlayEra(userId, 'pirates', eraConfig);
        
        if (access.method === 'voucher' && access.canPlay) {
          addTest('Check exclusive era', 'success', `✅ Has voucher with ${access.usesRemaining} plays`, access);
          passed++;
        } else if (access.method === 'exclusive' && !access.canPlay) {
          addTest('Check exclusive era', 'success', '✅ Correctly blocked (no voucher)', access);
          passed++;
        } else {
          throw new Error(`Unexpected result: ${access.method}`);
        }
      } catch (error) {
        addTest('Check exclusive era', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 4: Get badge info (free era)
      addTest('Badge info (free)', 'running', 'Testing badge display...');
      try {
        const eraConfig = { id: 'traditional', name: 'Traditional', passes_required: 0, exclusive: false };
        const badge = await RightsService.getEraBadgeInfo(userId, eraConfig);
        if (badge.badge === 'FREE' && badge.canPlay) {
          addTest('Badge info (free)', 'success', `✅ Badge: "${badge.badge}", Button: "${badge.button}"`, badge);
          passed++;
        } else {
          throw new Error('Incorrect badge for free era');
        }
      } catch (error) {
        addTest('Badge info (free)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 5: Get badge info (exclusive)
      addTest('Badge info (exclusive)', 'running', 'Testing badge display...');
      try {
        const eraConfig = { 
          id: 'pirates', 
          name: 'Pirates', 
          passes_required: 2, 
          exclusive: true,
          exclusive_label: 'EXCLUSIVE'
        };
        const badge = await RightsService.getEraBadgeInfo(userId, eraConfig);
        if (badge.badge && badge.button) {
          addTest('Badge info (exclusive)', 'success', `✅ Badge: "${badge.badge}", Button: "${badge.button}"`, badge);
          passed++;
        } else {
          throw new Error('Missing badge properties');
        }
      } catch (error) {
        addTest('Badge info (exclusive)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 6: Test backward compatibility (hasEraAccess)
      addTest('Backward compatibility', 'running', 'Testing hasEraAccess()...');
      try {
        const hasAccess = await RightsService.hasEraAccess(userId, 'traditional');
        // Traditional is free, so might not have explicit right
        addTest('Backward compatibility', 'success', `✅ hasEraAccess() still works: ${hasAccess}`);
        passed++;
      } catch (error) {
        addTest('Backward compatibility', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 7: Get user rights
      addTest('Get user rights', 'running', 'Fetching all rights...');
      try {
        const rights = await RightsService.getUserRights(userId);
        if (Array.isArray(rights)) {
          addTest('Get user rights', 'success', `✅ Found ${rights.length} rights entries`, { count: rights.length });
          passed++;
        } else {
          throw new Error('getUserRights should return array');
        }
      } catch (error) {
        addTest('Get user rights', 'error', `❌ ${error.message}`);
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

export default RightsServiceTest;

// EOF
