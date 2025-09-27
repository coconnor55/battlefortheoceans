// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import PurchasePage from './PurchasePage';

const version = 'v0.3.3';

const SelectEraPage = () => {
  const {
    dispatch,
    events,
    userProfile,
    getUserRights,
    eraService
  } = useGame();
  
  // Local UI state for browsing - not committed to game logic until "Join"
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

  // Handle BUY badge click - direct to purchase
  const handleBuyClick = useCallback((era, event) => {
    event.stopPropagation();
    console.log(version, 'Buy clicked for era:', era.id);
    setPurchaseEraId(era.id);
    setShowPurchasePage(true);
  }, []);

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
    
    // Show success message
    alert(`Era unlocked! You can now play ${eraId}.`);
  }, [eras]);

  // Handle purchase cancellation
  const handlePurchaseCancel = useCallback(() => {
    console.log(version, 'Purchase cancelled');
    setShowPurchasePage(false);
    setPurchaseEraId(null);
  }, []);

  // Join alliance and transition to SelectOpponentPage
  const handleJoinAlliance = useCallback((alliance) => {
    if (selectedEra) {
      console.log(version, 'Joining alliance and transitioning to opponent selection:');
      console.log(version, 'Era:', selectedEra.name);
      console.log(version, 'Alliance:', alliance.name);
      
      // Commit era and alliance selection to game logic
      dispatch(events.SELECTOPPONENT, {
        eraConfig: selectedEra,
        selectedAlliance: alliance.name
      });
    } else {
      console.error(version, 'Missing era selection');
    }
  }, [selectedEra, dispatch, events]);

  // For non-choose_alliance eras (Traditional), go directly to opponent selection
  const handleChooseOpponent = useCallback(() => {
    if (selectedEra) {
      console.log(version, 'Transitioning to opponent selection (no alliance choice):');
      console.log(version, 'Era:', selectedEra.name);
      
      // Commit era selection to game logic
      dispatch(events.SELECTOPPONENT, {
        eraConfig: selectedEra
      });
    } else {
      console.error(version, 'Missing era selection');
    }
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
          <div className="spinner spinner-lg"></div>
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
        <div className="content-pane content-pane-narrow">
          <div className="card-header">
            <h2 className="card-title">Error Loading Eras</h2>
          </div>
          <div className="card-body">
            <p className="error-message">{error}</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn-primary"
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
        <div className="content-pane content-pane-narrow">
          <div className="card-header">
            <h2 className="card-title">No Battle Eras Available</h2>
          </div>
          <div className="card-body">
            <p>Cannot load era configurations - try again later.</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn-primary"
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
      <div className="content-pane content-pane-wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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
                className={`era-item ${selectedEra?.id === era.id ? 'selected' : ''} ${!isAccessible ? 'locked' : ''}`}
                onClick={() => handleEraSelect(era)}
              >
                <div className="era-header">
                  <span className="era-name">{era.name}</span>
                  {badgeType === 'free' && <span className="badge badge-success">FREE</span>}
                  {badgeType === 'owned' && <span className="badge badge-success">✓</span>}
                  {badgeType === 'buy' && <span className="badge badge-primary">BUY</span>}
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

        {selectedEra && (
          <div className="alliance-selection">
            {selectedEra.game_rules?.choose_alliance ? (
              // Show alliance selection for choose_alliance eras (Midway)
              <div className="alliance-choice">
                <div className="game-info">
                  <h3>Choose Your Alliance</h3>
                  <p>Select which side you want to command</p>
                </div>
                
                <div className="alliance-list">
                  {selectedEra.alliances?.map((alliance) => (
                    <div key={alliance.name} className="alliance-item">
                      <div className="alliance-header">
                        <div className="alliance-name">{alliance.name}</div>
                        <div className="alliance-ships">
                          {alliance.ships?.length || 0} ships
                        </div>
                      </div>
                      <div className="alliance-description">
                        {alliance.description}
                      </div>
                      <div className="alliance-fleet">
                        <strong>Fleet:</strong> {alliance.ships?.map(s => s.name).join(', ')}
                      </div>
                      <button
                        className="btn btn-primary alliance-join-btn"
                        onClick={() => handleJoinAlliance(alliance)}
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Show direct opponent selection for non-choose_alliance eras (Traditional)
              <div className="opponent-choice">
                <div className="game-info">
                  <p>Who will you be going up against?</p>
                </div>
                
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleChooseOpponent}
                >
                  Choose Opponent
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Purchase Page Modal */}
      {showPurchasePage && (
        <PurchasePage
          eraId={purchaseEraId}
          onComplete={handlePurchaseComplete}
          onCancel={handlePurchaseCancel}
        />
      )}
    </div>
  );
};

export default SelectEraPage;

// EOF
