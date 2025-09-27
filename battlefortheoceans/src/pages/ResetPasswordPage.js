// src/pages/ResetPasswordPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const version = 'v0.1.1';

const ResetPasswordPage = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidTokens, setHasValidTokens] = useState(false);

  useEffect(() => {
    // Check for recovery tokens in URL fragment
    const checkRecoveryTokens = async () => {
      console.log(version, 'Checking URL for recovery tokens...');
      
      // Get tokens from URL fragment (after #)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const tokenType = hashParams.get('type');
      
      console.log(version, 'Token type found:', tokenType);
      
      if (accessToken && refreshToken && tokenType === 'recovery') {
        console.log(version, 'Valid recovery tokens found');
        
        try {
          // Set the session with the recovery tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error(version, 'Error setting session:', error);
            setError('Invalid or expired reset link. Please request a new password reset.');
          } else {
            console.log(version, 'Recovery session established:', data.user?.email);
            setHasValidTokens(true);
          }
        } catch (err) {
          console.error(version, 'Session setup failed:', err);
          setError('Failed to verify reset link. Please try again.');
        }
      } else {
        console.log(version, 'No valid recovery tokens found');
        setError('Invalid reset link. Please request a new password reset from the login page.');
      }
    };
    
    checkRecoveryTokens();
  }, []);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(version, 'Updating user password...');
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        console.error(version, 'Password update failed:', error);
        setError(error.message || 'Failed to update password. Please try again.');
      } else {
        console.log(version, 'Password updated successfully');
        setSuccess(true);
        
        // Clear the URL fragments for security
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err) {
      console.error(version, 'Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToLogin = () => {
    // Navigate back to homepage/login
    window.location.href = '/';
  };

  if (success) {
    return (
      <div className="page-base">
        <div className="page-content">
          <div className="content-frame">
            <div className="reset-success">
              <div className="page-header">
                <h2>Password Reset Successful!</h2>
              </div>
              <div className="success-message">
                <p>Your password has been updated successfully.</p>
                <p>You can now log in with your new password.</p>
              </div>
              <button
                className="btn btn-primary btn-large"
                onClick={handleBackToLogin}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasValidTokens) {
    return (
      <div className="page-base">
        <div className="page-content">
          <div className="content-frame">
            <div className="reset-error">
              <div className="page-header">
                <h2>Invalid Reset Link</h2>
              </div>
              <div className="error-message">
                <p>{error || 'This password reset link is invalid or has expired.'}</p>
                <p>Please request a new password reset from the login page.</p>
              </div>
              <button
                className="btn btn-primary btn-large"
                onClick={handleBackToLogin}
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="reset-password-form">
            <div className="page-header">
              <h2>Set New Password</h2>
              <p>Enter your new password below</p>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordReset}>
              <div className="form-group password-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  className="input input-primary"
                  type={showPassword ? 'text' : 'password'}
                  name="new-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={6}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  className="input input-primary"
                  type={showPassword ? 'text' : 'password'}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary btn-large"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating Password...' : 'Update Password'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

// EOF
