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
   * Get all active rights for a user
   */
  async getUserRights(userId) {
    if (!userId) {
      console.error(version, 'Cannot get rights without user ID');
      return [];
    }

    try {
      console.log(version, 'Fetching user rights for:', userId);
      
      const { data: rights, error } = await supabase
        .from('user_rights')
        .select('*')
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gte.now()') // Only active rights
        .gt('uses_remaining', 0).or('uses_remaining.eq.-1'); // Has uses left or unlimited

      if (error) {
        console.error(version, 'Error fetching user rights:', error);
        return [];
      }

      console.log(version, 'Found user rights:', rights.length);
      return rights || [];

    } catch (error) {
      console.error(version, 'Failed to fetch user rights:', error);
      return [];
    }
  }

  /**
   * Check if user has access to specific era
   */
  async hasEraAccess(userId, eraName) {
    // Traditional Battleship is always free
    if (eraName === 'traditional' || eraName === 'Traditional Battleship') {
      return true;
    }

    const rights = await this.getUserRights(userId);
    return rights.some(right =>
      right.rights_type === 'era' &&
      right.rights_value.toLowerCase() === eraName.toLowerCase()
    );
  }

  /**
   * Get active boosts for user (future feature)
   */
  async getUserBoosts(userId) {
    const rights = await this.getUserRights(userId);
    
    const boosts = {
      attack: 1.0, // Default multiplier
      defense: 1.0
    };

    rights.forEach(right => {
      if (right.rights_type === 'attack') {
        boosts.attack = Math.max(boosts.attack, parseFloat(right.rights_value));
      } else if (right.rights_type === 'defense') {
        boosts.defense = Math.max(boosts.defense, parseFloat(right.rights_value));
      }
    });

    return boosts;
  }

  /**
   * Validate voucher code and parse its contents
   */
  parseVoucherCode(voucherCode) {
    if (!voucherCode || typeof voucherCode !== 'string') {
      return { valid: false, error: 'Invalid voucher code format' };
    }

    const parts = voucherCode.split('-');
    if (parts.length !== 2) {
      return { valid: false, error: 'Voucher code must be in format: type-uuid or type.value-uuid' };
    }

    const [typeValue, uuid] = parts;
    if (!uuid || uuid.length < 8) {
      return { valid: false, error: 'Invalid voucher code format' };
    }

    // Parse type and value
    if (typeValue.includes('.')) {
      // Format: attack.25-uuid
      const [type, value] = typeValue.split('.');
      return {
        valid: true,
        type: type,
        value: value,
        uuid: uuid,
        code: voucherCode
      };
    } else {
      // Format: midway-uuid
      return {
        valid: true,
        type: 'era',
        value: typeValue,
        uuid: uuid,
        code: voucherCode
      };
    }
  }

  /**
   * Check if voucher exists in database
   */
  async validateVoucher(voucherCode) {
    const parsed = this.parseVoucherCode(voucherCode);
    if (!parsed.valid) {
      return parsed;
    }

    try {
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .select('voucher_code')
        .eq('voucher_code', voucherCode)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(version, 'Error validating voucher:', error);
        return { valid: false, error: 'Failed to validate voucher code' };
      }

      if (!voucher) {
        return { valid: false, error: 'Voucher code not found or already used' };
      }

      return {
        valid: true,
        ...parsed,
        exists: true
      };

    } catch (error) {
      console.error(version, 'Failed to validate voucher:', error);
      return { valid: false, error: 'Failed to validate voucher code' };
    }
  }

  /**
   * Redeem voucher and create user right
   */
  async redeemVoucher(userId, voucherCode) {
    const validation = await this.validateVoucher(voucherCode);
    if (!validation.valid || !validation.exists) {
      return { success: false, error: validation.error };
    }

    try {
      // Start transaction
      const { data, error } = await supabase.rpc('redeem_voucher', {
        p_user_id: userId,
        p_voucher_code: voucherCode,
        p_rights_type: validation.type === 'era' ? 'era' : validation.type,
        p_rights_value: validation.type === 'era' ? validation.value : validation.value
      });

      if (error) {
        console.error(version, 'Error redeeming voucher:', error);
        return { success: false, error: 'Failed to redeem voucher code' };
      }

      console.log(version, 'Voucher redeemed successfully:', voucherCode);
      return {
        success: true,
        rightsType: validation.type === 'era' ? 'era' : validation.type,
        rightsValue: validation.type === 'era' ? validation.value : validation.value
      };

    } catch (error) {
      console.error(version, 'Failed to redeem voucher:', error);
      return { success: false, error: 'Failed to redeem voucher code' };
    }
  }

  /**
   * Create user right from Stripe purchase
   */
  async grantPurchasedRight(userId, rightsType, rightsValue, stripePaymentIntentId, usesRemaining = -1, expiresAt = null) {
    try {
      const { data: right, error } = await supabase
        .from('user_rights')
        .insert([{
          user_id: userId,
          rights_type: rightsType,
          rights_value: rightsValue,
          uses_remaining: usesRemaining,
          expires_at: expiresAt,
          stripe_payment_intent_id: stripePaymentIntentId
        }])
        .select()
        .single();

      if (error) {
        console.error(version, 'Error granting purchased right:', error);
        return { success: false, error: 'Failed to grant purchased right' };
      }

      console.log(version, 'Right granted successfully:', rightsType, rightsValue);
      return { success: true, right };

    } catch (error) {
      console.error(version, 'Failed to grant purchased right:', error);
      return { success: false, error: 'Failed to grant purchased right' };
    }
  }

  /**
   * Consume a use-based right (for future boost implementation)
   */
  async consumeRight(userId, rightsType, rightsValue) {
    try {
      const { data, error } = await supabase
        .from('user_rights')
        .select('id, uses_remaining')
        .eq('user_id', userId)
        .eq('rights_type', rightsType)
        .eq('rights_value', rightsValue)
        .gt('uses_remaining', 0)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error || !data) {
        return { success: false, error: 'No available uses for this right' };
      }

      const newUsesRemaining = data.uses_remaining - 1;
      
      const { error: updateError } = await supabase
        .from('user_rights')
        .update({ uses_remaining: newUsesRemaining, updated_at: new Date().toISOString() })
        .eq('id', data.id);

      if (updateError) {
        console.error(version, 'Error consuming right:', updateError);
        return { success: false, error: 'Failed to consume right' };
      }

      return { success: true, remainingUses: newUsesRemaining };

    } catch (error) {
      console.error(version, 'Failed to consume right:', error);
      return { success: false, error: 'Failed to consume right' };
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
