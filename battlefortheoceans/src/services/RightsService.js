// src/services/RightsService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.3.1: Support generic 'era' vouchers for exclusive eras
//         - If no era-specific voucher found and era is exclusive, check for generic 'era' vouchers
//         - Generic era vouchers (rights_value='era') work for any exclusive era
//         - Provides flexibility: vouchers can be era-specific or generic
// v0.3.0: Use server-side RPC function for all rights consumption (security)
//         - Changed voucher and pass consumption to use consume_rights RPC
//         - Prevents cheating by ensuring server-side validation
//         - Bypasses RLS policies that block client-side updates
//         - Validates ownership server-side before allowing consumption
// v0.2.10: Simplified voucher consumption to match pass consumption pattern
//         - Log voucher details in getVoucherBalance to see what's being counted
//         - Log verification details in consumeRights to confirm database state
//         - Check for mismatches between expected and actual uses_remaining
// v0.2.8: Fix voucher update query - remove .single() from update to avoid PGRST116 error
//         - Update query now uses separate verify step instead of .select().single()
//         - Prevents "The result contains 0 rows" error when updating vouchers
// v0.2.7: Add detailed logging for voucher consumption debugging
//         - Added logging in consumeRights and checkRights to trace voucher consumption
//         - Logs voucher details, fetch results, and update operations
// v0.2.6: Add getVoucherBalance method
//         - Counts all active era voucher rights (not expired, not exhausted)
//         - Similar to getPassBalance but for era vouchers
// v0.2.5: Updated logging to match new pattern (tag, module, method)
//         - Added logging constants and utility functions
//         - Fixed all template literal syntax errors
//         - Replaced all console.log/console.error with log()/logerror()
//         - Added method assignments before logging calls
// v0.2.4: renamed canPlayEra -> checkRights, consumePlay -> consumeRights
// v0.2.3: use ConfigLoader to get eraConfig
// v0.2.2: Fixed access priority logic
//         - PRIORITY 1: Check purchases first (stripe_payment_intent_id)
//         - PRIORITY 2: Check vouchers (voucher_used)
//         - PRIORITY 3: Check exclusive flag
//         - PRIORITY 4: Check passes
//         - Updated grantEraAccess() to set 2-year expiry (not null)
//         - Badge shows OWNED for purchases, X EXCLUSIVE for vouchers
// v0.2.1: Added batch badge fetching
// v0.2.0: Complete pass management and access control
// v0.1.2: Return empty rights for guest users
// v0.1.1: Export singleton instance instead of class

// -- See all user rights
// SELECT * FROM user_rights
// WHERE player_id = '180e5efa-2c5f-4a19-b969-d67283def379';
//
// -- Delete only pass rights for player 180e5efa-2c5f-4a19-b969-d67283def379
// DELETE only passes FROM user_rights
// WHERE player_id = '180e5efa-2c5f-4a19-b969-d67283def379'
// AND rights_type = 'pass';

import { supabase } from '../utils/supabaseClient';
import Player from '../classes/Player';

const version = "v0.3.1";
const tag = "RIGHTS";
const module = "RightsService";
let method = "";

// =================
// Logging utilities
const log = (message) => {
  console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
};

const logerror = (message, error = null) => {
  if (error) {
    console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
  } else {
    console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
  }
};
// =================

class RightsService {
  constructor() {
    this.version = version;
    method = 'constructor';
    log('RightsService initialized');
  }

  // ============================================================================
  // PASS MANAGEMENT (NEW IN v0.2.0)
  // ============================================================================

  /**
   * Get user's total pass balance
   * Sums all active pass rights (not expired, not exhausted)
   *
   * @param {string} playerId - User ID
   * @returns {Promise<number>} Total passes available
   */
  async getPassBalance(playerId) {
    method = 'getPassBalance';
    
    if (!playerId || Player.isGuest(playerId)) {
      log('Guest user - returning 0 pass balance');
      return 0;
    }

    try {
      const { data: passRights, error } = await supabase
        .from('user_rights')
        .select('uses_remaining, expires_at')
        .eq('player_id', playerId)
        .eq('rights_type', 'pass')
        .gt('uses_remaining', 0) // Not exhausted
        .or('expires_at.is.null,expires_at.gt.now()'); // Not expired

      if (error) {
        logerror('Error fetching pass balance:', error);
        return 0;
      }

      const total = passRights?.reduce((sum, right) => {
        return sum + right.uses_remaining;
      }, 0) || 0;

      log(`Pass balance for user ${playerId}: ${total}`);
      return total;

    } catch (error) {
      logerror('Failed to get pass balance:', error);
      return 0;
    }
  }

  /**
   * Get user's total voucher balance (era vouchers)
   * Counts all active era voucher rights (not expired, not exhausted)
   *
   * @param {string} playerId - User ID
   * @returns {Promise<number>} Total vouchers available
   */
  async getVoucherBalance(playerId) {
    method = 'getVoucherBalance';
    
    if (!playerId || Player.isGuest(playerId)) {
      log('Guest user - returning 0 voucher balance');
      return 0;
    }

    try {
      const { data: voucherRights, error } = await supabase
        .from('user_rights')
        .select('uses_remaining, expires_at, id, voucher_used')
        .eq('player_id', playerId)
        .eq('rights_type', 'era')
        .not('voucher_used', 'is', null) // Has voucher_used (is a voucher)
        .gt('uses_remaining', 0) // Not exhausted
        .or('expires_at.is.null,expires_at.gt.now()'); // Not expired

      if (error) {
        logerror('Error fetching voucher balance:', error);
        return 0;
      }

      log(`getVoucherBalance: Found ${voucherRights?.length || 0} active vouchers:`, 
        voucherRights?.map(r => `id=${r.id}, uses=${r.uses_remaining}, voucher=${r.voucher_used?.substring(0, 20)}...`) || []);

      const total = voucherRights?.reduce((sum, right) => {
        return sum + right.uses_remaining;
      }, 0) || 0;

      log(`Voucher balance for user ${playerId}: ${total}`);
      return total;

    } catch (error) {
      logerror('Failed to get voucher balance:', error);
      return 0;
    }
  }

  /**
   * Check if user can play an era
   * Implements priority system: purchases > vouchers > exclusive check > passes > free
   *
   * @param {string} playerId - User ID
   * @param {string} eraId - Era ID
   * @param {object} eraConfig - Era configuration (must include passes_required, exclusive)
   * @returns {Promise<object>} Access information
   */
  async checkRights(playerId, eraConfig) {
    method = 'checkRights';
    
    if (!playerId || !eraConfig) {
      logerror(`Missing required parameters - playerId ${playerId} eraConfig ${eraConfig}`);
      return { canPlay: false, method: 'error', reason: 'Missing parameters' };
    }
    
    // Guest users can only play free eras
    if (Player.isGuest(playerId)) {
      log('Guest user - checking if era is free');
      if (eraConfig.exclusive === true || eraConfig.passes_required > 0) {
        log(`Guest cannot play ${eraConfig.id} - requires access`);
        return { canPlay: false, method: 'guest', reason: 'Requires account' };
      }
      log(`Guest can play free era ${eraConfig.id}`);
      return { canPlay: true, method: 'free' };
    }
    
    const eraId = eraConfig.id;
      
    try {
      // Fetch era rights: first try era-specific, then generic 'era' vouchers for exclusive eras
      let eraRights = null;
      let eraError = null;
      
      // First, check for era-specific vouchers (rights_value = eraId)
      const { data: specificRights, error: specificError } = await supabase
        .from('user_rights')
        .select('*')
        .eq('player_id', playerId)
        .eq('rights_type', 'era')
        .eq('rights_value', eraId)
        .or('uses_remaining.gt.0,uses_remaining.eq.-1') // Has plays or unlimited
        .or('expires_at.is.null,expires_at.gt.now()'); // Not expired

      if (specificError) {
        logerror('Error checking era-specific rights:', specificError);
      }
      
      eraRights = specificRights;
      eraError = specificError;
      
      // If no era-specific vouchers found AND era is exclusive, check for generic 'era' vouchers
      if ((!eraRights || eraRights.length === 0) && eraConfig.exclusive === true) {
        log(`No era-specific vouchers for ${eraId}, checking for generic 'era' vouchers (exclusive era)`);
        
        const { data: genericRights, error: genericError } = await supabase
          .from('user_rights')
          .select('*')
          .eq('player_id', playerId)
          .eq('rights_type', 'era')
          .eq('rights_value', 'era')  // Generic era vouchers work for any exclusive era
          .or('uses_remaining.gt.0,uses_remaining.eq.-1')
          .or('expires_at.is.null,expires_at.gt.now()');
        
        if (genericError) {
          logerror('Error checking generic era rights:', genericError);
        } else if (genericRights && genericRights.length > 0) {
          log(`Found ${genericRights.length} generic 'era' vouchers that work for exclusive era ${eraId}`);
          eraRights = genericRights;
        }
      }
      
      log(`checkRights for ${eraId}: found ${eraRights?.length || 0} era rights`);

      if (eraRights && eraRights.length > 0) {
        // PRIORITY 1: Check for PURCHASES (stripe_payment_intent_id present)
        const purchase = eraRights.find(right => right.stripe_payment_intent_id !== null);
        
        if (purchase) {
          log(`User has purchased ${eraId}`);
          return {
            canPlay: true,
            method: 'purchase',
            usesRemaining: -1, // Unlimited
            rightsId: purchase.id,
            expiresAt: purchase.expires_at
          };
        }

        // PRIORITY 2: Check for VOUCHERS (voucher_used present)
        const voucher = eraRights.find(right => right.voucher_used !== null);
        
        if (voucher) {
          log(`User has era voucher for ${eraId}: id=${voucher.id}, uses_remaining=${voucher.uses_remaining}, voucher_used=${voucher.voucher_used}`);
          return {
            canPlay: true,
            method: 'voucher',
            usesRemaining: voucher.uses_remaining,
            rightsId: voucher.id,
            voucherCode: voucher.voucher_used,
            expiresAt: voucher.expires_at
          };
        }
      }

      // PRIORITY 3: Check if exclusive (blocks passes)
      if (eraConfig.exclusive === true) {
        log(`Era ${eraId} is exclusive, requires voucher`);
        return {
          canPlay: false,
          method: 'exclusive',
          reason: 'Requires voucher'
        };
      }

      // PRIORITY 4: Check generic passes
      log(`Checking passes for ${eraId}: passes_required=${eraConfig.passes_required}, exclusive=${eraConfig.exclusive}`);
      
      if (eraConfig.passes_required > 0) {
        const passBalance = await this.getPassBalance(playerId);
        const canPlay = passBalance >= eraConfig.passes_required;

        log(`Era ${eraId} requires ${eraConfig.passes_required} passes, user has ${passBalance}`);

        return {
          canPlay,
          method: 'passes',
          passesRequired: eraConfig.passes_required,
          passBalance,
          playsAvailable: Math.floor(passBalance / eraConfig.passes_required)
        };
      }

      // PRIORITY 5: Free era
      log(`Era ${eraId} is free`);
      return {
        canPlay: true,
        method: 'free'
      };

    } catch (error) {
      logerror('Failed to check era access:', error);
      return { canPlay: false, method: 'error', reason: error.message };
    }
  }

  /**
   * Consume a play (decrement voucher or passes)
   *
   * @param {string} playerId - User ID
   * @param {string} eraId - Era ID
   * @param {object} eraConfig - Era configuration
   * @returns {Promise<object>} Consumption result
   */
  async consumeRights(playerId, eraConfig) {
    if (!playerId || !eraConfig) {
      throw new Error('Missing required parameters');
    }

    method = 'consumeRights';
    const eraId = eraConfig.id;
    log(`consumeRights called for ${eraId}, playerId=${playerId}`);
    
    try {
      const access = await this.checkRights(playerId, eraConfig);
      method = 'consumeRights'; // Reset after checkRights overwrites it
      log(`checkRights returned: method=${access.method}, canPlay=${access.canPlay}, rightsId=${access.rightsId || 'N/A'}`);

      if (!access.canPlay) {
        logerror(`No access to era ${eraId}`);
        throw new Error('No access to era');
      }

      // METHOD 1: Purchased - no consumption needed
      if (access.method === 'purchase') {
        log(`Using purchased access for ${eraId}`);
        return { method: 'purchase', remaining: -1 };
      }

      // METHOD 2: Consume voucher play
      if (access.method === 'voucher') {
        log(`Consuming voucher for ${eraId}, rightsId=${access.rightsId}, current uses=${access.usesRemaining}`);
        
        const { data: right, error: fetchError } = await supabase
          .from('user_rights')
          .select('*')
          .eq('id', access.rightsId)
          .single();

        if (fetchError) {
          logerror(`Failed to fetch voucher right:`, fetchError);
          throw fetchError;
        }

        log(`Fetched voucher right: id=${right.id}, uses_remaining=${right.uses_remaining}, voucher_used=${right.voucher_used}`);

        if (right.uses_remaining === -1) {
          // Unlimited - no decrement needed
          log(`Using unlimited voucher for ${eraId}`);
          return { method: 'voucher', remaining: -1 };
        }

        if (right.uses_remaining <= 0) {
          logerror(`Voucher already exhausted: uses_remaining=${right.uses_remaining}`);
          throw new Error('Voucher already exhausted');
        }

        const newUses = right.uses_remaining - 1;
        log(`Decrementing voucher: ${right.uses_remaining} -> ${newUses}`);

        // Use server-side RPC function to bypass RLS and prevent cheating
        const { data: updatedRight, error: rpcError } = await supabase.rpc('consume_rights', {
          p_rights_id: access.rightsId,
          p_uses_to_consume: 1
        });

        if (rpcError) {
          logerror(`Failed to consume voucher via RPC:`, rpcError);
          throw rpcError;
        }

        if (!updatedRight) {
          logerror(`RPC returned no data for rightsId=${access.rightsId}`);
          throw new Error('RPC function returned no data');
        }

        const actualUses = updatedRight.uses_remaining;
        log(`Voucher consumed via RPC: id=${updatedRight.id}, uses_remaining=${actualUses}`);
        
        if (actualUses !== newUses) {
          logerror(`RPC MISMATCH: Expected uses_remaining=${newUses}, but RPC returned ${actualUses}`);
        }

        log(`Successfully consumed voucher play for ${eraId}, ${actualUses} remaining`);
        return { method: 'voucher', remaining: actualUses };
      }

      // METHOD 3: Consume passes (FIFO - oldest first)
      if (access.method === 'passes') {
        const { data: passRights, error: fetchError } = await supabase
          .from('user_rights')
          .select('*')
          .eq('player_id', playerId)
          .eq('rights_type', 'pass')
          .gt('uses_remaining', 0)
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('created_at', { ascending: true }); // FIFO - oldest first

        if (fetchError) throw fetchError;

        let remaining = access.passesRequired;

        for (const right of passRights) {
          if (remaining <= 0) break;

          log(`Examining pass entry: id=${right.id}, uses=${right.uses_remaining}, created=${right.created_at}`);

          if (right.uses_remaining >= remaining) {
            log(`Consuming ${remaining} from entry ${right.id}`);
            // Use server-side RPC function to bypass RLS and prevent cheating
            const { data: updatedRight, error: rpcError } = await supabase.rpc('consume_rights', {
              p_rights_id: right.id,
              p_uses_to_consume: remaining
            });

            if (rpcError) {
              logerror('RPC FAILED for pass consumption:', rpcError);
              throw rpcError;
            }

            if (!updatedRight) {
              logerror(`RPC returned no data for pass entry ${right.id}`);
              throw new Error('RPC function returned no data');
            }

            log(`Successfully consumed ${remaining} passes from entry ${right.id}, new uses=${updatedRight.uses_remaining}`);
            remaining = 0;
          } else {
            // Exhaust this entry, continue to next
            log(`Exhausting entry ${right.id} (has ${right.uses_remaining}, need ${remaining})`);

            // Use server-side RPC function to bypass RLS and prevent cheating
            const { data: updatedRight, error: rpcError } = await supabase.rpc('consume_rights', {
              p_rights_id: right.id,
              p_uses_to_consume: right.uses_remaining
            });

            if (rpcError) {
              logerror('RPC FAILED for pass exhaustion:', rpcError);
              throw rpcError;
            }

            if (!updatedRight) {
              logerror(`RPC returned no data for pass entry ${right.id}`);
              throw new Error('RPC function returned no data');
            }

            log(`Successfully exhausted entry ${right.id}, new uses=${updatedRight.uses_remaining}`);
            remaining -= right.uses_remaining;
          }
        }

        if (remaining > 0) {
          throw new Error('Insufficient passes');
        }

        // Give database a moment to commit the update
        await new Promise(resolve => setTimeout(resolve, 100));

        const newBalance = await this.getPassBalance(playerId);
        log(`Consumed ${access.passesRequired} passes for ${eraId}, ${newBalance} remaining`);
        return { method: 'passes', remaining: newBalance };
      }

      // METHOD 4: Free era - nothing to consume
      log(`Free era ${eraId}, no consumption needed`);
      return { method: 'free' };

    } catch (error) {
      logerror('Failed to consume play:', error);
      throw error;
    }
  }

  /**
   * Credit passes to user
   * Creates a new user_rights entry with pass type
   *
   * @param {string} playerId - User ID
   * @param {number} amount - Number of passes to credit
   * @param {string} source - Source: "achievement", "referral", "bundle", "admin", "voucher"
   * @param {object} metadata - Optional metadata
   * @returns {Promise<object>} Created user_rights entry
   */
  async creditPasses(playerId, amount, source, metadata = {}) {
    method = 'creditPasses';
    
    log(`Called with amount=${amount}, source=${source}`);
    
    const validSources = ['achievement', 'referral', 'bundle', 'admin', 'voucher'];

    if (!validSources.includes(source)) {
      throw new Error(`Invalid pass source: ${source}`);
    }

    if (!playerId || Player.isGuest(playerId)) {
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
          player_id: playerId,
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

      log(`Credited ${amount} passes (${source}) to user ${playerId}`);

      return data;

    } catch (error) {
      logerror('Failed to credit passes:', error);
      throw error;
    }
  }

  /**
   * Get badge display info for era
   * Returns badge text, button text, style, and access status
   *
   * @param {string} playerId - User ID
   * @param {object} eraConfig - Era configuration
   * @returns {Promise<object>} Badge information
   */
  async getEraBadgeInfo(playerId, eraConfig) {
    method = 'getEraBadgeInfo';
    
    try {
      log(`playerId=${playerId}, eraConfig.id=${eraConfig.id}`);
      const access = await this.checkRights(playerId, eraConfig);
      log(`checkRights result: method=${access.method}, canPlay=${access.canPlay}`);

      // PURCHASED ACCESS
      if (access.method === 'purchase' && access.canPlay) {
        return {
          badge: 'OWNED',
          button: 'Play',
          style: 'badge-owned',
          canPlay: true,
          method: 'purchase'
        };
      }

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
          log(`returning badge with ${access.playsAvailable} plays`);
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
      logerror('Failed to get badge info:', error);
      return {
        badge: 'ERROR',
        button: 'Try Again',
        style: 'badge-error',
        canPlay: false,
        method: 'error'
      };
    }
  }

  /**
   * Get badges for multiple eras (batch operation)
   * More efficient than calling getEraBadgeInfo() in a loop
   *
   * @param {string} playerId - User ID
   * @param {Array} eraConfigs - Array of era configurations
   * @returns {Promise<Map>} Map of eraId -> badgeInfo
   */
  async getBadgesForUser(playerId, erasMap) {
    method = 'getBadgesForUser';
    
    if (!playerId || !erasMap || erasMap.size === 0) {
      console.warn(`[${tag}] ${version} ${module}.${method}: Invalid parameters`);
      return new Map();
    }

    try {
      log(`Fetching badges for ${erasMap.size} eras`);
      
      const badgeMap = new Map();
              
      // Fetch all badges in parallel
      await Promise.all(
        Array.from(erasMap.entries()).map(async ([eraId, fullEraConfig]) => {
          const badgeInfo = await this.getEraBadgeInfo(playerId, fullEraConfig);
          badgeMap.set(eraId, badgeInfo);
        })
      );
        
      log(`Loaded badges for ${badgeMap.size} eras`);
      return badgeMap;

    } catch (error) {
      logerror('Failed to fetch badges:', error);
      return new Map();
    }
  }
    
  // ============================================================================
  // EXISTING METHODS (Preserved for backward compatibility)
  // ============================================================================

  /**
   * Check if user has access to a specific era
   *
   * @deprecated Use canPlayEra() for more detailed access information
   * @param {string} playerId - User ID
   * @param {string} eraId - Era ID
   * @returns {Promise<boolean>} True if user has access
   */
  async hasEraAccess(playerId, eraId) {
    method = 'hasEraAccess';
    
    if (!playerId || !eraId) {
      logerror('Cannot check era access without playerId and eraId');
      return false;
    }

    try {
      log(`Checking era access for user ${playerId}, era ${eraId}`);
      
      const { data, error } = await supabase
        .from('user_rights')
        .select('*')
        .eq('player_id', playerId)
        .eq('rights_type', 'era')
        .eq('rights_value', eraId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        logerror('Error checking era access:', error);
        return false;
      }

      if (data) {
        // Check if the right has expired or no uses remaining
        const now = new Date();
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
        const usesRemaining = data.uses_remaining;

        if (expiresAt && now > expiresAt) {
          log(`Era access expired for ${eraId}`);
          return false;
        }

        if (usesRemaining !== null && usesRemaining !== -1 && usesRemaining <= 0) {
          log(`No uses remaining for ${eraId}`);
          return false;
        }

        log(`Era access confirmed for ${eraId}`);
        return true;
      }

      log(`No era access found for ${eraId}`);
      return false;

    } catch (error) {
      logerror('Failed to check era access:', error);
      return false;
    }
  }

  /**
   * Grant era access to user (typically called after successful payment)
   *
   * @param {string} playerId - User ID
   * @param {string} eraId - Era ID
   * @param {object} paymentData - Payment metadata
   * @returns {Promise<object|boolean>} Created user_rights entry or false
   */
  async grantEraAccess(playerId, eraId, paymentData = {}) {
    method = 'grantEraAccess';
    
    if (!playerId || !eraId) {
      logerror('Cannot grant era access without playerId and eraId');
      return false;
    }

    try {
      log(`Granting era access for user ${playerId}, era ${eraId}`);

      // UPDATED v0.2.2: Set 2-year expiry (not null)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 2);

      const { data, error } = await supabase
        .from('user_rights')
        .insert({
          player_id: playerId,
          rights_type: 'era',
          rights_value: eraId,
          uses_remaining: -1, // Unlimited uses
          expires_at: expiresAt.toISOString(), // 2 years from now
          stripe_payment_intent_id: paymentData.stripe_payment_intent_id || null,
          voucher_used: paymentData.voucher_used || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logerror('Error granting era access:', error);
        return false;
      }

      log(`Era access granted successfully for ${eraId}`);
      return data;

    } catch (error) {
      logerror('Failed to grant era access:', error);
      return false;
    }
  }


  /**
   * Get all user rights for a specific user
   *
   * @param {string} playerId - User ID
   * @returns {Promise<Array>} Array of user_rights entries
   */
  async getUserRights(playerId) {
    method = 'getUserRights';
    
    if (!playerId) {
      logerror('Cannot get user rights without playerId');
      return [];
    }

    // Skip database query for guest users
    if (!playerId || Player.isGuest(playerId)) {
      log('Guest user - returning empty rights');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('user_rights')
        .select('*')
        .eq('player_id', playerId);

      if (error) {
        logerror('Error fetching user rights:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      logerror('Failed to fetch user rights:', error);
      return [];
    }
  }
}

// Export singleton instance (not class)
const rightsServiceSingleton = new RightsService();
export default rightsServiceSingleton;

// EOF
