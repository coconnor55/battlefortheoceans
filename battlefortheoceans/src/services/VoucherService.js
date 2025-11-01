// src/services/VoucherService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial VoucherService - secure voucher parsing and redemption

import { supabase } from '../utils/supabaseClient';

const version = 'v0.1.0';

class VoucherService {
  constructor() {
    this.version = version;
    console.log(`[VoucherService ${version}] Initialized`);
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
   * @param {string} userId - User ID
   * @param {string} voucherCode - Voucher code to redeem
   * @returns {Promise<object>} Created user_rights entry
   * @throws {Error} If redemption fails
   */
  async redeemVoucher(userId, voucherCode) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!voucherCode) {
      throw new Error('Voucher code is required');
    }

    try {
      console.log(`[VoucherService ${version}] Redeeming voucher for user ${userId}`);

      // Optional: Client-side format validation for immediate feedback
      let parsed;
      try {
        parsed = this.parseVoucherCode(voucherCode);
        console.log(`[VoucherService ${version}] Parsed voucher:`, {
          type: parsed.voucherType,
          rightsValue: parsed.rightsValue,
          valueType: parsed.valueType,
          display: parsed.displayText
        });
      } catch (parseError) {
        console.warn(`[VoucherService ${version}] Client-side parse failed:`, parseError.message);
        // Continue anyway - server will do authoritative validation
      }

      // Call secure server-side RPC function
      const { data, error } = await supabase.rpc('redeem_voucher_v2', {
        p_user_id: userId,
        p_voucher_code: voucherCode.trim()
      });

      if (error) {
        console.error(`[VoucherService ${version}] Redemption error:`, error);

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

      console.log(`[VoucherService ${version}] Voucher redeemed successfully:`, data);

      return data;

    } catch (error) {
      console.error(`[VoucherService ${version}] Redemption failed:`, error);
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
  async generateVoucher(type, value, purpose = 'manual') {
    if (!type) {
      throw new Error('Voucher type is required');
    }

    if (!value) {
      throw new Error('Voucher value is required');
    }

    try {
      console.log(`[VoucherService ${version}] Generating voucher: ${type}-${value} (${purpose})`);

      // Call secure server-side RPC function
      const { data, error } = await supabase.rpc('generate_voucher', {
        p_type: type,
        p_value: value.toString(),
        p_purpose: purpose
      });

      if (error) {
        console.error(`[VoucherService ${version}] Generation error:`, error);

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

      console.log(`[VoucherService ${version}] Voucher generated: ${data}`);

      return data;

    } catch (error) {
      console.error(`[VoucherService ${version}] Generation failed:`, error);
      throw error;
    }
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
}

// Export singleton instance
const voucherServiceInstance = new VoucherService();
export default voucherServiceInstance;

// EOF
