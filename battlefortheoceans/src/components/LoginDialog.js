// src/components/LoginDialog.js (v0.1.32)
// Copyright(c) 2025, Clint H. O'Connor

import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import '../pages/Pages.css';
import '../pages/LoginPage.css';

const version = 'v0.1.34';

const LoginDialog = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [loginAttempted, setLoginAttempted] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    console.log(`${version}: Attempting user login with email:`, email);
    setLoginAttempted(true);
    
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Account not found or incorrect password. Would you like to sign up instead?');
      } else {
        setError(error.message);
      }
    } else {
      console.log('Login successful, user:', data.user);
      
      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        setError('Please confirm your email address before logging in. Check your inbox for a confirmation link.');
        return;
      }
      
      // Pass user data back to LoginPage
      onClose(data.user);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    console.log(`${version}: Attempting user signup with email:`, email);
    const { error, data } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      setError(error.message);
    } else {
      console.log('Sign-up successful, user:', data.user);
      
      // Check if email confirmation is required
      if (data.user && !data.user.email_confirmed_at) {
        console.log(`${version}: Email confirmation required for:`, email);
        setPendingConfirmation(true);
        setError(null);
        return;
      }
      
      // If email is already confirmed (shouldn't happen on signup), proceed
      onClose(data.user);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    // Redirect to homepage after password reset completion
    const redirectUrl = process.env.NODE_ENV === 'production'
      ? 'https://battlefortheoceans.com'
      : window.location.origin;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    if (error) {
      setError(error.message);
    } else {
      setError('Password reset email sent. Please check your inbox.');
    }
  };

  const handleGuest = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.REACT_APP_GUEST_EMAIL,
      password: process.env.REACT_APP_GUEST_PASSWORD,
    });
    
    if (error) {
      setError(error.message);
    } else {
      console.log('Guest logged in:', data.user);
      onClose(data.user);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email
    });
    
    if (error) {
      setError(error.message);
    } else {
      setError('Confirmation email resent. Please check your inbox.');
    }
  };

  const handleBackToLogin = () => {
    setPendingConfirmation(false);
    setMode('login');
    setError(null);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const switchToSignup = () => {
    setMode('signup');
    setError(null);
    setLoginAttempted(false);
  };

  const switchToLogin = () => {
    setMode('login');
    setError(null);
  };

  const switchToForgot = () => {
    setMode('forgot');
    setError(null);
  };

  if (pendingConfirmation) {
    return (
      <div className="login-dialog">
        <div className="page-header">
          <h2>Confirm Your Email</h2>
        </div>
        <div className="email-confirmation-message">
          <p><strong>Almost there!</strong></p>
          <p>We've sent a confirmation email to:</p>
          <p className="email-address"><strong>{email}</strong></p>
          <p>Please check your inbox and click the confirmation link to activate your account.</p>
          <p className="help-text">
            Don't see the email? Check your spam folder or click below to resend.
          </p>
        </div>
        {error && <p className="error-message">{error}</p>}
        <div className="confirmation-actions">
          <button className='btn btn-secondary' onClick={handleResendConfirmation}>
            Resend Confirmation Email
          </button>
          <button className='btn btn-primary' onClick={handleBackToLogin}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-dialog">
      <div className="page-header">
        <h2>
          {mode === 'login' && 'Login'}
          {mode === 'signup' && 'Sign Up'}
          {mode === 'forgot' && 'Reset Password'}
        </h2>
      </div>
      
      {error && (
        <div className="error-section">
          <p className="error-message">{error}</p>
          {mode === 'login' && loginAttempted && error.includes('Account not found') && (
            <button className='btn btn-secondary btn-small' onClick={switchToSignup}>
              Sign Up Instead
            </button>
          )}
        </div>
      )}
      
      <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignUp : handleForgotPassword}>
        <div className="form-group">
          <input
            className='input input-primary'
            type="email"
            name="email"
            autoComplete="username email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            required
          />
        </div>
        
        {mode !== 'forgot' && (
          <div className="form-group password-group">
            <input
              className='input input-primary'
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              minLength={mode === 'signup' ? 6 : undefined}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '🙈'}
            </button>
          </div>
        )}
        
        <div className="form-actions">
          {mode === 'login' && (
            <>
              <button className='btn btn-primary' type="submit">Login</button>
              <div className="auth-links">
                <button type="button" className='link-button' onClick={switchToSignup}>
                  Don't have an account? Sign up
                </button>
                <button type="button" className='link-button' onClick={switchToForgot}>
                  Forgot password?
                </button>
              </div>
            </>
          )}
          
          {mode === 'signup' && (
            <>
              <button className='btn btn-primary' type="submit">Create Account</button>
              <div className="auth-links">
                <button type="button" className='link-button' onClick={switchToLogin}>
                  Already have an account? Login
                </button>
              </div>
            </>
          )}
          
          {mode === 'forgot' && (
            <>
              <button className='btn btn-primary' type="submit">Send Reset Email</button>
              <div className="auth-links">
                <button type="button" className='link-button' onClick={switchToLogin}>
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </form>
      
      {mode === 'login' && (
        <div className="guest-section">
          <div className="divider">
            <span>or</span>
          </div>
          <button className='btn btn-secondary' onClick={handleGuest}>
            Play as Guest
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginDialog;

// EOF
