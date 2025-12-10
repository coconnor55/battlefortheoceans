// src/pages/EmailConfirmedPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Check if user needs profile creation after confirmation
//         - If user has session but no profile, proceed to profile creation
//         - Otherwise, proceed to login
// v0.1.0: Initial implementation - email confirmation success page
//         Shows success message with "Next" button (no auto-redirect timer)
//         Redirected here by index.js after hash capture

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import PlayerProfileService from '../services/PlayerProfileService';

const version = 'v0.1.1';

const EmailConfirmedPage = () => {
  const navigate = useNavigate();
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Check if user has profile
          const profileData = await PlayerProfileService.getPlayerProfile(session.user.id);
          
          if (!profileData || !profileData.game_name) {
            // No profile - will proceed to profile creation
            setCheckingProfile(false);
          } else {
            // Has profile - will proceed to login
            setCheckingProfile(false);
          }
        } else {
          setCheckingProfile(false);
        }
      } catch (error) {
        console.error('[EMAIL_CONFIRMED] Error checking profile:', error);
        setCheckingProfile(false);
      }
    };
    
    checkProfile();
  }, []);

  const handleNext = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Check if user has profile
        const profileData = await PlayerProfileService.getPlayerProfile(session.user.id);
        
        if (!profileData || !profileData.game_name) {
          // No profile - proceed to profile creation
          // Use window.location to ensure document.referrer is set
          console.log(version, 'User clicked Next, proceeding to profile creation');
          window.location.href = '/login';
        } else {
          // Has profile - proceed to login
          console.log(version, 'User clicked Next, proceeding to login');
          navigate('/login');
        }
      } else {
        // No session - proceed to login
    console.log(version, 'User clicked Next, proceeding to login');
    navigate('/login');
      }
    } catch (error) {
      console.error('[EMAIL_CONFIRMED] Error in handleNext:', error);
      navigate('/login');
    }
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
            Your email has been successfully verified. {checkingProfile ? 'Setting up your account...' : 'You can now choose your game handle to start playing.'}
          </p>
          
          {!checkingProfile && (
          <button
            className="btn btn--primary btn--lg"
            onClick={handleNext}
          >
            Next
          </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmedPage;

// EOF
