// src/components/LoginDialog.js (v0.1.30)
// Copyright(c) 2025, Clint H. O'Connor

import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import '../pages/Pages.css';
import '../pages/LoginPage.css';

const version = 'v0.1.30';

const LoginDialog = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

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
      // Pass user data back to LoginPage
      onClose(data.user);
    }
  };

  return (
    <div className="login-dialog">
      <div className="page-header">
        <h2>Login</h2>
      </div>
      {error && <p>{error}</p>}
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
