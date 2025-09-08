// src/components/LoginDialog.js (v0.1.28)
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useContext } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';

// LOCKED: Do not modify without confirmation

const LoginDialog = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { stateMachine, dispatch } = useGame();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else {
      console.log('Login successful, session:', data.session);
      dispatch(stateMachine.event.SELECTERA);
      onClose();
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    const { error, data } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else {
      const { error: insertError } = await supabase.from('users').insert({ email, password_hash: '', is_guest: false, username: email.split('@')[0] });
      if (insertError) setError(insertError.message);
      else {
        console.log('Sign-up successful, session:', data.session);
        dispatch(stateMachine.event.SELECTERA);
        onClose();
      }
    }
  };

  const handleGuest = async () => {
    // Temporary bypass: Use user_id to trigger transition without authentication
    console.log('Using guest user_id for temporary bypass');
    dispatch(stateMachine.event.SELECTERA); // Fire transition directly
    onClose(); // Exit dialog
  };

  return (
    <div className="login-dialog">
      <h2>Login</h2>
      {error && <p>{error}</p>}
      <form onSubmit={handleLogin}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button type="submit">Login</button>
      </form>
      <button onClick={handleSignUp}>Sign Up</button>
      <button onClick={handleGuest}>Play as Guest</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default LoginDialog;

// EOF - EOF - EOF
