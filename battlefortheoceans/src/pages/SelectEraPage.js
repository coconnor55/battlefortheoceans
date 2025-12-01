// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.6.16: Sort eras by order in era-list.json (same order as era-list.json)
//         - Removed category grouping (free, passes, vouchers)
//         - Eras now display in the exact order they appear in era-list.json
// v0.6.15: Add loading state while badges are being fetched
//          - Show spinner and message while useEraBadges hook is loading
//          - Prevents blank screen while checking era access
// v0.6.14: Sort eras by access type (free, passes, vouchers) and oldest first within each group
//         - Free eras first, then passes eras, then vouchers/exclusive eras
//         - Within each group, sort by position in era-list.json (oldest first)
// v0.6.13: Fix React setState during render warning - defer handleKeyDataError to useEffect
//         - Moved handleKeyDataError call to useEffect with setTimeout to defer execution
//         - Prevents "Cannot update a component while rendering a different component" error
// v0.6.12: Fix React hooks rule violations - move all hooks before key data check
//          - Moved useState, useMemo, and useCallback hooks before the key data check
// v0.6.11: Replace key data error throwing with graceful handling
//          - Use logwarn instead of logerror and throw
//          - Call coreEngine.handleKeyDataError() to save error and navigate to Launch
//          - Return null to prevent rendering when key data is missing
// v0.6.10: Allow null playerEmail for guest users in key data check
//          - Guest users don't have email, so playerEmail check is conditional
//          - Only require playerEmail for non-guest users
// v0.6.9: Restore play button hiding logic from cursor/hide-play-buttons-for-unavailable-content-aedf
//         - Restore selectedEraCanPlay logic to check if user has access to play era
//         - Hide play button and show "Access required" message when user can't play
//         - Check passes, exclusive eras, development eras, and voucher access
// v0.6.8: Simplified useEraBadges call - no longer pass eras Map
//         - Hook now reads coreEngine.eras internally
//         - Fixes render loop issue
 // v0.6.7: Pass coreEngine.eras Map directly to useEraBadges
//         - Eliminates array creation on every render
//         - Fixes render loop issue
// v0.6.6: Remove usage of eraList, getSelectedEraSummary
// v0.6.5: Remove redundant useEffect, use CoreEngine methods for selectedEra
//         - Remove userRole state and useEffect (read directly from playerProfile)
//         - Use coreEngine.setSelectedEraId() instead of direct property assignment
//         - Use coreEngine.getSelectedEraSummary() for basic era info
//         - Use coreEngine.getSelectedEraConfig() for full config
//         - Fixes: no more redundant Supabase queries, cleaner code
// v0.6.4: Use coreEngine.eraList and coreEngine.eras (preloaded in CoreEngine)
//         - Remove ConfigLoader import and era fetching logic
//         - Remove loading/error states (eras already loaded)
//         - Simpler: just read preloaded eras from CoreEngine
//         - Much faster: no async loading on page render
// v0.6.3: Removed eraId=getEraAccessId
// v0.6.2: Replaced PurchasePage with GetAccessPage
//         - Removed PurchasePage import and state
//         - Added GetAccessPage import and state
//         - Simplified handleEraSelect (no price checking)
//         - All locked eras now show GetAccessPage modal
// v0.6.1: Refactored to use useEraBadges hook
//         - Extracted badge/pass fetching logic to useEraBadges hook
//         - Extracted batch badge fetching to RightsService.getBadgesForUser()
//         - Cleaner component - only UI logic remains
// v0.6.0: Pass System integration - badge display and access checking
// v0.5.4: Moved GameGuide to App.js, removed setShowInfo and InfoButton

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import useEraBadges from '../hooks/useEraBadges';
import GetAccessPage from './GetAccessPage';
import { coreEngine, useGame } from '../context/GameContext';
import configLoader from '../utils/ConfigLoader';

const version = 'v0.6.14';
const tag = "SELECTERA";
const module = "SelectEraPage";
let method = "";

const SelectEraPage = () => {
    // Logging utilities
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

    const {
        dispatch,
        events
    } = useGame();
    
    const logwarn = (message) => {
        console.warn(`[${tag}] ${version} ${module}.${method}: ${message}`);
    };
    
    // All hooks must be called before any conditional returns
    // Pass System state (via custom hook) - use coreEngine.playerId directly
    const {
        passBalance,
        eraBadges,
        loading: badgesLoading,
        refresh: refreshBadges
    } = useEraBadges(coreEngine.playerId);

    // Rights and GetAccessPage state
    const [showGetAccessPage, setShowGetAccessPage] = useState(false);

    // Key data - see CoreEngine handle{state}
    const gameConfig = coreEngine.gameConfig;
    const eras = coreEngine.eras;
    const player = coreEngine.player;
    const playerProfile = coreEngine.playerProfile;
    const playerEmail = coreEngine.playerEmail;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponents = coreEngine.selectedOpponents;
    const selectedEraConfig = coreEngine.selectedEraConfig;

    // Derived data
    const playerId = coreEngine.playerId;
    const playerRole = coreEngine.playerRole;
    const playerGameName = coreEngine.playerGameName;
    const isGuest = player != null && player.isGuest;
    const isAdmin = player != null && playerProfile?.isAdmin;
    const isDeveloper = player != null && playerProfile?.isDeveloper;
    const isTester = player != null && playerProfile?.isTester;
    const selectedOpponent = selectedOpponents?.[0];
    const selectedGameMode = coreEngine.selectedGameMode;
    const gameInstance = coreEngine.gameInstance;
    const board = coreEngine.board;

    // Filter and sort eras by status, user role, and order in era-list.json
    const availableEras = useMemo(() => {
        method = 'availableEras';
        
        if (!coreEngine.eras || coreEngine.eras.size === 0) return [];
        const allEras = Array.from(coreEngine.eras.values());
        
        // Filter eras by status and user role
        const filteredEras = allEras.filter(era => {
            // Always show active eras (or eras without status field)
            if (!era.status || era.status === 'active') return true;
            
            // Show development eras to admins, developers, AND testers
            if (era.status === 'development' && ['admin', 'developer', 'tester'].includes(playerRole)) {
                log(`Development era visible to ${playerRole}:`, era.name);
                return true;
            }
            
            // Hide everything else (beta, disabled, etc.)
            return false;
        });
        
        // Create era order map from eraList (matches era-list.json order)
        const eraOrderMap = new Map();
        if (coreEngine.eraList && Array.isArray(coreEngine.eraList)) {
            coreEngine.eraList.forEach((eraEntry, index) => {
                eraOrderMap.set(eraEntry.id, index);
            });
        }
        
        // Get order index for an era (fallback to 999 if not in eraList)
        const getEraOrder = (era) => {
            return eraOrderMap.get(era.id) ?? 999;
        };
        
        // Sort by order in era-list.json (same order as era-list.json)
        return filteredEras.sort((a, b) => {
            return getEraOrder(a) - getEraOrder(b);
        });
    }, [coreEngine.eras, coreEngine.eraList, playerRole]);

    // Handle era selection - check if user has access
    const handleEraSelect = useCallback((era) => {
        method = 'handleEraSelect';
        
        log(`Era selected (UI state):`, era.name);
        log(`Era id=${era.id}, era=${era.era}`);
        
        const badgeInfo = eraBadges.get(era.id);
        
        if (!badgeInfo) {
            console.warn(`[SELECTERA] ${version}| No badge info for era:`, era.id);
            return;
        }
        
        // set selected era
        coreEngine.selectedEraId = era.id;
        log(`eraId=${era.id}, eraConfig=${coreEngine.selectedEraConfig}`);
        
        if (!badgeInfo.canPlay) {
            // Era is locked
            if (isGuest) {
                // Guest users should not see GetAccessPage - just show the message
                log(`Era locked for guest user - showing message only:`, era.id);
                // Don't open GetAccessPage for guest users
                return;
            } else {
                // Registered users can see GetAccessPage
                log(`Era locked, showing GetAccessPage:`, era.id);
                setShowGetAccessPage(true);
            }
        }
    }, [coreEngine, eraBadges, isGuest, setShowGetAccessPage]);
    
    // Handle GetAccessPage completion
    const handleGetAccessComplete = useCallback(async (eraId) => {
        method = 'handleGetAccessComplete';
        
        log(`Access granted for era:`, eraId);
        setShowGetAccessPage(false);
        
        // Refresh rights and badges
        await refreshBadges();
    }, [refreshBadges, setShowGetAccessPage]);
    
    // Handle GetAccessPage cancellation
    const handleGetAccessCancel = useCallback(async () => {
        method = 'handleGetAccessCancel';
        
        log(`GetAccessPage cancelled`);
        setShowGetAccessPage(false);
        
        // Refresh badges in case a voucher was redeemed before cancel
        await refreshBadges();
    }, [refreshBadges, setShowGetAccessPage]);
    
    // Transition to opponent selection
    const handlePlayEra = useCallback(async () => {
        method = 'handlePlayEra';
        
        if (!coreEngine.selectedEraId) {
            logerror(`No era selected`);
            return;
        }
        
        // selectedEraId is known, therefore coreEngine.selectedEraConfig is valid
        log('exit SelectEra: coreEngine.selectedEraId set: ', coreEngine.selectedEraId);
        log('exit SelectEra: coreEngine.selectedEraConfig set: ', coreEngine.selectedEraConfig);
        dispatch(events.SELECTOPPONENT);
    }, [coreEngine, dispatch, events]);
    
    // Determine badge display for era (using development badge override)
    const getEraBadgeDisplay = useCallback((era) => {
        method = 'getEraBadgeDisplay';
        
        log(`[BADGES] ${version}| SelectEraPage.getEraBadgeDisplay: eraId=${era.id}, era=${era}`);
        // Development eras show DEV badge (overrides pass system)
        if (era.status === 'development') {
            return {
                badge: 'DEV',
                style: 'badge-warning',
                canPlay: true
            };
        }
        
        // Get badge info from RightsService
        const badgeInfo = eraBadges.get(era.id);

        if (!badgeInfo) {
            // Still loading
            return {
                badge: '...',
                style: 'badge-secondary',
                canPlay: false
            };
        }
        
        log(`[BADGES] ${version}| SelectEraPage.getEraBadgeDisplay: eraId=${era.id}, badgeInfo=${badgeInfo}`);

        // Map style from RightsService to CSS class
        let cssClass = 'badge-secondary';
        if (badgeInfo.style === 'badge-free') cssClass = 'badge-success';
        else if (badgeInfo.style === 'badge-exclusive') cssClass = 'badge-primary';
        else if (badgeInfo.style === 'badge-plays') cssClass = 'badge-info';
        else if (badgeInfo.style === 'badge-locked') cssClass = 'badge-danger';
        else if (badgeInfo.style === 'badge-error') cssClass = 'badge-danger';
        
        return {
            badge: badgeInfo.badge,
            style: cssClass,
            canPlay: badgeInfo.canPlay
        };
    }, [eraBadges]);

    // Key data check - stop game if key data is missing
    // (selectedAlliance is allowed to be null)
    // (playerEmail is allowed to be null for guest users)
    const required = isGuest 
        ? { gameConfig, eras, player, playerProfile }
        : { gameConfig, eras, player, playerProfile, playerEmail };
    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key, value]) => `${key}=${value}`);
    
    // Defer handleKeyDataError to useEffect to avoid React setState during render warning
    useEffect(() => {
        if (missing.length > 0) {
            const errorMessage = `key data missing: ${missing.join(', ')}`;
            logwarn(errorMessage);
            // Use setTimeout to defer to next tick, avoiding setState during render
            setTimeout(() => {
                coreEngine.handleKeyDataError('era', errorMessage);
            }, 0);
        }
    }, [missing.length]); // Only run when missing data changes
    
    if (missing.length > 0) {
        return null; // Return null to prevent rendering
    }

    log('SelectEra: passed CoreEngine data checks');
    
    // Show loading state while badges are being fetched
    if (badgesLoading && !isGuest) {
        return (
            <div className="container flex flex-column flex-center">
                <div className="content-pane content-pane--wide">
                    <div className="loading">
                        <div className="spinner spinner--lg"></div>
                        <h2>Loading Era Information</h2>
                        <p>Checking access and availability...</p>
                    </div>
                </div>
            </div>
        );
    }
    
    const selectedEraBadgeInfo = selectedEraConfig ? eraBadges.get(selectedEraConfig.id) : null;
    const isPrivilegedRole = ['admin', 'developer', 'tester'].includes(playerRole);
    const selectedEraCanPlay = (() => {
        if (!selectedEraConfig) return false;
        
        const passesRequired = selectedEraConfig.passes_required || 0;
        const isExclusiveEra = selectedEraConfig.exclusive === true;
        const isDevelopmentEra = selectedEraConfig.status === 'development';
        const devGateSatisfied = !isDevelopmentEra || isPrivilegedRole;
        
        const passesAvailable = selectedEraBadgeInfo?.method === 'purchase'
            ? true
            : passesRequired === 0
                ? true
                : passBalance >= passesRequired;
        
        const hasVoucherAccess = ['voucher', 'purchase'].includes(selectedEraBadgeInfo?.method);
        
        return devGateSatisfied && (
            (!isExclusiveEra && passesAvailable) ||
            (isExclusiveEra && hasVoucherAccess)
        );
    })();
    
    const playButton = () => {
        const name = selectedEraConfig?.name;
        const isExclusiveEra = selectedEraConfig?.exclusive === true;
        
        // For exclusive eras, show vouchers instead of passes
        if (isExclusiveEra) {
            const badgeInfo = selectedEraBadgeInfo;
            if (badgeInfo?.method === 'voucher') {
                // Parse voucher count from badge text (e.g., "1 EXCLUSIVE" or "∞ EXCLUSIVE")
                const badgeText = badgeInfo.badge || '';
                const match = badgeText.match(/^(\d+|∞)\s+/);
                if (match) {
                    const count = match[1];
                    if (count === '∞') {
                        return `${name} - Unlimited Vouchers`;
                    }
                    const vouchers = parseInt(count, 10);
                    if (vouchers === 1) return `${name} - 1 Voucher`;
                    return `${name} - ${vouchers} Vouchers`;
                }
                // If badge shows "0 EXCLUSIVE" or no count, just show name
                return name;
            }
            // If no voucher access yet, just show name
            return name;
        }
        
        // For non-exclusive eras, show passes
        const passes = selectedEraConfig?.passes_required || 0;
        if (passes === 0) return name;
        if (passes === 1) return `${name} - 1 Pass`;
        return `${name} - ${passes} Passes`;
    };

  return (
    <div className="container flex flex-column flex-center">
      <div className="page-with-info">

        <div className="content-pane content-pane--wide">
          <div className="card-header">
            <h2 className="card-title">Select Battle Era</h2>
            <p className="card-subtitle">Choose your naval battlefield</p>
          {/*            {passBalance > 0 && (
            <div className="pass-balance-display">
            <span className="pass-icon">💎</span>
            <span className="pass-count">{passBalance}</span>
            <span className="pass-label">Passes</span>
            </div>
            )}*/}
          </div>

          {/* Era list using new shared classes */}
          <div className="era-list scrollable-list">
            {availableEras.map((era) => {
              const badgeDisplay = getEraBadgeDisplay(era);
              const backgroundImageUrl = era.promotional?.background_image
                ? configLoader.getEraAssetPath(era.id, era.promotional.background_image)
                : null;

              return (
                <div
                  key={era.id}
                      className={`selectable-item era-item ${coreEngine.selectedEraConfig?.id === era.id ? 'selectable-item--selected' : ''} ${!badgeDisplay.canPlay ? 'selectable-item--locked' : ''}`}
                  onClick={() => handleEraSelect(era)}
                >
                  <div className="era-item-content">
                    {backgroundImageUrl && (
                      <div className="era-item-image">
                        <img
                          src={backgroundImageUrl}
                          alt={`${era.name} background`}
                          className="era-background-image"
                        />
                      </div>
                    )}
                    <div className="era-item-text">
                      <div className="item-header">
                        <span className="item-name">{era.name}</span>
                        <span className={`badge ${badgeDisplay.style}`}>
                          {badgeDisplay.badge}
                        </span>
                      </div>
                      <div className="item-description">{era.era_description}</div>
                      <div className="item-details">
                        <span className="era-grid">{era.rows}×{era.cols} grid</span>
                        <span className="era-players">Max {era.max_players} players</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Action Section - Always Visible */}
            <div className="action-section">
              {!selectedEraId || !selectedEraConfig ? (
                <p className="text-dim text-center">
                  Select an era above to continue
                </p>
              ) : !selectedEraCanPlay ? (
                <p className="text-dim text-center">
                  {isGuest 
                    ? `Registered players can play ${selectedEraConfig.name}`
                    : `Access required to play ${selectedEraConfig.name}`
                  }
                </p>
              ) : (
                <div className="card-footer">
                  <button
                    className="btn btn--primary btn--lg"
                    onClick={handlePlayEra}
                  >
                    Play {playButton()}
                  </button>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Get Access Page Modal - Only show for registered users */}
      {showGetAccessPage && !isGuest && (
        <div className="modal-overlay modal-overlay--transparent">
          <GetAccessPage
            onComplete={handleGetAccessComplete}
            onCancel={handleGetAccessCancel}
          />
        </div>
      )}
    </div>
  );
};

export default SelectEraPage;

// EOF
