// src/pages/LoginPage.js (v0.1.34)
// Copyright(c) 2025, Clint H. O'Connor

import { useGame } from '../context/GameContext';
import LoginDialog from '../components/LoginDialog';
import './LoginPage.css';

const version = 'v0.1.34';

const LoginPage = () => {
  const { dispatch, stateMachine, updatePlayer } = useGame();
  
  const handleCloseDialog = (userData = null) => {
    // Store player data in GameContext if provided
    if (userData) {
      updatePlayer(userData);
      console.log(version, 'Player data stored in GameContext:', userData.id);
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

// EOF - EOF - EOF
