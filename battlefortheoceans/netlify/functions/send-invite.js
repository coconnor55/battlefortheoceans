// netlify/functions/send-invite.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.0: Simplified to match GetAccessPage parameters
//         - Accepts: friendEmail, senderName, senderEmail, voucherCode, eraName
//         - Removed: voucher generation (handled by frontend)
//         - Removed: auto-redemption (handled by frontend)
//         - Removed: senderUserId requirement
//         - Function now just sends email via Brevo with CC to sender
// v0.1.1: Support string template IDs (Brevo's new format)
//         - Handles both numeric IDs (1, 2, 3) and string IDs
//         - Auto-detects format and uses appropriate type
// v0.1.0: Initial send-invite function - handles game invitation emails via Brevo
//         - Generates voucher codes
//         - Auto-redeems reward voucher for sender
//         - Sends email with guest voucher
//         - Returns voucher details to frontend

const SibApiV3Sdk = require('sib-api-v3-sdk');

const version = 'v0.2.0';

// Brevo client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log(`[INVITE ${version}] Request received`);
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const body = JSON.parse(event.body);
    const { friendEmail, senderName, senderEmail, voucherCode, eraName } = body;
    
    // Validate input
    if (!friendEmail || !senderName || !senderEmail || !voucherCode || !eraName) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: friendEmail, senderName, senderEmail, voucherCode, eraName'
        })
      };
    }
    
    if (!friendEmail.includes('@')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid friend email address' })
      };
    }
    
    if (!senderEmail.includes('@')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid sender email address' })
      };
    }
    
    console.log(`[INVITE ${version}] Processing invite from ${senderEmail} to ${friendEmail} for ${eraName}`);
    
    // Build voucher link
    const voucherLink = `https://battlefortheoceans.com/redeem/${voucherCode}`;
    
    // Send email via Brevo
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: friendEmail }];
    sendSmtpEmail.cc = [{ email: senderEmail }]; // CC sender so they get a copy
    
    // Template ID can be numeric or string identifier
    const templateId = process.env.BREVO_INVITE_TEMPLATE_ID;
    // If it's a number, parse it; otherwise use as-is
    const parsedTemplateId = isNaN(templateId) ? templateId : parseInt(templateId, 10);
    
    console.log(`[INVITE ${version}] Template ID from env:`, templateId);
    console.log(`[INVITE ${version}] Parsed template ID:`, parsedTemplateId);
    console.log(`[INVITE ${version}] Type:`, typeof parsedTemplateId);
    
    sendSmtpEmail.templateId = parsedTemplateId;
    
    sendSmtpEmail.params = {
      SENDER_NAME: senderName,
      ERA_NAME: eraName,
      VOUCHER_CODE: voucherCode,
      VOUCHER_LINK: voucherLink
    };
    
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log(`[INVITE ${version}] Email sent successfully to ${friendEmail} (CC: ${senderEmail})`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Invite sent successfully'
      })
    };
    
  } catch (error) {
    console.error(`[INVITE ${version}] Error:`, error);
    
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
