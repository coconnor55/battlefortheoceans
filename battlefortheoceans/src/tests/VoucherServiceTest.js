// src/tests/VoucherServiceTest.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: VoucherService test suite

import React, { useState, useEffect } from 'react';
import VoucherService from '../services/VoucherService';

const VoucherServiceTest = ({ userId, onComplete }) => {
  const [tests, setTests] = useState([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
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

    try {
      // TEST 1: Parse count-based pass voucher
      addTest('Parse pass voucher (count)', 'running', 'Testing pass-20-...');
      try {
        const parsed = VoucherService.parseVoucherCode('pass-20-abc123-def4-5678-9012-abcdef123456');
        if (parsed.voucherType === 'pass' && parsed.usesRemaining === 20) {
          addTest('Parse pass voucher (count)', 'success', '✅ Correctly parsed 20 passes', parsed);
          passed++;
        } else {
          throw new Error('Incorrect parse result');
        }
      } catch (error) {
        addTest('Parse pass voucher (count)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 2: Parse count-based era voucher
      addTest('Parse era voucher (count)', 'running', 'Testing pirates-10-...');
      try {
        const parsed = VoucherService.parseVoucherCode('pirates-10-ghi789-jkl0-1234-5678-ghijkl456789');
        if (parsed.rightsValue === 'pirates' && parsed.usesRemaining === 10) {
          addTest('Parse era voucher (count)', 'success', '✅ Correctly parsed 10 Pirates plays', parsed);
          passed++;
        } else {
          throw new Error('Incorrect parse result');
        }
      } catch (error) {
        addTest('Parse era voucher (count)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 3: Parse time-based voucher (days)
      addTest('Parse time voucher (days)', 'running', 'Testing pirates-days7-...');
      try {
        const parsed = VoucherService.parseVoucherCode('pirates-days7-stu901-vwx6-7890-1234-stuvwx345678');
        if (parsed.valueType === 'time' && parsed.usesRemaining === -1 && parsed.durationMs === 7 * 24 * 60 * 60 * 1000) {
          addTest('Parse time voucher (days)', 'success', '✅ Correctly parsed 7 days unlimited', parsed);
          passed++;
        } else {
          throw new Error('Incorrect parse result');
        }
      } catch (error) {
        addTest('Parse time voucher (days)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 4: Parse time-based voucher (weeks)
      addTest('Parse time voucher (weeks)', 'running', 'Testing super-weeks2-...');
      try {
        const parsed = VoucherService.parseVoucherCode('super-weeks2-abc123-def4-5678-9012-abcdef123456');
        if (parsed.valueType === 'time' && parsed.durationMs === 2 * 7 * 24 * 60 * 60 * 1000) {
          addTest('Parse time voucher (weeks)', 'success', '✅ Correctly parsed 2 weeks unlimited', parsed);
          passed++;
        } else {
          throw new Error('Incorrect parse result');
        }
      } catch (error) {
        addTest('Parse time voucher (weeks)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 5: Parse time-based voucher (months)
      addTest('Parse time voucher (months)', 'running', 'Testing midway-month1-...');
      try {
        const parsed = VoucherService.parseVoucherCode('midway-month1-yza567-bcd7-8901-2345-yzabcd901234');
        if (parsed.valueType === 'time' && parsed.durationMs === 30 * 24 * 60 * 60 * 1000) {
          addTest('Parse time voucher (months)', 'success', '✅ Correctly parsed 1 month unlimited', parsed);
          passed++;
        } else {
          throw new Error('Incorrect parse result');
        }
      } catch (error) {
        addTest('Parse time voucher (months)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 6: Validate format (valid)
      addTest('Validate format (valid)', 'running', 'Testing validation...');
      try {
        const isValid = VoucherService.validateFormat('pass-10-abc123-def4-5678-9012-abcdef123456');
        if (isValid === true) {
          addTest('Validate format (valid)', 'success', '✅ Correctly validated valid code');
          passed++;
        } else {
          throw new Error('Should return true');
        }
      } catch (error) {
        addTest('Validate format (valid)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 7: Validate format (invalid)
      addTest('Validate format (invalid)', 'running', 'Testing validation...');
      try {
        const isValid = VoucherService.validateFormat('invalid-code');
        if (isValid === false) {
          addTest('Validate format (invalid)', 'success', '✅ Correctly rejected invalid code');
          passed++;
        } else {
          throw new Error('Should return false');
        }
      } catch (error) {
        addTest('Validate format (invalid)', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 8: Get display info
      addTest('Get display info', 'running', 'Testing display helper...');
      try {
        const info = VoucherService.getDisplayInfo('pass-20-abc123-def4-5678-9012-abcdef123456');
        if (info.title && info.description && info.icon) {
          addTest('Get display info', 'success', `✅ ${info.icon} ${info.title} - ${info.description}`, info);
          passed++;
        } else {
          throw new Error('Missing display properties');
        }
      } catch (error) {
        addTest('Get display info', 'error', `❌ ${error.message}`);
        failed++;
      }

      // TEST 9: Invalid format error handling
      addTest('Error handling', 'running', 'Testing error messages...');
      try {
        VoucherService.parseVoucherCode('bad-format');
        addTest('Error handling', 'error', '❌ Should have thrown error');
        failed++;
      } catch (error) {
        if (error.message.includes('Invalid voucher format')) {
          addTest('Error handling', 'success', '✅ Correct error message thrown');
          passed++;
        } else {
          addTest('Error handling', 'error', `❌ Wrong error: ${error.message}`);
          failed++;
        }
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

export default VoucherServiceTest;

// EOF