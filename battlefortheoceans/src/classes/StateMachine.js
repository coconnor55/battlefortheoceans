// src/classes/StateMachine.js (v0.1.4)
// Copyright(c) 2025, Clint H. O'Connor

export class StateMachine {
  constructor() {
    this.states = {
      launch: { on: { X_LOGIN: 'login' } },
      login: { on: { X_SELECTERA: 'era' } },
      era: { on: { X_PLACEMENT: 'placement' } },
      placement: { on: { X_PLAY: 'play' } },
      play: { on: { X_OVER: 'over' } },
      over: { on: { X_ERA: 'era' } }
    };
    this.currentState = 'launch';
    this.lastEvent = null;
  }

  transition(event) {
    const nextState = this.states[this.currentState]?.on[event.type];
    if (nextState) {
      this.currentState = nextState;
      this.lastEvent = event.type;
    } else {
      console.warn(`No transition defined for ${this.currentState} with event ${event.type}`);
    }
  }

  getCurrentState() {
    return this.currentState;
  }

  getLastEvent() {
    return this.lastEvent;
  }
}

// EOF - EOF - EOF
