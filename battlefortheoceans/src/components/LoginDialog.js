// src/components/LoginDialog.js (v0.1.26)
// Copyright(c) 2025, Clint H. O'Connor

import { useState, useEffect, useContext } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';

const LoginDialog = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { stateMachine, dispatch } = useGame();
  const [guestChecked, setGuestChecked] = useState(false);

  useEffect(() => {
    if (!guestChecked) {
      const checkGuest = async () => {
        console.log('Checking guest user...');
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('is_guest', true)
          .maybeSingle(); // Use maybeSingle to handle 0 rows
        if (error) {
          console.error('Guest check error:', error);
          if (error.code !== 'PGRST116') setError(error.message); // Only set error for non-expected cases
        } else if (!data) {
          console.log('Creating guest user...');
          const { error: signUpError } = await supabase.auth.signUp({ email: 'guest@battlefortheoceans.com', password: 'guest123' });
          if (signUpError) console.error('Guest sign-up error:', signUpError);
          else {
            const { error: insertError } = await supabase.from('users').insert({ email: 'guest@battlefortheoceans.com', password_hash: '', is_guest: true });
            if (insertError) console.error('Guest insert error:', insertError);
          }
        }
        setGuestChecked(true);
      };
      checkGuest();
    }
  }, [guestChecked]);

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
      const { error: insertError } = await supabase.from('users').insert({ email, password_hash: '', is_guest: false });
      if (insertError) setError(insertError.message);
      else {
        console.log('Sign-up successful, session:', data.session);
        dispatch(stateMachine.event.SELECTERA);
        onClose();
      }
    }
  };

  const handleGuest = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: 'guest@battlefortheoceans.com', password: 'guest123' });
    if (error) setError(error.message);
    else {
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
