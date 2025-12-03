// src/components/ErrorConsole.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Error Console component for admin/developer review
//         - Displays error logs from Supabase
//         - Filterable by severity, era, player
//         - Shows error details and statistics

import React, { useState, useEffect } from 'react';
import errorLogService from '../services/ErrorLogService';
import { Filter, RefreshCw, AlertCircle, FileText } from 'lucide-react';

const version = 'v0.1.0';
const tag = "CONSOLE";
const module = "ErrorConsole";

const ErrorConsole = ({ onClose }) => {
  const [errorLogs, setErrorLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCritical: 0, totalSummaries: 0, recentErrors: 0 });
  const [filters, setFilters] = useState({
    severity: '',
    era_id: '',
    player_id: '',
    limit: 100
  });
  const [selectedError, setSelectedError] = useState(null);

  useEffect(() => {
    loadErrorLogs();
    loadStats();
  }, [filters]);

  const loadErrorLogs = async () => {
    setLoading(true);
    try {
      const logs = await errorLogService.getErrorLogs(filters);
      setErrorLogs(logs);
    } catch (error) {
      console.error(`[${tag}] ${version} ${module}.loadErrorLogs:`, error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const errorStats = await errorLogService.getErrorStats();
      setStats(errorStats);
    } catch (error) {
      console.error(`[${tag}] ${version} ${module}.loadStats:`, error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRefresh = () => {
    loadErrorLogs();
    loadStats();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="content-pane content-pane--wide" onClick={(e) => e.stopPropagation()}>
        <div className="card-header card-header--with-close">
          <h1 className="card-title">Error Console</h1>
          {onClose && (
            <button className="btn btn--secondary btn--sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className="card-body">
          {/* Statistics */}
          <div className="stats-grid">
            <div className="card error-console-stat-card">
              <div className="error-console-stat-item">
                <AlertCircle size={20} color="var(--error)" />
                <div>
                  <div className="error-console-stat-label">Critical Errors</div>
                  <div className="error-console-stat-value">{stats.totalCritical}</div>
                </div>
              </div>
            </div>
            <div className="card error-console-stat-card">
              <div className="error-console-stat-item">
                <FileText size={20} color="var(--warning)" />
                <div>
                  <div className="error-console-stat-label">Error Summaries</div>
                  <div className="error-console-stat-value">{stats.totalSummaries}</div>
                </div>
              </div>
            </div>
            <div className="card error-console-stat-card">
              <div className="error-console-stat-item">
                <RefreshCw size={20} color="var(--info)" />
                <div>
                  <div className="error-console-stat-label">Last 24 Hours</div>
                  <div className="error-console-stat-value">{stats.recentErrors}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="error-console-filters">
            <div className="item-details">
              <Filter size={16} />
              <span className="error-console-filter-label-text">Filters:</span>
            </div>
            <select
              className="error-console-filter-input"
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="summary">Summary</option>
            </select>
            <input
              type="text"
              className="error-console-filter-input"
              placeholder="Era ID"
              value={filters.era_id}
              onChange={(e) => handleFilterChange('era_id', e.target.value)}
            />
            <input
              type="text"
              className="error-console-filter-input"
              placeholder="Player ID"
              value={filters.player_id}
              onChange={(e) => handleFilterChange('player_id', e.target.value)}
            />
            <button
              className="btn btn--secondary"
              onClick={handleRefresh}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            </div>

          {/* Error Logs Table */}
          {loading ? (
            <div className="loading-container">
              <RefreshCw size={32} className="spinning" />
              <p>Loading error logs...</p>
            </div>
          ) : errorLogs.length === 0 ? (
            <div className="empty-state">
              <p>No error logs found.</p>
            </div>
          ) : (
            <div className="leaderboard-table">
              <table className="table error-console-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Severity</th>
                    <th>Error</th>
                    <th>Game ID</th>
                    <th>Era</th>
                    <th>Player</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {errorLogs.map((log) => (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedError(log)}
                    >
                      <td>{formatDate(log.created_at)}</td>
                      <td>
                        <span className={log.severity === 'critical' ? 'error-console-severity-critical' : 'error-console-severity-summary'}>
                          {log.severity}
                        </span>
                      </td>
                      <td>
                        {log.error_name || 'N/A'}: {log.error_message?.substring(0, 50) || 'N/A'}...
                      </td>
                      <td className="error-console-table-cell-monospace">
                        {log.game_id?.substring(0, 8) || 'N/A'}
                      </td>
                      <td>{log.era_id || 'N/A'}</td>
                      <td className="error-console-table-cell-monospace">
                        {log.player_id?.substring(0, 8) || 'N/A'}
                      </td>
                      <td>
                        <button
                          className="btn btn--small btn--secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedError(log);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Error Detail Modal */}
        {selectedError && (
          <div 
            className="modal-overlay error-console-detail-modal"
            onClick={() => setSelectedError(null)}
          >
            <div 
              className="content-pane content-pane--narrow" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header card-header--with-close">
                <h2 className="card-title">Error Details</h2>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => setSelectedError(null)}
                >
                  ✕
                </button>
              </div>
              <div className="card-body">
                <div className="stat-row">
                  <strong>Severity:</strong> <span className={selectedError.severity === 'critical' ? 'error-console-severity-critical' : 'error-console-severity-summary'}>{selectedError.severity}</span>
                </div>
                <div className="stat-row">
                  <strong>Time:</strong> {formatDate(selectedError.created_at)}
                </div>
                <div className="stat-row">
                  <strong>Error Name:</strong> {selectedError.error_name || 'N/A'}
                </div>
                <div className="error-console-detail-section">
                  <strong>Error Message:</strong>
                  <pre className="error-console-detail-code">
                    {selectedError.error_message || 'N/A'}
                  </pre>
                </div>
                {selectedError.error_stack && (
                  <div className="error-console-detail-section">
                    <strong>Stack Trace:</strong>
                    <pre className="error-console-detail-stack">
                      {selectedError.error_stack}
                    </pre>
                  </div>
                )}
                {selectedError.total_errors && (
                  <div className="stat-row">
                    <strong>Total Errors:</strong> {selectedError.total_errors}
                  </div>
                )}
                {selectedError.error_types && (
                  <div className="error-console-detail-section">
                    <strong>Error Types:</strong>
                    <pre className="error-console-detail-code">
                      {JSON.stringify(selectedError.error_types, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="stat-row">
                  <strong>Game ID:</strong> {selectedError.game_id || 'N/A'}
                </div>
                <div className="stat-row">
                  <strong>Player ID:</strong> {selectedError.player_id || 'N/A'}
                </div>
                <div className="stat-row">
                  <strong>Era ID:</strong> {selectedError.era_id || 'N/A'}
                </div>
                <div className="stat-row">
                  <strong>Opponent:</strong> {selectedError.opponent_name || 'N/A'}
                </div>
                {selectedError.error_context && (
                  <div className="error-console-detail-section">
                    <strong>Context:</strong>
                    <pre className="error-console-detail-code">
                      {JSON.stringify(selectedError.error_context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <div className="card-footer">
                <button
                  className="btn btn--primary"
                  onClick={() => setSelectedError(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorConsole;

// EOF

