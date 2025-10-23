// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.8: Lazy-load services to prevent supabase initialization
//         - Services created on first access, not at module load
//         - Each service imports supabase, so delay their creation
// v0.4.7: Lazy-initialize CoreEngine to prevent premature supabaseClient loading
//         - CoreEngine created on first access, not at module load time
//         - Allows LaunchPage to read URL hash before CoreEngine initializes
//         - Fixes Sign Up URL hash consumption (for real this time!)
// v0.4.6: Import events from GameEvents.js to prevent premature initialization
//         - Events getter now returns imported events, not coreEngine.events
//         - Prevents CoreEngine initialization when LaunchPage accesses events
//         - Fixes Sign Up URL hash consumption issue
// v0.4.5: Munitions terminology rename (resources → munitions)
//         - Added fireMunition(munitionType, row, col) method
//         - Kept handleStarShellFired for backward compatibility
//         - Aligns with Game.js v0.8.8 and CoreEngine.js v0.6.10
// v0.4.4: Updated to call services directly instead of CoreEngine wrappers
//         - Import UserProfileService, LeaderboardService, RightsService, configLoader
//         - Call services directly for methods removed from CoreEngine v0.6.8
//         - Keep calls to CoreEngine for methods with business logic
// v0.4.3: Exposed logout() from CoreEngine
//         - User can logout from anywhere via GameContext
//         - NavBar uses this to provide logout dropdown menu
// v0.4.2: Fixed missing handleStarShellFired after revert
//         - Revert attempted to go back to v0.4.1 but used OLD v0.4.1
//         - This version correctly includes handleStarShellFired from v0.6.2 CoreEngine
//         - Lesson: Always increment version on every change
// v0.4.1: Exposed handleStarShellFired from CoreEngine
//         - Star shell logic now lives in CoreEngine (game logic layer)
//         - Context provides wrapper for UI access via useGameState hook
// v0.4.0: Multi-fleet combat support
//         - Exposed selectedOpponents[] array
//         - Backward compatible selectedOpponent (first opponent)

import React, { createContext, useContext } from 'react';
import CoreEngine from '../engines/CoreEngine';
import UserProfileService from '../services/UserProfileService';
import LeaderboardService from '../services/LeaderboardService';
import RightsService from '../services/RightsService';
import configLoader from '../utils/ConfigLoader';
import { events } from '../constants/GameEvents';

const version = "v0.4.8";

const GameState = createContext();

// Lazy initialization - nothing created until first access
let coreEngine = null;
let userProfileService = null;
let leaderboardService = null;
let rightsService = null;

function getCoreEngine() {
  if (!coreEngine) {
    console.log(`[GameContext ${version}] Lazy-initializing CoreEngine`);
    coreEngine = new CoreEngine();
  }
  return coreEngine;
}

function getUserProfileService() {
  if (!userProfileService) {
    console.log(`[GameContext ${version}] Lazy-initializing UserProfileService`);
    userProfileService = new UserProfileService();
  }
  return userProfileService;
}

function getLeaderboardService() {
  if (!leaderboardService) {
    console.log(`[GameContext ${version}] Lazy-initializing LeaderboardService`);
    leaderboardService = new LeaderboardService();
  }
  return leaderboardService;
}

function getRightsService() {
  if (!rightsService) {
    console.log(`[GameContext ${version}] Lazy-initializing RightsService`);
    rightsService = new RightsService();
  }
  return rightsService;
}

export const GameProvider = ({ children }) => {
  console.log(`[GameContext ${version}] Provider initialized (all lazy)`);
  
  return (
    <GameState.Provider value={{

      // State machine
      get currentState() { return getCoreEngine().currentState; },
      get events() { return events; },
      
      // Core dispatch
      dispatch: (event, eventData) => getCoreEngine().dispatch(event, eventData),
      
      // Observer pattern
      subscribeToUpdates: (callback) => getCoreEngine().subscribe(callback),
      get updateCounter() { return getCoreEngine().updateCounter; },
      
      // Game state accessors
      get eraConfig() { return getCoreEngine().eraConfig; },
      get selectedOpponents() { return getCoreEngine().selectedOpponents; },
      get selectedOpponent() { return getCoreEngine().selectedOpponents?.[0] || null; },
      get selectedGameMode() { return getCoreEngine().selectedGameMode; },
      get selectedAlliance() { return getCoreEngine().selectedAlliance; },
      get humanPlayer() { return getCoreEngine().humanPlayer; },
      get gameInstance() { return getCoreEngine().gameInstance; },
      get board() { return getCoreEngine().board; },
      get userProfile() { return getCoreEngine().userProfile; },
      
      // Computed state
      getUIState: () => getCoreEngine().getUIState(),
      getPlacementProgress: () => getCoreEngine().getPlacementProgress(),
      
      // Game actions
      registerShipPlacement: (ship, shipCells, orientation, playerId) =>
        getCoreEngine().registerShipPlacement(ship, shipCells, orientation, playerId),
      
      fireMunition: (munitionType, row, col) => getCoreEngine().fireMunition(munitionType, row, col),
      handleStarShellFired: (row, col) => getCoreEngine().handleStarShellFired(row, col),
      
      // User profile functions (lazy-loaded services)
      getUserProfile: (userId) => getUserProfileService().getUserProfile(userId),
      createUserProfile: (userId, gameName) => getCoreEngine().createUserProfile(userId, gameName),
      updateGameStats: (gameResults) => getCoreEngine().updateGameStats(gameResults),
      getLeaderboard: (limit) => getLeaderboardService().getLeaderboard(limit),
      getRecentChampions: (limit) => getLeaderboardService().getRecentChampions(limit),
      getPlayerGameName: (playerId) => getCoreEngine().getPlayerGameName(playerId),
      
      logout: () => getCoreEngine().logout(),
      
      // Rights functions (lazy-loaded service)
      hasEraAccess: (userId, eraId) => getCoreEngine().hasEraAccess(userId, eraId),
      grantEraAccess: (userId, eraId, paymentData) => getRightsService().grantEraAccess(userId, eraId, paymentData),
      redeemVoucher: (userId, voucherCode) => getRightsService().redeemVoucher(userId, voucherCode),
      getUserRights: (userId) => getRightsService().getUserRights(userId),
      
      // Era functions (configLoader doesn't import supabase)
      getAllEras: () => configLoader.listEras(),
      getEraById: (eraId) => configLoader.loadEraConfig(eraId),
      getPromotableEras: async () => {
        const eras = await configLoader.listEras();
        return eras.filter(era => !era.free && era.promotional);
      },
      getFreeEras: async () => {
        const eras = await configLoader.listEras();
        return eras.filter(era => era.free);
      },
      clearEraCache: () => configLoader.clearCache(),
      
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);
export { GameState as GameContext };

// EOF
