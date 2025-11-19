// src/services/VoucherService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.1: Fix signup bonus voucher type - use original invite voucher type instead of hardcoded 'pass'
//         - Parse original referral voucher to determine its type (pass or era like pirates)
//         - Use that type for signup bonus vouchers so exclusive eras get era vouchers, not pass vouchers
//         - If invite was for Pirates, signup bonus is now pirates-10 instead of pass-10
// v0.2.0: Rename referral_passes to referral_email, signup_bonus_passes to referral_signup
//         - Updated all code references to use referral_email and referral_signup from config
//         - Database field signup_bonus_passes kept for compatibility (stores referral_signup value)
//         - Function parameters renamed: signupBonusPasses -> referralSignup
//         - Clearer naming: referral_email = what each side gets when email sent/received
//         - referral_signup = what each side gets when invitee signs up
// v0.1.9: Return voucher type from redeemVoucher for selective NavBar updates
//         - Return voucherType ('pass' or 'era') in redemption result
//         - Allows callers to only notify subscribers for pass vouchers
//         - Prevents NavBar from refreshing pass balance for era vouchers
// v0.1.8: Fix missing original voucher redemption
//         - Now redeems the original referral voucher (1 pass) when new user signs up
//         - New user gets: 1 pass from original voucher + 10 passes from signup bonus = 11 total
//         - Previously only marked original voucher as processed without redeeming it
// v0.1.7: Fix referral reward vouchers - set created_by to null for system rewards
//         - System-generated reward vouchers should not have created_by set to recipient
//         - Prevents security check from blocking auto-redeemed reward vouchers
//         - Both referrer and new user reward vouchers now use created_by = null
// v0.1.6: Add email and creator validation to prevent voucher theft
//         - Check voucher email_sent_to matches redeeming user's email (if email provided)
//         - Check voucher created_by is NOT the redeeming user (prevents self-redemption)
//         - Prevents users from redeeming vouchers sent to other people
//         - Prevents voucher creators from redeeming their own vouchers
//         - Only validates if playerEmail is provided (optional parameter)
//         - General vouchers (email_sent_to is null) can be redeemed by anyone (except creator)
// v0.1.5: Reward NEW USER with referral_signup bonus on account creation
//          - processReferralReward: Generate and redeem referral_signup bonus for new user
//          - Uses referral_signup from config (stored in signup_bonus_passes database field)
//          - New user gets passes/vouchers immediately on profile creation
// v0.1.4: Pass tracking parameters to generate_voucher RPC
//         - Add createdBy, emailSentTo, rewardPasses, referralSignup to generateVoucher()
//         - Pass all parameters to RPC function (database field name signup_bonus_passes kept for compatibility)
//         - Remove client-side UPDATE (RPC handles it now)// v0.1.3: Accept reward parameters in findOrCreateVoucher
//         - Add rewardPasses and referralSignup parameters (default 1, 10)
//         - Use parameters instead of hardcoding values
//         - Allows game-config to control referral rewards// v0.1.1: Add findOrCreateVoucher for email invite abuse prevention
//         - Reuses existing vouchers to same email if not redeemed
//         - Returns status: 'reused', 'already_redeemed', or 'created'
//         - Updates voucher with created_by and email_sent_to tracking// v0.1.0: Initial VoucherService - secure voucher parsing and redemption

import { supabase } from '../utils/supabaseClient';

const version = 'v0.2.1';

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
     * @param {string} playerId - Player ID
     * @param {string} voucherCode - Voucher code to redeem
     * @param {string} playerEmail - Player email (optional, for validation)
     * @returns {Promise<object>} Created user_rights entry
     * @throws {Error} If redemption fails
     */
    async redeemVoucher(playerId, voucherCode, playerEmail = null) {
        if (!playerId) {
            throw new Error('Player ID is required');
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
            
            // Security check: Validate voucher email_sent_to and created_by if playerEmail provided
            if (playerEmail) {
                const { data: voucherData, error: voucherError } = await supabase
                    .from('vouchers')
                    .select('email_sent_to, created_by, redeemed_at')
                    .eq('voucher_code', voucherCode.trim())
                    .single();
                
                if (!voucherError && voucherData) {
                    // Check if creator is trying to redeem their own voucher
                    if (voucherData.created_by && voucherData.created_by === playerId) {
                        console.error(`[VOUCHER] VoucherService ${version}| Voucher creator attempting to redeem own voucher: ${playerId}`);
                        throw new Error('You cannot redeem a voucher that you created');
                    }
                    
                    // If voucher has email_sent_to, it must match the redeeming user's email
                    if (voucherData.email_sent_to && voucherData.email_sent_to.toLowerCase() !== playerEmail.toLowerCase()) {
                        console.error(`[VOUCHER] VoucherService ${version}| Voucher email mismatch: voucher sent to ${voucherData.email_sent_to}, user email is ${playerEmail}`);
                        throw new Error('This voucher was sent to a different email address and cannot be redeemed by you.');
                    }
                    
                    // Check if already redeemed
                    if (voucherData.redeemed_at) {
                        throw new Error('This voucher code has already been used');
                    }
                }
            } else {
                // Even without email, check if creator is trying to redeem their own voucher
                const { data: voucherData, error: voucherError } = await supabase
                    .from('vouchers')
                    .select('created_by')
                    .eq('voucher_code', voucherCode.trim())
                    .single();
                
                if (!voucherError && voucherData && voucherData.created_by && voucherData.created_by === playerId) {
                    console.error(`[VOUCHER] VoucherService ${version}| Voucher creator attempting to redeem own voucher: ${playerId}`);
                    throw new Error('You cannot redeem a voucher that you created');
                }
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
                } else if (errorMessage.includes('Player ID is required')) {
                    throw new Error('You must be logged in to redeem vouchers');
                } else {
                    throw new Error('Failed to redeem voucher. Please try again.');
                }
            }
            
            console.log(`[VOUCHER] VoucherService ${version}| Voucher redeemed successfully:`, data);
            
            // Return data with voucher type for caller to determine if pass balance should update
            return {
                ...data,
                voucherType: parsed?.voucherType || null  // 'pass' or 'era'
            };
            
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
    async generateVoucher(type, value, purpose = 'manual', createdBy = null, emailSentTo = null, rewardPasses = 1, referralSignup = 10) {
        
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
                p_signup_bonus_passes: referralSignup  // Database field name kept for compatibility
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
     * @param {string} createdBy - Player ID creating voucher
     * @param {string} emailSentTo - Email address receiving voucher
     * @param {string} purpose - Purpose for logging
     * @returns {Promise<object>} { voucherCode, isExisting, status }
     */
    async findOrCreateVoucher(type, value, createdBy, emailSentTo, purpose = 'email_friend', rewardPasses = 1, referralSignup = 10) {
      
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
      const voucherCode = await this.generateVoucher(type, value, purpose, createdBy, emailSentTo, rewardPasses, referralSignup);
      
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
     * @param {string} newUserId - Player ID of new user
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
            // Database field name is signup_bonus_passes (kept for compatibility)
            const referralSignupValue = referralVoucher.signup_bonus_passes || 10;
            
            // Parse the original voucher to determine its type (pass or era like pirates)
            let rewardVoucherType = 'pass';  // Default to pass
            try {
                const parsed = this.parseVoucherCode(referralVoucher.voucher_code);
                rewardVoucherType = parsed.voucherType;  // 'pass' or era name (e.g., 'pirates')
                console.log(`[VOUCHER] VoucherService ${version}| Original voucher type: ${rewardVoucherType}, using for signup bonus`);
            } catch (parseError) {
                console.warn(`[VOUCHER] VoucherService ${version}| Could not parse original voucher, defaulting to 'pass':`, parseError.message);
            }
            
            console.log(`[VOUCHER] VoucherService ${version}| Found referral! Referrer:`, referrerId, 'Signup bonus:', referralSignupValue, 'Type:', rewardVoucherType);
            
            // 1. Reward REFERRER with referral_signup passes/vouchers (same type as original invite)
            // Set created_by to null for system-generated reward vouchers to avoid security check
            const referrerRewardCode = await this.generateVoucher(
              rewardVoucherType,  // Use same type as original invite (pass or era)
              referralSignupValue,
              'referral_signup_reward',
              null,  // created_by = null for system rewards (not user-created)
              null,
              referralSignupValue,
              0
              );
            
            console.log(`[VOUCHER] VoucherService ${version}| Generated referrer reward:`, referrerRewardCode);
            // Referrer reward has email_sent_to as null (general voucher), so no email validation needed
            await this.redeemVoucher(referrerId, referrerRewardCode, null);
            console.log(`[VOUCHER] VoucherService ${version}| Referrer rewarded with ${referralSignupValue} ${rewardVoucherType} vouchers!`);
            
            // 2. Reward NEW USER with referral_signup bonus (same type as original invite)
            console.log(`[VOUCHER] VoucherService ${version}| Generating referral_signup bonus for new user:`, newUserId);
            
            // Set created_by to null for system-generated reward vouchers to avoid security check
            const newUserRewardCode = await this.generateVoucher(
                 rewardVoucherType,  // Use same type as original invite (pass or era)
                 referralSignupValue,
                 'referral_signup_reward',
                 null,  // created_by = null for system rewards (not user-created)
                 newUserEmail,
                 0,
                 referralSignupValue
                 );
            
            console.log(`[VOUCHER] VoucherService ${version}| Generated referral_signup bonus:`, newUserRewardCode);
            // New user referral_signup bonus has email_sent_to set to newUserEmail, validate it matches
            await this.redeemVoucher(newUserId, newUserRewardCode, newUserEmail);
            console.log(`[VOUCHER] VoucherService ${version}| New user rewarded with ${referralSignupValue} ${rewardVoucherType} vouchers!`);
            
            // 3. Redeem the original referral voucher (the 1 pass sent in the email)
            // This gives the new user the pass from the original invite voucher
            console.log(`[VOUCHER] VoucherService ${version}| Redeeming original referral voucher:`, referralVoucher.voucher_code);
            try {
                await this.redeemVoucher(newUserId, referralVoucher.voucher_code, newUserEmail);
                console.log(`[VOUCHER] VoucherService ${version}| Original referral voucher redeemed successfully`);
            } catch (error) {
                // If redemption fails (e.g., already redeemed), just mark as processed
                console.warn(`[VOUCHER] VoucherService ${version}| Could not redeem original voucher, marking as processed:`, error.message);
                await supabase
                .from('vouchers')
                .update({
                    redeemed_at: new Date().toISOString(),
                    redeemed_by: newUserId
                })
                .eq('voucher_code', referralVoucher.voucher_code);
            }
            
            console.log(`[VOUCHER] VoucherService ${version}| Original voucher processed`);
            
            return {
                rewarded: true,
                referrerId,
                referrerPasses: referralSignupValue,
                newUserId,
                newUserPasses: referralSignupValue,
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
