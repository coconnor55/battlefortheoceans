// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import PurchasePage from './PurchasePage';

const version = 'v0.3.6';

const SelectEraPage = () => {
  const {
    dispatch,
    events,
    userProfile,
    getUserRights,
    eraService
  } = useGame();
  
  // Local UI state for browsing - not committed to game logic until button click
  const [selectedEra, setSelectedEra] = useState(null);
  
  // Data fetching state
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Rights and purchase state
  const [userRights, setUserRights] = useState(new Map());
  const [showPurchasePage, setShowPurchasePage] = useState(false);
  const [purchaseEraId, setPurchaseEraId] = useState(null);

  // Handle era selection - check if user has access
  const handleEraSelect = useCallback((era) => {
    console.log(version, 'Era selected (UI state):', era.name);
    
    // Check if era is accessible
    const hasAccess = userRights.get(era.id) || era.free;
    
    if (hasAccess) {
      setSelectedEra(era);
    } else {
      // Era is locked - show purchase page
      console.log(version, 'Era locked, opening purchase page:', era.id);
      setPurchaseEraId(era.id);
      setShowPurchasePage(true);
    }
  }, [userRights]);

  // Handle purchase completion
  const handlePurchaseComplete = useCallback(async (eraId) => {
    console.log(version, 'Purchase completed for era:', eraId);
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
    console.log(version, 'Purchase cancelled');
    setShowPurchasePage(false);
    setPurchaseEraId(null);
  }, []);

  // Transition to opponent selection - NO alliance selection here anymore
  const handlePlayEra = useCallback(() => {
    if (!selectedEra) {
      console.error(version, 'No era selected');
      return;
    }

    console.log(version, 'Transitioning to opponent selection with era:', selectedEra.name);
    
    // Commit era selection to game logic
    // Alliance selection will happen in SelectOpponentPage if needed
    dispatch(events.SELECTOPPONENT, {
      eraConfig: selectedEra
    });
  }, [selectedEra, dispatch, events]);

  // Fetch user rights using GameContext singleton
  const fetchUserRights = useCallback(async () => {
    if (!userProfile?.id) {
      console.log(version, 'No user profile, skipping rights fetch');
      return;
    }

    try {
      console.log(version, 'Fetching user rights for:', userProfile.id);
      const rights = await getUserRights(userProfile.id);
      
      // Create a map of era access
      const rightsMap = new Map();
      rights.forEach(right => {
        if (right.rights_type === 'era') {
          rightsMap.set(right.rights_value, true);
        }
      });
      
      setUserRights(rightsMap);
      console.log(version, 'User rights loaded:', rightsMap);
    } catch (error) {
      console.error(version, 'Error fetching user rights:', error);
    }
  }, [userProfile?.id, getUserRights]);

  // Fetch eras using EraService
  useEffect(() => {
    const fetchEras = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(version, 'Fetching eras using EraService');
        
        if (!eraService) {
          throw new Error('EraService not available from GameContext');
        }
        
        const eraList = await eraService.getAllEras();
        
        console.log(version, 'Eras loaded via EraService:', eraList.length);
        setEras(eraList);
        
      } catch (fetchError) {
        console.error(version, 'Error fetching eras:', fetchError);
        setError(fetchError.message || 'Failed to load eras');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEras();
  }, [eraService]);

  // Fetch user rights when user profile changes
  useEffect(() => {
    fetchUserRights();
  }, [fetchUserRights]);

  // Determine badge type for era
  const getEraBadge = useCallback((era) => {
    if (era.free) return 'free';
    
    const hasAccess = userRights.get(era.id);
    if (hasAccess) return 'owned';
    
    return 'buy';
  }, [userRights]);

  // Loading state
  if (loading) {
    return (
      <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
        <div className="loading">
          <div className="spinner spinner--lg"></div>
          <h2>Loading Battle Eras...</h2>
          <p>Fetching available game configurations</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
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
  if (!loading && eras.length === 0) {
    return (
      <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
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
    <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
      <div className="content-pane content-pane--wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <h2 className="card-title">Select Battle Era</h2>
          <p className="card-subtitle">Choose your naval battlefield</p>
        </div>

        <div className="era-list">
          {eras.map((era) => {
            const badgeType = getEraBadge(era);
            const isAccessible = badgeType === 'free' || badgeType === 'owned';
            
            return (
              <div
                key={era.id}
                className={`era-item ${selectedEra?.id === era.id ? 'era-item--selected' : ''} ${!isAccessible ? 'era-item--locked' : ''}`}
                onClick={() => handleEraSelect(era)}
              >
                <div className="era-header">
                  <span className="era-name">{era.name}</span>
                  {badgeType === 'free' && <span className="badge badge--success">FREE</span>}
                  {badgeType === 'owned' && <span className="badge badge--success">✓</span>}
                  {badgeType === 'buy' && <span className="badge badge--primary">BUY</span>}
                </div>
                <div className="era-description">{era.era_description}</div>
                <div className="era-details">
                  <span className="era-grid">{era.rows}×{era.cols} grid</span>
                  <span className="era-players">Max {era.max_players} players</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="divider">
          <span>Choose Era</span>
        </div>

        {/* Action Section - Always Visible */}
        <div className="action-section" style={{
          padding: '2rem',
          textAlign: 'center',
          minHeight: '100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          {!selectedEra ? (
            <p style={{ color: 'rgba(148, 163, 184, 0.8)' }}>
              Select an era above to continue
            </p>
          ) : (
            <button
              className="btn btn--primary btn--lg"
              onClick={handlePlayEra}
            >
              Play {selectedEra.name}
            </button>
          )}
        </div>
      </div>

      {/* Purchase Page Modal - Uses new CSS classes */}
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
