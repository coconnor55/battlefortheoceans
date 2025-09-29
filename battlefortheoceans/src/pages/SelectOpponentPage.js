// src/pages/SelectOpponentPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';

const version = 'v0.3.5';

const SelectOpponentPage = () => {
  const {
    dispatch,
    events,
    eraConfig
  } = useGame();
  
  // Local UI state - alliance selection happens HERE now
  const [selectedAlliance, setSelectedAlliance] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [onlineHumans, setOnlineHumans] = useState([]);
  const [loading, setLoading] = useState(false);

  // Handle alliance selection (for choose_alliance eras)
  const handleAllianceSelect = useCallback((allianceName) => {
    console.log(version, 'Alliance selected:', allianceName);
    setSelectedAlliance(allianceName);
    // Clear opponent selection when alliance changes
    setSelectedOpponent(null);
  }, []);

  // Handle AI opponent selection
  const handleAIOpponentSelect = useCallback((opponent) => {
    const timestamp = Date.now();
    const sanitizedName = opponent.name.toLowerCase().replace(/\s+/g, '-');
    const completeOpponent = {
      ...opponent,
      id: opponent.id || `ai-${sanitizedName}-${timestamp}`,
      type: 'ai'
    };
    
    console.log(version, 'AI Opponent selected:', completeOpponent.name);
    setSelectedOpponent(completeOpponent);
  }, []);

  // Handle human opponent selection
  const handleHumanOpponentSelect = useCallback((human) => {
    const completeOpponent = {
      ...human,
      type: 'human'
    };
    
    console.log(version, 'Human Opponent selected:', completeOpponent.name);
    setSelectedOpponent(completeOpponent);
  }, []);

  // Get AI captains based on era configuration
  const getAvailableAICaptains = useCallback(() => {
    if (!eraConfig) return [];
    
    const requiresAlliance = eraConfig.game_rules?.choose_alliance;
    
    if (requiresAlliance && selectedAlliance) {
      // For choose_alliance eras, get AI captains from opposing alliance
      const opposingAlliance = eraConfig.alliances?.find(a => a.name !== selectedAlliance);
      return opposingAlliance?.ai_captains || [];
    } else if (!requiresAlliance) {
      // For non-choose_alliance eras (Traditional), get AI captains from 'Opponent' alliance
      const opponentAlliance = eraConfig.alliances?.find(a => a.name === 'Opponent');
      return opponentAlliance?.ai_captains || [];
    }
    
    return [];
  }, [eraConfig, selectedAlliance]);

  // Proceed to placement
  const handleBeginBattle = useCallback(() => {
    if (!selectedOpponent) {
      console.error(version, 'No opponent selected');
      return;
    }

    const requiresAlliance = eraConfig?.game_rules?.choose_alliance;

    // Check if alliance selection is required
    if (requiresAlliance && !selectedAlliance) {
      console.error(version, 'Alliance selection required but not selected');
      return;
    }

    console.log(version, 'Proceeding to placement with:');
    console.log(version, 'Era:', eraConfig.name);
    console.log(version, 'Opponent:', selectedOpponent.name, selectedOpponent.type);
    console.log(version, 'Alliance:', selectedAlliance || 'none');
    
    // Transition to placement with all data
    // CoreEngine will handle storing this in processEventData
    dispatch(events.PLACEMENT, {
      eraConfig: eraConfig,
      selectedOpponent: selectedOpponent,
      selectedAlliance: selectedAlliance
    });
  }, [selectedOpponent, selectedAlliance, eraConfig, dispatch, events]);

  // Fetch online human players
  const fetchOnlineHumans = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, game_name, last_seen')
        .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .neq('id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error(version, 'Error fetching online humans:', error);
      } else {
        setOnlineHumans(data || []);
        console.log(version, 'Found online humans:', data?.length || 0);
      }
    } catch (err) {
      console.error(version, 'Error in fetchOnlineHumans:', err);
    }
    setLoading(false);
  }, []);

  // Fetch online humans on mount
  useEffect(() => {
    fetchOnlineHumans();
  }, [fetchOnlineHumans]);

  // Error state - missing era
  if (!eraConfig) {
    return (
      <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
        <div className="content-pane content-pane-narrow">
          <div className="card-header">
            <h2 className="card-title">No Era Selected</h2>
          </div>
          <div className="card-body">
            <p>Please select an era first</p>
          </div>
          <div className="card-footer">
            <button
              className="btn btn-primary"
              onClick={() => dispatch(events.ERA)}
            >
              Back to Era Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const requiresAlliance = eraConfig.game_rules?.choose_alliance;
  const canProceed = selectedOpponent && (!requiresAlliance || selectedAlliance);
  const availableAICaptains = getAvailableAICaptains();

  return (
    <div className="container flex flex-column flex-center" style={{ minHeight: '100vh' }}>
      <div className="content-pane content-pane-wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <h2 className="card-title">Select Opponent</h2>
          <p className="card-subtitle">Playing: <strong>{eraConfig.name}</strong></p>
          {selectedAlliance && <p className="card-subtitle">Alliance: <strong>{selectedAlliance}</strong></p>}
        </div>

        {/* Alliance Selection - FIRST if required */}
        {requiresAlliance && !selectedAlliance && (
          <div className="alliance-selection">
            <div className="game-info">
              <h3>Choose Your Side</h3>
              <p>Select which alliance you want to command</p>
            </div>
            
            <div className="alliance-list">
              {eraConfig.alliances.map((alliance) => (
                <div
                  key={alliance.name}
                  className={`alliance-item ${selectedAlliance === alliance.name ? 'selected' : ''}`}
                  onClick={() => handleAllianceSelect(alliance.name)}
                >
                  <div className="alliance-header">
                    <span className="alliance-name">{alliance.name}</span>
                    <span className="ship-count">
                      {alliance.ships?.length || 0} Ships
                    </span>
                  </div>
                  <div className="alliance-description">
                    {alliance.description}
                  </div>
                  <div className="alliance-ships">
                    <strong>Fleet:</strong> {alliance.ships?.map((ship, idx) => (
                      <span key={idx} className="ship-name">
                        {ship.name}
                        {idx < alliance.ships.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Opponents - Show after alliance selected OR if no alliance required */}
        {(!requiresAlliance || selectedAlliance) && (
          <div className="ai-opponents">
            <div className="game-info">
              <h3>AI Opponents</h3>
              <p>Battle against computer captains</p>
              {requiresAlliance && selectedAlliance && (
                <p className="hint">Facing opponents from opposing alliance</p>
              )}
            </div>
            
            <div className="opponent-list">
              {availableAICaptains.length === 0 ? (
                <div className="no-humans">
                  <p>No AI captains available</p>
                  <p className="hint">Check era configuration</p>
                </div>
              ) : (
                availableAICaptains.map((opponent, index) => (
                  <div
                    key={index}
                    className={`opponent-item ai-opponent ${selectedOpponent?.name === opponent.name ? 'selected' : ''}`}
                    onClick={() => handleAIOpponentSelect(opponent)}
                  >
                    <div className="opponent-header">
                      <div className="opponent-name">{opponent.name}</div>
                      <div className="green-badge">
                        {opponent.difficulty?.toUpperCase() || 'NORMAL'}
                      </div>
                    </div>
                    <div className="opponent-description">{opponent.description}</div>
                    <div className="opponent-type">AI Captain</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Human Opponents - Show after alliance selected OR if no alliance required */}
        {(!requiresAlliance || selectedAlliance) && (
          <div className="human-opponents">
            <div className="game-info">
              <h3>Human Opponents</h3>
              <p>Challenge other players online</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchOnlineHumans}
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Refresh'}
              </button>
            </div>
            
            <div className="opponent-list">
              {onlineHumans.length === 0 ? (
                <div className="no-humans">
                  <p>No human players online</p>
                  <p className="hint">Human vs Human battles coming soon!</p>
                </div>
              ) : (
                onlineHumans.map((human) => (
                  <div
                    key={human.id}
                    className={`opponent-item human-opponent ${selectedOpponent?.id === human.id ? 'selected' : ''}`}
                    onClick={() => handleHumanOpponentSelect(human)}
                  >
                    <div className="opponent-header">
                      <div className="opponent-name">
                        {human.game_name || 'Player'}
                      </div>
                      <div className="online-badge">ONLINE</div>
                    </div>
                    <div className="opponent-description">
                      Last seen: {new Date(human.last_seen).toLocaleTimeString()}
                    </div>
                    <div className="opponent-type">Human Player</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="action-buttons">
          <button
            className="btn btn-secondary"
            onClick={() => dispatch(events.ERA)}
          >
            Back to Eras
          </button>
          
          <button
            className="btn btn-primary btn-lg"
            disabled={!canProceed}
            onClick={handleBeginBattle}
          >
            Begin Battle
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectOpponentPage;

// EOF
