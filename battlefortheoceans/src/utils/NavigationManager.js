// src/utils/NavigationManager.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Extracted from CoreEngine.js v0.6.5
//         - URL route mapping (stateToRoute, routeToState)
//         - initializeFromURL() - sets state from URL path
//         - syncURL() - updates browser URL when state changes
//         - handleBrowserNavigation() - handles back/forward buttons
//         - isValidBackwardTransition() - validates navigation
//         - Browser popstate event listener setup
//         - Reduces CoreEngine by ~200 lines

const version = "v0.1.0";

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
    if (!coreEngine) {
      throw new Error('NavigationManager requires CoreEngine instance');
    }
    
    this.coreEngine = coreEngine;
    
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
    window.addEventListener('popstate', (event) => {
      this.handleBrowserNavigation(event);
    });
    this.log('Browser navigation listener attached');
  }
  
  /**
   * Initialize state from current URL path
   * Called on page load to restore state from URL
   * 
   * @param {string} path - URL path (defaults to window.location.pathname)
   */
  initializeFromURL(path = window.location?.pathname || '/') {
    const targetState = this.routeToState[path] || 'launch';
    
    this.log(`Initializing from URL: ${path} → ${targetState}`);
    
    // Special handling for era state
    if (targetState === 'era') {
      this.coreEngine.setCurrentState('era');
      if (window.history) {
        window.history.replaceState(
          { state: 'era', timestamp: Date.now() },
          '',
          '/select-era'
        );
      }
      this.coreEngine.notifySubscribers();
      return;
    }
    
    // Log warning for direct access to protected states
    if (targetState !== 'launch' && targetState !== 'login') {
      this.log(`Direct URL to protected state ${targetState} - page will validate profile`);
    }
    
    // Set state and sync URL
    this.coreEngine.setCurrentState(targetState);
    if (window.history) {
      window.history.replaceState(
        { state: targetState, timestamp: Date.now() },
        '',
        this.stateToRoute[targetState] || '/'
      );
    }
    this.coreEngine.notifySubscribers();
  }
  
  /**
   * Sync browser URL to match current state
   * Called after state transitions to keep URL in sync
   * 
   * @param {string} currentState - Current game state
   */
  syncURL(currentState) {
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
   * @param {PopStateEvent} event - Browser navigation event
   */
  handleBrowserNavigation(event) {
    const targetState = event.state?.state;
    
    if (!targetState) {
      this.log('Browser navigation with no state - ignoring');
      return;
    }
    
    const currentState = this.coreEngine.getCurrentState();
    this.log(`Browser back/forward to: ${targetState}`);
    
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
      this.coreEngine.setCurrentState(targetState);
      
      // Trigger state transition handling (async)
      this.coreEngine.handleStateTransition(targetState).catch(error => {
        console.error(`${version} State transition failed:`, error);
      });
      
      this.coreEngine.notifySubscribers();
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
    return this.stateToRoute[state] || null;
  }
  
  /**
   * Get state for a given route
   * 
   * @param {string} route - URL route
   * @returns {string|null} Game state
   */
  getStateForRoute(route) {
    return this.routeToState[route] || null;
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [NavigationManager ${version}] ${message}`);
  }
}

export default NavigationManager;
// EOF
