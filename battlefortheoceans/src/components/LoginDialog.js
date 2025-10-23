// src/components/LoginDialog.js v0.1.43
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.43: Remove ?confirmed=true from emailRedirectTo URLs
//          - Let Supabase add hash fragment naturally (#access_token=...&type=signup)
//          - Query params interfere with hash capture in index.js
//          - Clean URLs enable proper flow: hash capture → LaunchPage → /email-confirmed
// v0.1.42: Add redirectTo URL for email confirmation with detection flag
//          - Set redirectTo with ?confirmed=true query param
//          - Tells Supabase where to redirect after confirmation
//          - Enables detection in LaunchPage
// v0.1.41: Better error handling for existing users during signup

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const version = 'v0.1.43';

const LoginDialog = ({ onClose, showSignup = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [mode, setMode] = useState(showSignup ? 'signup' : 'login');
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [userAlreadyExists, setUserAlreadyExists] = useState(false);

  useEffect(() => {
    if (showSignup) {
      setMode('signup');
    }
  }, [showSignup]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    console.log(`${version} Attempting user login with email:`, email);
    setLoginAttempted(true);
    
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Account not found or incorrect password. Would you like to sign up instead?');
      } else {
        setError(error.message);
      }
    } else {
      console.log(`${version} Login successful, user:`, data.user);
      
      if (!data.user.email_confirmed_at) {
        setError('Please confirm your email address before logging in. Check your inbox for a confirmation link.');
        return;
      }
      
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
    
    // Determine redirect URL - CLEAN, no query params
    const isProduction = window.location.hostname === 'battlefortheoceans.com' ||
                         window.location.hostname === 'www.battlefortheoceans.com';
    
    const redirectUrl = isProduction
      ? 'https://battlefortheoceans.com'
      : window.location.origin; // http://localhost:8888
    
    console.log(`${version} Attempting user signup with email:`, email);
    console.log(`${version} Redirect URL for confirmation:`, redirectUrl);
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    if (error) {
      if (error.message.includes('User already registered') ||
          error.message.includes('already been registered') ||
          error.status === 400) {
        console.log(`${version} User already exists:`, email);
        setError('This email is already registered. Would you like to login instead?');
        setUserAlreadyExists(true);
        return;
      }
      
      setError(error.message);
    } else {
      console.log(`${version} Sign-up successful, user:`, data.user);
      
      if (data.user && !data.user.email_confirmed_at) {
        console.log(`${version} Email confirmation required for:`, email);
        setPendingConfirmation(true);
        setError(null);
        return;
      }
      
      onClose(data.user);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    const isProduction = window.location.hostname === 'battlefortheoceans.com' ||
                         window.location.hostname === 'www.battlefortheoceans.com';
    
    const redirectUrl = isProduction
      ? 'https://battlefortheoceans.com'
      : window.location.origin;
    
    console.log(`${version} Forgot password redirect URL:`, redirectUrl);
    
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
    const guestId = `guest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    
    console.log(`${version} Playing as guest with ID:`, guestId);
    
    const guestUser = {
      id: guestId,
      email: null,
      user_metadata: {
        game_name: 'Guest'
      },
      app_metadata: {},
      created_at: new Date().toISOString()
    };
    
    onClose(guestUser);
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
    setUserAlreadyExists(false);
  };

  const switchToLogin = () => {
    setMode('login');
    setError(null);
    setUserAlreadyExists(false);
  };

  const switchToForgot = () => {
    setMode('forgot');
    setError(null);
    setUserAlreadyExists(false);
  };

  if (pendingConfirmation) {
    return (
      <div className="content-pane content-pane--narrow">
        <div className="card-header">
          <h2 className="card-title">Confirm Your Email</h2>
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
        {error && <p className="message message--error">{error}</p>}
        <div className="confirmation-actions">
          <button className="btn btn--secondary" onClick={handleResendConfirmation}>
            Resend Confirmation Email
          </button>
          <button className="btn btn--primary" onClick={handleBackToLogin}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content-pane content-pane--narrow">
      <div className="card-header">
        <h2 className="card-title">
          {mode === 'login' && 'Login'}
          {mode === 'signup' && 'Sign Up'}
          {mode === 'forgot' && 'Reset Password'}
        </h2>
      </div>
      
      {error && (
        <div className="error-section">
          <p className="message message--error">{error}</p>
          {mode === 'login' && loginAttempted && error.includes('Account not found') && (
            <button className="btn btn--secondary btn--sm" onClick={switchToSignup}>
              Sign Up Instead
            </button>
          )}
          {mode === 'signup' && userAlreadyExists && (
            <button className="btn btn--secondary btn--sm" onClick={switchToLogin}>
              Login Instead
            </button>
          )}
        </div>
      )}
      
      <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignUp : handleForgotPassword}>
        <div className="form-group">
          <input
            className="form-input"
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
              className="form-input"
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
              <button className="btn btn--primary" type="submit">Login</button>
              <div className="auth-links">
                <button type="button" className="link-button" onClick={switchToSignup}>
                  Don't have an account? Sign up
                </button>
                <button type="button" className="link-button" onClick={switchToForgot}>
                  Forgot password?
                </button>
              </div>
            </>
          )}
          
          {mode === 'signup' && (
            <>
              <button className="btn btn--primary" type="submit">Create Account</button>
              <div className="auth-links">
                <button type="button" className="link-button" onClick={switchToLogin}>
                  Already have an account? Login
                </button>
              </div>
            </>
          )}
          
          {mode === 'forgot' && (
            <>
              <button className="btn btn--primary" type="submit">Send Reset Email</button>
              <div className="auth-links">
                <button type="button" className="link-button" onClick={switchToLogin}>
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
          <button className="btn btn--primary" onClick={handleGuest}>
            Play as Guest
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginDialog;

// EOF
