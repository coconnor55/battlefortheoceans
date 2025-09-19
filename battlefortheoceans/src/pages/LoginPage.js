// src/pages/LoginPage.js
// Copyright(c) 2025, Clint H. O'Connor

import { useGame } from '../context/GameContext';
import LoginDialog from '../components/LoginDialog';
import './Pages.css';
import './LoginPage.css';

const version = 'v0.1.38';

const LoginPage = () => {
  const { dispatch, stateMachine } = useGame();
  
  const handleCloseDialog = (userData = null) => {
    if (userData) {
      console.log(version, 'User authenticated, transitioning with user data:', userData.id);
      
      // Pass user data directly to dispatch for immediate business logic processing
      dispatch(stateMachine.event.SELECTERA, { userData });
    } else {
      console.log(version, 'Dialog closed without authentication');
    }
  };

  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <LoginDialog onClose={handleCloseDialog} />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

// EOF
