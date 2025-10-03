// src/context/GameContext.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext } from 'react';
import CoreEngine from '../classes/CoreEngine';

const version = "v0.3.1";
const APP_VERSION = 'v1.0.0'; // Update this with each release

const GameState = createContext();

// CoreEngine singleton - single source of truth for all game state
const coreEngine = new CoreEngine();

export const GameProvider = ({ children }) => {
  console.log(`[GameContext ${version}] Provider initialized with CoreEngine`);
  
  return (
    <GameState.Provider value={{
        // Version
        appVersion: APP_VERSION,

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
      get selectedOpponent() { return coreEngine.selectedOpponent; },
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
      
      // Direct service access
      eraService: coreEngine.eraService
    }}>
      {children}
    </GameState.Provider>
  );
};

export const useGame = () => useContext(GameState);

// Export context for direct use if needed
export { GameState as GameContext };

// EOF
