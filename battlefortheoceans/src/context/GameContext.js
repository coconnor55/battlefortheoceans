// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor
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

const version = "v0.4.4";

const GameState = createContext();

// CoreEngine singleton - single source of truth for all game state
const coreEngine = new CoreEngine();

// Service instances for direct calls
const userProfileService = new UserProfileService();
const leaderboardService = new LeaderboardService();
const rightsService = new RightsService();

export const GameProvider = ({ children }) => {
  console.log(`[GameContext ${version}] Provider initialized with CoreEngine`);
  
  return (
    <GameState.Provider value={{

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
      get humanPlayer() { return coreEngine.humanPlayer; },
      get gameInstance() { return coreEngine.gameInstance; },
      get board() { return coreEngine.board; },
      get userProfile() { return coreEngine.userProfile; },
      
      // Computed state
      getUIState: () => coreEngine.getUIState(),
      getPlacementProgress: () => coreEngine.getPlacementProgress(),
      
      // Game actions
      registerShipPlacement: (ship, shipCells, orientation, playerId) =>
        coreEngine.registerShipPlacement(ship, shipCells, orientation, playerId),
      
      // v0.4.1: Resource actions
      handleStarShellFired: (row, col) => coreEngine.handleStarShellFired(row, col),
      
      // User profile functions
      // v0.4.4: Call services directly (not through CoreEngine)
      getUserProfile: (userId) => userProfileService.getUserProfile(userId),
      createUserProfile: (userId, gameName) => coreEngine.createUserProfile(userId, gameName), // Keep - has business logic
      updateGameStats: (gameResults) => coreEngine.updateGameStats(gameResults), // Keep - has business logic
      getLeaderboard: (limit) => leaderboardService.getLeaderboard(limit),
      getRecentChampions: (limit) => leaderboardService.getRecentChampions(limit),
      getPlayerGameName: (playerId) => coreEngine.getPlayerGameName(playerId), // Keep - still in CoreEngine
      
      // v0.4.3: Logout function
      logout: () => coreEngine.logout(),
      
      // Rights functions
      // v0.4.4: Call services directly (not through CoreEngine)
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
