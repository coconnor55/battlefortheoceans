// src/pages/SelectEraPage.js (v0.1.5)
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import './SelectEraPage.css';

const SelectEraPage = () => {
  const [selectedEra, setSelectedEra] = useState(null);
  const [eras, setEras] = useState([]);
  const [opponents, setOpponents] = useState(['Player1', 'Player2', 'Player3', 'Player4']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEras = async () => {
      setLoading(true);
      console.log('v0.1.5: Fetching eras from era_configs');
      const { data, error, status } = await supabase.from('era_configs').select('id, config, created_at');
      console.log('v0.1.5: Fetch response - status:', status, 'data:', data, 'error:', error);
      if (error) {
        setError(error.message);
        console.error('v0.1.5: Error fetching eras:', error);
      } else {
        console.log('v0.1.5: Raw data from Supabase:', data);
        const parsedEras = data.map(row => {
          try {
            const config = JSON.parse(row.config);
            return { ...config, id: row.id, created_at: row.created_at };
          } catch (parseError) {
            console.error('v0.1.5: Error parsing config for row:', row, parseError);
            return null;
          }
        }).filter(era => era !== null);
        setEras(parsedEras);
        console.log('v0.1.5: Parsed eras:', parsedEras);
      }
      setLoading(false);
    };
    fetchEras();
  }, []);

  useEffect(() => {
    if (eras.length > 0) {
      setEras([...eras].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
  }, [eras]);

  if (loading) return <div>Loading eras...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="select-era-page">
      <h2>Select Era</h2>
      <div className="era-list">
        {eras.map((era) => (
          <div key={era.id} className="era-item" onClick={() => setSelectedEra(era)}>
            {era.name} - {era.era_description} (Created: {new Date(era.created_at).toLocaleDateString()})
          </div>
        ))}
      </div>
      {selectedEra && (
        <div className="opponent-list">
          <h3>Opponents</h3>
          <div className="opponent-slider">
            {opponents.map((opponent, index) => (
              <div key={index} className="opponent-item" onClick={() => {/* Add opponent selection logic later */}}>
                {opponent}
              </div>
            ))}
          </div>
          <button className="play-now" disabled={!selectedEra}>Play Now</button>
        </div>
      )}
    </div>
  );
};

export default SelectEraPage;

// EOF - EOF - EOF
