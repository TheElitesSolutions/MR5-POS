/**
 * Request Manager Global Configuration
 *
 * This module provides global configuration for the RequestManager
 * to prevent duplicate API calls system-wide.
 */

// Global flag to disable multiple identical requests within the same render cycle
export const REQUEST_MANAGER_CONFIG = {
  // When true, completely blocks duplicate calls across the application
  // regardless of component boundaries
  STRICT_DEDUPLICATION: true,

  // Minimum time between identical requests (in ms)
  // Even if components mount at different times, this prevents
  // rapid duplicate calls of the same request
  // Increased from 100ms to 1000ms to better handle component mounting sequences
  DUPLICATE_REQUEST_THROTTLE: 1000,

  // Debug mode to log all request handling
  DEBUG_MODE: true,
};
