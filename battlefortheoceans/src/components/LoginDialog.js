// src/components/LoginDialog.js v0.1.43
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.43: Create and return Player objects instead of user/profile objects
//          - Import HumanPlayer and UserProfileService
//          - handleGuest: Create guest profile + HumanPlayer, return player
//          - handleLogin: Fetch profile + create HumanPlayer, return player
//          - Simplifies downstream flow: Login → Player object → CoreEngine
// v0.1.42: Fix welcome message to "Welcome back, {game_name}!"
// v0.1.41: Add welcome-back mode for returning users
//          - Accept existingUser and existingProfile props
//          - If profile exists → show "Welcome back" with Continue/Log Out
//          - Otherwise → normal login/signup/guest flow
//          - No "Play as Guest" in welcome mode (logout to access)
// v0.1.40: Prior version with full login/signup/forgot/guest functionality

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import HumanPlayer from '../classes/HumanPlayer';
import UserProfileService from '../services/UserProfileService';

const version = 'v0.1.43';

const LoginDialog = ({
  existingUser = null,
  existingProfile = null,
  onClose,
  onContinue,
  onLogout,
  showSignup = false
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [mode, setMode] = useState(showSignup ? 'signup' : 'login');
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Update mode if showSignup prop changes
  useEffect(() => {
    if (showSignup && !existingProfile) {
      setMode('signup');
    }
  }, [showSignup, existingProfile]);

  // WELCOME BACK MODE - Returning user with profile
  if (existingUser && existingProfile) {
    console.log(version, 'Rendering welcome-back mode for:', existingProfile.game_name);
    
    return (
      <div className="content-pane content-pane--narrow">
        <div className="card-header">
          <h2 className="card-title">Welcome back, {existingProfile.game_name}!</h2>
        </div>
        
        <div className="welcome-message">
          <p className="text-center text-muted">
            {existingUser.email}
          </p>
        </div>
        
        <div className="form-actions">
          <button
            className="btn btn--primary btn--lg"
            onClick={onContinue}
          >
            Continue Playing
          </button>
          
          <div className="mt-md">
            <button
              className="btn btn--secondary btn--full"
              onClick={onLogout}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // NORMAL MODE - New users or explicit login
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
      return;
    }
    
    console.log(`${version} Login successful, user:`, data.user);
    
    // Check if email is confirmed
    if (!data.user.email_confirmed_at) {
      setError('Please confirm your email address before logging in. Check your inbox for a confirmation link.');
      return;
    }
    
    try {
      // Fetch user profile from database
      console.log(`${version} Fetching profile for user:`, data.user.id);
      const userProfile = await UserProfileService.getUserProfile(data.user.id);
      
      if (!userProfile || !userProfile.game_name) {
        setError('Profile not found. Please contact support.');
        return;
      }
      
      console.log(`${version} Profile fetched:`, userProfile.game_name);
      
      // Create HumanPlayer with profile
      const player = new HumanPlayer(
        data.user.id,
        userProfile.game_name,
        'human',
        1.0,
        userProfile
      );
      
      console.log(`${version} HumanPlayer created:`, player.name);
      
      // Return Player object
      onClose(player);
    } catch (err) {
      console.error(`${version} Error creating player:`, err);
      setError('Failed to load profile. Please try again.');
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
    
    console.log(`${version} Attempting user signup with email:`, email);
    const { error, data } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      setError(error.message);
    } else {
      console.log(`${version} Sign-up successful, user:`, data.user);
      
      // Check if email confirmation is required
      if (data.user && !data.user.email_confirmed_at) {
        console.log(`${version} Email confirmation required for:`, email);
        setPendingConfirmation(true);
        setError(null);
        return;
      }
      
      // If email is already confirmed (shouldn't happen on signup), proceed
      // Note: User still needs ProfileCreationDialog - parent handles this
      onClose(data.user);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    // More reliable production detection
    const isProduction = window.location.hostname === 'battlefortheoceans.com' ||
                         window.location.hostname === 'www.battlefortheoceans.com';
    
    const redirectUrl = isProduction
      ? 'https://battlefortheoceans.com'
      : window.location.origin;
    
    console.log(`${version} Forgot password redirect URL:`, redirectUrl);
    console.log(`${version} Current hostname:`, window.location.hostname);
    console.log(`${version} Is production:`, isProduction);
    
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
    // Generate guest ID with timestamp and random string
    const guestId = `guest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    
    console.log(`${version} Playing as guest with ID:`, guestId);
    
    // Create guest profile (same structure as v0.6.10 CoreEngine)
    const guestProfile = {
      id: guestId,
      game_name: 'Guest',
      total_games: 0,
      total_wins: 0,
      total_score: 0,
      best_accuracy: 0,
      total_ships_sunk: 0,
      total_damage: 0
    };
    
    console.log(`${version} Guest profile created:`, guestProfile);
    
    // Create HumanPlayer with guest profile
    const guestPlayer = new HumanPlayer(
      guestId,
      'Guest',
      'human',
      1.0,
      guestProfile
    );
    
    console.log(`${version} Guest player created:`, guestPlayer.name);
    
    // Return Player object
    onClose(guestPlayer);
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
