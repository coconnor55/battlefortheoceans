// netlify/functions/stripe_webhook.js
// Copyright(c) 2025, Clint H. O'Connor
// Handles Stripe webhook events and grants user rights

const version = 'v0.1.1';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service key for server operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` }),
    };
  }

  // Handle the event
  try {
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(stripeEvent.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };

  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
    };
  }
};

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  const { userId, eraId } = paymentIntent.metadata;
  
  console.log(`Payment succeeded for user ${userId}, era ${eraId}`);
  
  try {
    // Grant era access in user_rights table
    const { data, error } = await supabase
      .from('user_rights')
      .insert({
        user_id: userId,
        rights_type: 'era',
        rights_value: eraId,
        uses_remaining: -1, // Unlimited uses
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        stripe_payment_intent_id: paymentIntent.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error granting era access:', error);
      throw error;
    }

    console.log(`Successfully granted ${eraId} access to user ${userId}`);
    
    // Optional: Send confirmation email here
    // await sendConfirmationEmail(userId, eraId);
    
  } catch (error) {
    console.error('Failed to grant era access:', error);
    throw error;
  }
}

// Handle failed payment
async function handlePaymentFailed(paymentIntent) {
  const { userId, eraId } = paymentIntent.metadata;
  
  console.log(`Payment failed for user ${userId}, era ${eraId}`);
  
  // Optional: Log failed payment attempt or send notification
  // You might want to track this for analytics
}

// Optional: Send confirmation email
async function sendConfirmationEmail(userId, eraId) {
  // Get user profile for email
  const { data: userProfile, error } = await supabase
    .from('user_profiles')
    .select('email, game_name')
    .eq('id', userId)
    .single();

  if (error || !userProfile) {
    console.error('Could not fetch user profile for email:', error);
    return;
  }

  // Here you would integrate with your email service (Brevo)
  // For now, just log that we would send an email
  console.log(`Would send confirmation email to ${userProfile.email} for ${eraId} unlock`);
}

// EOF
