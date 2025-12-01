// src/utils/retryWithBackoff.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Retry utility with exponential backoff for network requests
//         - Retries failed network operations with increasing delays
//         - Configurable max attempts and backoff multiplier
//         - Returns last error if all retries fail

const version = 'v0.1.0';

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 * @param {number} options.maxAttempts - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param {number} options.multiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried (default: retry all errors)
 * @returns {Promise} Resolves with function result or rejects with last error
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    multiplier = 2,
    shouldRetry = () => true // Retry all errors by default
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        throw error;
      }

      // Don't delay after the last attempt
      if (attempt < maxAttempts) {
        // Calculate delay with exponential backoff
        const currentDelay = Math.min(delay, maxDelay);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        // Increase delay for next attempt
        delay = Math.min(delay * multiplier, maxDelay);
      }
    }
  }

  // All retries failed, throw last error
  throw lastError;
};

/**
 * Check if an error is a network error (should be retried)
 * @param {Error} error - Error object to check
 * @returns {boolean} True if error is a network error
 */
export const isNetworkErrorForRetry = (error) => {
  if (!error) return false;
  
  // Network errors that should be retried
  if (error.name === 'NetworkError' || error.name === 'TypeError') {
    if (error.message && (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Network request failed') ||
      error.message.includes('Load failed') ||
      error.message.includes('fetch')
    )) {
      return true;
    }
  }
  
  // Check if error has isNetworkError flag
  if (error.isNetworkError) {
    return true;
  }
  
  // HTTP errors that might be temporary (5xx)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  return false;
};

export default retryWithBackoff;

