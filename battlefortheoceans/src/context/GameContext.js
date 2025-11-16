// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.15: Corrected reference to updateGameStats
// v0.4.14: Removed hasEraAccess - deprecated then deleted
// v0.4.13: Use VoucherService for voucher redemption
//          - Changed redeemVoucher to call VoucherService instead of RightsService
//          - RightsService.redeemVoucher deprecated and removed
// v0.4.12: fixed createPlayerProfile to call PlayerProfileService directly
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
//         - Components can now access `coreEngine.player` and `coreEngine.playerProfile`
//         - Removes need for wrapper getters (humanPlayer, playerProfile)
//         - Aligns with Player singleton documentation
// v0.4.6: Use PlayerProfileService singleton directly
//         - PlayerProfileService now exports singleton instance
//         - Remove "new PlayerProfileService()" - use imported instance directly
//         - Same pattern for LeaderboardService and RightsService
//         - Fixes "PlayerProfileService is not a constructor" error
// v0.4.5: Munitions terminology rename (resources → munitions)
//         - Added fireMunition(munitionType, row, col) method
//         - Kept handleStarShellFired for backward compatibility
//         - Aligns with Game.js v0.8.8 and CoreEngine.js v0.6.10

import React, { createContext, useContext } from 'react';
import CoreEngine from '../engines/CoreEngine';
import PlayerProfileService from '../services/PlayerProfileService';
import leaderboardService from '../services/LeaderboardService';
import rightsService from '../services/RightsService';
import VoucherService from '../services/VoucherService';
import GameStatsService from '../services/GameStatsService';

const version = "v0.4.15";

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
      get eraConfig() { return coreEngine.selectedEraConfig; },
      
      // v0.4.0: Multi-fleet support
      get selectedOpponents() { return coreEngine.selectedOpponents; },
      get selectedOpponent() { return coreEngine.selectedOpponents?.[0] || null; }, // Backward compatibility
            
      // Computed state
      getUIState: () => coreEngine.getUIState(),
//      getPlacementProgress: () => coreEngine.getPlacementProgress(),
      
      // Game actions
      registerShipPlacement: (ship, shipCells, orientation, playerId) =>
        coreEngine.registerShipPlacement(ship, shipCells, orientation, playerId),
        
        // Game Guide preferences
        disableGameGuide: (playerId) => PlayerProfileService.disableGameGuide(playerId),
      
      // v0.4.5: Munitions actions
      fireMunition: (munitionType, row, col) => coreEngine.fireMunition(munitionType, row, col),
      
      // User profile functions
      // v0.4.6: Use service singletons directly
      getPlayerProfile: (playerId) => PlayerProfileService.getPlayerProfile(playerId),
        createPlayerProfile: (playerId, gameName) => PlayerProfileService.createPlayerProfile(playerId, gameName),
        
        getLeaderboard: (limit) => leaderboardService.getLeaderboard(limit),
      getRecentChampions: (limit) => leaderboardService.getRecentChampions(limit),
      getPlayerGameName: (playerId) => coreEngine.getPlayerGameName(playerId), // Keep - still in CoreEngine
      
      // v0.4.3: Logout function
      logout: () => coreEngine.logout(),
      
      // Rights functions
      // v0.4.6: Use service singletons directly
      grantEraAccess: (playerId, eraId, paymentData) => rightsService.grantEraAccess(playerId, eraId, paymentData),
        // NEW:
        redeemVoucher: (playerId, voucherCode) => VoucherService.redeemVoucher(playerId, voucherCode),
        getUserRights: (playerId) => rightsService.getUserRights(playerId),
            
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// Export context for direct use if needed
export { GameState as GameContext };
export { coreEngine };

// EOF
