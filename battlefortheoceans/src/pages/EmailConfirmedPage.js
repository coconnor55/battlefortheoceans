// src/pages/EmailConfirmedPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial implementation - email confirmation success page
//         Shows success message with "Next" button (no auto-redirect timer)
//         Redirected here by index.js after hash capture

import React from 'react';
import { useNavigate } from 'react-router-dom';

const version = 'v0.1.0';

const EmailConfirmedPage = () => {
  const navigate = useNavigate();

  const handleNext = () => {
    console.log(version, 'User clicked Next, proceeding to login');
    navigate('/login');
  };

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--narrow">
        <div className="text-center">
          <div className="success-icon" style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--color-success)' }}>
            ✓
          </div>
          
          <h1 className="mb-md">Email Confirmed!</h1>
          
          <p className="mb-lg">
            Your email has been successfully verified. You can now sign in and choose your game handle to start playing.
          </p>
          
          <button
            className="btn btn--primary btn--lg"
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmedPage;

// EOF
