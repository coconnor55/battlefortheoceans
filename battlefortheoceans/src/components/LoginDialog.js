// src/components/LoginDialog.js (v0.1.23)
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useContext } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext'; // Updated to useGame hook

const LoginDialog = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { dispatch } = useGame();

  useEffect(() => {
    const checkGuest = async () => {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('is_guest', true)
        .single();
      if (!data) {
        await supabase.auth.signUp({ email: 'guest@battlefortheoceans.com', password: 'guest123' });
        await supabase.from('users').insert({ email: 'guest@battlefortheoceans.com', password_hash: '', is_guest: true });
      }
    };
    checkGuest();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else {
      dispatch({ type: 'X-SELECTERA' });
      onClose();
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else {
      await supabase.from('users').insert({ email, password_hash: '', is_guest: false });
      dispatch({ type: 'X-SELECTERA' });
      onClose();
    }
  };

  const handleGuest = async () => {
    await supabase.auth.signInWithPassword({ email: 'guest@battlefortheoceans.com', password: 'guest123' });
    dispatch({ type: 'X-SELECTERA' });
    onClose();
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
