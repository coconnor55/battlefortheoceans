import { useState } from 'react';
import LoginDialog from './components/LoginDialog';

const LoginPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(true);

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  return (
    <div className="login-page">
      <h1>Battle for the Oceans - Login</h1>
      {isDialogOpen && <LoginDialog onClose={handleCloseDialog} />}
      <button onClick={() => setIsDialogOpen(true)}>Open Login</button>
    </div>
  );
};

export default LoginPage;
