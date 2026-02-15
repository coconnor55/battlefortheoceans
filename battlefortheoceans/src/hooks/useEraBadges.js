// src/hooks/useEraBadges.js
// Copyright(c) 2025, Clint H. O'Connor
//
// PURPOSE:
// v0.1.3: Optimize guest badge generation - skip database queries for guests
//         - Generate badges locally for guests (free vs locked)
//         - Prevents unnecessary API calls and improves performance
// v0.1.2: use erasMap size instead to fix React rendering issue
// v0.1.1: Accept erasMap instead of eras array
//         - Prevents render loop by using stable string dependency
//         - erasMapString = Array.from(erasMap.keys()).sort().join(',')
// v0.1.0: Initial useEraBadges hook - manage era badges and pass balance
// Encapsulates badge fetching logic for SelectEraPage
// - Fetches pass balance
// - Fetches badges for all eras
// - Handles loading and error states
// - Auto-refreshes when dependencies change

import { useState, useEffect, useCallback } from 'react';
import RightsService from '../services/RightsService';
import Player from '../classes/Player';
import { coreEngine } from '../context/GameContext';

const version = 'v0.1.3';
const tag = "BADGES";
const module = "useEraBadges";
let method = "";

/**
 * Custom hook for managing era badges and pass balance
 *
 * @param {string} playerId - User ID
 * @param {Array} eras - Array of era configurations
 * @returns {object} Badge state and refresh function
 */
export function useEraBadges(playerId, erasMap) {
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

    const eraCount = coreEngine.eras?.size || 0;
    log(`useEraBadges: playerId=${playerId}, # eras=${eraCount}`);

    const [passBalance, setPassBalance] = useState(0);
  const [eraBadges, setEraBadges] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch pass balance
  const fetchPassBalance = useCallback(async () => {
    if (!playerId || Player.isGuest(playerId)) {
      setPassBalance(0);
      return;
    }

    try {
      const balance = await RightsService.getPassBalance(playerId);
      setPassBalance(balance);
      log(`useEraBadges: Pass balance:`, balance);
    } catch (err) {
      logerror(`useEraBadges: Error fetching pass balance:`, err);
      setPassBalance(0);
    }
  }, [playerId]);

  // Fetch badges for all eras
    const fetchBadges = useCallback(async () => {
      if (!playerId || !coreEngine.eras || coreEngine.eras.size === 0) {
          setEraBadges(new Map());
        setLoading(false);
        return;
      }

      // Skip database queries for guest users - generate badges locally
      if (Player.isGuest(playerId)) {
        method = 'fetchBadges';
        log('Guest user - generating badges locally without database query');
        const guestBadgeMap = new Map();
        
        // Guests can only play free eras (no passes_required, not exclusive)
        coreEngine.eras.forEach((eraConfig, eraId) => {
          const isFree = !eraConfig.exclusive && (!eraConfig.passes_required || eraConfig.passes_required === 0);
          if (isFree) {
            guestBadgeMap.set(eraId, {
              badge: 'FREE',
              button: 'Play',
              style: 'badge-free',
              canPlay: true,
              method: 'free'
            });
          } else {
            guestBadgeMap.set(eraId, {
              badge: 'Sign Up',
              button: 'Sign Up',
              style: 'badge-locked',
              canPlay: false,
              method: 'guest'
            });
          }
        });
        
        setEraBadges(guestBadgeMap);
        setLoading(false);
        log(`Generated ${guestBadgeMap.size} guest badges`);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        log(`useEraBadges: Fetching badges for ${coreEngine.eras.size} eras`);
          const badgeMap = await RightsService.getBadgesForUser(playerId, coreEngine.eras);
          
      setEraBadges(badgeMap);
          log(`Loaded ${badgeMap.size} badges`);
    } catch (err) {
      logerror(`useEraBadges: Error fetching badges:`, err);
      setError(err.message || 'Failed to load badges');
    } finally {
      setLoading(false);
    }
    }, [playerId, eraCount]);
    
  // Refresh both pass balance and badges
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchPassBalance(),
      fetchBadges()
    ]);
  }, [fetchPassBalance, fetchBadges]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    passBalance,
    eraBadges,
    loading,
    error,
    refresh
  };
}

export default useEraBadges;

// EOF
