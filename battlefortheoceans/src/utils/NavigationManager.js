// src/utils/NavigationManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Fixed browser navigation and page refresh using restoreToState()
//         - initializeFromURL() now calls restoreToState() instead of setCurrentState()
//         - Fixes page refresh bug where state handlers didn't run
//         - handleBrowserNavigation() now calls restoreToState()
//         - Fixes browser back/forward button where state handlers didn't run
//         - Made handleBrowserNavigation() async (restoreToState is async)
//         - Removed call to non-existent handleStateTransition()
// v0.1.0: Extracted from CoreEngine.js v0.6.5
//         - URL route mapping (stateToRoute, routeToState)
//         - initializeFromURL() - sets state from URL path
//         - syncURL() - updates browser URL when state changes
//         - handleBrowserNavigation() - handles back/forward buttons
//         - isValidBackwardTransition() - validates navigation
//         - Browser popstate event listener setup
//         - Reduces CoreEngine by ~200 lines

const version = "v0.1.2";
const tag = "NAVIGATION";
const module = "NavigationManager";
let method = "";

/**
 * NavigationManager
 *
 * Handles all URL synchronization and browser navigation for CoreEngine.
 * Extracted from CoreEngine v0.6.5 to separate navigation concerns.
 *
 * Responsibilities:
 * - Map states to URLs and vice versa
 * - Initialize state from current URL
 * - Update URL when state changes
 * - Handle browser back/forward buttons
 * - Validate backward navigation transitions
 *
 * @example
 * const navManager = new NavigationManager(coreEngine);
 * navManager.syncURL('era'); // Updates URL to /select-era
 */
class NavigationManager {
  constructor(coreEngine) {
    method = 'constructor';
    
    if (!coreEngine) {
      throw new Error('NavigationManager requires CoreEngine instance');
    }
    
    this.coreEngine = coreEngine;
    this.log('NavigationManager initialized');
    
    // URL route mapping
    this.stateToRoute = {
      'launch': '/',
      'login': '/login',
      'era': '/select-era',
      'opponent': '/select-opponent',
      'placement': '/placement',
      'play': '/battle',
      'over': '/results'
    };
    
    // Reverse mapping for URL → state lookup
    this.routeToState = Object.fromEntries(
      Object.entries(this.stateToRoute).map(([state, route]) => [route, state])
    );
    
    // Setup browser navigation if running in browser
    if (typeof window !== 'undefined') {
      this.setupBrowserNavigation();
    }
    
    this.log('NavigationManager initialized');
  }
  
  /**
   * Setup browser back/forward button handling
   */
  setupBrowserNavigation() {
    method = 'setupBrowserNavigation';
    window.addEventListener('popstate', (event) => {
      this.handleBrowserNavigation(event);
    });
    this.log('Browser navigation listener attached');
  }
  
  /**
   * Initialize state from current URL path
   * Called on page load to restore state from URL
   *
   * v0.1.1: Now uses restoreToState() to properly run state handlers
   * Fixes bug where page refresh didn't initialize game properly
   *
   * @param {string} path - URL path (defaults to window.location.pathname)
   */
  async initializeFromURL(path = window.location?.pathname || '/') {
    method = 'initializeFromURL';
    const targetState = this.routeToState[path] || 'launch';
    
    this.log(`Initializing from URL: ${path} → ${targetState}`);
    
    // Log warning for direct access to protected states
    if (targetState !== 'launch' && targetState !== 'login') {
      this.log(`Direct URL to protected state ${targetState} - page will validate profile`);
    }
    
    // Restore to state (runs handlers, saves session, notifies subscribers)
    await this.coreEngine.restoreToState(targetState);
    
    // Replace history state (don't push, we're already here)
    if (window.history) {
      window.history.replaceState(
        { state: targetState, timestamp: Date.now() },
        '',
        this.stateToRoute[targetState] || '/'
      );
    }
  }
  
  /**
   * Sync browser URL to match current state
   * Called after state transitions to keep URL in sync
   *
   * @param {string} currentState - Current game state
   */
  syncURL(currentState) {
    method = 'syncURL';
    const route = this.stateToRoute[currentState];
    if (!route || typeof window === 'undefined' || !window.history) {
      return;
    }
    
    const currentUrl = new URL(window.location);
    const newUrl = new URL(route, window.location.origin);
    
    // Preserve query parameters
    currentUrl.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value);
    });
    
    window.history.pushState(
      { state: currentState, timestamp: Date.now() },
      '',
      newUrl.pathname + newUrl.search
    );
    
    this.log(`URL synced: ${newUrl.pathname + newUrl.search}`);
  }
  
  /**
   * Handle browser back/forward button navigation
   * Validates transition and updates state
   *
   * v0.1.1: Now uses restoreToState() instead of non-existent handleStateTransition()
   * Made async since restoreToState() is async
   *
   * @param {PopStateEvent} event - Browser navigation event
   */
  async handleBrowserNavigation(event) {
    method = 'handleBrowserNavigation';
    const targetState = event.state?.state;
    
    if (!targetState) {
      this.log('Browser navigation with no state - ignoring');
      return;
    }
    
    const currentState = this.coreEngine.getCurrentState();
    this.log(`Browser back/forward: ${currentState} → ${targetState}`);
    
    // Prevent navigation away from active game
    if (currentState === 'play' && this.coreEngine.isGameActive()) {
      this.log('Cannot navigate away from active game');
      window.history.pushState(
        { state: currentState, timestamp: Date.now() },
        '',
        this.stateToRoute[currentState]
      );
      return;
    }
    
    // Validate backward transition
    if (this.isValidBackwardTransition(currentState, targetState)) {
      // Restore to state (runs handlers, saves session, notifies subscribers)
      // No URL sync needed - we're already at the correct URL (popstate event)
      await this.coreEngine.restoreToState(targetState);
    } else {
      this.log(`Invalid backward navigation from ${currentState} to ${targetState}`);
      // Re-sync URL to current state
      this.syncURL(currentState);
    }
  }
  
  /**
   * Check if backward navigation is allowed
   *
   * @param {string} from - Current state
   * @param {string} to - Target state
   * @returns {boolean} True if transition is valid
   */
  isValidBackwardTransition(from, to) {
    method = 'isValidBackwardTransition';
    const backwardAllowed = {
      'opponent': ['era'],
      'placement': ['opponent'],
      'over': ['era'],
      'achievements': ['era']
    };
    
    // Allow navigation to login from most states
    if (to === 'login' && ['era', 'opponent', 'placement', 'over', 'achievements'].includes(from)) {
      return true;
    }
    
    return backwardAllowed[from]?.includes(to) || false;
  }
  
  /**
   * Get route for a given state
   *
   * @param {string} state - Game state
   * @returns {string|null} URL route
   */
  getRouteForState(state) {
    method = 'getRouteForState';
    return this.stateToRoute[state] || null;
  }
  
  /**
   * Get state for a given route
   *
   * @param {string} route - URL route
   * @returns {string|null} Game state
   */
  getStateForRoute(route) {
    method = 'getStateForRoute';
    return this.routeToState[route] || null;
  }
  
  log(message) {
    console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
  }
  
  logerror(message, error = null) {
    if (error) {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
    } else {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
    }
  }
}

export default NavigationManager;
// EOF
