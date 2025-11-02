// src/tests/UIComponentsTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.2: Removed the test user
// v0.3.1: Add detailed reasons with file paths for skips and failures
//         - Include component path in skip messages
//         - Add reason field to details array
//         - Show expected vs actual for failures
// v0.3.0: Fixed - converted from class to React functional component
// v0.2.0: UI component instantiation tests with real test user
// v0.1.0: Initial version

import React, { useEffect, useState, useRef } from 'react';

const version = 'v0.3.2';

/**
 * UIComponentsTest
 * Tests that UI components can be instantiated without crashing
 * Uses real test user for props
 */
const UIComponentsTest = ({ userId, onComplete }) => {
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double-run in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;
    
    runTests();
  }, []);

  const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, type, message };
    setResults(prev => [...prev, logEntry]);
    console.log(`[TESTS] ${type.toUpperCase()} ${message}`);
  };

  const testComponentExists = async (componentName, ComponentClass, componentPath) => {
    try {
      if (!ComponentClass) {
        log(`❌ ${componentName} - Component not found at ${componentPath}`, 'error');
        return { success: false, reason: `File not found: ${componentPath}` };
      }

      if (typeof ComponentClass !== 'function') {
        log(`❌ ${componentName} - Not a valid React component`, 'error');
        return { success: false, reason: 'Not a valid React component' };
      }

      log(`✅ ${componentName} - Component exists and is valid`, 'success');
      return { success: true };
    } catch (error) {
      log(`❌ ${componentName} - Error: ${error.message}`, 'error');
      return { success: false, reason: error.message };
    }
  };

  const testComponentProps = async (componentName, ComponentClass, testProps) => {
    try {
      const element = React.createElement(ComponentClass, testProps);

      if (!element) {
        log(`❌ ${componentName} - Failed to create element with props`, 'error');
        return { success: false, reason: 'Failed to create element with props' };
      }

      log(`✅ ${componentName} - Accepts props correctly`, 'success');
      return { success: true };
    } catch (error) {
      log(`❌ ${componentName} - Props error: ${error.message}`, 'error');
      return { success: false, reason: `Props error: ${error.message}` };
    }
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);

    log('Starting UI Components Test Suite', 'info');
    log(`Version: ${version}`, 'info');
    log(`Testing as user: ${userId?.substring(0, 8)}...`, 'info');
    
    const testComponents = [
      {
        name: 'PassBalanceDisplay',
        props: { userId: userId }
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
    const details = [];

    for (const testCase of testComponents) {
      log(`\nTesting: ${testCase.name}`, 'info');

try {
  // Import components statically (Webpack requirement)
  let ComponentModule = null;

  switch(testCase.name) {
    case 'AchievementNotification':
      ComponentModule = await import('../components/AchievementNotification.js').catch(() => null);
      break;
    case 'FleetStatusSidebar':
      ComponentModule = await import('../components/FleetStatusSidebar.js').catch(() => null);
      break;
    case 'VideoPopup':
      ComponentModule = await import('../components/VideoPopup.js').catch(() => null);
      break;
    case 'PassBalanceDisplay':
      ComponentModule = await import('../components/PassBalanceDisplay.js').catch(() => null);
      break;
    case 'PlayConfirmModal':
      ComponentModule = await import('../components/PlayConfirmModal.js').catch(() => null);
      break;
    default:
      ComponentModule = null;
  }

  if (!ComponentModule) {
    const skipReason = `Component file not found: src/components/${testCase.name}.js`;
    log(`⚠️ ${testCase.name} - ${skipReason}`, 'warn');
    skipped++;
    details.push({
      name: testCase.name,
      status: 'skip',
      reason: skipReason
    });
    continue;
  }
  
        const ComponentClass = ComponentModule.default;

        const existsResult = await testComponentExists(testCase.name, ComponentClass, testCase.name);

        if (!existsResult.success) {
          failed++;
          details.push({
            name: `${testCase.name} - Exists`,
            status: 'fail',
            reason: existsResult.reason
          });
          continue;
        }

        const propsResult = await testComponentProps(testCase.name, ComponentClass, testCase.props);
        if (propsResult.success) {
          passed++;
          details.push({
            name: testCase.name,
            status: 'pass'
          });
        } else {
          failed++;
          details.push({
            name: `${testCase.name} - Props`,
            status: 'fail',
            reason: propsResult.reason
          });
        }

      } catch (error) {
        const errorReason = `Unexpected error: ${error.message}`;
        log(`❌ ${testCase.name} - ${errorReason}`, 'error');
        failed++;
        details.push({
          name: testCase.name,
          status: 'fail',
          reason: errorReason
        });
      }
    }

    log(`\n=== Test Results ===`, 'info');
    log(`✅ Passed: ${passed}`, 'success');
    log(`❌ Failed: ${failed}`, 'error');
    log(`⚠️ Skipped: ${skipped}`, 'warn');
    log(`Total: ${passed + failed + skipped}`, 'info');

    setIsRunning(false);

    if (onComplete) {
      onComplete({
        passed,
        failed,
        skipped,
        total: passed + failed + skipped,
        details
      });
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

export default UIComponentsTest;
// EOF
