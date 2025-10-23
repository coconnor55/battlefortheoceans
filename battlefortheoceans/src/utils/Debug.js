// src/utils/debug.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.3: Fixed infinite recursion - removed init log, use originalLog directly
// Simple console.log filter by category

const version = "v0.1.3";

// Control which categories are logged
const control = {
  HOOK: false,
  PLACEMENT: true,
  SOUND: false,
  AI: false,
  ATTACK: false,
  BOARD: false,
  CANVAS: true,
  NETWORK: false,
  STATS: false,
  PAYMENT: false,
  OPPONENT: false,
  OVERLAY: false,
  TARGETING: false,
  GAME: false,
  NAVBAR: false,
  ACHIEVEMENT: false,
  MESSAGE: true,
  FIRE: false,
    VIDEO: true,
    INDEX: true,
  DEBUG: true
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
      
      // Only log if this category is enabled
      if (control[category] === true) {
        const timestamp = new Date().toLocaleTimeString();
        originalLog(`[${timestamp}]`, ...args);
      }
      return; // Category found, don't fall through
    }
  }
  
  // No category tag, log normally (backwards compatible)
  originalLog(...args);
};

// Keep error and warn unfiltered (always show)
console.error = (...args) => {
  const timestamp = new Date().toLocaleTimeString();
  originalError(`[${timestamp}] [ERROR]`, ...args);
};

console.warn = (...args) => {
  const timestamp = new Date().toLocaleTimeString();
  originalWarn(`[${timestamp}] [WARN]`, ...args);
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
};

// Restore original console
export const restoreConsole = () => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
};

// Use originalLog directly to avoid recursion on init
// REMOVED: This line was causing recursion when called repeatedly
// originalLog('[DEBUG] Debug system initialized', version);

// EOF
