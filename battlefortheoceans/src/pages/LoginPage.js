// src/pages/LoginPage.js
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED - do not modify

import { useState } from 'react';
import { useGame } from '../context/GameContext';
import LoginDialog from '../components/LoginDialog';
import './LoginPage.css';

const version = 'v0.1.32'

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
          <div className="login-content">
            <LoginDialog onClose={handleCloseDialog} />
          </div>
    </div>
  );
};

export default LoginPage;
// EOF - EOF - EOF
