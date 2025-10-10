// src/utils/debug.js
// Copyright(c) 2025, Clint H. O'Connor
// Simple console.log filter by category

const version = "v0.1.2";

// Control which categories are logged
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
  DEBUG: true,
    TARGETING: false,
    GAME: false
};

// Store original console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Override console.log to filter by category
console.log = (...args) => {
  const firstArg = args[0];
  
  // Check if first argument starts with a category tag like [PLACEMENT]
  if (typeof firstArg === 'string') {
    const categoryMatch = firstArg.match(/^\[(\w+)\]/);
    
    if (categoryMatch) {
      const category = categoryMatch[1];
      
      // Only log if this category is enabled
      if (control[category] === true) {
        const timestamp = new Date().toLocaleTimeString();
        originalLog(`[${timestamp}] [${category}]`, ...args.slice(0, 1).map(arg => arg.replace(/^\[\w+\]\s*/, '')), ...args.slice(1));
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

console.log('[DEBUG] Debug system initialized', version);

// EOF
