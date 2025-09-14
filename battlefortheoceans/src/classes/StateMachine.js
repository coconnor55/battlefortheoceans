// src/classes/StateMachine.js (v0.1.7)
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED: Do not modify without confirmation

export class StateMachine {
  constructor() {
    this.event = {
      LOGIN: Symbol('LOGIN'),
      SELECTERA: Symbol('SELECTERA'),
      PLACEMENT: Symbol('PLACEMENT'),
      PLAY: Symbol('PLAY'),
      OVER: Symbol('OVER'),
      ERA: Symbol('ERA')
    };
    this.states = {
      launch: { on: { [this.event.LOGIN]: 'login' } },
      login: { on: { [this.event.SELECTERA]: 'era' } },
      era: { on: { [this.event.PLACEMENT]: 'placement' } },
      placement: { on: { [this.event.PLAY]: 'play' } },
      play: { on: { [this.event.OVER]: 'over' } },
      over: { on: { [this.event.ERA]: 'era' } }
    };
    this.currentState = 'launch';
    this.lastEvent = null;
  }

  transition(event) {
    console.log(`Attempting transition from ${this.currentState} with event`, event);
    console.log('Available transitions:', Object.getOwnPropertySymbols(this.states[this.currentState]?.on || {}));
    const nextState = this.states[this.currentState]?.on[event];
    if (nextState) {
      this.currentState = nextState;
      this.lastEvent = event;
      console.log(`Transitioned to ${this.currentState} with event`, event);
    } else {
      console.warn(`No transition defined for ${this.currentState} with event`, event);
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
