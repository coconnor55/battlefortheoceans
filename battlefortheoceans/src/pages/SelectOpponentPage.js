// src/pages/SelectOpponentPage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';
import './Pages.css';
import './SelectOpponentPage.css';

const version = 'v0.1.1';

const SelectOpponentPage = () => {
  const {
    dispatch,
    stateMachine,
    eraConfig,
    selectedAlliance,
    updateSelectedOpponent,
    updateSelectedAlliance
  } = useGame();
  
  // Local UI state
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [localSelectedAlliance, setLocalSelectedAlliance] = useState(selectedAlliance);
  const [onlineHumans, setOnlineHumans] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // Handle alliance selection (for choose_alliance eras)
  const handleAllianceSelect = useCallback((allianceName) => {
    console.log(version, 'Alliance selected:', allianceName);
    setLocalSelectedAlliance(allianceName);
    // Clear opponent selection when alliance changes
    setSelectedOpponent(null);
  }, []);

  // Get AI captains based on era configuration
  const getAvailableAICaptains = useCallback(() => {
    if (!eraConfig) return [];
    
    const requiresAlliance = eraConfig.game_rules?.choose_alliance;
    const currentAlliance = localSelectedAlliance || selectedAlliance;
    
    if (requiresAlliance && currentAlliance) {
      // For choose_alliance eras, get AI captains from opposing alliance
      const opposingAlliance = eraConfig.alliances?.find(a => a.name !== currentAlliance);
      return opposingAlliance?.ai_captains || [];
    } else {
      // For non-choose_alliance eras (Traditional), get AI captains from 'Opponent' alliance
      const opponentAlliance = eraConfig.alliances?.find(a => a.name === 'Opponent');
      return opponentAlliance?.ai_captains || [];
    }
  }, [eraConfig, localSelectedAlliance, selectedAlliance]);

  // Proceed to placement
  const handleBeginBattle = useCallback(() => {
    if (!selectedOpponent) {
      console.error(version, 'No opponent selected');
      return;
    }

    const requiresAlliance = eraConfig?.game_rules?.choose_alliance;
    const currentAlliance = localSelectedAlliance || selectedAlliance;

    // Check if alliance selection is required
    if (requiresAlliance && !currentAlliance) {
      console.error(version, 'Alliance selection required but not selected');
      return;
    }

    console.log(version, 'Proceeding to placement with:');
    console.log(version, 'Era:', eraConfig.name);
    console.log(version, 'Opponent:', selectedOpponent.name, selectedOpponent.type);
    console.log(version, 'Alliance:', currentAlliance);
    
    // Commit selections to game logic
    updateSelectedOpponent(selectedOpponent);
    if (currentAlliance) {
      updateSelectedAlliance(currentAlliance);
    }
    
    // Transition to placement
    dispatch(stateMachine.event.PLACEMENT, {
      eraConfig: eraConfig,
      selectedOpponent: selectedOpponent,
      selectedAlliance: currentAlliance
    });
  }, [selectedOpponent, localSelectedAlliance, selectedAlliance, eraConfig, dispatch, stateMachine, updateSelectedOpponent, updateSelectedAlliance]);

  // Fetch online human players
  const fetchOnlineHumans = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, last_seen')
        .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Online in last 5 minutes
        .neq('id', (await supabase.auth.getUser()).data.user?.id); // Exclude current user

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
      <div className="page-base">
        <div className="page-content">
            <div className="content-frame">
              <div className="error-message">
                <h2>No Era Selected</h2>
                <p>Please select an era first</p>
                <button
                  className="btn btn-primary"
                  onClick={() => dispatch(stateMachine.event.ERA)}
                >
                  Back to Era Selection
                </button>
              </div>
            </div>
        </div>
      </div>
    );
  }

  const requiresAlliance = eraConfig.game_rules?.choose_alliance;
  const currentAlliance = localSelectedAlliance || selectedAlliance;
  const canProceed = selectedOpponent && (!requiresAlliance || currentAlliance);
  const availableAICaptains = getAvailableAICaptains();

  return (
    <div className="page-base">
      <div className="page-content">
        <div className="content-frame">
          <div className="page-header">
            <h2>Select Opponent</h2>
            <p>Playing: <strong>{eraConfig.name}</strong></p>
            {currentAlliance && <p>Alliance: <strong>{currentAlliance}</strong></p>}
          </div>

          {/* Alliance Selection - shown if era requires it and not already selected */}
          {requiresAlliance && !currentAlliance && (
            <div className="alliance-selection">
              <div className="game-info">
                <h3>Choose Your Alliance</h3>
                <p>Select which side you want to command</p>
              </div>
              
              <div className="alliance-list">
                {eraConfig.alliances.map((alliance) => (
                  <div
                    key={alliance.name}
                    className={`alliance-item ${localSelectedAlliance === alliance.name ? 'selected' : ''}`}
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

          {/* AI Opponents - only show if alliance is selected (for choose_alliance eras) or era doesn't require alliance choice */}
          {(!requiresAlliance || currentAlliance) && (
            <div className="ai-opponents">
              <div className="game-info">
                <h3>AI Opponents</h3>
                <p>Battle against computer captains</p>
                {requiresAlliance && currentAlliance && (
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

          {/* Human Opponents - only show if alliance is selected (for choose_alliance eras) or era doesn't require alliance choice */}
          {(!requiresAlliance || currentAlliance) && (
            <div className="human-opponents">
              <div className="game-info">
                <h3>Human Opponents</h3>
                <p>Challenge other players online</p>
                <button
                  className="btn btn-secondary btn-small"
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
                          {human.full_name || human.email.split('@')[0]}
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
              onClick={() => dispatch(stateMachine.event.ERA)}
            >
              Back to Eras
            </button>
            
            <button
              className="btn btn-primary btn-large"
              disabled={!canProceed}
              onClick={handleBeginBattle}
            >
              Begin Battle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectOpponentPage;

// EOF
