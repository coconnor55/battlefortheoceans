// src/classes/StateMachine.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

class StateMachine {
  constructor() {
    this.states = {
      launch: { template: 'LaunchPage' },
      login: { template: 'LoginPage' },
      select_era: { template: 'SelectEraPage' },
      placement: { template: 'PlacementPage' },
      playing: { template: 'PlayingPage' },
      over: { template: 'OverPage' }
    };
    this.currentState = 'launch';
    this.globalInstance = null;
  }

  static getInstance() {
    if (!this.globalInstance) {
      this.globalInstance = new StateMachine();
    }
    return this.globalInstance;
  }

  transition(event) {
    const validTransitions = {
      'X-LOGIN': 'login',
      'X-SELECTERA': 'select_era',
      'X-PLACEMENT': 'placement',
      'X-PLAYING': 'playing',
      'X-OVER': 'over'
    };

    const nextState = validTransitions[event];
    if (nextState && this.states[nextState]) {
      console.debug(`Transitioning from ${this.currentState} to ${nextState} via event ${event}`);
      this.currentState = nextState;
      return this.states[nextState].template;
    }
    console.debug(`Invalid transition from ${this.currentState} with event ${event}`);
    return null;
  }

  getCurrentState() {
    return this.currentState;
  }
}

export default StateMachine;

// EOF - EOF - EOF
