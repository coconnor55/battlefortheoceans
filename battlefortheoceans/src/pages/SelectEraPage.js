// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';
import './Pages.css';
import './SelectEraPage.css';

const version = 'v0.2.2';

const SelectEraPage = () => {
  const {
    dispatch,
    stateMachine
  } = useGame();
  
  // Local UI state for browsing - not committed to game logic until "Join"
  const [selectedEra, setSelectedEra] = useState(null);
  
  // Data fetching state
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle era selection - local UI state only
  const handleEraSelect = useCallback((era) => {
    console.log(version, 'Era selected (UI state):', era.name);
    setSelectedEra(era);
  }, []);

  // Join alliance and transition to SelectOpponentPage
  const handleJoinAlliance = useCallback((alliance) => {
    if (selectedEra) {
      console.log(version, 'Joining alliance and transitioning to opponent selection:');
      console.log(version, 'Era:', selectedEra.name);
      console.log(version, 'Alliance:', alliance.name);
      
      // Commit era and alliance selection to game logic
      dispatch(stateMachine.event.SELECTOPPONENT, {
        eraConfig: selectedEra,
        selectedAlliance: alliance.name
      });
    } else {
      console.error(version, 'Missing era selection');
    }
  }, [selectedEra, dispatch, stateMachine]);

  // For non-choose_alliance eras (Traditional), go directly to opponent selection
  const handleChooseOpponent = useCallback(() => {
    if (selectedEra) {
      console.log(version, 'Transitioning to opponent selection (no alliance choice):');
      console.log(version, 'Era:', selectedEra.name);
      
      // Commit era selection to game logic
      dispatch(stateMachine.event.SELECTOPPONENT, {
        eraConfig: selectedEra
      });
    } else {
      console.error(version, 'Missing era selection');
    }
  }, [selectedEra, dispatch, stateMachine]);

  // Fetch eras only once on mount
  useEffect(() => {
    const fetchEras = async () => {
      setLoading(true);
      console.log(version, 'Fetching eras from era_configs');
      
      const { data, error, status } = await supabase
        .from('era_configs')
        .select('id, config, created_at');
        
      console.log(version, 'Supabase response:', { data, error, status });
      
      if (error) {
        setError(error.message);
        console.error(version, 'Error fetching eras:', error);
      } else {
        console.log(version, 'Raw data from Supabase:', data);
        
        const parsedEras = data.map(row => {
          try {
            const config = typeof row.config === 'object' ? row.config : JSON.parse(row.config);
            return { ...config, id: row.id, created_at: row.created_at };
          } catch (parseError) {
            console.error(version, 'Error parsing config for row:', row, parseError);
            return null;
          }
        }).filter(era => era !== null)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
        setEras(parsedEras);
        console.log(version, 'Parsed eras:', parsedEras);
      }
      setLoading(false);
    };
    
    fetchEras();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="page-base">
        <div className="page-content">
            <div className="content-frame">
              <div className="loading-message">
                <h2>Loading Battle Eras...</h2>
                <p>Fetching available game configurations</p>
              </div>
            </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="page-base">
        <div className="page-content">
            <div className="content-frame">
              <div className="error-message">
                <h2>Error Loading Eras</h2>
                <p>{error}</p>
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            </div>
        </div>
      </div>
    );
  }

  // No eras found
  if (!loading && eras.length === 0) {
    return (
      <div className="page-base">
        <div className="page-content">
            <div className="content-frame">
              <div className="error-message">
                <h2>No Battle Eras Available</h2>
                <p>Cannot load era configurations - try again later.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="page-header">
            <h2>Select Battle Era</h2>
            <p>Choose your naval battlefield</p>
          </div>

          <div className="era-list">
            {eras.map((era) => (
              <div
                key={era.id}
                className={`era-item ${selectedEra?.id === era.id ? 'selected' : ''}`}
                onClick={() => handleEraSelect(era)}
              >
                <div className="era-header">
                  <span className="era-name">{era.name}</span>
                  {era.free && <span className="green-badge">FREE</span>}
                </div>
                <div className="era-description">{era.era_description}</div>
                <div className="era-details">
                  <span className="era-grid">{era.rows}×{era.cols} grid</span>
                  <span className="era-players">Max {era.max_players} players</span>
                </div>
              </div>
            ))}
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
                    <h3>Ready for Battle</h3>
                    <p>Proceed to select your opponent</p>
                  </div>
                  
                  <button
                    className="btn btn-primary btn-large"
                    onClick={handleChooseOpponent}
                  >
                    Choose Opponent
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectEraPage;

// EOF
