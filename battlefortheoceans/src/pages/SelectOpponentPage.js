// src/pages/SelectOpponentPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.6.8: Fixed userProfile access AND opponents property name
//         - Line 33: Changed from coreEngine.userProfile to coreEngine.humanPlayer.userProfile
//         - Line 203: Changed selectedOpponents to opponents (matches CoreEngine expectation)
//         - CoreEngine processEventData expects data.opponents, not data.selectedOpponents
// v0.6.7: Fixed dispatch to send selectedOpponents array for consistency
//         - Traditional/Midway now sends [selectedOpponent] array
//         - Matches multi-fleet pattern and GameLifecycleManager expectations
// v0.6.6: Merged v0.6.5 property access with v0.5.5 complete UI code
//         - Use coreEngine.humanPlayer (Player instance for game logic)
//         - Use coreEngine.userProfile (database object for display)
//         - Restored all UI components, styling, and multi-fleet support
// v0.6.5: Fixed property names - use coreEngine.humanPlayer and coreEngine.userProfile
// v0.6.1: Replaced InfoPanel with GameGuide component
// v0.6.0: Multi-fleet combat support (Pirates of the Gulf)
// v0.5.0: Added avatar display for AI captains

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';
import InfoButton from '../components/InfoButton';
import GameGuide from '../components/GameGuide';

const version = 'v0.6.8';

const SelectOpponentPage = () => {
  const {
    coreEngine,
    dispatch,
    events,
    eraConfig
  } = useGame();
  
  // v0.6.8: Use CoreEngine properties for Player singleton pattern
  const player = coreEngine.humanPlayer;              // Player instance (game logic)
  const profile = coreEngine.humanPlayer.userProfile; // Database object (display)
  
  console.log('[OPPONENT]', version, 'Player=', player);
  console.log('[OPPONENT]', version, 'userProfile=', profile);
  
  useEffect(() => {
    if (!player) {
      console.log(version, 'No player detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [player, dispatch, events]);
  
  const [selectedAlliance, setSelectedAlliance] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  
  // v0.6.0: Multi-fleet selection state
  const [selectedPirateFleets, setSelectedPirateFleets] = useState([]);
  
  const [onlineHumans, setOnlineHumans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [aiExpanded, setAiExpanded] = useState(true);
  const [humanExpanded, setHumanExpanded] = useState(false);

  // v0.6.0: Check if this is multi-fleet combat era
  const isMultiFleet = eraConfig?.game_rules?.multi_fleet_combat;
  const pirateFleets = eraConfig?.alliances?.find(a => a.name === 'Pirates')?.pirate_fleets || [];

  const getDifficultyLabel = (difficulty) => {
    if (difficulty < 1.0) return 'Easy';
    if (difficulty === 1.0) return 'Medium';
    if (difficulty <= 1.4) return 'Hard';
    if (difficulty <= 1.7) return 'Expert';
    return 'Master';
  };

  const getDifficultyBadgeClass = (difficulty) => {
    if (difficulty < 1.0) return 'badge--success';
    if (difficulty === 1.0) return 'badge--primary';
    if (difficulty <= 1.4) return 'badge--warning';
    return 'badge--danger';
  };

  // v0.6.0: Calculate combined difficulty for multi-fleet
  const getCombinedDifficulty = useCallback(() => {
    if (selectedPirateFleets.length === 0) return 0;
    
    const multiplier = eraConfig.game_rules.fleet_difficulty_multipliers[selectedPirateFleets.length] || 1.0;
    const baseDifficulty = selectedPirateFleets.reduce((sum, fleet) => sum + fleet.ai_captain.difficulty, 0);
    
    return (baseDifficulty * multiplier).toFixed(1);
  }, [selectedPirateFleets, eraConfig]);

  // v0.6.0: Toggle pirate fleet selection
  const handleFleetToggle = useCallback((fleet) => {
    setSelectedPirateFleets(prev => {
      const isSelected = prev.some(f => f.fleet_id === fleet.fleet_id);
      
      if (isSelected) {
        // Deselect
        return prev.filter(f => f.fleet_id !== fleet.fleet_id);
      } else {
        // Select (check max limit)
        const maxFleets = eraConfig.game_rules.fleet_selection_max || 4;
        if (prev.length >= maxFleets) {
          console.log(version, 'Max fleet limit reached:', maxFleets);
          return prev;
        }
        return [...prev, fleet];
      }
    });
  }, [eraConfig]);

  const handleAllianceSelect = useCallback((allianceName) => {
    console.log(version, 'Alliance selected:', allianceName);
    setSelectedAlliance(allianceName);
    setSelectedOpponent(null);
  }, []);

  const handleAIOpponentSelect = useCallback((opponent) => {
    const timestamp = Date.now();
    const sanitizedName = opponent.name.toLowerCase().replace(/\s+/g, '-');
    const completeOpponent = {
      ...opponent,
      id: opponent.id || `ai-${sanitizedName}-${timestamp}`,
      type: 'ai'
    };
    
    console.log(version, 'AI Opponent selected:', completeOpponent.name, 'difficulty:', completeOpponent.difficulty);
    setSelectedOpponent(completeOpponent);
  }, []);

  const handleHumanOpponentSelect = useCallback((human) => {
    const completeOpponent = {
      ...human,
      type: 'human'
    };
    
    console.log(version, 'Human Opponent selected:', completeOpponent.name);
    setSelectedOpponent(completeOpponent);
  }, []);

  const getAvailableAICaptains = useCallback(() => {
    if (!eraConfig) return [];
    
    const requiresAlliance = eraConfig.game_rules?.choose_alliance;
    
    if (requiresAlliance && selectedAlliance) {
      const opposingAlliance = eraConfig.alliances?.find(a => a.name !== selectedAlliance);
      return opposingAlliance?.ai_captains || [];
    } else if (!requiresAlliance) {
      const opponentAlliance = eraConfig.alliances?.find(a => a.name === 'Opponent');
      return opponentAlliance?.ai_captains || [];
    }
    
    return [];
  }, [eraConfig, selectedAlliance]);

  const handleBeginBattle = useCallback(async () => {
    // v0.6.0: Multi-fleet handling
    if (isMultiFleet) {
      // Pirates - check that at least one fleet is selected
      if (selectedPirateFleets.length === 0) {
        console.error(version, 'No pirate fleets selected');
        return;
      }

      const minFleets = eraConfig.game_rules.fleet_selection_min || 1;
      if (selectedPirateFleets.length < minFleets) {
        console.error(version, `At least ${minFleets} fleet(s) required`);
        return;
      }

      console.log(version, 'Proceeding to placement with multi-fleet:');
      console.log(version, 'Era:', eraConfig.name);
      console.log(version, 'Selected fleets:', selectedPirateFleets.length);
      
      // Build opponents array with captain + ships
      const opponents = selectedPirateFleets.map(fleet => ({
        ...fleet.ai_captain,
        ships: fleet.ships,
        fleet_id: fleet.fleet_id
      }));
      
      setIsTransitioning(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      dispatch(events.PLACEMENT, {
        eraConfig: eraConfig,
        selectedOpponents: opponents,  // Array
        selectedAlliance: 'US Navy'
      });
      
    } else {
      // Traditional/Midway - single opponent
      if (!selectedOpponent) {
        console.error(version, 'No opponent selected');
        return;
      }

      const requiresAlliance = eraConfig?.game_rules?.choose_alliance;

      if (requiresAlliance && !selectedAlliance) {
        console.error(version, 'Alliance selection required but not selected');
        return;
      }

      console.log(version, 'Proceeding to placement with:');
      console.log(version, 'Era:', eraConfig.name);
      console.log(version, 'Opponent:', selectedOpponent.name, selectedOpponent.type);
      console.log(version, 'Alliance:', selectedAlliance || 'none');
      
      setIsTransitioning(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      dispatch(events.PLACEMENT, {
        eraConfig: eraConfig,
        opponents: [selectedOpponent],  // CoreEngine expects 'opponents' property
        selectedAlliance: selectedAlliance || null
      });
    }
  }, [isMultiFleet, selectedPirateFleets, selectedOpponent, selectedAlliance, eraConfig, dispatch, events]);

  const fetchOnlineHumans = useCallback(async () => {
    if (!eraConfig) return;
    
    setLoading(true);
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('player_online_status')
        .select('user_id, game_name, last_seen')
        .eq('is_online', true)
        .gte('last_seen', fiveMinutesAgo)
        .neq('user_id', profile?.id)
        .limit(20);
      
      if (error) throw error;
      
      const humansWithIds = data.map(h => ({
        id: h.user_id,
        game_name: h.game_name,
        name: h.game_name,
        last_seen: h.last_seen
      }));
      
      setOnlineHumans(humansWithIds);
      console.log(version, 'Fetched online humans:', humansWithIds.length);
    } catch (error) {
      console.error(version, 'Error fetching online humans:', error);
      setOnlineHumans([]);
    } finally {
      setLoading(false);
    }
  }, [eraConfig, profile]);

  useEffect(() => {
    fetchOnlineHumans();
  }, [fetchOnlineHumans]);

  const requiresAlliance = eraConfig?.game_rules?.choose_alliance;
  const availableAlliances = eraConfig?.alliances?.filter(a => a.name !== 'Opponent') || [];
  const availableAICaptains = getAvailableAICaptains();

  // v0.6.0: Determine if user can proceed
  const canProceed = isMultiFleet
    ? selectedPirateFleets.length > 0
    : selectedOpponent !== null && (!requiresAlliance || selectedAlliance);

  const getButtonText = () => {
//    if (isMultiFleet) {
//      return selectedPirateFleets.length > 1
//        ? `Begin Battle vs ${selectedPirateFleets.length} Fleets`
//        : 'Begin Battle';
//    }
//    return selectedOpponent?.type === 'human'
//      ? 'Challenge Player'
//      : 'Begin Battle';
      if (isMultiFleet) {
        const fleetNames = selectedPirateFleets.map(f => f.ai_captain.name).join(' & ');
        return `Play ${fleetNames}`;
      } else {
        return selectedOpponent ? `Play ${selectedOpponent.name}` : 'Select Opponent';
      }
  };

  // v0.6.6: Use profile for display, player for game logic checks
  if (!player) {
    return (
      <div className="content-pane">
        <div className="modal-overlay__content">
          <p>Initializing player...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex flex-column flex-center">
      <div className="page-with-info">
          <InfoButton onClick={() => setShowInfo(true)} />
          
          <GameGuide
            section="opponent"
            manualOpen={showInfo}
            onClose={() => setShowInfo(false)}
          />

        <div className="content-pane content-pane--wide">
          {/* Header */}
          <div className="card-header">
            <div className="card-header__content">
              <h2 className="card-title">Select Your Opponent</h2>
              <p className="card-subtitle">
                Era: {eraConfig?.name || 'Unknown'}  | Captain: {profile?.game_name || player.name}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="card-body card-body--scrollable">
            {/* Alliance Selection (Midway Island only) */}
            {requiresAlliance && availableAlliances.length > 0 && (
              <div className="alliance-selector">
                <h3 className="section-title">Choose Your Alliance</h3>
                <div className="alliance-list">
                  {availableAlliances.map((alliance) => (
                    <button
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
                        <hr />
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

                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-Fleet Selection (Pirates of the Gulf) */}
            {isMultiFleet && pirateFleets.length > 0 && (
              <div className="pirate-fleet-selection">
                <h3 className="section-title">
                  Select Pirate Fleets
                </h3>
                <p className="section-hint">
                  Select 1-{eraConfig.game_rules.fleet_selection_max || 4} fleets to battle - &nbsp;
                 {selectedPirateFleets.length > 0 && (
                   <span className="fleet-count-badge">
                     {selectedPirateFleets.length} selected
                     {selectedPirateFleets.length > 1 && (
                       <span className="difficulty-multiplier">
                         , combined difficulty  {getCombinedDifficulty()}x
                       </span>
                     )}
                   </span>
                 )}

                </p>
                
                <div className="opponent-list">
                  {pirateFleets.map((fleet) => {
                    const isSelected = selectedPirateFleets.some(f => f.fleet_id === fleet.fleet_id);
                    const difficulty = fleet.ai_captain.difficulty || 1.0;
                    
                    return (
                      <div
                        key={fleet.fleet_id}
                            className={`selectable-item opponent-item pirate-fleet-item ${isSelected ? 'selectable-item--selected' : ''}`}
                        onClick={() => handleFleetToggle(fleet)}
                      >
                        <div className="opponent-content">
                          <div className="fleet-checkbox">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by parent onClick
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          
                          {fleet.ai_captain.avatar && (
                            <div className="opponent-avatar opponent-avatar--small">
                              <img
                                src={`/${fleet.ai_captain.avatar}`}
                                alt={fleet.ai_captain.name}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          
                          <div className="opponent-info">
                            <div className="item-header">
                              <div className="item-name">{fleet.ai_captain.name}</div>
                              <div className={`badge ${getDifficultyBadgeClass(difficulty)}`}>
                                {getDifficultyLabel(difficulty)} - {difficulty}x
                              </div>
                            </div>
                            <div className="item-description">{fleet.ai_captain.description}</div>
                            <div className="fleet-details">
                              <span className="fleet-name">{fleet.fleet_name}</span>
                              <span className="ship-count">{fleet.ships.length} ships</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standard AI Opponents (Traditional/Midway) */}
            {!isMultiFleet && (!requiresAlliance || selectedAlliance) && (
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
                      availableAICaptains.map((opponent, index) => {
                        const difficulty = opponent.difficulty || 1.0;
                        return (
                          <div
                            key={index}
                            className={`selectable-item opponent-item ai-opponent ${selectedOpponent?.name === opponent.name ? 'selectable-item--selected' : ''}`}
                            onClick={() => handleAIOpponentSelect(opponent)}
                          >
                            <div className="opponent-content">
                              {opponent.avatar && (
                                <div className="opponent-avatar opponent-avatar--small">
                                  <img
                                    src={`/${opponent.avatar}`}
                                    alt={opponent.name}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              <div className="opponent-info">
                                <div className="item-header">
                                  <div className="item-name">{opponent.name}</div>
                                  <div className={`badge ${getDifficultyBadgeClass(difficulty)}`}>
                                    {getDifficultyLabel(difficulty)} - {difficulty}x
                                  </div>
                                </div>
                                <div className="item-description">{opponent.description}</div>
                                <div className="opponent-type text-dim italics">AI Captain</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Human Opponents (Future) */}
            {!isMultiFleet && (!requiresAlliance || selectedAlliance) && (
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
                          <div className="opponent-content">
                            <div className="opponent-info">
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
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Section */}
          <div className="action-section">
            {!canProceed ? (
              <p className="text-dim text-center">
                {isMultiFleet
                  ? 'Select at least one pirate fleet to continue'
                  : ''
                }
                {selectedAlliance ? "Select an opponent to continue" : "Select an alliance to continue"}
              </p>
            ) : (
              <div className="card-footer">
                <button
                  className="btn btn--primary btn--lg"
                  disabled={!canProceed}
                  onClick={handleBeginBattle}
                >
                  {getButtonText()}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectOpponentPage;
// EOF
