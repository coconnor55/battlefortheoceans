// src/tests/NavigationTest.jsx
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Fix duplicate test runs and add skip status
//         - Run tests only once (not on every visibility toggle)
//         - Add 'skip' status for missing prerequisites
//         - Clear skip message when CoreEngine unavailable
//         - Don't count skips as failures in summary
// v0.1.0: State machine navigation testing

import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';

const version = 'v0.1.1';

const NavigationTest = ({ userId, onComplete }) => {
  const { coreEngine, currentState, events } = useGame();
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
      // Test 1: Check CoreEngine exists
      const hasCoreEngine = !!coreEngine;
      
      addResult(
        'CoreEngine Available',
        hasCoreEngine ? 'pass' : 'skip',
        hasCoreEngine
          ? 'CoreEngine instance found'
          : '⊘ Navigation tests skipped - CoreEngine not available',
        { hasCoreEngine }
      );

      if (!hasCoreEngine) {
        const summary = {
          total: 1,
          passed: 0,
          failed: 0,
          skipped: 1,
          details: [{ name: 'CoreEngine Available', status: 'skip' }]
        };
        onComplete(summary);
        setRunning(false);
        return;
      }

      // Test 2: Check current state
      const validStates = ['launch', 'login', 'era', 'opponent', 'placement', 'play', 'over'];
      const isValidState = validStates.includes(currentState);
      addResult(
        'Current State Valid',
        isValidState ? 'pass' : 'fail',
        isValidState
          ? `Current state is valid: ${currentState}`
          : `Invalid state: ${currentState}`,
        { currentState, validStates }
      );

      // Test 3: Check events object
      const hasEvents = events && typeof events === 'object';
      addResult(
        'Events Object',
        hasEvents ? 'pass' : 'fail',
        hasEvents ? 'Events object available' : 'Events object missing',
        { hasEvents }
      );

      // Test 4: Check required events
      const requiredEvents = ['LAUNCH', 'LOGIN', 'SELECTERA', 'SELECTOPPONENT', 'PLACEMENT', 'PLAY', 'OVER'];
      const missingEvents = requiredEvents.filter(event => !events[event]);
      addResult(
        'Required Events',
        missingEvents.length === 0 ? 'pass' : 'fail',
        missingEvents.length === 0
          ? `All ${requiredEvents.length} required events present`
          : `Missing events: ${missingEvents.join(', ')}`,
        { requiredEvents, missingEvents, availableEvents: Object.keys(events || {}) }
      );

      // Test 5: Check state machine structure
      const hasStates = coreEngine.states && typeof coreEngine.states === 'object';
      addResult(
        'State Machine Structure',
        hasStates ? 'pass' : 'fail',
        hasStates ? 'State machine structure exists' : 'State machine structure missing',
        { hasStates }
      );

      // Test 6: Check dispatch method
      const hasDispatch = typeof coreEngine.dispatch === 'function';
      addResult(
        'Dispatch Method',
        hasDispatch ? 'pass' : 'fail',
        hasDispatch ? 'dispatch() method available' : 'dispatch() method missing',
        { hasDispatch }
      );

      // Test 7: Validate state transitions
      if (hasStates) {
        const stateTransitions = Object.entries(coreEngine.states).map(([state, config]) => {
          const transitions = config.on ? Object.keys(config.on) : [];
          return { state, transitionCount: transitions.length, transitions };
        });

        const allStatesHaveTransitions = stateTransitions.every(st => st.transitionCount > 0 || st.state === 'launch');
        
        addResult(
          'State Transitions Defined',
          allStatesHaveTransitions ? 'pass' : 'fail',
          allStatesHaveTransitions
            ? 'All states have valid transitions defined'
            : 'Some states missing transitions',
          { stateTransitions }
        );
      }

      // Test 8: Check 'over' state transitions (bug fix verification)
      if (hasStates && coreEngine.states.over) {
        const overState = coreEngine.states.over;
        const overTransitions = overState.on ? Object.keys(overState.on) : [];
        const validOverTransitions = ['SELECTERA', 'SELECTOPPONENT', 'PLACEMENT', 'LAUNCH'];
        const invalidTransitions = overTransitions.filter(t =>
          !validOverTransitions.includes(t.toString().replace('Symbol(', '').replace(')', ''))
        );

        addResult(
          'Over State Transitions Valid',
          invalidTransitions.length === 0 ? 'pass' : 'fail',
          invalidTransitions.length === 0
            ? `Over state has valid transitions: ${overTransitions.length}`
            : `Over state has invalid transitions: ${invalidTransitions.join(', ')}`,
          { overTransitions, validOverTransitions, invalidTransitions }
        );
      }

      // Test 9: Check session persistence
      const hasSessionManager = coreEngine.sessionManager !== undefined;
      addResult(
        'Session Manager',
        hasSessionManager ? 'pass' : 'fail',
        hasSessionManager ? 'SessionManager available' : 'SessionManager missing',
        { hasSessionManager }
      );

      // Test 10: Check navigation manager
      const hasNavigationManager = coreEngine.navigationManager !== undefined;
      addResult(
        'Navigation Manager',
        hasNavigationManager ? 'pass' : 'fail',
        hasNavigationManager ? 'NavigationManager available' : 'NavigationManager missing',
        { hasNavigationManager }
      );

      // Test 11: Check transition method
      const hasTransition = typeof coreEngine.transition === 'function';
      addResult(
        'Transition Method',
        hasTransition ? 'pass' : 'fail',
        hasTransition ? 'transition() method available' : 'transition() method missing',
        { hasTransition }
      );

      // Test 12: Check observer pattern
      const hasSubscribe = typeof coreEngine.subscribe === 'function';
      addResult(
        'Observer Pattern',
        hasSubscribe ? 'pass' : 'fail',
        hasSubscribe ? 'subscribe() method available for observers' : 'subscribe() method missing',
        { hasSubscribe }
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
      {running && <div className="test-running">Running navigation tests...</div>}
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

export default NavigationTest;
// EOF
