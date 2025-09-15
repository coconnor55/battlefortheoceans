// src/pages/SelectEraPage.js (v0.1.14)
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';
import './SelectEraPage.css';

const version = 'v0.1.15';

const SelectEraPage = () => {
  const { dispatch, stateMachine, setSelectedEra } = useGame();
  const [selectedEra, setSelectedEraLocal] = useState(null);
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);

  const handleCloseDialog = () => {
    if (dispatch && selectedEra && selectedOpponent) {
      console.log(version, 'SelectEraPage', 'Storing era and opponent in GameContext');
      // Store the selected era and opponent in GameContext
      setSelectedEra(selectedEra, selectedOpponent);
      
      console.log(version, 'SelectEraPage', 'Firing PLACEMENT event from handleCloseDialog');
      dispatch(stateMachine.event.PLACEMENT);
    } else {
      console.error(version, 'SelectEraPage', 'Cannot proceed - missing era, opponent, or dispatch');
    }
  };

  // No clearGameData call needed - should be done in OverPage before transition
  useEffect(() => {
    const fetchEras = async () => {
      setLoading(true);
      console.log(version, 'Fetching eras from era_configs');
      const { data, error, status } = await supabase.from('era_configs').select('id, config, created_at');
      console.log(version, 'Supabase response:', JSON.stringify({ data: data, error: error, status: status }, null, 2));
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
        }).filter(era => era !== null).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setEras(parsedEras);
        console.log(version, 'Parsed eras after fix:', parsedEras);
      }
      setLoading(false);
    };
    fetchEras();
  }, []); // Simple fetch on mount, no state clearing

  const handleEraSelection = (era) => {
    setSelectedId(era.id);
    setSelectedEraLocal(era);
    setSelectedOpponent(null); // Reset opponent when era changes
  };

  const handleOpponentSelection = (opponent) => {
    setSelectedOpponent(opponent);
  };

  return (
    <div className="select-page">
      <div className="select-content">
        <h2>Select Era</h2>
        {loading && <p>Loading eras...</p>}
        {error && <p>Error: {error}</p>}
        <div className="era-list">
          {eras.map((era) => (
            <div
              key={era.id}
              className={`era-item ${selectedId === era.id ? 'selected' : ''}`}
              onClick={() => handleEraSelection(era)}
            >
              <span className="era-name">{era.name}</span> - {era.era_description}
            </div>
          ))}
        </div>
        {selectedEra && (
          <div className="opponent-list">
            <h3>Opponents</h3>
            <div className="opponent-slider">
              {selectedEra.ai_captains && selectedEra.ai_captains.slice(0, 3).map((opponent, index) => (
                 <div
                   key={index}
                   className={`opponent-item ${selectedOpponent?.name === opponent.name ? 'selected' : ''}`}
                   onClick={() => handleOpponentSelection(opponent)}
                 >
                   <span className="opponent-name">{opponent.name}</span>
                   {opponent.description && <p className="opponent-description">{opponent.description}</p>}
                 </div>
              ))}
            </div>
            <button
              className="select-button"
              disabled={!selectedEra || !selectedOpponent}
              onClick={handleCloseDialog}
            >
              Play Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectEraPage;

// EOF - EOF - EOF
