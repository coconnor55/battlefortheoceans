// src/services/RightsService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.0: Complete pass management and access control
//         - Added getPassBalance() - sum all active pass rights
//         - Added canPlayEra() - complex access logic (voucher priority, exclusive, passes)
//         - Added consumePlay() - decrement voucher/passes with FIFO
//         - Added creditPasses() - create pass rights entries
//         - Added getEraBadgeInfo() - badge display logic
//         - Updated grantEraAccess() - permanent access (expires_at = null)
//         - Deprecated redeemVoucher() - use VoucherService instead
// v0.1.2: Return empty rights for guest users
// v0.1.1: Export singleton instance instead of class

import { supabase } from '../utils/supabaseClient';

const version = "v0.2.0";

class RightsService {
  constructor() {
    this.version = version;
    this.log('RightsService initialized');
  }

  // ============================================================================
  // PASS MANAGEMENT (NEW IN v0.2.0)
  // ============================================================================

  /**
   * Get user's total pass balance
   * Sums all active pass rights (not expired, not exhausted)
   *
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total passes available
   */
  async getPassBalance(userId) {
    if (!userId || userId.startsWith('guest-')) {
      console.log(`[RightsService ${version}] Guest user - returning 0 pass balance`);
      return 0;
    }

    try {
      const { data: passRights, error } = await supabase
        .from('user_rights')
        .select('uses_remaining, expires_at')
        .eq('user_id', userId)
        .eq('rights_type', 'pass')
        .gt('uses_remaining', 0) // Not exhausted
        .or('expires_at.is.null,expires_at.gt.now()'); // Not expired

      if (error) {
        console.error(`[RightsService ${version}] Error fetching pass balance:`, error);
        return 0;
      }

      const total = passRights?.reduce((sum, right) => {
        return sum + right.uses_remaining;
      }, 0) || 0;

      console.log(`[RightsService ${version}] Pass balance for user ${userId}: ${total}`);
      return total;

    } catch (error) {
      console.error(`[RightsService ${version}] Failed to get pass balance:`, error);
      return 0;
    }
  }

  /**
   * Check if user can play an era
   * Implements priority system: vouchers > exclusive check > passes > free
   *
   * @param {string} userId - User ID
   * @param {string} eraId - Era ID
   * @param {object} eraConfig - Era configuration (must include passes_required, exclusive)
   * @returns {Promise<object>} Access information
   */
  async canPlayEra(userId, eraId, eraConfig) {
    if (!userId || !eraId || !eraConfig) {
      console.error(`[RightsService ${version}] Missing required parameters for canPlayEra`);
      return { canPlay: false, method: 'error', reason: 'Missing parameters' };
    }

    try {
      // PRIORITY 1: Check for era-specific vouchers
      const { data: eraRights, error: eraError } = await supabase
        .from('user_rights')
        .select('*')
        .eq('user_id', userId)
        .eq('rights_type', 'era')
        .eq('rights_value', eraId)
        .or('uses_remaining.gt.0,uses_remaining.eq.-1') // Has plays or unlimited
        .or('expires_at.is.null,expires_at.gt.now()') // Not expired
        .order('uses_remaining', { ascending: false }); // Prefer unlimited first

      if (eraError) {
        console.error(`[RightsService ${version}] Error checking era rights:`, eraError);
      }

      if (eraRights && eraRights.length > 0) {
        const right = eraRights[0]; // Use first (best) voucher
        console.log(`[RightsService ${version}] User has era voucher for ${eraId}`);
        return {
          canPlay: true,
          method: 'voucher',
          usesRemaining: right.uses_remaining,
          rightsId: right.id,
          voucherCode: right.voucher_used,
          expiresAt: right.expires_at
        };
      }

      // PRIORITY 2: Check if exclusive (blocks passes)
      if (eraConfig.exclusive === true) {
        console.log(`[RightsService ${version}] Era ${eraId} is exclusive, requires voucher`);
        return {
          canPlay: false,
          method: 'exclusive',
          reason: 'Requires voucher'
        };
      }

      // PRIORITY 3: Check generic passes
      if (eraConfig.passes_required > 0) {
        const passBalance = await this.getPassBalance(userId);
        const canPlay = passBalance >= eraConfig.passes_required;

        console.log(`[RightsService ${version}] Era ${eraId} requires ${eraConfig.passes_required} passes, user has ${passBalance}`);

        return {
          canPlay,
          method: 'passes',
          passesRequired: eraConfig.passes_required,
          passBalance,
          playsAvailable: Math.floor(passBalance / eraConfig.passes_required)
        };
      }

      // PRIORITY 4: Free era
      console.log(`[RightsService ${version}] Era ${eraId} is free`);
      return {
        canPlay: true,
        method: 'free'
      };

    } catch (error) {
      console.error(`[RightsService ${version}] Failed to check era access:`, error);
      return { canPlay: false, method: 'error', reason: error.message };
    }
  }

  /**
   * Consume a play (decrement voucher or passes)
   *
   * @param {string} userId - User ID
   * @param {string} eraId - Era ID
   * @param {object} eraConfig - Era configuration
   * @returns {Promise<object>} Consumption result
   */
  async consumePlay(userId, eraId, eraConfig) {
    if (!userId || !eraId || !eraConfig) {
      throw new Error('Missing required parameters');
    }

    try {
      const access = await this.canPlayEra(userId, eraId, eraConfig);

      if (!access.canPlay) {
        throw new Error('No access to era');
      }

      // METHOD 1: Consume voucher play
      if (access.method === 'voucher') {
        const { data: right, error: fetchError } = await supabase
          .from('user_rights')
          .select('*')
          .eq('id', access.rightsId)
          .single();

        if (fetchError) throw fetchError;

        if (right.uses_remaining === -1) {
          // Unlimited - no decrement needed
          console.log(`[RightsService ${version}] Using unlimited voucher for ${eraId}`);
          return { method: 'voucher', remaining: -1 };
        }

        const newUses = right.uses_remaining - 1;

        const { error: updateError } = await supabase
          .from('user_rights')
          .update({
            uses_remaining: newUses,
            updated_at: new Date().toISOString()
          })
          .eq('id', access.rightsId);

        if (updateError) throw updateError;

        console.log(`[RightsService ${version}] Consumed voucher play for ${eraId}, ${newUses} remaining`);
        return { method: 'voucher', remaining: newUses };
      }

      // METHOD 2: Consume passes (FIFO - oldest first)
      if (access.method === 'passes') {
        const { data: passRights, error: fetchError } = await supabase
          .from('user_rights')
          .select('*')
          .eq('user_id', userId)
          .eq('rights_type', 'pass')
          .gt('uses_remaining', 0)
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('created_at', { ascending: true }); // FIFO - oldest first

        if (fetchError) throw fetchError;

        let remaining = access.passesRequired;

        for (const right of passRights) {
          if (remaining <= 0) break;

          if (right.uses_remaining >= remaining) {
            // This entry has enough passes
            const { error: updateError } = await supabase
              .from('user_rights')
              .update({
                uses_remaining: right.uses_remaining - remaining,
                updated_at: new Date().toISOString()
              })
              .eq('id', right.id);

            if (updateError) throw updateError;

            remaining = 0;
          } else {
            // Exhaust this entry, continue to next
            const { error: updateError } = await supabase
              .from('user_rights')
              .update({
                uses_remaining: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', right.id);

            if (updateError) throw updateError;

            remaining -= right.uses_remaining;
          }
        }

        if (remaining > 0) {
          throw new Error('Insufficient passes');
        }

        const newBalance = await this.getPassBalance(userId);
        console.log(`[RightsService ${version}] Consumed ${access.passesRequired} passes for ${eraId}, ${newBalance} remaining`);
        return { method: 'passes', remaining: newBalance };
      }

      // METHOD 3: Free era - nothing to consume
      console.log(`[RightsService ${version}] Free era ${eraId}, no consumption needed`);
      return { method: 'free' };

    } catch (error) {
      console.error(`[RightsService ${version}] Failed to consume play:`, error);
      throw error;
    }
  }

  /**
   * Credit passes to user
   * Creates a new user_rights entry with pass type
   *
   * @param {string} userId - User ID
   * @param {number} amount - Number of passes to credit
   * @param {string} source - Source: "achievement", "referral", "bundle", "admin", "voucher"
   * @param {object} metadata - Optional metadata
   * @returns {Promise<object>} Created user_rights entry
   */
  async creditPasses(userId, amount, source, metadata = {}) {
    const validSources = ['achievement', 'referral', 'bundle', 'admin', 'voucher'];

    if (!validSources.includes(source)) {
      throw new Error(`Invalid pass source: ${source}`);
    }

    if (!userId || userId.startsWith('guest-')) {
      throw new Error('Cannot credit passes to guest users');
    }

    if (!amount || amount <= 0) {
      throw new Error('Amount must be positive');
    }

    try {
      // Set expiration to 2 years from now
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 2);

      const { data, error } = await supabase
        .from('user_rights')
        .insert({
          user_id: userId,
          rights_type: 'pass',
          rights_value: source, // Track source
          uses_remaining: amount,
          expires_at: expiresAt.toISOString(),
          stripe_payment_intent_id: metadata.payment_intent || null,
          voucher_used: metadata.voucher_code || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[RightsService ${version}] Credited ${amount} passes (${source}) to user ${userId}`);

      return data;

    } catch (error) {
      console.error(`[RightsService ${version}] Failed to credit passes:`, error);
      throw error;
    }
  }

  /**
   * Get badge display info for era
   * Returns badge text, button text, style, and access status
   *
   * @param {string} userId - User ID
   * @param {object} eraConfig - Era configuration
   * @returns {Promise<object>} Badge information
   */
  async getEraBadgeInfo(userId, eraConfig) {
    try {
      const access = await this.canPlayEra(userId, eraConfig.id, eraConfig);

      // VOUCHER ACCESS
      if (access.method === 'voucher' && access.canPlay) {
        const count = access.usesRemaining === -1 ? '∞' : access.usesRemaining;
        const label = eraConfig.exclusive_label || 'EXCLUSIVE';

        let badge = `${count} ${label}`;
        let button = 'Play (using voucher)';

        // Add expiry info for time-based vouchers
        if (access.expiresAt && access.usesRemaining === -1) {
          const expiryDate = new Date(access.expiresAt);
          const now = new Date();
          const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          if (daysLeft <= 7) {
            badge = `${count} ${label} (${daysLeft}d left)`;
          }
        }

        return {
          badge,
          button,
          style: 'badge-exclusive',
          canPlay: true,
          method: 'voucher'
        };
      }

      // PASS ACCESS
      if (access.method === 'passes') {
        if (access.canPlay) {
          const passText = access.passesRequired === 1 ? 'pass' : 'passes';
          return {
            badge: `${access.playsAvailable} PLAYS`,
            button: `Play (using ${access.passesRequired} ${passText})`,
            style: 'badge-plays',
            canPlay: true,
            method: 'passes'
          };
        } else {
          return {
            badge: '0 PLAYS',
            button: 'Get Passes',
            style: 'badge-locked',
            canPlay: false,
            method: 'passes'
          };
        }
      }

      // EXCLUSIVE (no voucher, blocks passes)
      if (access.method === 'exclusive') {
        const label = eraConfig.exclusive_label || 'EXCLUSIVE';
        return {
          badge: `0 ${label}`,
          button: 'Get Vouchers',
          style: 'badge-locked',
          canPlay: false,
          method: 'exclusive'
        };
      }

      // FREE ERA
      return {
        badge: 'FREE',
        button: 'Play',
        style: 'badge-free',
        canPlay: true,
        method: 'free'
      };

    } catch (error) {
      console.error(`[RightsService ${version}] Failed to get badge info:`, error);
      return {
        badge: 'ERROR',
        button: 'Try Again',
        style: 'badge-error',
        canPlay: false,
        method: 'error'
      };
    }
  }

  // ============================================================================
  // EXISTING METHODS (Preserved for backward compatibility)
  // ============================================================================

  /**
   * Check if user has access to a specific era
   *
   * @deprecated Use canPlayEra() for more detailed access information
   * @param {string} userId - User ID
   * @param {string} eraId - Era ID
   * @returns {Promise<boolean>} True if user has access
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
   *
   * @param {string} userId - User ID
   * @param {string} eraId - Era ID
   * @param {object} paymentData - Payment metadata
   * @returns {Promise<object|boolean>} Created user_rights entry or false
   */
  async grantEraAccess(userId, eraId, paymentData = {}) {
    if (!userId || !eraId) {
      console.error(version, 'Cannot grant era access without userId and eraId');
      return false;
    }

    try {
      console.log(version, `Granting era access for user ${userId}, era ${eraId}`);

      // UPDATED v0.2.0: Permanent access (expires_at = null)
      const { data, error } = await supabase
        .from('user_rights')
        .insert({
          user_id: userId,
          rights_type: 'era',
          rights_value: eraId,
          uses_remaining: -1, // Unlimited uses
          expires_at: null, // Never expires (permanent)
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
   *
   * @deprecated Use VoucherService.redeemVoucher() instead
   * @param {string} userId - User ID
   * @param {string} voucherCode - Voucher code
   * @returns {Promise<object>} Redemption result
   */
  async redeemVoucher(userId, voucherCode) {
    console.warn(`[RightsService ${version}] redeemVoucher() is deprecated. Use VoucherService.redeemVoucher() instead.`);
    
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
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of user_rights entries
   */
  async getUserRights(userId) {
    if (!userId) {
      console.error(version, 'Cannot get user rights without userId');
      return [];
    }

    // Skip database query for guest users
    if (!userId || userId.startsWith('guest-')) {
      console.log('[RightsService]', this.version, 'Guest user - returning empty rights');
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

// Export singleton instance (not class)
const rightsServiceInstance = new RightsService();
export default rightsServiceInstance;

// EOF
