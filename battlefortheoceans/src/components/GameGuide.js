// src/components/GameGuide.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.1: fix AutoShow
// v0.2.0: Use database flag for game guide preferences
//         - Reads show_game_guide from userProfile (database)
//         - "Got It!" dismisses for current session only (state)
//         - "Turn Off Game Guide" sets show_game_guide = false in database
//         - Works for both authenticated and guest users
//         - Guest users: guide always shows (no persistence)
// v0.1.1: Improved auto-show UX
// v0.1.0: Initial game guide component

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import InfoPanel from './InfoPanel';

const version = 'v0.2.1';

const GameGuide = ({ section, manualOpen = false, onClose, forceShow = false, eraName = '' }) => {
    console.log('[GUIDE]', version, 'Component rendered - section:', section, 'manualOpen:', manualOpen, 'forceShow:', forceShow);
  const { userProfile, disableGameGuide, coreEngine } = useGame();
    
    const shouldAutoShow = () => {
      if (forceShow) return true;
      
      // Check if show_game_guide is explicitly false (user disabled it)
      // If undefined/null, default to true (show guide)
      if (userProfile?.show_game_guide === false) {
        console.log('[GUIDE]', version, 'Auto-show disabled in user profile');
        return false;
      }
      
      // Always auto-show for new sessions (unless explicitly disabled)
      console.log('[GUIDE]', version, 'Auto-showing guide for section: ' + section);
      return true;
    };
    
  const [autoShowFirstTime] = useState(() => shouldAutoShow());

    const handleClose = () => {
      onClose();
    };

    const handleDontShowAgain = async () => {
      console.log('[GUIDE]', version, '"Turn Off Game Guide" clicked');
      
      if (!userProfile?.id || userProfile.id.startsWith('guest-')) {
        console.log('[GUIDE]', version, 'Guest user - cannot persist preference');
        onClose();
        return;
      }
      
      try {
        await disableGameGuide(userProfile.id);
        console.log('[GUIDE]', version, 'Game guide disabled in database');
        
        // Update the in-memory profile
        if (coreEngine.humanPlayer?.userProfile) {
          coreEngine.humanPlayer.userProfile.show_game_guide = false;
          console.log('[GUIDE]', version, 'Updated in-memory profile: show_game_guide = false');
        }
        
        onClose();
      } catch (error) {
        console.error('[GUIDE]', version, 'Failed to disable game guide:', error);
        onClose();
      }
    };
    
  const isOpen = forceShow || manualOpen || autoShowFirstTime;

  const getContent = () => {
    switch (section) {
      case 'placement':
        return {
          title: 'Ship Placement Guide',
          content: (
            <>
              <h4>How to Place Ships</h4>
              <p>
                Position your fleet on the board before battle begins. Each ship must be placed on valid terrain.
              </p>

              <h4>Placement Methods</h4>
              <ul>
                <li><strong>Auto-Place:</strong> Click "Auto-Place All Ships" for random positioning</li>
                <li><strong>Manual Drag:</strong> Click and drag from bow to stern to place each ship</li>
                <li><strong>Rotation:</strong> Drag in any direction - up, down, left, or right</li>
              </ul>

              <h4>Visual Feedback</h4>
              <ul>
                <li><strong>Green highlight:</strong> Valid placement position</li>
                <li><strong>Red highlight:</strong> Invalid placement (wrong terrain or overlap)</li>
                <li><strong>Blue ship outlines:</strong> Successfully placed ships</li>
              </ul>

              <h4>Terrain Restrictions</h4>
              <p>
                Different ships can only be placed on certain terrain types:
              </p>
              <ul>
                <li><strong>Submarines:</strong> Deep water only</li>
                <li><strong>Battleships/Carriers:</strong> Deep and shallow water</li>
                <li><strong>PT Boats:</strong> Shallow water and shoals</li>
                <li><strong>Check era-specific rules</strong> for detailed restrictions</li>
              </ul>

              <h4>Tips</h4>
              <ul>
                <li>Spread ships out to avoid clustered damage</li>
                <li>Use terrain strategically for better positioning</li>
                <li>Consider opponent's likely attack patterns</li>
                <li>Ships cannot overlap or share cells</li>
              </ul>
            </>
          )
        };

      case 'battle':
        return {
          title: 'Battle Instructions',
          content: (
            <>
              <h4>Understanding the Board</h4>
              <p>
                The battle board shows a combined view of your fleet and attack results. Use the view mode buttons to change what you see.
              </p>

              <h4>View Modes</h4>
              <ul>
                <li><strong>Fleet View:</strong> Shows only your ships and where enemy has attacked you</li>
                <li><strong>Blended View:</strong> Shows both your ships and your attack results (default)</li>
                <li><strong>Attack View:</strong> Shows only your attacks on the enemy (hides your ships)</li>
              </ul>

              <h4>Board Symbols</h4>
              <ul>
                <li><strong>Blue ship outlines:</strong> Your fleet positions</li>
                <li><strong>Blue dots:</strong> Enemy's missed shots (Fleet view)</li>
                <li><strong>Gray dots:</strong> Your missed shots (Combined/Attack views)</li>
                <li><strong>Red slash:</strong> Your hits on enemy ships</li>
                <li><strong>Blue slash:</strong> Enemy hits on your ships</li>
                <li><strong>Fire:</strong> Damaged ships</li>
                <li><strong>Smoke:</strong> Rising from damaged vessels</li>
              </ul>

              <h4>Fleet Status Sidebars</h4>
              <ul>
                <li><strong>Left sidebar (Home):</strong> Your fleet status</li>
                <li><strong>Right sidebar (Enemy):</strong> Opponent fleet status</li>
                <li><strong>Skull:</strong> Ship is sunk (crossed out)</li>
                <li><strong>Star Shells:</strong> Special reconnaissance ability (if available)</li>
              </ul>

              <h4>How to Attack</h4>
              <ul>
                <li>Wait for your turn (check the message console)</li>
                <li>Click any unattacked cell on the grid</li>
                <li>Watch for hit/miss feedback and particle effects</li>
                <li>Progressive intel: Ships reveal more info as you hit them</li>
                <li>Repeat until all enemy ships are sunk!</li>
              </ul>

              <h4>Strategy Tips</h4>
              <ul>
                <li>After a hit, target adjacent cells to find the rest of the ship</li>
                <li>Ships are oriented horizontally or vertically (not diagonal)</li>
                <li>Terrain affects gameplay - check ship restrictions</li>
                <li>Track enemy attack patterns to predict their strategy</li>
                <li>Use star shells strategically to reveal enemy positions</li>
              </ul>

              <h4>Game Stats</h4>
              <p>
                Below the board, you will see:
              </p>
              <ul>
                <li><strong>Your Hits:</strong> Number of successful attacks you have made</li>
                <li><strong>Enemy Hits:</strong> Number of times enemy has hit your ships</li>
              </ul>
            </>
          )
        };

      case 'era':
        return {
          title: 'Era Selection Guide',
          content: (
            <>
              <h4>Choose Your Naval Theater</h4>
              <p>
                Each era offers a unique battlefield with different rules, ships, and strategic challenges.  For example:
              </p>

              <h4>Classic Battleship</h4>
              <ul>
                <li><strong>Board:</strong> 10x10 classic grid</li>
                <li><strong>Gameplay:</strong> Simple, pure strategy</li>
                <li><strong>Best for:</strong> Learning the game, quick matches</li>
                <li><strong>Status:</strong> Free - always available</li>
              </ul>

              <h4>Midway Island (Premium)</h4>
              <ul>
                <li><strong>Board:</strong> 13x13 Pacific theater</li>
                <li><strong>Ships:</strong> WWII carriers, battleships, submarines</li>
                <li><strong>Features:</strong> Terrain restrictions, larger fleet battles</li>
                <li><strong>Best for:</strong> Extended tactical gameplay</li>
              </ul>

              <h4>Pirates of the Gulf (Premium)</h4>
              <ul>
                <li><strong>Board:</strong> 30x20 irregular Caribbean map</li>
                <li><strong>Ships:</strong> Pirate vessels, privateers, naval frigates</li>
                <li><strong>Features:</strong> Alliance battles, multiple opponents</li>
                <li><strong>Best for:</strong> Advanced strategic combat</li>
              </ul>

              <h4>Tips</h4>
              <ul>
                <li>Start with Traditional to learn the basics</li>
                <li>Each era has unique ship types and terrain</li>
                <li>Check ship restrictions before placement</li>
                <li>Larger boards = longer, more strategic games</li>
              </ul>
            </>
          )
        };

      case 'opponent':
        return {
          title: 'Opponent Selection Guide',
          content: (
            <>
              <h4>Choose Your Adversary</h4>
              <p>
                Each AI opponent has a unique personality, strategy, and difficulty level.
              </p>

              <h4>AI Personalities</h4>
              <ul>
                <li><strong>Cautious:</strong> Methodical, predictable attacks</li>
                <li><strong>Aggressive:</strong> Bold, risk-taking strategy</li>
                <li><strong>Analytical:</strong> Probabilistic targeting</li>
                <li><strong>Adaptive:</strong> Learns from your patterns</li>
              </ul>

              <h4>Difficulty Ratings</h4>
              <ul>
                <li><strong>Easy (0.3-0.5):</strong> Good for learning</li>
                <li><strong>Medium (0.6-0.7):</strong> Balanced challenge</li>
                <li><strong>Hard (0.8-0.9):</strong> Experienced players</li>
                <li><strong>Expert (1.0):</strong> Maximum challenge</li>
              </ul>

              <h4>Historical Commanders</h4>
              <p>
                Some eras feature famous naval commanders with authentic tactical approaches:
              </p>
              <ul>
                <li><strong>Admiral Nimitz:</strong> Calculated Pacific strategy</li>
                <li><strong>Admiral Yamamoto:</strong> Aggressive carrier tactics</li>
                <li><strong>Jean Lafitte:</strong> Unpredictable pirate raids</li>
                <li><strong>Blackbeard:</strong> Intimidating frontal assault</li>
              </ul>

              <h4>Tips</h4>
              <ul>
                <li>Start with easier opponents to learn the game</li>
                <li>Each opponent has strengths and weaknesses</li>
                <li>Difficulty affects scoring multipliers</li>
                <li>Try different opponents to find your rival</li>
              </ul>
            </>
          )
        };

      default:
        return {
          title: 'Game Guide',
          content: <p>Welcome to Battle for the Oceans!</p>
        };
    }
  };

  const { title, content } = getContent();

  return (
    <InfoPanel
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
    >
      {content}
      
      {autoShowFirstTime && !forceShow && (
        <div style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          alignItems: 'center'
        }}>
          
          <button
            className="btn btn--secondary"
            onClick={handleDontShowAgain}
          >
            Turn Off Game Guide
          </button>
          
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-dim)',
            fontStyle: 'italic',
            margin: '0',
            textAlign: 'center'
          }}>
            Use Help menu to see Game Guide information
          </p>
        </div>
      )}
    </InfoPanel>
  );
};

export default GameGuide;
// EOF
