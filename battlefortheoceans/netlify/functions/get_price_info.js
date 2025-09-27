// netlify/functions/get_price_info.js
// Copyright(c) 2025, Clint H. O'Connor

const version = 'v0.2.0'
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { priceId } = JSON.parse(event.body);

    if (!priceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Price ID is required' })
      };
    }

    console.log('Fetching price info for:', priceId);

    // Fetch price from Stripe
    const price = await stripe.prices.retrieve(priceId);

    console.log('Price fetched successfully:', price.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: price.id,
        unit_amount: price.unit_amount,
        currency: price.currency,
        type: price.type,
        recurring: price.recurring,
        product: price.product,
        active: price.active
      })
    };

  } catch (error) {
    console.error('Error fetching price:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch price information',
        details: error.message 
      })
    };
  }
};

// EOF
