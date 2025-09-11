// src/pages/LaunchPage.js
// Copyright(c) 2025, Clint H. O'Connor

import { useGame } from '../context/GameContext';
import './LaunchPage.css';

const version = 'v0.1.12';

const LaunchPage = () => {
  const { dispatch, stateMachine } = useGame();

  const handleCloseDialog = () => {
    if (dispatch) {
      console.log(version, 'LaunchPage', 'Firing LOGIN event from handleCloseDialog');
      dispatch(stateMachine.event.LOGIN);
    } else {
      console.error(version, 'LaunchPage', 'Dispatch is not available in handleCloseDialog');
    }
  };

  return (
      <div className="launch-page">
          <div className="launch-content">
                <button className="launch-button" onClick={handleCloseDialog}>Play Game</button>
          </div>
      </div>
    );
};

export default LaunchPage;

// EOF - EOF - EOF
