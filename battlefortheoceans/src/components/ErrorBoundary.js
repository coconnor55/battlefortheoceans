// src/components/ErrorBoundary.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: React Error Boundary to catch and handle component errors gracefully
//         - Catches errors in component tree during rendering, lifecycle methods, and constructors
//         - Displays user-friendly error message with option to reload
//         - Logs error details for debugging

import React from 'react';

const version = 'v0.1.0';
const tag = "ERRORBOUNDARY";
const module = "ErrorBoundary";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error(`[${tag}] ${version} ${module}.componentDidCatch:`, error, errorInfo);
    
    // Store error details in state for display
    this.setState({
      error,
      errorInfo
    });

    // Error is already logged to console.error above
    // In production, you might want to send error to error reporting service here
    // Example: errorReportingService.logError(error, errorInfo);
  }

  handleReload = () => {
    // Clear error state and reload page
    window.location.reload();
  };

  handleReset = () => {
    // Reset error boundary state (may not work if error persists)
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="error-boundary">
          <div className="content-pane content-pane--narrow" style={{ margin: '2rem auto', maxWidth: '600px' }}>
            <div className="card-header">
              <h1 className="card-title text-center" style={{ color: 'var(--error)' }}>
                ⚠️ Something Went Wrong
              </h1>
            </div>
            <div className="card-body">
              <p className="message message--error">
                We're sorry, but something unexpected happened. The game encountered an error and couldn't continue.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-dark)', borderRadius: 'var(--border-radius-sm)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Error Details (Development Only)
                  </summary>
                  <pre style={{ 
                    fontSize: '0.75rem', 
                    overflow: 'auto', 
                    maxHeight: '300px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="card-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  className="btn btn--primary"
                  onClick={this.handleReload}
                >
                  Reload Game
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    className="btn btn--secondary"
                    onClick={this.handleReset}
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Render children normally if no error
    return this.props.children;
  }
}

export default ErrorBoundary;

