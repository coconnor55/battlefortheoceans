// src/components/LoginPage.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

import React from 'react';
import './LoginPage.css';

const LoginPage = ({ onLogin, onSignUp, onGuest }) => (
  <div className="login-page">
    <input type="text" placeholder="Username" />
    <input type="password" placeholder="Password" />
    <button onClick={onLogin}>Login</button>
    <button onClick={onSignUp}>Sign Up</button>
    <button onClick={onGuest}>Play as Guest</button>
  </div>
);

export default LoginPage;

// EOF - EOF - EOF
