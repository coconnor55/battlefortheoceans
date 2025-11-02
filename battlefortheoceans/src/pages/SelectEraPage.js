// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.6.1: Refactored to use useEraBadges hook
//         - Extracted badge/pass fetching logic to useEraBadges hook
//         - Extracted batch badge fetching to RightsService.getBadgesForUser()
//         - Cleaner component - only UI logic remains
// v0.6.0: Pass System integration - badge display and access checking
// v0.5.4: Moved GameGuide to App.js, removed setShowInfo and InfoButton

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../utils/supabaseClient';
import useEraBadges from '../hooks/useEraBadges';
import PurchasePage from './PurchasePage';

const version = 'v0.6.1';

const SelectEraPage = () => {
  const {
    dispatch,
    events,
    userProfile,
    getUserRights,
    getAllEras,
    getEraById
  } = useGame();
  
  // Local UI state for browsing - not committed to game logic until button click
  const [selectedEra, setSelectedEra] = useState(null);
  
  // Data fetching state
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pass System state (via custom hook)
  const {
    passBalance,
    eraBadges,
    refresh: refreshBadges
  } = useEraBadges(userProfile?.id, eras);
  
  // Rights and purchase state
  const [userRights, setUserRights] = useState(new Map());
  const [showPurchasePage, setShowPurchasePage] = useState(false);
  const [purchaseEraId, setPurchaseEraId] = useState(null);
  
  // User role for status filtering
  const [userRole, setUserRole] = useState('user');

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!userProfile?.id || userProfile.id.startsWith('guest-')) {
        setUserRole('user');
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userProfile.id)
          .single();
        
        if (error) throw error;
        
        setUserRole(data?.role || 'user');
        console.log(`[SELECTERA ${version}] User role:`, data?.role || 'user');
      } catch (error) {
        console.error(`[SELECTERA ${version}] Error fetching user role:`, error);
        setUserRole('user');
      }
    };
    
    fetchUserRole();
  }, [userProfile?.id]);

  // Filter eras by status and user role (admin OR tester)
  const availableEras = useMemo(() => {
    if (!eras || eras.length === 0) return [];
    
    return eras.filter(era => {
      // Always show active eras (or eras without status field)
      if (!era.status || era.status === 'active') return true;
      
      // Show development eras to admins AND testers
      if (era.status === 'development' && ['admin', 'tester'].includes(userRole)) {
        console.log(`[SELECTERA ${version}] Development era visible to ${userRole}:`, era.name);
        return true;
      }
      
      // Hide everything else (beta, disabled, etc.)
      return false;
    });
  }, [eras, userRole]);

  // Handle era selection - check if user has access
  const handleEraSelect = useCallback((era) => {
    console.log(`[SELECTERA ${version}] Era selected (UI state):`, era.name);
    
    const badgeInfo = eraBadges.get(era.id);
    
    if (!badgeInfo) {
      console.warn(`[SELECTERA ${version}] No badge info for era:`, era.id);
      return;
    }
    
    if (badgeInfo.canPlay) {
      // User can play - select the era
      setSelectedEra(era);
    } else {
      // Era is locked - show purchase page
      console.log(`[SELECTERA ${version}] Era locked, opening purchase page:`, era.id);
      setPurchaseEraId(era.id);
      setShowPurchasePage(true);
    }
  }, [eraBadges]);

  // Handle purchase completion
  const handlePurchaseComplete = useCallback(async (eraId) => {
    console.log(`[SELECTERA ${version}] Purchase completed for era:`, eraId);
    setShowPurchasePage(false);
    setPurchaseEraId(null);
    
    // Refresh rights and badges
    await fetchUserRights();
    await refreshBadges();
    
    // Auto-select the purchased era
    const purchasedEra = eras.find(e => e.id === eraId);
    if (purchasedEra) {
      setSelectedEra(purchasedEra);
    }
  }, [eras, refreshBadges]);

  // Handle purchase cancellation
  const handlePurchaseCancel = useCallback(() => {
    console.log(`[SELECTERA ${version}] Purchase cancelled`);
    setShowPurchasePage(false);
    setPurchaseEraId(null);
  }, []);

  // Transition to opponent selection
  const handlePlayEra = useCallback(async () => {
    if (!selectedEra) {
      console.error(`[SELECTERA ${version}] No era selected`);
      return;
    }

    console.log(`[SELECTERA ${version}] Loading full era config for:`, selectedEra.name);
    
    try {
      // Load the FULL era configuration
      const fullEraConfig = await getEraById(selectedEra.id);
      
      console.log(`[SELECTERA ${version}] Transitioning to opponent selection with era:`, fullEraConfig.name);
      
      // Dispatch with full config (game-scoped data, not singleton)
      // Note: Pass consumption happens in PlacementPage after fleet is placed
      dispatch(events.SELECTOPPONENT, {
        eraConfig: fullEraConfig
      });
    } catch (error) {
      console.error(`[SELECTERA ${version}] Failed to load era config:`, error);
      setError('Failed to load era configuration');
    }
  }, [selectedEra, dispatch, events, getEraById]);
    
  // Fetch user rights using GameContext singleton
  const fetchUserRights = useCallback(async () => {
    if (!userProfile?.id) {
      console.log(`[SELECTERA ${version}] No user profile, skipping rights fetch`);
      return;
    }

    try {
      console.log(`[SELECTERA ${version}] Fetching user rights for:`, userProfile.id);
      const rights = await getUserRights(userProfile.id);
      
      // Create a map of era access
      const rightsMap = new Map();
      rights.forEach(right => {
        if (right.rights_type === 'era') {
          rightsMap.set(right.rights_value, true);
        }
      });
      
      setUserRights(rightsMap);
      console.log(`[SELECTERA ${version}] User rights loaded:`, rightsMap);
    } catch (error) {
      console.error(`[SELECTERA ${version}] Error fetching user rights:`, error);
    }
  }, [userProfile?.id, getUserRights]);

  // Fetch eras
  useEffect(() => {
    const fetchEras = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`[SELECTERA ${version}] Fetching eras`);
        
        const eraList = await getAllEras();
        
        console.log(`[SELECTERA ${version}] Eras loaded:`, eraList.length);
        setEras(eraList);
        
      } catch (fetchError) {
        console.error(`[SELECTERA ${version}] Error fetching eras:`, fetchError);
        setError(fetchError.message || 'Failed to load eras');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEras();
  }, [getAllEras]);

  // Fetch user rights when user profile changes
  useEffect(() => {
    fetchUserRights();
  }, [fetchUserRights]);

  // Determine badge display for era (using development badge override)
  const getEraBadgeDisplay = useCallback((era) => {
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

  // Loading state
  if (loading) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <h2>Setting up...</h2>
            <p>Getting battle options...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="card-header">
            <h2 className="card-title">Error Loading Eras</h2>
          </div>
          <div className="card-body">
            <p className="message message--error">{error}</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn--primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No eras found
  if (!loading && availableEras.length === 0) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="card-header">
            <h2 className="card-title">No Battle Eras Available</h2>
          </div>
          <div className="card-body">
            <p>Cannot load era configurations - try again later.</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn--primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex flex-column flex-center">
      <div className="page-with-info">

        <div className="content-pane content-pane--wide">
          <div className="card-header">
            <h2 className="card-title">Select Battle Era</h2>
            <p className="card-subtitle">Choose your naval battlefield</p>
            {passBalance > 0 && (
              <div className="pass-balance-display">
                <span className="pass-icon">💎</span>
                <span className="pass-count">{passBalance}</span>
                <span className="pass-label">Passes</span>
              </div>
            )}
          </div>

          {/* Era list using new shared classes */}
          <div className="era-list scrollable-list">
            {availableEras.map((era) => {
              const badgeDisplay = getEraBadgeDisplay(era);
              
              return (
                <div
                  key={era.id}
                  className={`selectable-item era-item ${selectedEra?.id === era.id ? 'selectable-item--selected' : ''} ${!badgeDisplay.canPlay ? 'selectable-item--locked' : ''}`}
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
            {!selectedEra ? (
              <p className="text-dim text-center">
                Select an era above to continue
              </p>
            ) : (
              <div className="card-footer">
                <button
                  className="btn btn--primary btn--lg"
                  onClick={handlePlayEra}
                >
                  Play {selectedEra.name}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Page Modal */}
      {showPurchasePage && (
        <div className="modal-overlay modal-overlay--transparent">
          <PurchasePage
            eraId={purchaseEraId}
            onComplete={handlePurchaseComplete}
            onCancel={handlePurchaseCancel}
          />
        </div>
      )}
    </div>
  );
};

export default SelectEraPage;

// EOF
