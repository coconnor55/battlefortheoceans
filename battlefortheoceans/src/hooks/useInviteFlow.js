// src/hooks/useInviteFlow.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.6: Only notify subscribers for pass vouchers, not era vouchers
//         - Check voucherType from redeemVoucher result before notifying
//         - Prevents NavBar from refreshing pass balance for era vouchers
//         - Era vouchers don't affect pass balance, only pass vouchers do
// v0.1.5: Optimize hook to reduce re-renders
//         - Move data validation to useEffect (runs once on mount, not every render)
//         - Remove logging that runs on every render
//         - Prevents unnecessary re-initialization when parent component re-renders
// v0.1.4: Notify CoreEngine after voucher redemption to refresh NavBar pass balance
//         - Ensures pass balance updates immediately in NavBar after voucher redemption
// v0.1.3: Pass playerEmail to redeemVoucher for email validation
//         - Prevents users from redeeming vouchers sent to other people
//         - Validates voucher email_sent_to matches redeeming user's email
// v0.1.2: Manually fixed up file after ai wipeout
// v0.1.0: Initial useInviteFlow hook - voucher invitation and redemption logic
//         - inviteFriend(friendEmail, selectedEraId) - Find/create voucher, send email
//         - consumeVoucher(voucherCode) - Redeem voucher user entered
//         - Extracted from GetAccessPage for better separation of concerns

import React, { useState, useEffect } from 'react';
import VoucherService from '../services/VoucherService';
import { coreEngine, useGame } from '../context/GameContext';

const version = 'v0.1.6';
const tag = "INVITE";
const module = "useInviteFlow";
let method = "";

/**
 * Custom hook for voucher invitation and redemption flows
 *
 * @returns {object} Hook state and methods
 */
export function useInviteFlow() {
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

    //key data - see CoreEngine handle{state}
    const gameConfig = coreEngine.gameConfig;
    const eras = coreEngine.eras;
    const player = coreEngine.player
    const playerProfile = coreEngine.playerProfile;
    const playerEmail = coreEngine.playerEmail;
    const selectedEraId = coreEngine.selectedEraId;
    const selectedAlliance = coreEngine.selectedAlliance;
    const selectedOpponents = coreEngine.selectedOpponents;

    // derived data
    const playerId = coreEngine.playerId;
    const playerRole = coreEngine.playerRole;
    const playerGameName = coreEngine.playerGameName;
    const isGuest = player != null && player.isGuest;
    const isAdmin = player != null && playerProfile.isAdmin;
    const isDeveloper = player != null && playerProfile.isDeveloper;
    const isTester = player != null && playerProfile.isTester;
    const selectedOpponent = coreEngine.selectedOpponents[0];

    const selectedGameMode = coreEngine.selectedGameMode;
    const gameInstance = coreEngine.gameInstance;
    const board = coreEngine.board;

    // stop game if key data is missing (selectedAlliance is allowed to be null)
    // playerEmail is allowed to be null for guest users
    // Only validate once on mount, not on every render
    const selectedEraConfig = coreEngine.selectedEraConfig;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Validate key data only once on mount (useEffect)
  useEffect(() => {
    const required = isGuest 
        ? { gameConfig, eras, player, playerProfile }
        : { gameConfig, eras, player, playerProfile, playerEmail };
    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key, value]) => `${key}=${value}`);
    if (missing.length > 0) {
        logerror(`key data missing: ${missing.join(', ')}`, required);
        console.error(`${module}: key data missing: ${missing.join(', ')}`);
    } else {
        log('useInviteFlow: passed CoreEngine data checks');
    }
  }, []); // Only run once on mount

  /**
   * Invite friend via email
   * Finds existing voucher or creates new one, then sends email
   *
   * @param {string} friendEmail - Friend's email address
   * @param {string} selectedEraId - Era ID for voucher (e.g., 'pirates', 'midway')
   * @returns {Promise<object>} Result with status
   */
  const inviteFriend = async (friendEmail, selectedEraId) => {
      method = 'inviteFriend';

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      log(`Inviting friend: ${friendEmail} for era: ${selectedEraId}`);

        console.log(`[INVITE] ${version}|  coreEngine.playerProfile:`, coreEngine.playerProfile);
        
        const friendPasses = coreEngine.gameConfig.friend_signup || 10;  // ✅ What friend gets
        const rewardPasses = coreEngine.gameConfig.referral_passes || 1;
        const signupBonus = coreEngine.gameConfig.referral_signup || 10;

        log(`Inviting friend: ${friendEmail} for era: ${selectedEraId}`);

      if (!playerId || !playerEmail) {
        throw new Error('You must be logged in to send invites');
      }

      // Validate friend email
      if (!friendEmail || !friendEmail.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      if (friendEmail.toLowerCase() === playerEmail.toLowerCase()) {
        throw new Error('You cannot send an invite to yourself');
      }

      // Get era name for email
      const eraName = selectedEraConfig?.name || selectedEraId;

      // Find or create voucher (prevents abuse)
      log(`Finding or creating voucher...`);

      const voucherResult = await VoucherService.findOrCreateVoucher(
        selectedEraId,          // type (era name)
        friendPasses,             // value (10 plays)
        playerId,         // created_by
        friendEmail,    // email_sent_to
        'email_friend'  // purpose
      );

      log(`Voucher result:`, voucherResult);

      // Check if already redeemed
      if (voucherResult.status === 'already_redeemed') {
        setError(`This friend already redeemed a voucher for ${eraName}`);
        setLoading(false);
        return {
          success: false,
          status: 'already_redeemed'
        };
      }

      // Send email via Netlify function
      log(`Sending email...`);
      const emailResponse = await fetch('/.netlify/functions/send-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          friendEmail,
          senderName: playerGameName,
          senderEmail: playerEmail,
          voucherCode: voucherResult.voucherCode,
          eraName
        })
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        throw new Error(errorData.error || 'Failed to send invite email');
      }

      // Success
      const statusMessage = voucherResult.status === 'reused'
        ? `Resent existing invite to ${friendEmail}`
        : `Invite sent to ${friendEmail}!`;

      setSuccess(statusMessage);
      setLoading(false);

      log(`Invite successful:`, statusMessage);

      return {
        success: true,
        status: voucherResult.status,
        voucherCode: voucherResult.voucherCode,
        message: statusMessage
      };

    } catch (err) {
      logerror(`Invite failed:`, err);
      setError(err.message || 'Failed to send invite');
      setLoading(false);
      return {
        success: false,
        error: err.message
      };
    }
  };

  /**
   * Consume voucher code entered by user
   * Redeems voucher immediately
   *
   * @param {string} voucherCode - Voucher code to redeem
   * @returns {Promise<object>} Result with created rights
   */
  const consumeVoucher = async (voucherCode) => {
      method = 'consumeVoucher';

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
        console.log(`[INVITE] ${version}| Consuming voucher: ${voucherCode}`);

        console.log(`[INVITE] ${version}| coreEngine.playerProfile:`, coreEngine.playerProfile);
        
        const playerId = coreEngine.playerProfile?.id;
        const playerGameName = coreEngine.playerGameName;
        const playerEmail = coreEngine.playerEmail;

        console.log(`[INVITE ${version}] playerId:`, playerId);


      if (!playerId) {
        throw new Error('You must be logged in to redeem vouchers');
      }

      // Validate format (client-side quick check)
      if (!voucherCode || voucherCode.trim().length < 10) {
        throw new Error('Please enter a valid voucher code');
      }

      // Get display info before redemption
      const displayInfo = VoucherService.getDisplayInfo(voucherCode);

      // Redeem voucher
      log(`Redeeming voucher...`);
      const result = await VoucherService.redeemVoucher(playerId, voucherCode.trim(), playerEmail);

      log(`Redemption successful:`, result);

      // Only notify CoreEngine subscribers for pass vouchers (not era vouchers)
      // Era vouchers don't affect pass balance, so NavBar shouldn't refresh
      if (result.voucherType === 'pass' && coreEngine && coreEngine.notifySubscribers) {
        coreEngine.notifySubscribers();
        log('Notified CoreEngine subscribers after pass voucher redemption');
      } else if (result.voucherType === 'era') {
        log('Era voucher redeemed - skipping pass balance update');
      }

      // Success message
      const successMessage = `Voucher redeemed! You received ${displayInfo.displayText} for ${displayInfo.title}`;
      setSuccess(successMessage);
      setLoading(false);

      return {
        success: true,
        result,
        message: successMessage
      };

    } catch (err) {
      logerror(`Redemption failed:`, err);
      
      // User-friendly error messages
      let errorMessage = err.message;
      
      if (errorMessage.includes('Invalid voucher code')) {
        errorMessage = 'Invalid voucher code. Please check and try again.';
      } else if (errorMessage.includes('already redeemed') || errorMessage.includes('already been used')) {
        errorMessage = 'This voucher has already been used.';
      } else if (errorMessage.includes('expired')) {
        errorMessage = 'This voucher has expired.';
      }

      setError(errorMessage);
      setLoading(false);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  /**
   * Clear error and success messages
   */
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return {
    inviteFriend,
    consumeVoucher,
    clearMessages,
    loading,
    error,
    success
  };
}

export default useInviteFlow;

// EOF
