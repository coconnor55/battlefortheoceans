// netlify/functions/send-admin-invite.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial send-admin-invite function - handles admin invitation emails via Brevo
//         - Accepts: friendEmail, senderName, senderEmail, voucherCode, eraName, customMessage
//         - Handles multiple vouchers (comma-separated)
//         - Sends custom email with standard message + optional custom message
//         - Sets sender email address to admin's email

const SibApiV3Sdk = require('sib-api-v3-sdk');

const version = 'v0.1.0';

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
    
    // Build voucher links (handle multiple vouchers separated by comma)
    const voucherCodes = voucherCode.split(',').map(code => code.trim());
    const voucherLinks = voucherCodes.map(code => `https://battlefortheoceans.com/redeem/${code}`);
    
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
    const safeEraName = escapeHtml(eraName);
    const hasCustomMessage = customMessage && customMessage.trim();
    const safeCustomMessage = hasCustomMessage ? escapeHtml(customMessage) : '';
    
    // Send email via Brevo
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    // When using custom HTML (not a template), Brevo requires an explicit sender
    sendSmtpEmail.sender = { email: 'battlefortheoceans@gmail.com', name: senderName };
    sendSmtpEmail.to = [{ email: friendEmail }];
    sendSmtpEmail.cc = [{ email: senderEmail }]; // CC admin so they get a copy
    sendSmtpEmail.subject = `${senderName} invited you to play ${eraName}`;
    
    sendSmtpEmail.htmlContent = `
      <html>
        <body>
          <h2>You've been invited to play ${safeEraName}!</h2>
          <p>Hi there,</p>
          <p>${safeSenderName} has invited you to play <strong>Battle for the Oceans</strong>, modeled after the 1920s paper game of Battleship. Please try playing a game as a guest, and then sign up to create a game account where you will be able to use the following passes and vouchers to play more games.</p>
          ${hasCustomMessage ? `<div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #4CAF50; border-radius: 4px;">
            <p style="margin: 0; font-style: italic;">"${safeCustomMessage.replace(/\n/g, '<br>')}"</p>
          </div>` : ''}
          <p>Use the following voucher code${voucherCodes.length > 1 ? 's' : ''} to get started:</p>
          <div style="background: #e8f5e9; padding: 15px; margin: 20px 0; border-radius: 4px;">
            ${voucherCodes.map(code => `<p style="margin: 5px 0;"><strong>${escapeHtml(code)}</strong></p>`).join('\n')}
          </div>
          <p>Or click the link${voucherLinks.length > 1 ? 's' : ''} below to redeem:</p>
          <div style="margin: 20px 0;">
            ${voucherLinks.map(link => `<p><a href="${link}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Redeem Voucher</a></p>`).join('')}
          </div>
          <p>Happy gaming!</p>
          <p>— The Battle for the Oceans Team</p>
        </body>
      </html>
    `;
    
    sendSmtpEmail.textContent = `
You've been invited to play ${eraName}!

Hi there,

${senderName} has invited you to play Battle for the Oceans, modeled after the 1920s paper game of Battleship. Please try playing a game as a guest, and then sign up to create a game account where you will be able to use the following passes and vouchers to play more games.

${hasCustomMessage ? `\n"${customMessage}"\n` : ''}

Use the following voucher code${voucherCodes.length > 1 ? 's' : ''} to get started:
${voucherCodes.map(code => `  ${code}`).join('\n')}

Or visit:
${voucherLinks.join('\n')}

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

