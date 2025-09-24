// netlify/functions/create-payment-intent.js
// Creates Stripe payment intent for era purchases

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { priceId, userId, eraId } = JSON.parse(event.body);

    // Validate required fields
    if (!priceId || !userId || !eraId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: priceId, userId, eraId'
        }),
      };
    }

    // Get price details from Stripe
    const price = await stripe.prices.retrieve(priceId);
    
    if (!price) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid price ID' }),
      };
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount, // Amount in cents
      currency: 'usd',
      metadata: {
        userId: userId,
        eraId: eraId,
        product: 'era_unlock',
        priceId: priceId
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
      }),
    };

  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to create payment intent',
        details: error.message
      }),
    };
  }
};

// Handle preflight requests for CORS
exports.handler.options = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: '',
  };
};
// EOF
