// src/pages/SelectOpponentPage.js v0.4.2
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';

const version = 'v0.4.2';

const SelectOpponentPage = () => {
  const {
    dispatch,
    events,
    eraConfig,
    userProfile
  } = useGame();
  
  // Redirect to login if no user profile
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);
  
  // Local UI state - alliance selection happens HERE now
  const [selectedAlliance, setSelectedAlliance] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [onlineHumans, setOnlineHumans] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Collapsible sections state
  const [aiExpanded, setAiExpanded] = useState(true);
  const [humanExpanded, setHumanExpanded] = useState(false);

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

  // Don't render if no userProfile (will redirect)
  if (!userProfile) {
    return null;
  }

  // Error state - missing era
  if (!eraConfig) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="card-header">
            <h2 className="card-title">No Era Selected</h2>
          </div>
          <div className="card-body">
            <p>Please select an era first</p>
            <p className="text-secondary">Use your browser's back button to return to era selection</p>
          </div>
        </div>
      </div>
    );
  }

  const requiresAlliance = eraConfig.game_rules?.choose_alliance;
  const canProceed = selectedOpponent && (!requiresAlliance || selectedAlliance);
  const availableAICaptains = getAvailableAICaptains();

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header">
          <h2 className="card-title">Select Opponent</h2>
          <p className="card-subtitle">Playing: <strong>{eraConfig.name}</strong></p>
          {selectedAlliance && <p className="card-subtitle">Alliance: <strong>{selectedAlliance}</strong></p>}
        </div>

        <div className="card-body">
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
                    className={`selectable-item alliance-item ${selectedAlliance === alliance.name ? 'selectable-item--selected' : ''}`}
                    onClick={() => handleAllianceSelect(alliance.name)}
                  >
                    <div className="item-header">
                      <span className="item-name">{alliance.name}</span>
                      <span className="ship-count">
                        {alliance.ships?.length || 0} Ships
                      </span>
                    </div>
                    <div className="item-description">
                      {alliance.description}
                    </div>
                    <div className="alliance-fleet">
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

          {/* Collapsible AI Opponents */}
          {(!requiresAlliance || selectedAlliance) && (
            <div className="collapsible-section">
              <div
                className="collapsible-section__header"
                onClick={() => setAiExpanded(!aiExpanded)}
              >
                <h4>
                  <span className="collapsible-section__icon">{aiExpanded ? '▼' : '▶'}</span>
                  AI Opponents ({availableAICaptains.length})
                </h4>
                <p className="text-secondary">Battle against computer captains</p>
              </div>
              
              {aiExpanded && (
                <div className="opponent-list scrollable-list scrollable-list--short">
                  {availableAICaptains.length === 0 ? (
                    <div className="empty-state">
                      <p>No AI captains available</p>
                      <p className="empty-state__hint">Check era configuration</p>
                    </div>
                  ) : (
                    availableAICaptains.map((opponent, index) => (
                      <div
                        key={index}
                        className={`selectable-item opponent-item ai-opponent ${selectedOpponent?.name === opponent.name ? 'selectable-item--selected' : ''}`}
                        onClick={() => handleAIOpponentSelect(opponent)}
                      >
                        <div className="item-header">
                          <div className="item-name">{opponent.name}</div>
                          <div className="badge badge--success">
                            {opponent.difficulty?.toUpperCase() || 'NORMAL'}
                          </div>
                        </div>
                        <div className="item-description">{opponent.description}</div>
                        <div className="opponent-type text-dim italics">AI Captain</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Human Opponents */}
          {(!requiresAlliance || selectedAlliance) && (
            <div className="collapsible-section">
              <div
                className="collapsible-section__header"
                onClick={() => setHumanExpanded(!humanExpanded)}
              >
                <h4>
                  <span className="collapsible-section__icon">{humanExpanded ? '▼' : '▶'}</span>
                  Human Opponents ({onlineHumans.length})
                </h4>
                <p className="text-secondary">Challenge other players online</p>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchOnlineHumans();
                  }}
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Refresh'}
                </button>
              </div>
              
              {humanExpanded && (
                <div className="opponent-list scrollable-list scrollable-list--short">
                  {onlineHumans.length === 0 ? (
                    <div className="empty-state">
                      <p>No human players online</p>
                      <p className="empty-state__hint">Human vs Human battles coming soon!</p>
                    </div>
                  ) : (
                    onlineHumans.map((human) => (
                      <div
                        key={human.id}
                        className={`selectable-item opponent-item human-opponent ${selectedOpponent?.id === human.id ? 'selectable-item--selected' : ''}`}
                        onClick={() => handleHumanOpponentSelect(human)}
                      >
                        <div className="item-header">
                          <div className="item-name">
                            {human.game_name || 'Player'}
                          </div>
                          <div className="badge badge--online">ONLINE</div>
                        </div>
                        <div className="item-description">
                          Last seen: {new Date(human.last_seen).toLocaleTimeString()}
                        </div>
                        <div className="opponent-type text-dim italics">Human Player</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* v0.4.2: Removed "Back to Era Selection" button - browser back button handles navigation */}
        <div className="card-footer">
          <button
            className="btn btn--primary btn--lg"
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
