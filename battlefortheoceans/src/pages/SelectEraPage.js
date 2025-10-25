// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.5.3: Remove dead guest creation useEffect
//         - Removed auto-guest-creation logic (LoginPage handles this)
//         - Trust Player singleton is set by LoginPage before reaching this state
//         - Keep eraConfig as passed data (game-scoped, not session-scoped)
//         - Cleanup from pre-Player-singleton architecture
// v0.5.2: REFACTOR - Replaced InfoPanel with GameGuide component
// v0.5.1: Added 'tester' role to development era visibility check
// v0.5.0: Added status filtering - development eras visible only to admins

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../utils/supabaseClient';
import PurchasePage from './PurchasePage';
import InfoButton from '../components/InfoButton';
import GameGuide from '../components/GameGuide';

const version = 'v0.5.3';

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
  const [showInfo, setShowInfo] = useState(false);
  
  // Data fetching state
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
        console.log(`[SELECTERA] ${version} User role:`, data?.role || 'user');
      } catch (error) {
        console.error(`[SELECTERA] ${version} Error fetching user role:`, error);
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
        console.log(`[SELECTERA] ${version} Development era visible to ${userRole}:`, era.name);
        return true;
      }
      
      // Hide everything else (beta, disabled, etc.)
      return false;
    });
  }, [eras, userRole]);

  // Handle era selection - check if user has access
  const handleEraSelect = useCallback((era) => {
    console.log(`[SELECTERA] ${version} Era selected (UI state):`, era.name);
    
    // Check if era is accessible
    const hasAccess = userRights.get(era.id) || era.free;
    
    if (hasAccess) {
      setSelectedEra(era);
    } else {
      // Era is locked - show purchase page
      console.log(`[SELECTERA] ${version} Era locked, opening purchase page:`, era.id);
      setPurchaseEraId(era.id);
      setShowPurchasePage(true);
    }
  }, [userRights]);

  // Handle purchase completion
  const handlePurchaseComplete = useCallback(async (eraId) => {
    console.log(`[SELECTERA] ${version} Purchase completed for era:`, eraId);
    setShowPurchasePage(false);
    setPurchaseEraId(null);
    
    // Refresh user rights
    await fetchUserRights();
    
    // Auto-select the purchased era
    const purchasedEra = eras.find(e => e.id === eraId);
    if (purchasedEra) {
      setSelectedEra(purchasedEra);
    }
  }, [eras]);

  // Handle purchase cancellation
  const handlePurchaseCancel = useCallback(() => {
    console.log(`[SELECTERA] ${version} Purchase cancelled`);
    setShowPurchasePage(false);
    setPurchaseEraId(null);
  }, []);

  // Transition to opponent selection
  const handlePlayEra = useCallback(async () => {
    if (!selectedEra) {
      console.error(`[SELECTERA] ${version} No era selected`);
      return;
    }

    console.log(`[SELECTERA] ${version} Loading full era config for:`, selectedEra.name);
    
    try {
      // Load the FULL era configuration
      const fullEraConfig = await getEraById(selectedEra.id);
      
      console.log(`[SELECTERA] ${version} Transitioning to opponent selection with era:`, fullEraConfig.name);
      
      // Dispatch with full config (game-scoped data, not singleton)
      dispatch(events.SELECTOPPONENT, {
        eraConfig: fullEraConfig
      });
    } catch (error) {
      console.error(`[SELECTERA] ${version} Failed to load era config:`, error);
      setError('Failed to load era configuration');
    }
  }, [selectedEra, dispatch, events, getEraById]);
    
  // Fetch user rights using GameContext singleton
  const fetchUserRights = useCallback(async () => {
    if (!userProfile?.id) {
      console.log(`[SELECTERA] ${version} No user profile, skipping rights fetch`);
      return;
    }

    try {
      console.log(`[SELECTERA] ${version} Fetching user rights for:`, userProfile.id);
      const rights = await getUserRights(userProfile.id);
      
      // Create a map of era access
      const rightsMap = new Map();
      rights.forEach(right => {
        if (right.rights_type === 'era') {
          rightsMap.set(right.rights_value, true);
        }
      });
      
      setUserRights(rightsMap);
      console.log(`[SELECTERA] ${version} User rights loaded:`, rightsMap);
    } catch (error) {
      console.error(`[SELECTERA] ${version} Error fetching user rights:`, error);
    }
  }, [userProfile?.id, getUserRights]);

  // Fetch eras
  useEffect(() => {
    const fetchEras = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`[SELECTERA] ${version} Fetching eras`);
        
        const eraList = await getAllEras();
        
        console.log(`[SELECTERA] ${version} Eras loaded:`, eraList.length);
        setEras(eraList);
        
      } catch (fetchError) {
        console.error(`[SELECTERA] ${version} Error fetching eras:`, fetchError);
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

  // Determine badge type for era
  const getEraBadge = useCallback((era) => {
    // Show DEV badge for development eras (admins/testers only)
    if (era.status === 'development') {
      return 'dev';
    }
    
    if (era.free) return 'free';
    
    const hasAccess = userRights.get(era.id);
    if (hasAccess) return 'owned';
    
    return 'buy';
  }, [userRights]);

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
        <InfoButton onClick={() => setShowInfo(true)} />
        
        {/* v0.5.2: GameGuide replaces InfoPanel with static content */}
        <GameGuide
          section="era"
          manualOpen={showInfo}
          onClose={() => setShowInfo(false)}
        />

        <div className="content-pane content-pane--wide">
          <div className="card-header">
            <h2 className="card-title">Select Battle Era</h2>
            <p className="card-subtitle">Choose your naval battlefield</p>
          </div>

          {/* Era list using new shared classes */}
          <div className="era-list scrollable-list">
            {availableEras.map((era) => {
              const badgeType = getEraBadge(era);
              const isAccessible = badgeType === 'free' || badgeType === 'owned' || badgeType === 'dev';
              
              return (
                <div
                  key={era.id}
                  className={`selectable-item era-item ${selectedEra?.id === era.id ? 'selectable-item--selected' : ''} ${!isAccessible ? 'selectable-item--locked' : ''}`}
                  onClick={() => handleEraSelect(era)}
                >
                  <div className="item-header">
                    <span className="item-name">{era.name}</span>
                    {badgeType === 'free' && <span className="badge badge--success">FREE</span>}
                    {badgeType === 'owned' && <span className="badge badge--success">✓</span>}
                    {badgeType === 'buy' && <span className="badge badge--primary">BUY</span>}
                    {badgeType === 'dev' && <span className="badge badge--warning">DEV</span>}
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
