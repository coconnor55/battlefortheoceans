// src/services/VoucherService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.5: Reward NEW USER with signup bonus on account creation
//          - processReferralReward: Generate and redeem signup bonus for new user
//          - Uses signup_bonus from email voucher (was signup_bonus_passes)
//          - New user gets passes immediately on profile creation
//          - Consistent terminology: signup_bonus throughout
// v0.1.4: Pass tracking parameters to generate_voucher RPC
//         - Add createdBy, emailSentTo, rewardPasses, signupBonusPasses to generateVoucher()
//         - Pass all parameters to RPC function
//         - Remove client-side UPDATE (RPC handles it now)// v0.1.3: Accept reward parameters in findOrCreateVoucher
//         - Add rewardPasses and signupBonusPasses parameters (default 1, 10)
//         - Use parameters instead of hardcoding values
//         - Allows game-config to control referral rewards// v0.1.1: Add findOrCreateVoucher for email invite abuse prevention
//         - Reuses existing vouchers to same email if not redeemed
//         - Returns status: 'reused', 'already_redeemed', or 'created'
//         - Updates voucher with created_by and email_sent_to tracking// v0.1.0: Initial VoucherService - secure voucher parsing and redemption

import { supabase } from '../utils/supabaseClient';

const version = 'v0.1.5';

class VoucherService {
    constructor() {
        this.version = version;
        console.log(`[VOUCHER] VoucherService ${version}| Initialized`);
    }
    
    /**
     * Parse voucher code (client-side validation)
     * Format: {type}-{value}-{uuid}
     *
     * This provides immediate feedback without hitting the database.
     * Actual redemption happens server-side via RPC.
     *
     * @param {string} code - Voucher code to parse
     * @returns {object} Parsed voucher data
     * @throws {Error} If format is invalid
     */
    parseVoucherCode(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('Voucher code is required');
        }
        
        const trimmedCode = code.trim();
        const parts = trimmedCode.split('-');
        
        if (parts.length < 3) {
            throw new Error('Invalid voucher format: must be {type}-{value}-{uuid}');
        }
        
        const type = parts[0];
        const value = parts[1];
        const uuid = parts.slice(2).join('-'); // Handle UUIDs with dashes
        
        // Parse value portion
        const valueData = this.parseValue(value);
        
        // Determine rights type and value
        if (type === 'pass') {
            return {
                voucherType: 'pass',
                rightsType: 'pass',
                rightsValue: 'voucher',
                ...valueData,
                uuid,
                fullCode: trimmedCode
            };
        }
        
        // Otherwise it's an era name (pirates, midway, super-battleship, etc.)
        return {
            voucherType: 'era',
            rightsType: 'era',
            rightsValue: type,
            ...valueData,
            uuid,
            fullCode: trimmedCode
        };
    }
    
    /**
     * Parse value portion of voucher code
     *
     * @param {string} value - Value string (e.g., "10", "days7", "month1")
     * @returns {object} Parsed value data
     * @throws {Error} If format is invalid
     */
    parseValue(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Value is required');
        }
        
        // Purely numeric = count-based
        if (/^\d+$/.test(value)) {
            return {
                valueType: 'count',
                usesRemaining: parseInt(value, 10),
                expiresAt: null, // Will be set to +2 years on redemption
                durationMs: null,
                displayText: `${value} plays`
            };
        }
        
        // Starts with letter = time-based (e.g., days7, weeks2, month1)
        const match = value.match(/^([a-z]+)(\d+)$/i);
        
        if (!match) {
            throw new Error(`Invalid value "${value}". Use format: 10 or days7`);
        }
        
        const unit = match[1].toLowerCase();
        const amount = parseInt(match[2], 10);
        
        let durationMs;
        let displayText;
        
        switch (unit) {
            case 'day':
            case 'days':
                durationMs = amount * 24 * 60 * 60 * 1000;
                displayText = `${amount} day${amount > 1 ? 's' : ''}`;
                break;
            case 'week':
            case 'weeks':
                durationMs = amount * 7 * 24 * 60 * 60 * 1000;
                displayText = `${amount} week${amount > 1 ? 's' : ''}`;
                break;
            case 'month':
            case 'months':
                durationMs = amount * 30 * 24 * 60 * 60 * 1000;
                displayText = `${amount} month${amount > 1 ? 's' : ''}`;
                break;
            default:
                throw new Error(`Unknown time unit: ${unit}`);
        }
        
        return {
            valueType: 'time',
            usesRemaining: -1, // Unlimited during period
            expiresAt: null, // Will be calculated on redemption
            durationMs,
            displayText: `${displayText} unlimited`
        };
    }
    
    /**
     * Validate voucher code format (quick check)
     *
     * @param {string} code - Voucher code to validate
     * @returns {boolean} True if format is valid
     */
    validateFormat(code) {
        try {
            this.parseVoucherCode(code);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Redeem voucher for user (server-side via RPC)
     *
     * This is the secure redemption path. All validation and database
     * operations happen server-side.
     *
     * @param {string} playerId - User ID
     * @param {string} voucherCode - Voucher code to redeem
     * @returns {Promise<object>} Created user_rights entry
     * @throws {Error} If redemption fails
     */
    async redeemVoucher(playerId, voucherCode) {
        if (!playerId) {
            throw new Error('User ID is required');
        }
        
        if (!voucherCode) {
            throw new Error('Voucher code is required');
        }
        
        try {
            console.log(`[VOUCHER] VoucherService ${version}| Redeeming voucher for user ${playerId}`);
            
            // Optional: Client-side format validation for immediate feedback
            let parsed;
            try {
                parsed = this.parseVoucherCode(voucherCode);
                console.log(`[VOUCHER] VoucherService ${version}| Parsed voucher:`, {
                    type: parsed.voucherType,
                    rightsValue: parsed.rightsValue,
                    valueType: parsed.valueType,
                    display: parsed.displayText
                });
            } catch (parseError) {
                console.warn(`[VOUCHER] VoucherService ${version}| Client-side parse failed:`, parseError.message);
                // Continue anyway - server will do authoritative validation
            }
            
            // Call secure server-side RPC function
            const { data, error } = await supabase.rpc('redeem_voucher_v2', {
                p_user_id: playerId,
                p_voucher_code: voucherCode.trim()
            });
            
            if (error) {
                console.error(`[VOUCHER] VoucherService ${version}| Redemption error:`, error);
                
                // Parse error message for user-friendly display
                const errorMessage = error.message || 'Failed to redeem voucher';
                
                if (errorMessage.includes('Invalid voucher code')) {
                    throw new Error('Invalid voucher code');
                } else if (errorMessage.includes('already redeemed')) {
                    throw new Error('This voucher code has already been used');
                } else if (errorMessage.includes('expired')) {
                    throw new Error('This voucher code has expired');
                } else if (errorMessage.includes('User ID is required')) {
                    throw new Error('You must be logged in to redeem vouchers');
                } else {
                    throw new Error('Failed to redeem voucher. Please try again.');
                }
            }
            
            console.log(`[VOUCHER] VoucherService ${version}| Voucher redeemed successfully:`, data);
            
            return data;
            
        } catch (error) {
            console.error(`[VOUCHER] VoucherService ${version}| Redemption failed:`, error);
            throw error; // Re-throw to maintain error message
        }
    }
    
    /**
     * Generate voucher code (server-side via RPC)
     *
     * Note: This requires appropriate permissions. Typically restricted to
     * admin/service accounts.
     *
     * @param {string} type - 'pass' or era name (e.g., 'pirates', 'midway')
     * @param {string|number} value - Count (e.g., 10) or time (e.g., 'days7')
     * @param {string} purpose - Purpose for logging (e.g., 'referral_reward', 'achievement')
     * @returns {Promise<string>} Generated voucher code
     * @throws {Error} If generation fails
     */
    async generateVoucher(type, value, purpose = 'manual', createdBy = null, emailSentTo = null, rewardPasses = 1, signupBonusPasses = 10) {
        
        if (!type) {
            throw new Error('Voucher type is required');
        }
        
        if (!value) {
            throw new Error('Voucher value is required');
        }
        
        try {
            console.log(`[VOUCHER] VoucherService ${version}| Generating voucher: ${type}-${value} (${purpose})`);
            
            // Call secure server-side RPC function with all tracking parameters
            const { data, error } = await supabase.rpc('generate_voucher', {
                p_type: type,
                p_value: value.toString(),
                p_purpose: purpose,
                p_created_by: createdBy,
                p_email_sent_to: emailSentTo,
                p_reward_passes: rewardPasses,
                p_signup_bonus_passes: signupBonusPasses
            });
            
            if (error) {
                console.error(`[VOUCHER] VoucherService ${version}| Generation error:`, error);
                
                // Parse error for user-friendly message
                const errorMessage = error.message || 'Failed to generate voucher';
                
                if (errorMessage.includes('permission denied')) {
                    throw new Error('You do not have permission to generate vouchers');
                } else if (errorMessage.includes('invalid voucher code')) {
                    throw new Error(`Invalid voucher parameters: ${type}-${value}`);
                } else {
                    throw new Error('Failed to generate voucher. Please try again.');
                }
            }
            
            console.log(`[VOUCHER] VoucherService ${version}| Voucher generated: ${data}`);
            
            return data;
            
        } catch (error) {
            console.error(`[VOUCHER] VoucherService ${version}| Generation failed:`, error);
            throw error;
        }
    }
    
    /**
     * Find existing voucher to email or create new one
     * Prevents abuse by reusing vouchers sent to same email
     *
     * @param {string} type - 'pass' or era name
     * @param {string|number} value - Count or time value
     * @param {string} createdBy - User ID creating voucher
     * @param {string} emailSentTo - Email address receiving voucher
     * @param {string} purpose - Purpose for logging
     * @returns {Promise<object>} { voucherCode, isExisting, status }
     */
    async findOrCreateVoucher(type, value, createdBy, emailSentTo, purpose = 'email_friend', rewardPasses = 1, signupBonusPasses = 10) {
      
      // One call - get any voucher to this email (redeemed or not)
      const { data: existing, error: searchError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('created_by', createdBy)
        .eq('email_sent_to', emailSentTo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!searchError && existing) {
        if (!existing.redeemed_at) {
          // Unredeemed - reuse it
          console.log(`[VOUCHER] VoucherService ${version}| Reusing existing voucher to ${emailSentTo}: ${existing.voucher_code}`);
          return {
            voucherCode: existing.voucher_code,
            isExisting: true,
            status: 'reused'
          };
        } else {
          // Already redeemed
          console.log(`[VOUCHER] VoucherService ${version}| Voucher already redeemed by ${emailSentTo}`);
          return {
            voucherCode: existing.voucher_code,
            isExisting: true,
            status: 'already_redeemed'
          };
        }
      }
      
      // No existing voucher - create new one
      const voucherCode = await this.generateVoucher(type, value, purpose, createdBy, emailSentTo, rewardPasses, signupBonusPasses);
      
      console.log(`[VOUCHER] VoucherService ${version}| Created new voucher for ${emailSentTo}: ${voucherCode}`);
      
      return {
        voucherCode,
        isExisting: false,
        status: 'created'
      };
    }

    /**
     * Get display information for a voucher code
     *
     * Useful for showing preview before redemption.
     *
     * @param {string} voucherCode - Voucher code to analyze
     * @returns {object} Display information
     */
    getDisplayInfo(voucherCode) {
        try {
            const parsed = this.parseVoucherCode(voucherCode);
            
            let title, description, icon;
            
            if (parsed.voucherType === 'pass') {
                title = 'Generic Passes';
                description = `Redeem for ${parsed.displayText}`;
                icon = '💎';
            } else {
                // Era voucher
                const eraName = parsed.rightsValue.charAt(0).toUpperCase() +
                parsed.rightsValue.slice(1).replace(/-/g, ' ');
                title = `${eraName} Access`;
                description = `Redeem for ${parsed.displayText}`;
                icon = parsed.valueType === 'time' ? '⏰' : '🎫';
            }
            
            return {
                title,
                description,
                icon,
                voucherType: parsed.voucherType,
                rightsValue: parsed.rightsValue,
                valueType: parsed.valueType,
                displayText: parsed.displayText
            };
            
        } catch (error) {
            return {
                title: 'Invalid Voucher',
                description: error.message,
                icon: '❌',
                voucherType: null,
                rightsValue: null,
                valueType: null,
                displayText: null
            };
        }
    }
    
    /**
     * Process referral reward when new user signs up
     * Rewards BOTH the referrer AND the new user
     *
     * @param {string} newUserEmail - Email of new user signing up
     * @param {string} newUserId - User ID of new user
     * @returns {Promise<object>} Result with reward details
     */
    async processReferralReward(newUserEmail, newUserId) {
        try {
            console.log(`[VOUCHER] VoucherService ${version}| Checking referral reward for:`, newUserEmail);
            
            // ✅ ONE CALL - Get unredeemed voucher sent to this email
            const { data: referralVoucher, error: searchError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('email_sent_to', newUserEmail)
            .not('created_by', 'is', null)
            .is('redeemed_at', null)  // ✅ Only unredeemed vouchers
            .single();
            
            // Handle errors
            if (searchError) {
                if (searchError.code === 'PGRST116') {
                    // Not found - no unredeemed referral voucher
                    console.log(`[VOUCHER] VoucherService ${version}| No unredeemed referral voucher found`);
                    return { rewarded: false, reason: 'no_referral' };
                }
                console.error(`[VOUCHER] VoucherService ${version}| Search error:`, searchError);
                return { rewarded: false, error: searchError.message };
            }
            
            // ✅ Null check (defensive, shouldn't happen with .single())
            if (!referralVoucher) {
                console.log(`[VOUCHER] VoucherService ${version}| Voucher is null`);
                return { rewarded: false, reason: 'no_referral' };
            }
            
            // Now we have a valid unredeemed voucher
            const referrerId = referralVoucher.created_by;
            const signupBonusPasses = referralVoucher.signup_bonus_passes || 10;
            
            console.log(`[VOUCHER] VoucherService ${version}| Found referral! Referrer:`, referrerId, 'Signup bonus:', signupBonusPasses);
            
            // 1. Reward REFERRER with referral_signup passes
            const referrerRewardCode = await this.generateVoucher(
              'pass',
              signupBonusPasses,
              'referral_signup_reward',
              referrerId,
              null,
              signupBonusPasses,
              0
              );
            
            console.log(`[VOUCHER] VoucherService ${version}| Generated referrer reward:`, referrerRewardCode);
            await this.redeemVoucher(referrerId, referrerRewardCode);
            console.log(`[VOUCHER] VoucherService ${version}| Referrer rewarded with ${signupBonusPasses} passes!`);
            
            // 2. Reward NEW USER with signup bonus
            console.log(`[VOUCHER] VoucherService ${version}| Generating signup bonus for new user:`, newUserId);
            
            const newUserRewardCode = await this.generateVoucher(
                 'pass',
                 signupBonusPasses,
                 'signup_bonus_reward',
                 null,
                 newUserEmail,
                 0,
                 signupBonusPasses
                 );
            
            console.log(`[VOUCHER] VoucherService ${version}| Generated signup bonus:`, newUserRewardCode);
            await this.redeemVoucher(newUserId, newUserRewardCode);
            console.log(`[VOUCHER] VoucherService ${version}| New user rewarded with ${signupBonusPasses} passes!`);
            
            // 3. Mark original voucher as processed
            await supabase
            .from('vouchers')
            .update({
                redeemed_at: new Date().toISOString(),
                redeemed_by: newUserId
            })
            .eq('voucher_code', referralVoucher.voucher_code);
            
            console.log(`[VOUCHER] VoucherService ${version}| Original voucher marked as processed`);
            
            return {
                rewarded: true,
                referrerId,
                referrerPasses: signupBonusPasses,
                newUserId,
                newUserPasses: signupBonusPasses,
                referrerRewardCode,
                newUserRewardCode
            };
            
        } catch (error) {
            console.error(`[VOUCHER] VoucherService ${version}| processReferralReward error:`, error);
            return { rewarded: false, error: error.message };
        }
    }
}

// Export singleton instance
const voucherServiceSingleton = new VoucherService();
export default voucherServiceSingleton;

// EOF
