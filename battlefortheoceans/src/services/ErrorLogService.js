// src/services/ErrorLogService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Error logging service for Supabase
//         - Logs critical errors immediately
//         - Logs non-critical error summaries per game
//         - Provides query interface for error console

import { supabase } from '../utils/supabaseClient';

const version = 'v0.1.0';
const tag = "SERVICE";
const module = "ErrorLogService";
let method = "";

class ErrorLogService {
  constructor() {
    method = 'constructor';
  }

  log(message) {
    console.log(`[${tag}] ${version} ${module}.${method}: ${message}`);
  }

  logerror(message, error = null) {
    if (error) {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
    } else {
      console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
    }
  }

  /**
   * Log a critical error immediately to Supabase
   * @param {Error} error - Error object
   * @param {object} context - Additional context (gameId, era, opponent, etc.)
   * @param {string} playerId - Player ID (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async logCriticalError(error, context = {}, playerId = null) {
    method = 'logCriticalError';

    if (!error) {
      return false;
    }

    try {
      const errorData = {
        game_id: context.gameId || null,
        player_id: playerId || null,
        era_id: context.era || context.eraId || null,
        opponent_name: context.opponent || null,
        
        // Error details
        error_name: error.name || 'Error',
        error_message: error.message || error.toString(),
        error_stack: error.stack || null,
        severity: 'critical',
        
        // Context
        error_context: context.componentStack ? { componentStack: context.componentStack } : context,
        
        // Metadata
        environment: process.env.NODE_ENV || 'development',
        created_at: new Date().toISOString()
      };

      const { error: dbError } = await supabase
        .from('error_logs')
        .insert([errorData]);

      if (dbError) {
        this.logerror('Failed to log critical error to Supabase:', dbError);
        return false;
      }

      if (process.env.NODE_ENV === 'development') {
        this.log(`Critical error logged: ${error.name}`);
      }

      return true;
    } catch (err) {
      this.logerror('Exception logging critical error:', err);
      return false;
    }
  }

  /**
   * Log error summary for a completed game
   * @param {object} summary - Error summary from ErrorCollector
   * @param {string} playerId - Player ID (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async logGameErrorSummary(summary, playerId = null) {
    method = 'logGameErrorSummary';

    if (!summary || summary.totalErrors === 0) {
      return false;
    }

    try {
      const summaryData = {
        game_id: summary.gameId,
        player_id: playerId || null,
        era_id: summary.context?.era || summary.context?.eraId || null,
        opponent_name: summary.context?.opponent || null,
        
        // Summary details
        total_errors: summary.totalErrors,
        error_types: summary.errorTypes, // JSONB array
        errors: summary.errors, // JSONB array with full error details
        
        // Game context
        game_duration: summary.duration,
        game_turns: summary.context?.turns || null,
        winner: summary.context?.winner || null,
        human_won: summary.context?.humanWon || null,
        
        // Metadata
        severity: 'summary',
        environment: process.env.NODE_ENV || 'development',
        created_at: new Date().toISOString()
      };

      const { error: dbError } = await supabase
        .from('error_logs')
        .insert([summaryData]);

      if (dbError) {
        this.logerror('Failed to log error summary to Supabase:', dbError);
        return false;
      }

      if (process.env.NODE_ENV === 'development') {
        this.log(`Error summary logged for game ${summary.gameId}: ${summary.totalErrors} errors`);
      }

      return true;
    } catch (err) {
      this.logerror('Exception logging error summary:', err);
      return false;
    }
  }

  /**
   * Get error logs with optional filters
   * @param {object} filters - Filter options
   * @param {string} filters.severity - Filter by severity ('critical' or 'summary')
   * @param {string} filters.era_id - Filter by era
   * @param {string} filters.player_id - Filter by player
   * @param {number} filters.limit - Limit results (default: 100)
   * @param {number} filters.offset - Offset for pagination
   * @returns {Promise<Array>} - Array of error logs
   */
  async getErrorLogs(filters = {}) {
    method = 'getErrorLogs';

    try {
      const {
        severity,
        era_id,
        player_id,
        limit = 100,
        offset = 0
      } = filters;

      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (severity) {
        query = query.eq('severity', severity);
      }

      if (era_id) {
        query = query.eq('era_id', era_id);
      }

      if (player_id) {
        query = query.eq('player_id', player_id);
      }

      const { data, error } = await query;

      if (error) {
        this.logerror('Failed to fetch error logs:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      this.logerror('Exception fetching error logs:', err);
      return [];
    }
  }

  /**
   * Get error statistics
   * @returns {Promise<object>} - Error statistics
   */
  async getErrorStats() {
    method = 'getErrorStats';

    try {
      // Get total counts by severity
      const { data: criticalCount } = await supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('severity', 'critical');

      const { data: summaryCount } = await supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('severity', 'summary');

      // Get recent errors (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: recentCount } = await supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

      return {
        totalCritical: criticalCount?.length || 0,
        totalSummaries: summaryCount?.length || 0,
        recentErrors: recentCount?.length || 0
      };
    } catch (err) {
      this.logerror('Exception fetching error stats:', err);
      return {
        totalCritical: 0,
        totalSummaries: 0,
        recentErrors: 0
      };
    }
  }
}

// Export singleton instance
const errorLogService = new ErrorLogService();
export default errorLogService;

// EOF

