// src/constants/GameEvents.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Extracted from CoreEngine to prevent premature initialization
//         - Events are now standalone constants
//         - No imports - prevents supabaseClient.js from loading
//         - Can be safely imported by LaunchPage without triggering CoreEngine
//         - CoreEngine imports these events instead of defining them
//         - Fixes Sign Up URL hash consumption issue

const version = "v0.1.0";

/**
 * Game state machine events
 * These trigger transitions between game states
 * Exported as constants to avoid circular dependencies
 */
// CoreEngine uses its own this.events (same names). Components get events via useGame().events.
// This file exists for LaunchPage and others that may import without loading CoreEngine.
export const events = {
  LAUNCH: Symbol('LAUNCH'),
  LOGIN: Symbol('LOGIN'),
  SELECTERA: Symbol('SELECTERA'),
  SELECTOPPONENT: Symbol('SELECTOPPONENT'),
  PLACEMENT: Symbol('PLACEMENT'),
  PLAY: Symbol('PLAY'),
  OVER: Symbol('OVER')
};

console.log(`[GameEvents ${version}] Events constants loaded`);

// EOF
