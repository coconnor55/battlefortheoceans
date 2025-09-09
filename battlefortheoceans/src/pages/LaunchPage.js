// src/pages/LaunchPage.js
// Copyright(c) 2025, Clint H. O'Connor

import BackgroundVideo from '../components/BackgroundVideo';
import { useGame } from '../context/GameContext';
import './LaunchPage.css';

const version = 'v0.1.5'
const LaunchPage = () => {
  const { dispatch, stateMachine } = useGame();

  const handleCloseDialog = () => {
    if (dispatch) {
      console.log(version, 'Firing LOGIN event from handleCloseDialog');
      dispatch(stateMachine.event.LOGIN);
    } else {
      console.error(version, 'Dispatch is not available in handleCloseDialog');
    }
  };

  return (
    <div className="launch-page">
      <BackgroundVideo />
      <h1>Battle for the Oceans</h1>
      <button onClick={handleCloseDialog}>Play Game</button>
    </div>
  );
};

export default LaunchPage;

// EOF - EOF - EOF
