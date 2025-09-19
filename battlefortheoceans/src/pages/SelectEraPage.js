// src/pages/SelectEraPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';
import './Pages.css';
import './SelectEraPage.css';

const version = 'v0.1.21';

const SelectEraPage = () => {
  const { dispatch, stateMachine, updateEraConfig, updateSelectedOpponent } = useGame();
  const [selectedEra, setSelectedEra] = useState(null);
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);

  // Handle opponent selection and create complete opponent object with ID
  const handleOpponentSelect = (opponent) => {
    const timestamp = Date.now();
    const sanitizedName = opponent.name.toLowerCase().replace(/\s+/g, '-');
    const completeOpponent = {
      ...opponent,
      id: opponent.id || `ai-${sanitizedName}-${timestamp}`,
      type: 'ai'
    };
    
    console.log(version, 'Created AI opponent with ID:', completeOpponent.id);
    setSelectedOpponent(completeOpponent);
  };
        
  const handleCloseDialog = () => {
    if (selectedEra && selectedOpponent) {
      // Store the era config and opponent in GameContext
      updateEraConfig(selectedEra);
      updateSelectedOpponent(selectedOpponent);
      
      console.log(version, 'Storing era config and firing PLACEMENT event');
      console.log(version, 'Era config:', selectedEra.name);
      console.log(version, 'Selected opponent:', selectedOpponent.name, 'with ID:', selectedOpponent.id);
      
      if (dispatch) {
        dispatch(stateMachine.event.PLACEMENT);
      } else {
        console.error(version, 'Dispatch is not available in handleCloseDialog');
      }
    } else {
      console.error(version, 'Missing era or opponent selection');
    }
  };

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
          <div className="loading-message">
            <h2>Loading Battle Eras...</h2>
            <p>Fetching available game configurations</p>
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
    );
  }

  // No eras found
  if (!loading && eras.length === 0) {
    return (
      <div className="page-base">
        <div className="page-content">
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
                className={`era-item ${selectedId === era.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedId(era.id);
                  setSelectedEra(era);
                  setSelectedOpponent(null); // Reset opponent selection
                }}
              >
                <div className="era-header">
                  <span className="era-name">{era.name}</span>
                  {era.free && <span className="era-badge free">FREE</span>}
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
            <div className="opponent-selection">
              <div className="game-info">
                <h3>Choose Your Opponent</h3>
                <p>Select an AI captain to battle against</p>
              </div>
              
              <div className="opponent-slider">
                {selectedEra.ai_captains.slice(0, 3).map((opponent, index) => (
                  <div
                    key={index}
                    className={`opponent-item ${selectedOpponent?.name === opponent.name ? 'selected' : ''}`}
                    onClick={() => handleOpponentSelect(opponent)}
                  >
                    <div className="opponent-header">
                      <div className="opponent-name">{opponent.name}</div>
                      <div className="opponent-difficulty">
                        Difficulty: {Math.round(opponent.difficulty * 100)}%
                      </div>
                    </div>
                    <div className="opponent-description">{opponent.description}</div>
                    <div className="opponent-strategy">Strategy: {opponent.strategy.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
              
              <button
                className="btn btn-primary btn-large"
                disabled={!selectedEra || !selectedOpponent}
                onClick={handleCloseDialog}
              >
                Begin Battle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectEraPage;

// EOF
