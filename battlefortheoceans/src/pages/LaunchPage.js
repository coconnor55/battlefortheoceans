// src/pages/LaunchPage.js
// Copyright(c) 2025, Clint H. O'Connor

import { useGame } from '../context/GameContext';

const version = 'v0.3.3';

const LaunchPage = () => {
  const { dispatch, events } = useGame();

  const handleCloseDialog = () => {
    if (dispatch) {
      console.log(version, 'LaunchPage', 'Firing LOGIN event from handleCloseDialog');
      dispatch(events.LOGIN);
    } else {
      console.error(version, 'LaunchPage', 'Dispatch is not available in handleCloseDialog');
    }
  };

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--narrow">
        <div className="card-header">
          <h1 className="card-title">Battle for the Oceans</h1>
          <p className="card-subtitle">Strategic Naval Combat</p>
        </div>
        <div className="card-body flex flex-center">
          <button
            className="btn btn--primary btn--lg"
            onClick={handleCloseDialog}
          >
            Play Game
          </button>
          </div>
        <div className="card-footer">
        </div>
      </div>
    </div>
  );
};

export default LaunchPage;

// EOF
