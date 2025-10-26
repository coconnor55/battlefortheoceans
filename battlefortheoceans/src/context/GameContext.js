// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor
<<<<<<< HEAD
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
=======
// v0.4.7: Expose coreEngine directly for Player singleton pattern
//         - Added `coreEngine` to context value
//         - Components can now access `coreEngine.player` and `coreEngine.userProfile`
//         - Removes need for wrapper getters (humanPlayer, userProfile)
//         - Aligns with Player singleton documentation
// v0.4.6: Use UserProfileService singleton directly
//         - UserProfileService now exports singleton instance (v0.1.3)
//         - Remove "new UserProfileService()" - use imported instance directly
//         - Same pattern for LeaderboardService and RightsService
//         - Fixes "UserProfileService is not a constructor" error
>>>>>>> rollback-to-v0.5.5-plus-auth
// v0.4.5: Munitions terminology rename (resources → munitions)
//         - Added fireMunition(munitionType, row, col) method
//         - Kept handleStarShellFired for backward compatibility
//         - Aligns with Game.js v0.8.8 and CoreEngine.js v0.6.10

import React, { createContext, useContext } from 'react';
import CoreEngine from '../engines/CoreEngine';
import UserProfileService from '../services/UserProfileService';
import LeaderboardService from '../services/LeaderboardService';
import RightsService from '../services/RightsService';
import configLoader from '../utils/ConfigLoader';
import { events } from '../constants/GameEvents';

<<<<<<< HEAD
const version = "v0.4.8";
=======
const version = "v0.4.7";
>>>>>>> rollback-to-v0.5.5-plus-auth

const GameState = createContext();

// Lazy initialization - nothing created until first access
let coreEngine = null;
let userProfileService = null;
let leaderboardService = null;
let rightsService = null;

<<<<<<< HEAD
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
=======
// Services are already singletons - use imported instances directly
// No need to instantiate with "new" - they export instances, not classes
>>>>>>> rollback-to-v0.5.5-plus-auth

export const GameProvider = ({ children }) => {
  console.log(`[GameContext ${version}] Provider initialized (all lazy)`);
  
  return (
    <GameState.Provider value={{

      // v0.4.7: Expose CoreEngine directly for Player singleton pattern
      coreEngine: coreEngine,

      // State machine
      get currentState() { return getCoreEngine().currentState; },
      get events() { return events; },
      
      // Core dispatch
      dispatch: (event, eventData) => getCoreEngine().dispatch(event, eventData),
      
      // Observer pattern
      subscribeToUpdates: (callback) => getCoreEngine().subscribe(callback),
      get updateCounter() { return getCoreEngine().updateCounter; },
      
      // Game state accessors
<<<<<<< HEAD
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
=======
      get eraConfig() { return coreEngine.eraConfig; },
      
      // v0.4.0: Multi-fleet support
      get selectedOpponents() { return coreEngine.selectedOpponents; },
      get selectedOpponent() { return coreEngine.selectedOpponents?.[0] || null; }, // Backward compatibility
      
      get selectedGameMode() { return coreEngine.selectedGameMode; },
      get selectedAlliance() { return coreEngine.selectedAlliance; },
      
      // v0.4.7: Keep for backward compatibility, but prefer coreEngine.player/profile
      get humanPlayer() { return coreEngine.humanPlayer; },
      get userProfile() { return coreEngine.userProfile; },
      
      get gameInstance() { return coreEngine.gameInstance; },
      get board() { return coreEngine.board; },
      
      // Computed state
      getUIState: () => coreEngine.getUIState(),
//      getPlacementProgress: () => coreEngine.getPlacementProgress(),
>>>>>>> rollback-to-v0.5.5-plus-auth
      
      // Game actions
      registerShipPlacement: (ship, shipCells, orientation, playerId) =>
        getCoreEngine().registerShipPlacement(ship, shipCells, orientation, playerId),
      
      fireMunition: (munitionType, row, col) => getCoreEngine().fireMunition(munitionType, row, col),
      handleStarShellFired: (row, col) => getCoreEngine().handleStarShellFired(row, col),
      
<<<<<<< HEAD
      // User profile functions (lazy-loaded services)
      getUserProfile: (userId) => getUserProfileService().getUserProfile(userId),
      createUserProfile: (userId, gameName) => getCoreEngine().createUserProfile(userId, gameName),
      updateGameStats: (gameResults) => getCoreEngine().updateGameStats(gameResults),
      getLeaderboard: (limit) => getLeaderboardService().getLeaderboard(limit),
      getRecentChampions: (limit) => getLeaderboardService().getRecentChampions(limit),
      getPlayerGameName: (playerId) => getCoreEngine().getPlayerGameName(playerId),
=======
      // User profile functions
      // v0.4.6: Use service singletons directly
      getUserProfile: (userId) => UserProfileService.getUserProfile(userId),
      createUserProfile: (userId, gameName) => coreEngine.createUserProfile(userId, gameName), // Keep - has business logic
      updateGameStats: (gameResults) => coreEngine.updateGameStats(gameResults), // Keep - has business logic
      getLeaderboard: (limit) => LeaderboardService.getLeaderboard(limit),
      getRecentChampions: (limit) => LeaderboardService.getRecentChampions(limit),
      getPlayerGameName: (playerId) => coreEngine.getPlayerGameName(playerId), // Keep - still in CoreEngine
>>>>>>> rollback-to-v0.5.5-plus-auth
      
      logout: () => getCoreEngine().logout(),
      
<<<<<<< HEAD
      // Rights functions (lazy-loaded service)
      hasEraAccess: (userId, eraId) => getCoreEngine().hasEraAccess(userId, eraId),
      grantEraAccess: (userId, eraId, paymentData) => getRightsService().grantEraAccess(userId, eraId, paymentData),
      redeemVoucher: (userId, voucherCode) => getRightsService().redeemVoucher(userId, voucherCode),
      getUserRights: (userId) => getRightsService().getUserRights(userId),
=======
      // Rights functions
      // v0.4.6: Use service singletons directly
      hasEraAccess: (userId, eraId) => coreEngine.hasEraAccess(userId, eraId), // Keep - has business logic
      grantEraAccess: (userId, eraId, paymentData) => RightsService.grantEraAccess(userId, eraId, paymentData),
      redeemVoucher: (userId, voucherCode) => RightsService.redeemVoucher(userId, voucherCode),
      getUserRights: (userId) => RightsService.getUserRights(userId),
>>>>>>> rollback-to-v0.5.5-plus-auth
      
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
