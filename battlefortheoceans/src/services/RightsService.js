// src/services/RightsService.js
// Copyright(c) 2025, Clint H. O'Connor

import { supabase } from '../utils/supabaseClient';

const version = "v0.1.0";

class RightsService {
  constructor() {
    this.version = version;
    this.log('RightsService initialized');
  }

  /**
   * Check if user has access to a specific era
   */
  async hasEraAccess(userId, eraId) {
    if (!userId || !eraId) {
      console.error(version, 'Cannot check era access without userId and eraId');
      return false;
    }

    try {
      console.log(version, `Checking era access for user ${userId}, era ${eraId}`);
      
      const { data, error } = await supabase
        .from('user_rights')
        .select('*')
        .eq('user_id', userId)
        .eq('rights_type', 'era')
        .eq('rights_value', eraId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error(version, 'Error checking era access:', error);
        return false;
      }

      if (data) {
        // Check if the right has expired or no uses remaining
        const now = new Date();
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
        const usesRemaining = data.uses_remaining;

        if (expiresAt && now > expiresAt) {
          console.log(version, `Era access expired for ${eraId}`);
          return false;
        }

        if (usesRemaining !== null && usesRemaining !== -1 && usesRemaining <= 0) {
          console.log(version, `No uses remaining for ${eraId}`);
          return false;
        }

        console.log(version, `Era access confirmed for ${eraId}`);
        return true;
      }

      console.log(version, `No era access found for ${eraId}`);
      return false;

    } catch (error) {
      console.error(version, 'Failed to check era access:', error);
      return false;
    }
  }

  /**
   * Grant era access to user (typically called after successful payment)
   */
  async grantEraAccess(userId, eraId, paymentData = {}) {
    if (!userId || !eraId) {
      console.error(version, 'Cannot grant era access without userId and eraId');
      return false;
    }

    try {
      console.log(version, `Granting era access for user ${userId}, era ${eraId}`);

      // Set expiration to 1 year from now (for purchased content)
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('user_rights')
        .insert({
          user_id: userId,
          rights_type: 'era',
          rights_value: eraId,
          uses_remaining: -1, // Unlimited uses
          expires_at: expiresAt,
          stripe_payment_intent_id: paymentData.stripe_payment_intent_id || null,
          voucher_used: paymentData.voucher_used || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error(version, 'Error granting era access:', error);
        return false;
      }

      console.log(version, `Era access granted successfully for ${eraId}`);
      return data;

    } catch (error) {
      console.error(version, 'Failed to grant era access:', error);
      return false;
    }
  }

  /**
   * Redeem a voucher code
   */
  async redeemVoucher(userId, voucherCode) {
    if (!userId || !voucherCode) {
      console.error(version, 'Cannot redeem voucher without userId and voucherCode');
      throw new Error('Invalid parameters');
    }

    try {
      console.log(version, `Redeeming voucher ${voucherCode} for user ${userId}`);

      // Call the Supabase function to redeem voucher
      const { data, error } = await supabase.rpc('redeem_voucher', {
        p_user_id: userId,
        p_voucher_code: voucherCode.trim()
      });

      if (error) {
        console.error(version, 'Error redeeming voucher:', error);
        
        // Provide user-friendly error messages
        if (error.message.includes('Invalid voucher code')) {
          throw new Error('Invalid voucher code');
        } else if (error.message.includes('already been used')) {
          throw new Error('This voucher code has already been used');
        } else if (error.message.includes('expired')) {
          throw new Error('This voucher code has expired');
        } else {
          throw new Error('Failed to redeem voucher');
        }
      }

      console.log(version, `Voucher redeemed successfully: ${voucherCode}`);
      return data;

    } catch (error) {
      console.error(version, 'Failed to redeem voucher:', error);
      throw error; // Re-throw to maintain error message
    }
  }

  /**
   * Get all user rights for a specific user
   */
  async getUserRights(userId) {
    if (!userId) {
      console.error(version, 'Cannot get user rights without userId');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('user_rights')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error(version, 'Error fetching user rights:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error(version, 'Failed to fetch user rights:', error);
      return [];
    }
  }

  /**
   * Logging utility
   */
  log(message) {
    console.log(`[RightsService ${version}] ${message}`);
  }
}

export default RightsService;

// EOF
