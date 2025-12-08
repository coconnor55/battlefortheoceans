// netlify/functions/send-admin-invite.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.2.0: Updated email format to match new specification
//         - Subject: "You've been invited to play Battle for the Oceans!"
//         - Updated body format with signup link instead of voucher redemption links
//         - Voucher codes listed for Get Access page entry
//         - Direct signup URL (no query params)
// v0.1.0: Initial send-admin-invite function - handles admin invitation emails via Brevo
//         - Accepts: friendEmail, senderName, senderEmail, voucherCode, eraName, customMessage
//         - Handles multiple vouchers (comma-separated)
//         - Sends custom email with standard message + optional custom message
//         - Sets sender email address to admin's email

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
  console.log(`[INVITE ${version}] Admin invite request received`);
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const body = JSON.parse(event.body);
    const { friendEmail, senderName, senderEmail, voucherCode, eraName, customMessage } = body;
    
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
    
    console.log(`[INVITE ${version}] Processing admin invite from ${senderEmail} to ${friendEmail} for ${eraName}`);
    console.log(`[INVITE ${version}] Sender name: ${senderName}`);
    console.log(`[INVITE ${version}] Voucher codes: ${voucherCode}`);
    if (customMessage) {
      console.log(`[INVITE ${version}] Custom message provided`);
    }
    
    // Build voucher codes (handle multiple vouchers separated by comma)
    const voucherCodes = voucherCode.split(',').map(code => code.trim());
    
    console.log(`[INVITE ${version}] Parsed ${voucherCodes.length} voucher code(s):`, voucherCodes);
    
    // Helper function to escape HTML
    const escapeHtml = (text) => {
      if (!text) return '';
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    };
    
    const safeSenderName = escapeHtml(senderName);
    const hasCustomMessage = customMessage && customMessage.trim();
    const safeCustomMessage = hasCustomMessage ? escapeHtml(customMessage.trim()) : '';
    
    // Signup URL (base URL, no query params as they get stripped)
    const signupUrl = 'https://battlefortheoceans.com';
    
    // Send email via Brevo
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    // When using custom HTML (not a template), Brevo requires an explicit sender
    sendSmtpEmail.sender = { email: 'battlefortheoceans@gmail.com', name: senderName };
    sendSmtpEmail.to = [{ email: friendEmail }];
    sendSmtpEmail.cc = [{ email: senderEmail }]; // CC admin so they get a copy
    sendSmtpEmail.subject = `You've been invited to play Battle for the Oceans!`;
    
    sendSmtpEmail.htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>You've been invited to play Battle for the Oceans!</h2>
          
          <p>Hi there,</p>
          
          <p>${safeSenderName} has invited you to play Battle for the Oceans, modeled after the 1920s paper game of Battleship. Please sign up to create a game account where you will be able to use the following passes and vouchers to play more games.</p>
          
          ${hasCustomMessage ? `<p>"${safeCustomMessage.replace(/\n/g, '<br>')}"</p>` : ''}
          
          <p>In the Get Access page for these games, enter the following voucher codes to play Midway Island and Pirates of the Gulf:</p>
          
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 4px; font-family: monospace;">
            ${voucherCodes.map(code => `<div style="margin: 5px 0;">${escapeHtml(code)}</div>`).join('')}
          </div>
          
          <p>Click the link below to sign up:</p>
          
          <div style="margin: 20px 0;">
            <a href="${signupUrl}" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Sign Up</a>
          </div>
          
          <p>Happy gaming!</p>
          
          <p>— The Battle for the Oceans Team</p>
        </body>
      </html>
    `;
    
    sendSmtpEmail.textContent = `You've been invited to play Battle for the Oceans!



Hi there,

${senderName} has invited you to play Battle for the Oceans, modeled after the 1920s paper game of Battleship. Please sign up to create a game account where you will be able to use the following passes and vouchers to play more games.

${hasCustomMessage ? `"${customMessage.trim()}"\n\n` : ''}In the Get Access page for these games, enter the following voucher codes to play Midway Island and Pirates of the Gulf:

${voucherCodes.map(code => code).join('\n')}

Click the link below to sign up:

${signupUrl}



Happy gaming!

— The Battle for the Oceans Team
    `;
    
    console.log(`[INVITE ${version}] Subject: ${sendSmtpEmail.subject}`);
    console.log(`[INVITE ${version}] HTML content length: ${sendSmtpEmail.htmlContent.length} chars`);
    console.log(`[INVITE ${version}] Email configuration:`);
    console.log(`[INVITE ${version}]   To: ${friendEmail}`);
    console.log(`[INVITE ${version}]   CC: ${senderEmail}`);
    
    console.log(`[INVITE ${version}] Sending email via Brevo API...`);
    const emailResponse = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[INVITE ${version}] Brevo API response:`, JSON.stringify(emailResponse, null, 2));
    console.log(`[INVITE ${version}] Email sent successfully to ${friendEmail} (CC: ${senderEmail})`);
    console.log(`[INVITE ${version}] Message ID: ${emailResponse.messageId || 'N/A'}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Invite sent successfully'
      })
    };
    
  } catch (error) {
    console.error(`[INVITE ${version}] Error occurred:`, error);
    console.error(`[INVITE ${version}] Error stack:`, error.stack);
    
    // Log Brevo API error details if available
    if (error.response) {
      console.error(`[INVITE ${version}] Brevo API error response:`, error.response);
      console.error(`[INVITE ${version}] Brevo API error status:`, error.response.status);
      console.error(`[INVITE ${version}] Brevo API error body:`, error.response.body);
    }
    
    // Provide more detailed error message
    let errorMessage = 'Failed to send invite';
    if (error.response && error.response.body) {
      try {
        const errorBody = typeof error.response.body === 'string' 
          ? JSON.parse(error.response.body) 
          : error.response.body;
        errorMessage = errorBody.message || errorBody.error || errorMessage;
        console.error(`[INVITE ${version}] Parsed error message: ${errorMessage}`);
      } catch (e) {
        errorMessage = error.response.body.message || error.response.body.error || errorMessage;
        console.error(`[INVITE ${version}] Error parsing response body:`, e);
      }
    } else if (error.message) {
      errorMessage = error.message;
      console.error(`[INVITE ${version}] Error message: ${errorMessage}`);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: errorMessage,
        details: error.message || 'Unknown error occurred'
      })
    };
  }
};

// EOF

