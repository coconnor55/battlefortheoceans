// src/pages/PurchasePage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useGame } from '../context/GameContext';
import './Pages.css';
import './PurchasePage.css';

const version = 'v0.1.5';

// Load Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const PaymentForm = ({ eraInfo, userProfile, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent via Netlify function
      const response = await fetch('/.netlify/functions/create_payment_intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: eraInfo.priceId,
          userId: userProfile.id,
          eraId: eraInfo.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      // Confirm payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            email: userProfile.email,
          },
        }
      });

      if (result.error) {
        onError(result.error.message);
      } else {
        // Payment succeeded
        onSuccess(result.paymentIntent.id);
      }
    } catch (error) {
      onError('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="card-element-container">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>
      
      <button
        type="submit"
        className="btn btn-primary btn-large"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? 'Processing...' : `Pay $${eraInfo.price}`}
      </button>
    </form>
  );
};

const PurchasePage = ({ eraId, onComplete, onCancel }) => {
  const { userProfile, grantEraAccess, redeemVoucher } = useGame();
  const [purchaseMethod, setPurchaseMethod] = useState('stripe');
  const [voucherCode, setVoucherCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [eraInfo, setEraInfo] = useState(null);

  useEffect(() => {
    fetchEraInfo();
  }, [eraId]);

  const fetchEraInfo = async () => {
    try {
      // Fetch from your era configuration
      setEraInfo({
        id: 'MidwayIsland',
        name: 'Midway Island',
        description: 'Experience the pivotal 1942 Pacific battle with carriers, destroyers, and strategic positioning.',
        price: 4.99,
        priceId: 'price_1234567890', // Replace with your actual Stripe Price ID
        features: [
          '12x12 battle grid with realistic Pacific terrain',
          'Historical WWII ship classes and capabilities',
          'Alliance-based gameplay (US Navy vs Imperial Navy)',
          'Enhanced AI captains with period-accurate strategies'
        ]
      });
    } catch (err) {
      setError('Failed to load era information');
    }
  };

  const handleStripeSuccess = async (paymentIntentId) => {
    try {
      // Grant rights via GameContext singleton service
      await grantEraAccess(userProfile.id, eraId, {
        stripe_payment_intent_id: paymentIntentId
      });

      setSuccess(`Successfully unlocked ${eraInfo.name}!`);
      setTimeout(() => {
        onComplete && onComplete(eraId);
      }, 2000);
    } catch (err) {
      setError('Payment processed but failed to unlock era. Please contact support.');
    }
  };

  const handleStripeError = (errorMessage) => {
    setError(errorMessage);
  };

  const handleVoucherRedemption = async () => {
    if (!userProfile) {
      setError('You must be logged in to redeem a voucher');
      return;
    }

    if (!voucherCode.trim()) {
      setError('Please enter a voucher code');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      await redeemVoucher(userProfile.id, voucherCode.trim());
      
      setSuccess(`Voucher redeemed successfully! ${eraInfo.name} is now unlocked.`);
      setTimeout(() => {
        onComplete && onComplete(eraId);
      }, 2000);
    } catch (err) {
      if (err.message.includes('Invalid voucher')) {
        setError('Invalid voucher code. Please check and try again.');
      } else if (err.message.includes('already used')) {
        setError('This voucher code has already been used.');
      } else if (err.message.includes('expired')) {
        setError('This voucher code has expired.');
      } else {
        setError('Failed to redeem voucher. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!eraInfo) {
    return (
      <div className="purchase-page">
        <div className="purchase-container">
          <div className="loading">Loading era information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="purchase-page">
      <div className="purchase-container">
        <div className="purchase-header">
          <h2>Unlock {eraInfo.name}</h2>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <div className="era-showcase">
          <div className="era-image">
            <div className="placeholder-image">
              <span>🚢</span>
            </div>
          </div>
          
          <div className="era-details">
            <h3>{eraInfo.name}</h3>
            <p className="era-description">{eraInfo.description}</p>
            
            <div className="feature-list">
              <h4>What's Included:</h4>
              <ul>
                {eraInfo.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="purchase-methods">
          <div className="method-selector">
            <button
              className={`method-tab ${purchaseMethod === 'stripe' ? 'active' : ''}`}
              onClick={() => setPurchaseMethod('stripe')}
            >
              Credit/Debit Card
            </button>
            <button
              className={`method-tab ${purchaseMethod === 'voucher' ? 'active' : ''}`}
              onClick={() => setPurchaseMethod('voucher')}
            >
              Voucher Code
            </button>
          </div>

          {purchaseMethod === 'stripe' && (
            <div className="stripe-payment">
              <div className="price-display">
                <span className="price">${eraInfo.price}</span>
                <span className="price-note">One-time purchase</span>
              </div>
              
              <div className="payment-info">
                <p>Secure payment powered by Stripe</p>
                <ul className="payment-features">
                  <li>✓ Instant access after payment</li>
                  <li>✓ No subscription or recurring charges</li>
                  <li>✓ 30-day money-back guarantee</li>
                </ul>
              </div>

              <Elements stripe={stripePromise}>
                <PaymentForm
                  eraInfo={eraInfo}
                  userProfile={userProfile}
                  onSuccess={handleStripeSuccess}
                  onError={handleStripeError}
                />
              </Elements>
            </div>
          )}

          {purchaseMethod === 'voucher' && (
            <div className="voucher-redemption">
              <div className="voucher-info">
                <p>Have a voucher code? Enter it below to unlock this era for free!</p>
              </div>
              
              <div className="voucher-input">
                <input
                  type="text"
                  placeholder="Enter voucher code (e.g., midway-abc123)"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <button
                className="btn btn-primary btn-large"
                onClick={handleVoucherRedemption}
                disabled={isProcessing || !voucherCode.trim()}
              >
                {isProcessing ? 'Redeeming...' : 'Redeem Voucher'}
              </button>

              <div className="voucher-help">
                <p>Voucher codes are case-sensitive and can only be used once.</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        {success && (
          <div className="message success">
            {success}
          </div>
        )}

        <div className="purchase-footer">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchasePage;

// EOF
