// src/utils/debug.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.6: Turned off all debug categories for production - can be enabled via enableCategory() at runtime
//         - All categories default to false for clean production logs
//         - Critical errors and warnings still shown (console.error/warn are unfiltered)
// v0.1.4: Added extendedDebug filter for DEBUG messages
//         - If extendedDebug is false, filters out messages with "DEBUG" after [TAG]
//         - Example: "[SELECTERA] DEBUG SelectEra.xyz" is filtered when extendedDebug=false
//         - Allows toggling verbose debug messages without disabling entire categories
// v0.1.3: Fixed infinite recursion - removed init log, use originalLog directly
// Simple console.log filter by category

const version = "v0.1.6";

// Control which categories are logged
const extendedDebug = false;  // Set to false to filter DEBUG messages

const control = {
  HOOK: false,
  PLACEMENT: false,
  SOUND: false,
  AI: false,
  ATTACK: false,
  BOARD: false,
  CANVAS: false,
  NETWORK: false,
  STATS: false,
  PAYMENT: false,
  OPPONENT: false,
  OVERLAY: false,
  TARGETING: false,
  GAME: false,
  NAVBAR: false,
  ACHIEVEMENT: false,
  MESSAGE: false,
  FIRE: false,
  VIDEO: false,
  LAUNCH: false,
  LOGIN: true,
  CORE: false,
  GUIDE: false,
  AUTOPLAY: false,
  MUNITIONS: false,
  RIGHTS: false,
  INVITE: true,
  VOUCHER: false,
  ACCESS: false,
  SELECTERA: false,
  LIFECYCLE: false,
  ERRORCOLLECTOR: true,
  ABOUT: false,
  BADGES: false,
  PROFILE: false,
  AUTH: true,
  SERVICE: true,
  OVER: false,
  TEST: false,
  DEBUG: false,
  NAVIGATION: false,
  SOUND: false
};

// Store original console methods FIRST
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Override console.log to filter by category
console.log = (...args) => {
  const firstArg = args[0];
  
  // Check if first argument starts with a category tag like [PLACEMENT] or [FIRE-INIT]
  if (typeof firstArg === 'string') {
    const categoryMatch = firstArg.match(/^\[([A-Z]+)/);
    
    if (categoryMatch) {
      const category = categoryMatch[1];
      
      // Check if category is enabled
      if (control[category] !== true) {
        return; // Category disabled, don't log
      }
      
      // Check for DEBUG keyword after tag (if extendedDebug is false)
      if (!extendedDebug) {
        // Match pattern: [TAG] DEBUG or [TAG] v0.x.x Module.method DEBUG
        const debugMatch = firstArg.match(/^\[[A-Z]+\].*?\bDEBUG\b/i);
        if (debugMatch) {
          return; // Contains DEBUG and extendedDebug is off, don't log
        }
      }
      
      // Category enabled and passes DEBUG filter, log it
      const timestamp = new Date().toLocaleTimeString();
      originalLog(`${timestamp}`, ...args);
      return;
    }
  }
  
  // No category tag, log normally (backwards compatible)
  originalLog(...args);
};

// Keep error and warn unfiltered (always show)
console.error = (...args) => {
  const timestamp = new Date().toLocaleTimeString();
  originalError(`${timestamp} [ERROR]`, ...args);
};

console.warn = (...args) => {
  const timestamp = new Date().toLocaleTimeString();
  originalWarn(`${timestamp} [WARN]`, ...args);
};

// Export control object so it can be modified at runtime
export const debugControl = control;

// Utility to enable/disable categories
export const enableCategory = (category) => {
  if (category in control) {
    control[category] = true;
    originalLog(`[DEBUG] Enabled logging for: ${category}`);
  }
};

export const disableCategory = (category) => {
  if (category in control) {
    control[category] = false;
    originalLog(`[DEBUG] Disabled logging for: ${category}`);
  }
};

// Show current settings
export const showDebugSettings = () => {
  originalLog('[DEBUG] Current debug settings:', control);
  originalLog(`[DEBUG] Extended debug (DEBUG messages): ${extendedDebug}`);
};

// Restore original console
export const restoreConsole = () => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
};

// EOF
