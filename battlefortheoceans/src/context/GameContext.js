// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.11: Complete munitions refactoring - remove backward compatibility wrapper
//          - Removed handleStarShellFired - no longer needed
//          - All components now use fireMunition(munitionType, row, col) directly
//          - Completes refactoring started in v0.4.5
// v0.4.10: Use singleton RightsService instance
//         - Changed import from RightsService (class) to rightsService (instance)
//         - RightsService already exports singleton per v0.1.2
//         - All services now use consistent singleton pattern
// v0.4.9: Use singleton LeaderboardService instance
//         - Changed import from LeaderboardService (class) to leaderboardService (instance)
//         - LeaderboardService now exports singleton per v0.1.6
//         - Matches pattern already used for other services
// v0.4.8: Added disableGameGuide context value
// v0.4.7: Expose coreEngine directly for Player singleton pattern
//         - Added `coreEngine` to context value
//         - Components can now access `coreEngine.player` and `coreEngine.userProfile`
//         - Removes need for wrapper getters (humanPlayer, userProfile)
//         - Aligns with Player singleton documentation
// v0.4.6: Use UserProfileService singleton directly
//         - UserProfileService now exports singleton instance
//         - Remove "new UserProfileService()" - use imported instance directly
//         - Same pattern for LeaderboardService and RightsService
//         - Fixes "UserProfileService is not a constructor" error
// v0.4.5: Munitions terminology rename (resources → munitions)
//         - Added fireMunition(munitionType, row, col) method
//         - Kept handleStarShellFired for backward compatibility
//         - Aligns with Game.js v0.8.8 and CoreEngine.js v0.6.10

import React, { createContext, useContext } from 'react';
import CoreEngine from '../engines/CoreEngine';
import UserProfileService from '../services/UserProfileService';
import leaderboardService from '../services/LeaderboardService';
import rightsService from '../services/RightsService';
import configLoader from '../utils/ConfigLoader';

const version = "v0.4.11";

const GameState = createContext();

// CoreEngine singleton - single source of truth for all game state
const coreEngine = new CoreEngine();

// Services are already singletons - use imported instances directly
// No need to instantiate with "new" - they export instances, not classes

export const GameProvider = ({ children }) => {
  console.log(`[GameContext ${version}] Provider initialized with CoreEngine`);
  
  return (
    <GameState.Provider value={{

      // v0.4.7: Expose CoreEngine directly for Player singleton pattern
      coreEngine: coreEngine,

      // State machine
      get currentState() { return coreEngine.currentState; },
      get events() { return coreEngine.events; },
      
      // Core dispatch
      dispatch: (event, eventData) => coreEngine.dispatch(event, eventData),
      
      // Observer pattern
      subscribeToUpdates: (callback) => coreEngine.subscribe(callback),
      updateCounter: coreEngine.updateCounter,
      
      // Game state accessors
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
      
      // Game actions
      registerShipPlacement: (ship, shipCells, orientation, playerId) =>
        coreEngine.registerShipPlacement(ship, shipCells, orientation, playerId),
        
        // Game Guide preferences
        disableGameGuide: (userId) => UserProfileService.disableGameGuide(userId),
      
      // v0.4.5: Munitions actions
      fireMunition: (munitionType, row, col) => coreEngine.fireMunition(munitionType, row, col),
      
      // User profile functions
      // v0.4.6: Use service singletons directly
      getUserProfile: (userId) => UserProfileService.getUserProfile(userId),
      createUserProfile: (userId, gameName) => coreEngine.createUserProfile(userId, gameName), // Keep - has business logic
      updateGameStats: (gameResults) => coreEngine.updateGameStats(gameResults), // Keep - has business logic
      getLeaderboard: (limit) => leaderboardService.getLeaderboard(limit),
      getRecentChampions: (limit) => leaderboardService.getRecentChampions(limit),
      getPlayerGameName: (playerId) => coreEngine.getPlayerGameName(playerId), // Keep - still in CoreEngine
      
      // v0.4.3: Logout function
      logout: () => coreEngine.logout(),
      
      // Rights functions
      // v0.4.6: Use service singletons directly
      hasEraAccess: (userId, eraId) => coreEngine.hasEraAccess(userId, eraId), // Keep - has business logic
      grantEraAccess: (userId, eraId, paymentData) => rightsService.grantEraAccess(userId, eraId, paymentData),
      redeemVoucher: (userId, voucherCode) => rightsService.redeemVoucher(userId, voucherCode),
      getUserRights: (userId) => rightsService.getUserRights(userId),
      
      // Era functions
      // v0.4.4: Call configLoader directly (not through CoreEngine)
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

// Export context for direct use if needed
export { GameState as GameContext };

// EOF
