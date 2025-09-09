// src/pages/LoginPage.js
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED - do not modify

import BackgroundVideo from '../components/BackgroundVideo';
import { useState } from 'react';
import LoginDialog from '../components/LoginDialog';
import { useGame } from '../context/GameContext';
import './LoginPage.css';

const version = 'v0.1.4'

const LoginPage = () => {
    const { dispatch, stateMachine } = useGame();

    const handleCloseDialog = () => {
      if (dispatch) {
        console.log(version, 'Firing SELECTERA event from handleCloseDialog');
        dispatch(stateMachine.event.SELECTERA);
      } else {
        console.error(version, 'Dispatch is not available in handleCloseDialog');
      }
    };

  return (
    <div className="login-page">
    <BackgroundVideo />
    <h1>Battle for the Oceans - Login</h1>
      <LoginDialog onClose={handleCloseDialog} />
    </div>
  );
};

export default LoginPage;
// EOF - EOF - EOF
