// src/components/NavBar.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.21: Added Fullscreen toggle option under Help menu
//          - Toggles fullscreen mode on/off
//          - Shows "Fullscreen (Esc)" label
//          - Listens for Escape key to exit fullscreen
// v0.2.20: Add voucher balance display and fix pass singular/plural
//          - Added voucher balance fetching and display
//          - Fixed "Passes" to "Pass" when singular
//          - Use Coins icon for passes, Diamond icon for vouchers
//          - Show vouchers to the right of passes
// v0.2.19: Fix pass balance not updating immediately after credit/consume
//          - Refresh pass balance when CoreEngine notifies subscribers
//          - Use useCallback to stabilize fetchPassBalance function
//          - Ensures passes are reflected immediately in NavBar after operations
// v0.2.18: Pass location to App for help positioning
// v0.2.17: Added *Add 3 Passes menu item for admins/developers/testers
//          - Menu item between Help and Test
//          - Creates 3 admin passes via RightsService
//          - Refreshes pass balance after creation
//          - Uses Coins icon from lucide-react
//          - Only visible to admins, developers, and testers
// v0.2.16: Fixed pass balance refresh and logging
//          - Removed passBalance from useEffect dependencies (was causing infinite loop)
//          - Added currentState to dependencies to refresh on state changes
//          - Move balance log inside fetchPassBalance for accurate value
//          - Updated logging to match new pattern (tag, module, method)
// v0.2.15: Various changes
// v0.2.14: Restricted Test menu item to admins and developers only
//          - Check playerProfile.role for 'admin' or 'developer'
//          - Test only visible to authorized users
// v0.2.13: Added Test menu item to user dropdown
//          - Test appears between Help and Logout
//          - Calls onShowTest prop
//          - Uses TestTube icon from lucide-react
//          - Available to all users (will add admin check later if needed)
// v0.2.12: Import TestSuite (removed - not needed in NavBar)
// v0.2.11: Added About {Era} button to center navigation
//          - Shows "About {eraName}" button when era is selected
//          - Positioned before Stats and Achievements
//          - Calls onShowAbout prop
//          - Only visible when eraConfig is available
// v0.2.10: Added Help menu item to user dropdown
//          - Help appears between username header and Logout
//          - Calls onShowHelp prop to trigger GameGuide in App.js
//          - GameGuide centralized at App level, not page level
// v0.2.9: Added user menu dropdown with logout functionality
//         - Click username to show dropdown menu
//         - Menu shows username header + Logout button
//         - Logout calls CoreEngine.logout() → returns to LaunchPage
//         - Close on backdrop click or after logout
//         - Uses action menu styling from game-ui.css
// v0.2.8: Enabled Stats button
// v0.2.7: Show Return to Game for all states when overlay is active
// v0.2.6: Only show Return to Game button when overlay is active

import React, { useEffect, useState, useRef, useCallback } from 'react';
import RightsService from '../services/RightsService';
import PlayerProfileService from '../services/PlayerProfileService';
import VoucherService from '../services/VoucherService';
import { coreEngine, useGame } from '../context/GameContext';
import { Recycle, Menu, LogOut, HelpCircle, TestTube, Coins, Diamond, Maximize2, Minimize2 } from 'lucide-react';

const version = 'v0.2.21';
const tag = "NAVBAR";
const module = "NavBar";
let method = "";

const log = (message) => {
  console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
};

const logerror = (message, error = null) => {
  if (error) {
    console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
  } else {
    console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
  }
};

const NavBar = ({ onShowAbout, onShowStats, onShowAchievements, onShowHelp, onShowTest, onCloseOverlay, hasActiveOverlay }) => {
  method = 'NavBar';
  
  const {
    currentState,
    subscribeToUpdates,
    logout
  } = useGame();
  
  // key data
  const player = coreEngine.player;
  const playerId = coreEngine.playerId;
  const playerProfile = coreEngine.playerProfile;
  const gameConfig = coreEngine.gameConfig;
  const userEmail = coreEngine.userEmail;
  const selectedEraId = coreEngine.selectedEraId;
  const eraConfig = coreEngine.selectedEraConfig;
  const playerGameName = coreEngine.playerGameName;
  
//  log(`DEBUG humanPlayer=${player}, playerId=${playerId}, playerGameName=${playerGameName}, userEmail=${userEmail}, playerProfile=${playerProfile}, `, playerProfile);
  
  const isGuest = !!(player && playerProfile?.isGuest);
  const isAdmin = !!(player && playerProfile?.isAdmin);
  const isDeveloper = !!(player && playerProfile?.isDeveloper);
  const isTester = !!(player && playerProfile?.isTester);
  const role = playerProfile?.role;
  
//  log(`DEBUG role=${role}, isGuest=${isGuest}, isAdmin=${isAdmin}, isDeveloper=${isDeveloper}, isTester=${isTester}`);

  const [, forceUpdate] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const [passBalance, setPassBalance] = useState(0);
  const [voucherBalance, setVoucherBalance] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchPassBalance = useCallback(async () => {
    method = 'fetchPassBalance';
    
    if (!playerId || isGuest) {
      setPassBalance(0);
      log('No playerId or guest user - pass balance set to 0');
      return;
    }

    try {
      const balance = await RightsService.getPassBalance(playerId);
      setPassBalance(balance);
      log(`Pass balance fetched: ${balance}`);
    } catch (err) {
      logerror('Error fetching pass balance:', err);
      setPassBalance(0);
    }
  }, [playerId, isGuest]);

  const fetchVoucherBalance = useCallback(async () => {
    method = 'fetchVoucherBalance';
    
    if (!playerId || isGuest) {
      setVoucherBalance(0);
      log('No playerId or guest user - voucher balance set to 0');
      return;
    }

    try {
      const balance = await RightsService.getVoucherBalance(playerId);
      setVoucherBalance(balance);
      log(`Voucher balance fetched: ${balance}`);
    } catch (err) {
      logerror('Error fetching voucher balance:', err);
      setVoucherBalance(0);
    }
  }, [playerId, isGuest]);

  useEffect(() => {
    // Fetch when playerId changes OR when returning to 'era' state (after game)
    fetchPassBalance();
    fetchVoucherBalance();
  }, [playerId, isGuest, currentState, fetchPassBalance, fetchVoucherBalance]); // Added fetchPassBalance to dependencies

  // Force re-render and refresh pass balance when game state changes
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      forceUpdate(n => n + 1);
      // Refresh pass balance when CoreEngine notifies of updates
      // This ensures passes are reflected immediately after credit/consume operations
      fetchPassBalance();
      fetchVoucherBalance();
    });
    return unsubscribe;
  }, [subscribeToUpdates, fetchPassBalance, fetchVoucherBalance]);
  
  // Check initial fullscreen state
  useEffect(() => {
    const checkFullscreen = () => {
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isFs);
    };
    
    checkFullscreen();
    
    // Listen for fullscreen changes
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(event => {
      document.addEventListener(event, checkFullscreen);
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, checkFullscreen);
      });
    };
  }, []);
  
  // Listen for Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = async (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        // Exit fullscreen on Escape
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            await document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            await document.msExitFullscreen();
          }
        } catch (error) {
          logerror('Failed to exit fullscreen on Escape:', error);
        }
      }
    };
    
    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen]);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);
  
  if (currentState === 'launch' || currentState === 'login') {
    return null;
  }
  
  method = 'render';
  log(`DEBUG Rendering for state: ${currentState}, hasOverlay: ${hasActiveOverlay}`);
  
  const handleNavigate = (destination) => {
    method = 'handleNavigate';
    log(`Navigate to: ${destination}`);
    
    switch (destination) {
      case 'game':
        if (onCloseOverlay) {
          onCloseOverlay();
        }
        break;
        
      case 'about':
        if (onShowAbout) {
          onShowAbout();
        }
        break;
        
      case 'stats':
        if (onShowStats) {
          onShowStats();
        }
        break;
        
      case 'achievements':
        if (onShowAchievements) {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            onShowAchievements(scrollTop);  // ← NEW: Pass scroll position + 100px offset
        }
        break;
        
      default:
        console.warn(`[${tag}] ${version} ${module}.${method}: Unknown destination: ${destination}`);
    }
  };
  
  const handleLogout = () => {
    method = 'handleLogout';
    log('User clicked logout');
    setShowUserMenu(false);
    
    if (logout) {
      logout();
    } else {
      logerror('No logout function available from GameContext');
    }
  };
  
  const handleHelp = () => {
    method = 'handleHelp';
    log('User clicked help');
    setShowUserMenu(false);
    
    if (onShowHelp) {
      onShowHelp();
    }
  };
  
  const handleToggleFullscreen = async () => {
    method = 'handleToggleFullscreen';
    log(`Toggling fullscreen (currently: ${isFullscreen})`);
    setShowUserMenu(false);
    
    try {
      if (isFullscreen) {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        log('Exited fullscreen');
      } else {
        // Enter fullscreen
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }
        log('Entered fullscreen');
      }
    } catch (error) {
      logerror('Failed to toggle fullscreen:', error);
    }
  };
  
  const handleAddPasses = async () => {
    method = 'handleAddPasses';
    log('User clicked Add 3 Passes');
    setShowUserMenu(false);
    
    if (!playerId) {
      logerror('No playerId available');
      alert('✗ Failed to add passes - no player ID');
      return;
    }
    
    try {
      // Create 3 admin passes
        await RightsService.creditPasses(playerId, 3, 'admin', {});
      log('3 passes created successfully');
      
      // Refresh pass balance
      await fetchPassBalance();
      
      alert('✓ 3 passes added successfully!');
    } catch (error) {
      logerror('Failed to add passes:', error);
      alert('✗ Failed to add passes');
    }
  };
  
  const handleAddVoucher = async () => {
    method = 'handleAddVoucher';
    log('User clicked Add 1 Voucher (Pirates)');
    setShowUserMenu(false);
    
    if (!playerId) {
      logerror('No playerId available');
      alert('✗ Failed to add voucher - no player ID');
      return;
    }
    
    try {
      // Generate a Pirates voucher (1 play) with purpose 'admin'
      // Use null for createdBy to allow redemption (system/admin voucher)
      const voucherCode = await VoucherService.generateVoucher(
        'pirates',
        1,
        'admin', // purpose - tracks that this is an admin-created voucher
        null, // createdBy - null allows the voucher to be redeemed (system/admin voucher)
        null, // emailSentTo - null for general voucher
        1, // rewardPasses
        10 // referralSignup
      );
      
      log(`Pirates voucher generated: ${voucherCode}`);
      
      // Immediately redeem the voucher for the current player
      await VoucherService.redeemVoucher(playerId, voucherCode);
      
      log('Pirates voucher redeemed successfully');
      
      // Refresh voucher balance
      await fetchVoucherBalance();
      
      alert('✓ 1 Pirates voucher added successfully!');
    } catch (error) {
      logerror('Failed to add voucher:', error);
      alert(`✗ Failed to add voucher: ${error.message || 'Unknown error'}`);
    }
  };
  
  const handleTest = () => {
    method = 'handleTest';
    log('User clicked test');
    setShowUserMenu(false);
    
    if (onShowTest) {
      onShowTest();
    }
  };
    
  // In your admin page/component
  const handleReset = async () => {
    method = 'handleReset';
      log('User clicked Reset as New Player');

    if (!window.confirm('⚠️ Reset ALL your rights, scores, and achievements? This cannot be undone!')) {
      return;
    }

    try {
      await PlayerProfileService.resetOwnProgress(playerId);
      alert('✓ Progress reset successfully!');
      log('Progress reset successfully');
      // Reload profile or navigate away
    } catch (error) {
      logerror('Failed to reset progress:', error);
      alert('✗ Failed to reset progress');
    }
  };
  
  const toggleUserMenu = () => {
    setShowUserMenu(prev => !prev);
  };
  
  // Show "Return to Game" whenever there's an active overlay (any state except launch/login)
  const showReturnButton = hasActiveOverlay;
  const showAboutButton = ['era', 'opponent', 'placement', 'play', 'over'].includes(currentState) && eraConfig && eraConfig.about;
  const showStatsButton = ['era', 'opponent', 'placement', 'play', 'over'].includes(currentState);
  const showAchievementsButton = ['era', 'opponent', 'placement', 'play', 'over'].includes(currentState);
  
  return (
    <nav className="nav-bar">
      <div className="nav-bar__container">
        <div className="nav-bar__logo">
          Battle for the Oceans
        </div>
        
        <div className="nav-bar__links">
          {showReturnButton && (
            <button
              className="btn btn--secondary btn--thin"
              onClick={() => handleNavigate('game')}
              aria-label="Return to game"
            >
              Return to Game
            </button>
          )}
          
          {showAboutButton && (
            <button
              className="btn btn--secondary btn--thin"
              onClick={() => handleNavigate('about')}
              aria-label={`About ${eraConfig.name}`}
              title={`Learn about ${eraConfig.name}`}
            >
              About {eraConfig.name}
            </button>
          )}
          
          {showStatsButton && !isGuest && (
            <button
              className="btn btn--secondary btn--thin"
              onClick={() => handleNavigate('stats')}
              aria-label="View statistics"
              title="View your combat statistics"
            >
              Stats
            </button>
          )}
          
          {showAchievementsButton && (
            <button
              className="btn btn--secondary btn--thin"
              onClick={() => handleNavigate('achievements')}
              aria-label="View achievements"
            >
              Achievements
            </button>
          )}
        </div>
        
        {(passBalance > 0 || voucherBalance > 0) && (
          <div className="nav-bar__passes" style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.875rem' }}>
            {passBalance > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Coins size={16} />
                <span className="pass-count">{passBalance}</span>
                <span className="pass-label">{passBalance === 1 ? ' Pass' : ' Passes'}</span>
              </div>
            )}
            {voucherBalance > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Diamond size={16} />
                <span className="voucher-count">{voucherBalance}</span>
                <span className="voucher-label">{voucherBalance === 1 ? ' Voucher' : ' Vouchers'}</span>
              </div>
            )}
          </div>
        )}
        
        {true && (
          <div className="btn btn--secondary btn--xthin" ref={menuRef}>
            <span
              className="nav-bar__menu"
              onClick={toggleUserMenu}
              style={{ cursor: 'pointer' }}
              title="Click for user menu"
            >
              <Menu size={22} className="action-menu__emoji" />
            </span>
            
            {showUserMenu && (
              <>
                <div
                  className="action-menu-backdrop"
                  onClick={() => setShowUserMenu(false)}
                  style={{ background: 'transparent' }}
                />
                <div
                  className="action-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    marginTop: '0.5rem'
                  }}
                >
                  <div className="action-menu__items">
                    <div
                      className="action-menu__item action-menu__item--header"
                      style={{
                        cursor: 'default',
                        background: 'var(--bg-medium)',
                        borderColor: 'var(--border-subtle)',
                        fontSize: '0.85rem',
                        padding: 'var(--space-xs) var(--space-md)'
                      }}
                    >
                      <span>{playerProfile?.game_name || 'Guest'}</span>
                    </div>
                    
                    <div
                      className="action-menu__item"
                      onClick={handleHelp}
                    >
                      <HelpCircle size={20} className="action-menu__emoji" />
                      <span className="action-menu__label">Help</span>
                    </div>
                    
                    <div
                      className="action-menu__item"
                      onClick={handleToggleFullscreen}
                    >
                      {isFullscreen ? (
                        <Minimize2 size={20} className="action-menu__emoji" />
                      ) : (
                        <Maximize2 size={20} className="action-menu__emoji" />
                      )}
                      <span className="action-menu__label">Fullscreen (Esc)</span>
                    </div>
                            
                    <div
                      className="action-menu__item"
                      onClick={handleLogout}
                    >
                      <LogOut size={20} className="action-menu__emoji" />
                      <span className="action-menu__label">Logout</span>
                    </div>
                    
                    {(isAdmin || isDeveloper || isTester) && (
                      <div
                        className="action-menu__item action-menu__item--admin"
                        onClick={handleAddPasses}
                      >
                        <Coins size={20} className="action-menu__emoji" />
                        <span className="action-menu__label">*Add 3 Passes</span>
                      </div>
                    )}
                    
                    {(isAdmin || isDeveloper || isTester) && (
                      <div
                        className="action-menu__item action-menu__item--admin"
                        onClick={handleAddVoucher}
                      >
                        <Diamond size={20} className="action-menu__emoji" />
                        <span className="action-menu__label">*Add 1 Voucher (Pirates)</span>
                      </div>
                    )}
                    
                    {(isAdmin || isDeveloper) && (
                      <div
                        className="action-menu__item action-menu__item--admin"
                        onClick={handleTest}
                      >
                        <TestTube size={20} className="action-menu__emoji" />
                        <span className="action-menu__label">Test</span>
                      </div>
                    )}
                    
                    {(isAdmin || isDeveloper) && (
                      <div
                        className="action-menu__item action-menu__item--admin"
                        onClick={handleReset}
                      >
                        <Recycle size={20} className="action-menu__emoji" />
                        <span className="action-menu__label">Reset as New Player...</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
// EOF
