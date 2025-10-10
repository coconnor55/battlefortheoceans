// src/pages/SelectOpponentPage.js v0.4.6
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.6: Added transition loading state to prevent visual lag
// v0.4.5: Added InfoButton and InfoPanel with opponent selection instructions
// v0.4.4: Changed button text to "Play {Opponent Name}"

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useGame } from '../context/GameContext';
import InfoButton from '../components/InfoButton';
import InfoPanel from '../components/InfoPanel';

const version = 'v0.4.6';

const SelectOpponentPage = () => {
  const {
    dispatch,
    events,
    eraConfig,
    userProfile
  } = useGame();
  
  useEffect(() => {
    if (!userProfile) {
      console.log(version, 'No user profile detected - redirecting to login');
      dispatch(events.LOGIN);
    }
  }, [userProfile, dispatch, events]);
  
  const [selectedAlliance, setSelectedAlliance] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [onlineHumans, setOnlineHumans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [aiExpanded, setAiExpanded] = useState(true);
  const [humanExpanded, setHumanExpanded] = useState(false);

  const getDifficultyLabel = (difficulty) => {
    if (difficulty < 1.0) return 'Easy';
    if (difficulty === 1.0) return 'Medium';
    return 'Hard';
  };

  const getDifficultyBadgeClass = (difficulty) => {
    if (difficulty < 1.0) return 'badge--success';
    if (difficulty === 1.0) return 'badge--primary';
    return 'badge--warning';
  };

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
    
    // Show loading state immediately
    setIsTransitioning(true);
    
    // Small delay to ensure loading UI renders before heavy sync work
    await new Promise(resolve => setTimeout(resolve, 50));
    
    dispatch(events.PLACEMENT, {
      eraConfig: eraConfig,
      selectedOpponent: selectedOpponent,
      selectedAlliance: selectedAlliance
    });
  }, [selectedOpponent, selectedAlliance, eraConfig, dispatch, events]);

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

  useEffect(() => {
    fetchOnlineHumans();
  }, [fetchOnlineHumans]);

  if (!userProfile) {
    return null;
  }

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

  // Show transitioning state
  if (isTransitioning) {
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--narrow">
          <div className="loading">
            <div className="spinner spinner--lg"></div>
            <h2>Preparing for Battle</h2>
            <p>Setting up {eraConfig.name} ...</p>
          </div>
        </div>
      </div>
    );
  }

  const requiresAlliance = eraConfig.game_rules?.choose_alliance;
  const canProceed = selectedOpponent && (!requiresAlliance || selectedAlliance);
  const availableAICaptains = getAvailableAICaptains();
  
  const buttonText = selectedOpponent ? `Play ${selectedOpponent.name}` : 'Select Opponent';

  return (
    <div className="container flex flex-column flex-center">
      <div className="page-with-info">
        <InfoButton onClick={() => setShowInfo(true)} />
        
        <InfoPanel
          isOpen={showInfo}
          onClose={() => setShowInfo(false)}
          title="Opponent Selection"
        >
          <h4>Alliance Selection</h4>
          <p>
            Some eras require you to <strong>choose an alliance first</strong> (e.g., US Navy vs Imperial Navy).
            Each alliance has different ships and characteristics.
          </p>

          <h4>AI Opponents</h4>
          <p>
            Battle against computer-controlled captains with different personalities and skill levels:
          </p>
          <ul>
            <li><strong className="badge badge--success">Easy</strong> - Beginner AI, lower difficulty multiplier (0.7x)</li>
            <li><strong className="badge badge--primary">Medium</strong> - Standard AI, normal difficulty (1.0x)</li>
            <li><strong className="badge badge--warning">Hard</strong> - Advanced AI, higher difficulty (1.3x - 1.6x)</li>
          </ul>
          <p className="text-secondary">
            <em>Difficulty multiplier affects scoring - defeating harder opponents earns more points!</em>
          </p>

          <h4>AI Strategies</h4>
          <p>Each AI captain uses different tactics:</p>
          <ul>
            <li><strong>Random:</strong> Unpredictable targeting</li>
            <li><strong>Methodical:</strong> Systematic search patterns</li>
            <li><strong>Aggressive:</strong> Probability-based smart targeting</li>
          </ul>

          <h4>Human Opponents</h4>
          <p>
            Challenge other players currently online. Human vs Human battles feature:
          </p>
          <ul>
            <li>Real-time matchmaking</li>
            <li>Turn-based gameplay</li>
            <li>Head-to-head competition</li>
          </ul>
          <p className="text-secondary">
            <em>Note: Human vs Human multiplayer is coming soon!</em>
          </p>

          <h4>How to Select</h4>
          <ol>
            <li>Choose your alliance (if required)</li>
            <li>Expand <strong>"AI Opponents"</strong> or <strong>"Human Opponents"</strong></li>
            <li>Click on an opponent (highlights in blue)</li>
            <li>Click <strong>"Play [Opponent Name]"</strong> to begin</li>
          </ol>
        </InfoPanel>

        <div className="content-pane content-pane--wide">
          <div className="card-header">
            <h2 className="card-title">Select Opponent</h2>
            <p className="card-subtitle">Playing: <strong>{eraConfig.name}</strong></p>
            {selectedAlliance && <p className="card-subtitle">Alliance: <strong>{selectedAlliance}</strong></p>}
          </div>

          <div className="card-body">
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
                      availableAICaptains.map((opponent, index) => {
                        const difficulty = opponent.difficulty || 1.0;
                        return (
                          <div
                            key={index}
                            className={`selectable-item opponent-item ai-opponent ${selectedOpponent?.name === opponent.name ? 'selectable-item--selected' : ''}`}
                            onClick={() => handleAIOpponentSelect(opponent)}
                          >
                            <div className="item-header">
                              <div className="item-name">{opponent.name}</div>
                              <div className={`badge ${getDifficultyBadgeClass(difficulty)}`}>
                                {getDifficultyLabel(difficulty)} - {difficulty}x
                              </div>
                            </div>
                            <div className="item-description">{opponent.description}</div>
                            <div className="opponent-type text-dim italics">AI Captain</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

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

          {/* Action Section */}
          <div className="action-section">
            {!selectedOpponent ? (
              <p className="text-dim text-center">
                Select an opponent above to continue
              </p>
            ) : (
              <div className="card-footer">
                <button
                  className="btn btn--primary btn--lg"
                  disabled={!canProceed}
                  onClick={handleBeginBattle}
                >
                  Play {selectedOpponent.name}
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
