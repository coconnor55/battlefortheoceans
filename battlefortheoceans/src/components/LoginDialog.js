// src/components/LoginDialog.js
// Copyright(c) 2025, Clint H. O’Connor
// LOCKED: Do not modify without confirmation

import { useState, useContext } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';

const version = 'v0.1.28'
const LoginDialog = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { stateMachine, dispatch, setPlayerId } = useGame();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    console.log(`${version}: Attempting user login with email:', ${email}`);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else {
      console.log('Login successful, user:', data.user);
      setPlayerId(data.user.id); // Persist player ID
      dispatch(stateMachine.event.SELECTERA);
      onClose();
    }
  };

  const handleGuest = async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: process.env.REACT_APP_GUEST_EMAIL,
        password: process.env.REACT_APP_GUEST_PASSWORD, // If set post-creation
      });
      console.log('Login with:', data.session);
      if (error) setError(error.message);
      else {
          console.log('Guest logged in:', data.user);
          setPlayerId(data.user.id); // Persist player ID
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
      console.log(`${version}: Attempting user signup with email:', ${email}`);
      const { error, data } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
          console.log('Sign-up successful, user:', data.user);
          setPlayerId(data.user.id); // Persist player ID
          dispatch(stateMachine.event.SELECTERA);
          onClose();
      }
    };

  return (
    <div className="login-dialog">
      <h2>Login</h2>
      {error && <p>{error}</p>}
      <form onSubmit={handleLogin}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button className='login-dialog-login' onClick={handleLogin}>Login</button>
        <button className='login-dialog-signup' onClick={handleSignUp}>Sign Up</button>
      </form>
      <button className='login-dialog-guest' onClick={handleGuest}>Play as Guest</button>
    </div>
  );
};

export default LoginDialog;

// EOF - EOF - EOF
