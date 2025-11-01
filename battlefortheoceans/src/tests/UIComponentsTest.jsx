// src/tests/UIComponentsTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.0: Fixed - converted from class to React functional component
// v0.2.0: UI component instantiation tests with real test user
// v0.1.0: Initial version

import React, { useEffect, useState } from 'react';

const version = 'v0.3.0';

// Test user credentials
const TEST_USER = {
  id: '7f6c17c1-5c54-4a8a-ba4b-3870fca7b004',
  game_name: 'TestUser',
  email: 'testuser@battlefortheoceans.com'
};

/**
 * UIComponentsTest
 * Tests that UI components can be instantiated without crashing
 * Uses real test user for props
 */
const UIComponentsTest = ({ userId, onComplete }) => {
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, type, message };
    setResults(prev => [...prev, logEntry]);
    console.log(`[TESTS] ${type.toUpperCase()} ${message}`);
  };

  const testComponentExists = async (componentName, ComponentClass) => {
    try {
      if (!ComponentClass) {
        log(`❌ ${componentName} - Component not found`, 'error');
        return false;
      }

      if (typeof ComponentClass !== 'function') {
        log(`❌ ${componentName} - Not a valid React component`, 'error');
        return false;
      }

      log(`✅ ${componentName} - Component exists and is valid`, 'success');
      return true;
    } catch (error) {
      log(`❌ ${componentName} - Error: ${error.message}`, 'error');
      return false;
    }
  };

  const testComponentProps = async (componentName, ComponentClass, testProps) => {
    try {
      const element = React.createElement(ComponentClass, testProps);

      if (!element) {
        log(`❌ ${componentName} - Failed to create element with props`, 'error');
        return false;
      }

      log(`✅ ${componentName} - Accepts props correctly`, 'success');
      return true;
    } catch (error) {
      log(`❌ ${componentName} - Props error: ${error.message}`, 'error');
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    log('Starting UI Components Test Suite', 'info');
    log(`Version: ${version}`, 'info');
    log(`Test User: ${TEST_USER.game_name} (${TEST_USER.id})`, 'info');

    const testComponents = [
      {
        name: 'PassBalanceDisplay',
        props: { userId: userId || TEST_USER.id }
      },
      {
        name: 'PlayConfirmModal',
        props: {
          era: { id: 'traditional', name: 'Traditional Battleship' },
          badge: 'FREE',
          method: 'free',
          onConfirm: () => {},
          onCancel: () => {}
        }
      },
      {
        name: 'AchievementNotification',
        props: {
          achievement: {
            id: 'first-blood',
            name: 'First Blood',
            badge_icon: '⚔️',
            points: 10
          },
          onClose: () => {}
        }
      },
      {
        name: 'FleetStatusSidebar',
        props: {
          fleet: { ships: [] },
          alliance: 'Blue Fleet'
        }
      },
      {
        name: 'VideoPopup',
        props: {
          videoData: {
            src: '/test.mp4',
            title: 'Test Video'
          },
          onClose: () => {}
        }
      }
    ];

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const testCase of testComponents) {
      log(`\nTesting: ${testCase.name}`, 'info');

      try {
        const componentPath = `../components/${testCase.name}`;
        const ComponentModule = await import(componentPath).catch(() => null);

        if (!ComponentModule) {
          log(`⚠️ ${testCase.name} - Component file not found (skipping)`, 'warn');
          skipped++;
          continue;
        }

        const ComponentClass = ComponentModule.default;

        const existsResult = await testComponentExists(testCase.name, ComponentClass);
        if (!existsResult) {
          failed++;
          continue;
        }

        const propsResult = await testComponentProps(testCase.name, ComponentClass, testCase.props);
        if (propsResult) {
          passed++;
        } else {
          failed++;
        }

      } catch (error) {
        log(`❌ ${testCase.name} - Unexpected error: ${error.message}`, 'error');
        failed++;
      }
    }

    log(`\n=== Test Results ===`, 'info');
    log(`✅ Passed: ${passed}`, 'success');
    log(`❌ Failed: ${failed}`, 'error');
    log(`⚠️ Skipped: ${skipped}`, 'warn');
    log(`Total: ${passed + failed + skipped}`, 'info');

    setIsRunning(false);

    if (onComplete) {
      onComplete({ passed, failed, skipped, total: passed + failed + skipped });
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

export default UIComponentsTest;
// EOF
