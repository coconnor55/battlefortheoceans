// src/pages/SelectOpponentPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.6.14: Fix React hooks rule violations - move all hooks before key data check
//          - Moved all useCallback and useEffect hooks before the key data check
//          - Moved isMultiFleet computation before hooks for use in dependency arrays
// v0.6.13: Replace key data error throwing with graceful handling
//          - Use logwarn instead of logerror and throw
//          - Call coreEngine.handleKeyDataError() to save error and navigate to Launch
//          - Return null to prevent rendering when key data is missing
// v0.6.12: Allow null playerEmail for guest users in key data check
//          - Guest users don't have email, so playerEmail check is conditional
//          - Only require playerEmail for non-guest users
// v0.6.11: Fixed unnecessary re-renders and selectedOpponents array bug
//          - Changed fetchOnlineHumans useEffect to run once on mount only
//          - Fixed 3 places using selectedOpponent[0] → selectedOpponents array
//          - Lines 157, 178, 199: Proper array assignment
// v0.6.10: Moved GameGuide to App.js, removed setShowInfo and InfoButton
// v0.6.9: Manually restored lost page formatting
// v0.6.8: Fixed playerProfile access AND opponents property name
//         - Line 33: Changed from coreEngine.playerProfile to coreEngine.player.playerProfile
//         - Line 203: Changed selectedOpponents to opponents (matches CoreEngine expectation)
//         - CoreEngine processEventData expects data.opponents, not data.selectedOpponents
// v0.6.7: Fixed dispatch to send selectedOpponents array for consistency
//         - Traditional/Midway now sends [selectedOpponent] array
//         - Matches multi-fleet pattern and GameLifecycleManager expectations
// v0.6.6: Merged v0.6.5 property access with v0.5.5 complete UI code
//         - Use coreEngine.player (Player instance for game logic)
//         - Use coreEngine.playerProfile (database object for display)
//         - Restored all UI components, styling, and multi-fleet support
// v0.6.5: Fixed property names - use coreEngine.player and coreEngine.playerProfile
// v0.6.1: Replaced InfoPanel with GameGuide component
// v0.6.0: Multi-fleet combat support (Pirates of the Gulf)
// v0.5.0: Added avatar display for AI captains

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { coreEngine, useGame } from '../context/GameContext';

const version = 'v0.6.14';
const tag = "OPPONENT";
const module = "SelectOpponentPage";
let method = "";

const SelectOpponentPage = () => {
    // ===============
    // Logging utilities
    const log = (message) => {
      console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
    };
    
    const logwarn = (message) => {
        console.warn(`[${tag}] ${version} ${module}.${method}: ${message}`);
    };

    const logerror = (message, error = null) => {
      if (error) {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
      } else {
        console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
      }
    };
    // ===============
    
    // All hooks must be called before any conditional returns
    const {
        dispatch,
        events,
    } = useGame();

    // v0.6.0: Multi-fleet selection state
    const [selectedPirateFleets, setSelectedPirateFleets] = useState([]);
    const [onlineHumans, setOnlineHumans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [aiExpanded, setAiExpanded] = useState(true);
    const [humanExpanded, setHumanExpanded] = useState(false);

    // Key data - see CoreEngine handle{state}
    const gameConfig = coreEngine.gameConfig;
    const eras = coreEngine.eras;
    const player = coreEngine.player;
    const playerProfile = coreEngine.playerProfile;
    const playerEmail = coreEngine.playerEmail;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponents = coreEngine.selectedOpponents;

    // Derived data
    const playerId = coreEngine.playerId;
    const playerRole = coreEngine.playerRole;
    const playerGameName = coreEngine.playerGameName;
    const isGuest = player != null && player.isGuest;
    const isAdmin = player != null && playerProfile?.isAdmin;
    const isDeveloper = player != null && playerProfile?.isDeveloper;
    const isTester = player != null && playerProfile?.isTester;
    const selectedOpponent = selectedOpponents?.[0];
    const selectedGameMode = coreEngine.selectedGameMode;
    const gameInstance = coreEngine.gameInstance;
    const board = coreEngine.board;

    // Helper functions (not hooks, but need to be defined before useCallback hooks that use them)
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

    // Get selectedEraConfig for use in hooks (before key data check)
    const selectedEraConfig = coreEngine.selectedEraConfig;
    
    // v0.6.0: Check if this is multi-fleet combat era (needed for hooks)
    const isMultiFleet = selectedEraConfig?.game_rules?.multi_fleet_combat;

    // v0.6.0: Calculate combined difficulty for multi-fleet
    const getCombinedDifficulty = useCallback(() => {
      method = 'getCombinedDifficulty';
      
    if (selectedPirateFleets.length === 0) return 0;
    
    const multiplier = selectedEraConfig.game_rules.fleet_difficulty_multipliers[selectedPirateFleets.length] || 1.0;
    const baseDifficulty = selectedPirateFleets.reduce((sum, fleet) => sum + fleet.ai_captain.difficulty, 0);
    
    return (baseDifficulty * multiplier).toFixed(1);
  }, [selectedPirateFleets, selectedEraConfig]);

  // v0.6.0: Toggle pirate fleet selection
  const handleFleetToggle = useCallback((fleet) => {
      method = 'handleFleetToggle';
      
    setSelectedPirateFleets(prev => {
      const isSelected = prev.some(f => f.fleet_id === fleet.fleet_id);
      
      if (isSelected) {
        // Deselect
        return prev.filter(f => f.fleet_id !== fleet.fleet_id);
      } else {
        // Select (check max limit)
        const maxFleets = selectedEraConfig.game_rules.fleet_selection_max || 4;
        if (prev.length >= maxFleets) {
          log('Max fleet limit reached:', maxFleets);
          return prev;
        }
        return [...prev, fleet];
      }
    });
    }, [selectedEraConfig]);

    const handleAllianceSelect = useCallback((allianceName) => {
      method = 'handleAllianceSelect';
      
    coreEngine.selectedAlliance = allianceName
      log('Alliance selected:', allianceName);
      coreEngine.selectedOpponents = [null];
    }, []);

    const handleAIOpponentSelect = useCallback((opponent) => {
      method = 'handleAIOpponentSelect';
      
    const timestamp = Date.now();
    const sanitizedName = opponent.name.toLowerCase().replace(/\s+/g, '-');
    const completeOpponent = {
      ...opponent,
      id: opponent.id || `ai-${sanitizedName}-${timestamp}`,
      type: 'ai'
    };
    
    log('AI Opponent selected:', completeOpponent.name, 'difficulty:', completeOpponent.difficulty);
      coreEngine.selectedOpponents = [completeOpponent];
    }, []);

    const handleHumanOpponentSelect = useCallback((human) => {
      method = 'handleHumanOpponentSelect';
      
    const completeOpponent = {
      ...human,
      type: 'human'
    };
    
    log('Human Opponent selected:', completeOpponent.name);
      coreEngine.selectedOpponents = [completeOpponent];
    }, []);

    const getAvailableAICaptains = useCallback(() => {
      method = 'getAvailableAICaptains';
      
    if (!selectedEraConfig) return [];
    
    const requiresAlliance = selectedEraConfig.game_rules?.choose_alliance;
    
    if (requiresAlliance && selectedAlliance) {
      const opposingAlliance = selectedEraConfig.alliances?.find(a => a.name !== selectedAlliance);
      return opposingAlliance?.ai_captains || [];
    } else if (!requiresAlliance) {
      const opponentAlliance = selectedEraConfig.alliances?.find(a => a.name === 'Opponent');
      return opponentAlliance?.ai_captains || [];
    }
    
    return [];
    }, [selectedEraConfig, selectedAlliance, isGuest, playerProfile?.id]);

    const handleBeginBattle = useCallback(async () => {
        method = 'handleBeginBattle';
        
      // v0.6.0: Multi-fleet handling
      if (isMultiFleet) {
        // Pirates - check that at least one fleet is selected
        if (selectedPirateFleets.length === 0) {
          logerror('No pirate fleets selected');
          return;
        }
        const minFleets = selectedEraConfig.game_rules.fleet_selection_min || 1;
        if (selectedPirateFleets.length < minFleets) {
          logerror(`At least ${minFleets} fleet(s) required`);
          return;
        }
        log('Proceeding to placement with multi-fleet:');
        log('Era:', selectedEraConfig.name);
        log('Selected fleets:', selectedPirateFleets.length);
        
        // Build opponents array with captain + ships
        const opponents = selectedPirateFleets.map(fleet => ({
          ...fleet.ai_captain,
          ships: fleet.ships,
          fleet_id: fleet.fleet_id
        }));
        
          // Set CoreEngine properties directly
        coreEngine.selectedOpponents = opponents;
        coreEngine.selectedAlliance = 'US Navy';
        
        setIsTransitioning(true);
        await new Promise(resolve => setTimeout(resolve, 50));
        
          log('exit SelectOpponent: coreEngine.selectedAlliance set: ', coreEngine.selectedAlliance);
          log('exit SelectOpponent: coreEngine.selectedOpponents set: ', coreEngine.selectedOpponents);
        dispatch(events.PLACEMENT);
        
      } else {
        // Traditional/Midway - single opponent
        if (!selectedOpponent) {
          logerror('No opponent selected');
          return;
        }
        const requiresAlliance = selectedEraConfig?.game_rules?.choose_alliance;
        if (requiresAlliance && !selectedAlliance) {
          logerror('Alliance selection required but not selected');
          return;
        }
        log('Proceeding to placement with:');
        log('Era:', selectedEraConfig.name);
        log('Opponent:', selectedOpponent.name, selectedOpponent.type);
        log('Alliance:', selectedAlliance || 'none');
        
        // Set CoreEngine properties directly
        coreEngine.selectedOpponents = [selectedOpponent];  // Array with single opponent
        coreEngine.selectedAlliance = selectedAlliance || null;
        
        setIsTransitioning(true);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        dispatch(events.PLACEMENT);  // No data payload needed anymore
      }
    }, [isMultiFleet, selectedPirateFleets, selectedOpponent, selectedAlliance, selectedEraConfig, dispatch, events]);

    const fetchOnlineHumans = useCallback(async () => {
      method = 'fetchOnlineHumans';
      
    if (!selectedEraConfig) return;
    
    // Skip for guest users - they can't query user_profiles with guest IDs
    if (isGuest || !playerProfile?.id) {
      log('Guest user - skipping online humans fetch');
      setOnlineHumans([]);
      return;
    }
    
    setLoading(true);
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
        const { data, error } = await supabase
          .from('user_profiles')  // ✅ Use existing table
          .select('id, game_name, last_seen')
          .gte('last_seen', fiveMinutesAgo)
          .neq('id', playerProfile.id)  // Only valid for UUIDs, not guest IDs
          .limit(20);
        
      if (error) throw error;
      
      const humansWithIds = data.map(h => ({
        id: h.player_id,
        game_name: h.game_name,
        name: h.game_name,
        last_seen: h.last_seen
      }));
      
      setOnlineHumans(humansWithIds);
      log('Fetched online humans:', humansWithIds.length);
    } catch (error) {
      logerror('Error fetching online humans:', error);
      setOnlineHumans([]);
    } finally {
      setLoading(false);
    }
    }, [selectedEraConfig, playerProfile]);

    useEffect(() => {
        fetchOnlineHumans();
    }, [fetchOnlineHumans]);

    // Key data check - stop game if key data is missing
    // (selectedAlliance is allowed to be null)
    // (playerEmail is allowed to be null for guest users)
    const required = isGuest 
        ? { gameConfig, eras, player, playerProfile, selectedEraId }
        : { gameConfig, eras, player, playerProfile, playerEmail, selectedEraId };
    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key, value]) => `${key}=${value}`);
    if (missing.length > 0) {
        const errorMessage = `key data missing: ${missing.join(', ')}`;
        logwarn(errorMessage);
        coreEngine.handleKeyDataError('opponent', errorMessage);
        return null; // Return null to prevent rendering
    }

    log('SelectOpponent: passed CoreEngine data checks');

    const pirateFleets = selectedEraConfig?.alliances?.find(a => a.name === 'Pirates')?.pirate_fleets || [];

    const requiresAlliance = selectedEraConfig?.game_rules?.choose_alliance;
  const availableAlliances = selectedEraConfig?.alliances?.filter(a => a.name !== 'Opponent') || [];
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

  // v0.6.6: Use playerProfile for display, player for game logic checks
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

        <div className="content-pane content-pane--wide">
          {/* Header */}
          <div className="card-header">
            <div className="card-header__content">
              <h2 className="card-title">Select Your Opponent</h2>
              <p className="card-subtitle">
                Era: {selectedEraConfig?.name || 'Unknown'}  | Captain: {playerProfile?.game_name || player.name}
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
                  Select 1-{selectedEraConfig.game_rules.fleet_selection_max || 4} fleets to battle - &nbsp;
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
