// src/pages/LaunchPage.js
// Copyright(c) 2025, Clint H. O'Connor

import { useGame } from '../context/GameContext';
import './Pages.css';
import './LaunchPage.css';

const version = 'v0.1.14';

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
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="page-header">
            <h1>Battle for the Oceans</h1>
            <p>Strategic Naval Combat</p>
          </div>
          
          <button
            className="btn btn-primary btn-large"
            onClick={handleCloseDialog}
          >
            Play Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default LaunchPage;

// EOF
