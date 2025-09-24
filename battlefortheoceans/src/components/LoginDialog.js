// src/components/LoginDialog.js (v0.1.31)
// Copyright(c) 2025, Clint H. O'Connor

import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import '../pages/Pages.css';
import '../pages/LoginPage.css';

const version = 'v0.1.31';

const LoginDialog = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    console.log(`${version}: Attempting user login with email:`, email);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
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

  const handleGuest = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.REACT_APP_GUEST_EMAIL,
      password: process.env.REACT_APP_GUEST_PASSWORD,
    });
    console.log('Login with:', data.session);
    if (error) {
      setError(error.message);
    } else {
      console.log('Guest logged in:', data.user);
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
        <h2>Login</h2>
      </div>
      {error && <p className="error-message">{error}</p>}
      <form onSubmit={handleLogin}>
        <input className='input input-primary' type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className='input input-primary' type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button className='btn btn-primary' onClick={handleLogin}>Login</button>
        <button className='btn btn-primary' onClick={handleSignUp}>Sign Up</button>
      </form>
      <button className='btn btn-primary' onClick={handleGuest}>Play as Guest</button>
    </div>
  );
};

export default LoginDialog;

// EOF - EOF - EOF
