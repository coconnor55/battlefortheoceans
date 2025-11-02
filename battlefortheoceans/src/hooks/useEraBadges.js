// src/hooks/useEraBadges.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial useEraBadges hook - manage era badges and pass balance
//
// PURPOSE:
// Encapsulates badge fetching logic for SelectEraPage
// - Fetches pass balance
// - Fetches badges for all eras
// - Handles loading and error states
// - Auto-refreshes when dependencies change

import { useState, useEffect, useCallback } from 'react';
import RightsService from '../services/RightsService';

const version = 'v0.1.0';

/**
 * Custom hook for managing era badges and pass balance
 *
 * @param {string} userId - User ID
 * @param {Array} eras - Array of era configurations
 * @returns {object} Badge state and refresh function
 */
export function useEraBadges(userId, eras) {
  const [passBalance, setPassBalance] = useState(0);
  const [eraBadges, setEraBadges] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch pass balance
  const fetchPassBalance = useCallback(async () => {
    if (!userId || userId.startsWith('guest-')) {
      setPassBalance(0);
      return;
    }

    try {
      const balance = await RightsService.getPassBalance(userId);
      setPassBalance(balance);
      console.log(`[useEraBadges ${version}] Pass balance:`, balance);
    } catch (err) {
      console.error(`[useEraBadges ${version}] Error fetching pass balance:`, err);
      setPassBalance(0);
    }
  }, [userId]);

  // Fetch badges for all eras
  const fetchBadges = useCallback(async () => {
    if (!userId || !eras || eras.length === 0) {
      setEraBadges(new Map());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`[useEraBadges ${version}] Fetching badges for ${eras.length} eras`);
      
      const badgeMap = await RightsService.getBadgesForUser(userId, eras);
      
      setEraBadges(badgeMap);
      console.log(`[useEraBadges ${version}] Loaded ${badgeMap.size} badges`);
      
    } catch (err) {
      console.error(`[useEraBadges ${version}] Error fetching badges:`, err);
      setError(err.message || 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  }, [userId, eras]);

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