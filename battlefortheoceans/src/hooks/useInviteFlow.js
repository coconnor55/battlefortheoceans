// src/hooks/useInviteFlow.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.2: Manually fixed up file after ai wipeout
// v0.1.0: Initial useInviteFlow hook - voucher invitation and redemption logic
//         - inviteFriend(friendEmail, eraId) - Find/create voucher, send email
//         - consumeVoucher(voucherCode) - Redeem voucher user entered
//         - Extracted from GetAccessPage for better separation of concerns

import { useState } from 'react';
import VoucherService from '../services/VoucherService';
import { coreEngine, useGame } from '../context/GameContext';

const version = 'v0.1.2';

/**
 * Custom hook for voucher invitation and redemption flows
 *
 * @returns {object} Hook state and methods
 */
export function useInviteFlow() {
    const eraId = coreEngine.selectedEraId;
    const eraConfig = coreEngine.selectedEraConfig;
    const playerId = coreEngine.playerId;
    const playerProfile = coreEngine.playerProfile;
    const userEmail = coreEngine.userEmail;
    const playerGameName = coreEngine.playerGameName;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
    console.log(`[INVITE] useInviteFlow ${version}| Hook initialized`);

  /**
   * Invite friend via email
   * Finds existing voucher or creates new one, then sends email
   *
   * @param {string} friendEmail - Friend's email address
   * @param {string} eraId - Era ID for voucher (e.g., 'pirates', 'midway')
   * @returns {Promise<object>} Result with status
   */
  const inviteFriend = async (friendEmail, eraId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log(`[INVITE] useInviteFlow ${version}| Inviting friend: ${friendEmail} for era: ${eraId}`);

        console.log(`[INVITE] ${version}|  coreEngine.playerProfile:`, coreEngine.playerProfile);
        
        const friendPasses = coreEngine.gameConfig.friend_signup || 10;  // ✅ What friend gets
        const rewardPasses = coreEngine.gameConfig.referral_passes || 1;
        const signupBonus = coreEngine.gameConfig.referral_signup || 10;

        console.log(`[INVITE] useInviteFlow ${version}| Inviting friend: ${friendEmail} for era: ${eraId}`);

      if (!playerId || !userEmail) {
        throw new Error('You must be logged in to send invites');
      }

      // Validate friend email
      if (!friendEmail || !friendEmail.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      if (friendEmail.toLowerCase() === userEmail.toLowerCase()) {
        throw new Error('You cannot send an invite to yourself');
      }

      // Get era name for email
      const eraName = eraConfig?.name || eraId;

      // Find or create voucher (prevents abuse)
      console.log(`[INVITE] useInviteFlow ${version}| Finding or creating voucher...`);

      const voucherResult = await VoucherService.findOrCreateVoucher(
        eraId,          // type (era name)
        friendPasses,             // value (10 plays)
        playerId,         // created_by
        friendEmail,    // email_sent_to
        'email_friend'  // purpose
      );

      console.log(`[INVITE] useInviteFlow ${version}| Voucher result:`, voucherResult);

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
      console.log(`[INVITE] useInviteFlow ${version}| Sending email...`);
      const emailResponse = await fetch('/.netlify/functions/send-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          friendEmail,
          senderName: playerGameName,
          senderEmail: userEmail,
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

      console.log(`[INVITE] useInviteFlow ${version}| Invite successful:`, statusMessage);

      return {
        success: true,
        status: voucherResult.status,
        voucherCode: voucherResult.voucherCode,
        message: statusMessage
      };

    } catch (err) {
      console.error(`[INVITE] useInviteFlow ${version}| Invite failed:`, err);
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
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
        console.log(`[INVITE] ${version}| Consuming voucher: ${voucherCode}`);

        console.log(`[INVITE] ${version}| coreEngine.playerProfile:`, coreEngine.playerProfile);
        
        const playerId = coreEngine.playerProfile?.id;
        const playerGameName = coreEngine.playerGameName;
        const userEmail = coreEngine.user?.email;

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
      console.log(`[INVITE] useInviteFlow ${version}| Redeeming voucher...`);
      const result = await VoucherService.redeemVoucher(playerId, voucherCode.trim());

      console.log(`[INVITE] useInviteFlow ${version}| Redemption successful:`, result);

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
      console.error(`[INVITE] useInviteFlow ${version}| Redemption failed:`, err);
      
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
