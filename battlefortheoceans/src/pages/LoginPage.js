// src/pages/LoginPage.js
// Copyright(c) 2025, Clint H. O'Connor

import { useGame } from '../context/GameContext';
import LoginDialog from '../components/LoginDialog';
import './LoginPage.css';

const version = 'v0.1.35';

const LoginPage = () => {
  const { dispatch, stateMachine, updateHumanPlayer } = useGame();
  
  const handleCloseDialog = (userData = null) => {
    // Store player data in GameContext if provided
    if (userData) {
      updateHumanPlayer(userData);
      console.log(version, 'HumanPlayer instance created in GameContext:', userData.id);
    }
    
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

// EOF
