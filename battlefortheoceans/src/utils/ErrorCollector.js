// src/utils/ErrorCollector.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Error collection service for Supabase logging
//         - Collects non-critical errors locally during game sessions
//         - Sends summary report to Supabase when game ends
//         - Sends critical errors immediately to Supabase
//         - Efficient error tracking without external services

const version = 'v0.1.0';
const tag = "ERRORCOLLECTOR";
const module = "ErrorCollector";

// In-memory error collection (per game session)
const errorCollections = new Map(); // gameId -> error collection

// Error severity levels
export const ErrorSeverity = {
  CRITICAL: 'critical',    // Send immediately (React errors, game-breaking)
  HIGH: 'high',            // Collect and send in summary (API failures, state errors)
  MEDIUM: 'medium',        // Collect and send in summary (warnings, recoverable errors)
  LOW: 'low'              // Collect and send in summary (non-critical, info)
};

// Error types that are considered non-critical
const NON_CRITICAL_ERROR_TYPES = [
  'ChunkLoadError',
  'NetworkError',
  'TimeoutError',
  'AbortError',
  'TypeError', // Some TypeErrors are non-critical (e.g., optional chaining failures)
];

// Error messages that indicate non-critical errors
const NON_CRITICAL_PATTERNS = [
  /failed to fetch/i,
  /network error/i,
  /timeout/i,
  /chunk load/i,
  /loading chunk/i,
  /cannot read property.*of undefined/i, // Common non-critical TypeError
];

/**
 * Determine if an error is critical
 * @param {Error} error - Error object
 * @returns {boolean} - True if error is critical
 */
function isCriticalError(error) {
  // React component errors are always critical
  if (error?.componentStack) {
    return true;
  }
  
  // Check error type
  if (error?.name && NON_CRITICAL_ERROR_TYPES.includes(error.name)) {
    return false;
  }
  
  // Check error message patterns
  const message = error?.message || error?.toString() || '';
  if (NON_CRITICAL_PATTERNS.some(pattern => pattern.test(message))) {
    return false;
  }
  
  // Default to critical if we can't determine
  return true;
}

/**
 * Start error collection for a game session
 * @param {string} gameId - Game identifier
 * @param {object} context - Additional context (era, opponent, etc.)
 */
export function startGameErrorCollection(gameId, context = {}) {
  if (!gameId) {
    console.warn(`[${tag}] ${version} ${module}.startGameErrorCollection: No gameId provided`);
    return;
  }
  
  errorCollections.set(gameId, {
    gameId,
    startTime: Date.now(),
    context,
    errors: [],
    errorCounts: new Map(), // error type -> count
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${tag}] ${version} ${module}.startGameErrorCollection: Started collection for game ${gameId}`);
  }
}

/**
 * Collect an error (either send immediately if critical, or collect for summary)
 * @param {Error} error - Error object
 * @param {object} options - Collection options
 * @param {string} options.gameId - Current game ID
 * @param {string} options.severity - Error severity (default: auto-detect)
 * @param {object} options.context - Additional context
 * @param {string} options.playerId - Player ID (optional)
 */
export function collectError(error, options = {}) {
  const { gameId, severity, context = {}, playerId } = options;
  
  if (!error) {
    return;
  }
  
  // Determine severity if not provided
  const errorSeverity = severity || (isCriticalError(error) ? ErrorSeverity.CRITICAL : ErrorSeverity.MEDIUM);
  
  // Critical errors: send immediately to Supabase
  if (errorSeverity === ErrorSeverity.CRITICAL) {
    // Dynamically import ErrorLogService to avoid circular dependencies
    import('../services/ErrorLogService.js').then(({ default: errorLogService }) => {
      errorLogService.logCriticalError(error, {
        ...context,
        gameId,
        severity: errorSeverity,
        immediate: true
      }, playerId).catch(err => {
        console.error(`[${tag}] ${version} ${module}.collectError: Failed to log critical error:`, err);
      });
    }).catch(() => {
      // ErrorLogService not available - log to console
      console.error(`[${tag}] ${version} ${module}.collectError: Critical error (ErrorLogService unavailable):`, error);
    });
    return;
  }
  
  // Non-critical errors: collect for summary
  if (!gameId) {
    // No game context - log immediately as fallback
    console.warn(`[${tag}] ${version} ${module}.collectError: Non-critical error without game context:`, error);
    return;
  }
  
  const collection = errorCollections.get(gameId);
  if (!collection) {
    // Game collection not started - log warning
    console.warn(`[${tag}] ${version} ${module}.collectError: Error collection not started for game ${gameId}`);
    return;
  }
  
  // Add error to collection
  const errorKey = `${error.name || 'Error'}:${error.message || error.toString()}`;
  const count = collection.errorCounts.get(errorKey) || 0;
  collection.errorCounts.set(errorKey, count + 1);
  
  // Store first occurrence with full details
  if (count === 0) {
    collection.errors.push({
      error: {
        name: error.name,
        message: error.message || error.toString(),
        stack: error.stack,
      },
      severity: errorSeverity,
      context,
      timestamp: Date.now(),
      count: 1
    });
  } else {
    // Update count for existing error
    const existingError = collection.errors.find(e => 
      e.error.name === error.name && 
      e.error.message === error.message
    );
    if (existingError) {
      existingError.count = count + 1;
    }
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${tag}] ${version} ${module}.collectError: Collected ${errorSeverity} error for game ${gameId}:`, errorKey);
  }
}

/**
 * End error collection and send summary to Supabase
 * @param {string} gameId - Game identifier
 * @param {object} gameResult - Game result context (winner, turns, etc.)
 * @param {string} playerId - Player ID (optional)
 */
export function endGameErrorCollection(gameId, gameResult = {}, playerId = null) {
  if (!gameId) {
    return;
  }
  
  const collection = errorCollections.get(gameId);
  if (!collection) {
    return;
  }
  
  const duration = Date.now() - collection.startTime;
  const totalErrors = Array.from(collection.errorCounts.values()).reduce((sum, count) => sum + count, 0);
  
  if (totalErrors > 0) {
    // Send error summary if there were errors
    const summary = {
      gameId,
      duration,
      totalErrors,
      errorTypes: Array.from(collection.errorCounts.entries()).map(([key, count]) => ({
        error: key,
        count
      })),
      errors: collection.errors,
      context: {
        ...collection.context,
        ...gameResult
      },
      timestamp: Date.now()
    };
    
    // Send summary to Supabase
    import('../services/ErrorLogService.js').then(({ default: errorLogService }) => {
      errorLogService.logGameErrorSummary(summary, playerId).catch(err => {
        console.error(`[${tag}] ${version} ${module}.endGameErrorCollection: Failed to log error summary:`, err);
      });
    }).catch(() => {
      // ErrorLogService not available - log to console
      console.warn(`[${tag}] ${version} ${module}.endGameErrorCollection: Error summary (ErrorLogService unavailable):`, summary);
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${tag}] ${version} ${module}.endGameErrorCollection: Sent summary for game ${gameId}:`, {
        totalErrors,
        errorTypes: collection.errorCounts.size
      });
    }
  } else {
    // No errors - log success message with incomplete counter
    const incompleteCount = typeof gameResult.incompleteCounter === 'number' ? gameResult.incompleteCounter : 'N/A';
    console.log(`[${tag}] ${version} ${module}.endGameErrorCollection: Game ${gameId} completed with no errors. Incomplete counter: ${incompleteCount}`);
  }
  
  // Clean up
  errorCollections.delete(gameId);
}

/**
 * Clear error collection for a game (e.g., if game is abandoned)
 * @param {string} gameId - Game identifier
 */
export function clearGameErrorCollection(gameId) {
  if (gameId) {
    errorCollections.delete(gameId);
  }
}

/**
 * Get current error collection stats for a game
 * @param {string} gameId - Game identifier
 * @returns {object|null} - Collection stats or null
 */
export function getGameErrorStats(gameId) {
  const collection = errorCollections.get(gameId);
  if (!collection) {
    return null;
  }
  
  const totalErrors = Array.from(collection.errorCounts.values()).reduce((sum, count) => sum + count, 0);
  
  return {
    gameId,
    totalErrors,
    errorTypes: collection.errorCounts.size,
    duration: Date.now() - collection.startTime
  };
}

// EOF

