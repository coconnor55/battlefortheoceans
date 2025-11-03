// netlify/functions/send-invite.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Support string template IDs (Brevo's new format)
//         - Handles both numeric IDs (1, 2, 3) and string IDs
//         - Auto-detects format and uses appropriate type
// v0.1.0: Initial send-invite function - handles game invitation emails via Brevo
//         - Generates voucher codes
//         - Auto-redeems reward voucher for sender
//         - Sends email with guest voucher
//         - Returns voucher details to frontend

const { createClient } = require('@supabase/supabase-js');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const version = 'v0.1.1';

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Brevo client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Generate voucher code: {type}-{value}-{uuid}
 */
function generateVoucherCode(type, value) {
  const uuid = crypto.randomUUID();
  return `${type}-${value}-${uuid}`;
}

/**
 * Store voucher in database
 */
async function createVoucher(voucherCode) {
  const { error } = await supabase
    .from('vouchers')
    .insert({
      voucher_code: voucherCode,
      created_at: new Date().toISOString()
    });
  
  if (error) {
    throw new Error(`Failed to create voucher: ${error.message}`);
  }
  
  return voucherCode;
}

/**
 * Auto-redeem voucher for user
 */
async function redeemVoucherForUser(userId, voucherCode, type, value) {
  // Calculate expiration (2 years from now for count-based)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);
  
  const { error } = await supabase
    .from('user_rights')
    .insert({
      user_id: userId,
      rights_type: type === 'pass' ? 'pass' : 'era',
      rights_value: type === 'pass' ? 'voucher' : type,
      uses_remaining: parseInt(value, 10),
      expires_at: expiresAt.toISOString(),
      voucher_used: voucherCode
    });
  
  if (error) {
    throw new Error(`Failed to redeem voucher: ${error.message}`);
  }
}

/**
 * Get user profile by ID
 */
async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('game_name')
    .eq('id', userId)
    .single();
  
  if (error) {
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
  
  return data;
}

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log(`[SEND-INVITE ${version}] Request received`);
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const body = JSON.parse(event.body);
    const { friendEmail, senderUserId, eraId } = body;
    
    // Validate input
    if (!friendEmail || !senderUserId || !eraId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: friendEmail, senderUserId, eraId'
        })
      };
    }
    
    if (!friendEmail.includes('@')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }
    
    console.log(`[SEND-INVITE ${version}] Processing invite from ${senderUserId} to ${friendEmail} for era ${eraId}`);
    
    // Get sender's profile
    const senderProfile = await getUserProfile(senderUserId);
    const senderName = senderProfile.game_name;
    
    // Generate vouchers
    // 1. Guest voucher (1 play for friend)
    const guestVoucherCode = generateVoucherCode(eraId, '1');
    await createVoucher(guestVoucherCode);
    
    // 2. Reward voucher (1 play for sender - auto-redeemed)
    const rewardVoucherCode = generateVoucherCode(eraId, '1');
    await createVoucher(rewardVoucherCode);
    await redeemVoucherForUser(senderUserId, rewardVoucherCode, eraId, '1');
    
    console.log(`[SEND-INVITE ${version}] Vouchers created: guest=${guestVoucherCode}, reward=${rewardVoucherCode}`);
    
    // Build voucher link
    const voucherLink = `https://battlefortheoceans.com/redeem/${guestVoucherCode}`;
    
    // Get era name (capitalize first letter)
    const eraName = eraId.charAt(0).toUpperCase() + eraId.slice(1).replace(/-/g, ' ');
    
    // Send email via Brevo
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: friendEmail }];
    
    // Template ID can be numeric or string identifier
    const templateId = process.env.BREVO_INVITE_TEMPLATE_ID;
    // If it's a number, parse it; otherwise use as-is
    sendSmtpEmail.templateId = isNaN(templateId) ? templateId : parseInt(templateId, 10);
    
    sendSmtpEmail.params = {
      SENDER_NAME: senderName,
      ERA_NAME: eraName,
      VOUCHER_CODE: guestVoucherCode,
      VOUCHER_LINK: voucherLink
    };
    
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log(`[SEND-INVITE ${version}] Email sent successfully to ${friendEmail}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Invite sent successfully',
        guestVoucher: guestVoucherCode,
        rewardVoucher: rewardVoucherCode,
        senderRewardRedeemed: true
      })
    };
    
  } catch (error) {
    console.error(`[SEND-INVITE ${version}] Error:`, error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send invite',
        details: error.message
      })
    };
  }
};

// EOF
