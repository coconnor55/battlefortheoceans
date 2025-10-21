// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor
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

const version = "v0.4.2";

const GameState = createContext();

// CoreEngine singleton - single source of truth for all game state
const coreEngine = new CoreEngine();

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
      getUserProfile: (userId) => coreEngine.getUserProfile(userId),
      createUserProfile: (userId, gameName) => coreEngine.createUserProfile(userId, gameName),
      updateGameStats: (gameResults) => coreEngine.updateGameStats(gameResults),
      getLeaderboard: (limit) => coreEngine.getLeaderboard(limit),
      getRecentChampions: (limit) => coreEngine.getRecentChampions(limit),
      getPlayerGameName: (playerId) => coreEngine.getPlayerGameName(playerId),
      
      // Rights functions
      hasEraAccess: (userId, eraId) => coreEngine.hasEraAccess(userId, eraId),
      grantEraAccess: (userId, eraId, paymentData) => coreEngine.grantEraAccess(userId, eraId, paymentData),
      redeemVoucher: (userId, voucherCode) => coreEngine.redeemVoucher(userId, voucherCode),
      getUserRights: (userId) => coreEngine.getUserRights(userId),
      
      // Era functions
      getAllEras: () => coreEngine.getAllEras(),
      getEraById: (eraId) => coreEngine.getEraById(eraId),
      getPromotableEras: () => coreEngine.getPromotableEras(),
      getFreeEras: () => coreEngine.getFreeEras(),
      clearEraCache: () => coreEngine.clearEraCache(),
      
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// Export context for direct use if needed
export { GameState as GameContext };

// EOF
