// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor
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

import React, { useState, useCallback, useMemo } from 'react';
import useEraBadges from '../hooks/useEraBadges';
import GetAccessPage from './GetAccessPage';
import { coreEngine, useGame } from '../context/GameContext';

const version = 'v0.6.8';
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
    
    //key data - see CoreEngine handle{state}
    const gameConfig = coreEngine.gameConfig;
    const eras = coreEngine.eras;
    const player = coreEngine.player
    const playerProfile = coreEngine.playerProfile;
    const playerEmail = coreEngine.playerEmail;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponents = coreEngine.selectedOpponents;
    const selectedEraConfig = coreEngine.selectedEraConfig;

    // derived data
    const playerId = coreEngine.playerId;
    const playerRole = coreEngine.playerRole;
    const playerGameName = coreEngine.playerGameName;
    const isGuest = player != null && player.isGuest;
    const isAdmin = player != null && playerProfile.isAdmin;
    const isDeveloper = player != null && playerProfile.isDeveloper;
    const isTester = player != null && playerProfile.isTester;
    const selectedOpponent = coreEngine.selectedOpponents[0];

    const selectedGameMode = coreEngine.selectedGameMode;
    const gameInstance = coreEngine.gameInstance;
    const board = coreEngine.board;

    // stop game if key data is missing (selectedAlliance is allowed to be null)
    const required = { gameConfig, eras, player, playerProfile, playerEmail };
    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key, value]) => `${key}=${value}`);
    if (missing.length > 0) {
        logerror(`key data missing: ${missing.join(', ')}`, required);
        throw new Error(`${module}: key data missing: ${missing.join(', ')}`);
    }

    log('SelectEra: passed CoreEngine data checks');
    
    // Pass System state (via custom hook)
    const {
        eraBadges,
        refresh: refreshBadges
    } = useEraBadges(playerId);
    
    const selectedEraBadgeInfo = selectedEraConfig ? eraBadges.get(selectedEraConfig.id) : null;
    const selectedEraCanPlay = selectedEraConfig?.status === 'development'
        ? true
        : Boolean(selectedEraBadgeInfo?.canPlay);
    
    // Rights and GetAccessPage state
    const [showGetAccessPage, setShowGetAccessPage] = useState(false);
    
    // Filter eras by status and user role (admin OR tester)
    const availableEras = useMemo(() => {
        method = 'availableEras';
        
        if (!coreEngine.eras || coreEngine.eras.size === 0) return [];
        const allEras = Array.from(coreEngine.eras.values());
        
        return allEras.filter(era => {
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
    }, [coreEngine.eras, playerRole]);
    
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
            // Era is locked - show GetAccessPage
            log(`Era locked, showing GetAccessPage:`, era.id);
            setShowGetAccessPage(true);
        }
    }, [coreEngine, eraBadges]);
    
    // Handle GetAccessPage completion
    const handleGetAccessComplete = useCallback(async (eraId) => {
        method = 'handleGetAccessComplete';
        
        log(`Access granted for era:`, eraId);
        setShowGetAccessPage(false);
        
        // Refresh rights and badges
        await refreshBadges();
        //
        //    // Auto-select the era if now accessible
        //    const era = eraList.find(e => e.id === eraId);
        //    if (era) {
        //      setSelectedEraId(era);
        //    }
    }, [refreshBadges]);
    
    // Handle GetAccessPage cancellation
    const handleGetAccessCancel = useCallback(() => {
        method = 'handleGetAccessCancel';
        
        log(`GetAccessPage cancelled`);
        setShowGetAccessPage(false);
        
    }, []);
    
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
    
    const playButton = () => {
        const name = selectedEraConfig?.name
        const passes = selectedEraConfig?.passes_required || 0
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

              return (
                <div
                  key={era.id}
                      className={`selectable-item era-item ${coreEngine.selectedEraConfig?.id === era.id ? 'selectable-item--selected' : ''} ${!badgeDisplay.canPlay ? 'selectable-item--locked' : ''}`}
                  onClick={() => handleEraSelect(era)}
                >
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
                  Access required to play {selectedEraConfig.name}
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

      {/* Get Access Page Modal */}
      {showGetAccessPage && (
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
