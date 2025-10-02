// src/pages/PurchasePage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useGame } from '../context/GameContext';
import StripeService from '../services/StripeService';

const version = 'v0.3.3';

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
      console.log('[PAYMENT]', version, 'Creating payment intent');
      
      const response = await fetch('/.netlify/functions/create_payment_intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: eraInfo.promotional.stripe_price_id,
          userId: userProfile.id,
          eraId: eraInfo.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      console.log('[PAYMENT]', version, 'Confirming card payment');
      
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
        onSuccess(result.paymentIntent.id);
      }
    } catch (error) {
      console.error('[PAYMENT]', version, 'Payment error:', error);
      onError('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: 'var(--text-primary)',
                '::placeholder': {
                  color: 'var(--text-dim)',
                },
              },
              invalid: {
                color: 'var(--error)',
              },
            },
          }}
        />
      </div>
      
      <button
        type="submit"
        className="btn btn--primary btn--lg btn--block"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? 'Processing...' : `Pay ${eraInfo.priceFormatted || '[unavailable]'}`}
      </button>
    </form>
  );
};

const PurchasePage = ({ eraId, onComplete, onCancel }) => {
  const { userProfile, grantEraAccess, redeemVoucher, eraService, dispatch, events } = useGame();
  const [purchaseMethod, setPurchaseMethod] = useState('stripe');
  const [voucherCode, setVoucherCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [eraInfo, setEraInfo] = useState(null);
  const [priceInfo, setPriceInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const stripeService = new StripeService();
  const gameCDN = process.env.REACT_APP_GAME_CDN || '';
  
  // Check if user is guest
  const isGuest = userProfile?.id?.startsWith('guest-');

  useEffect(() => {
    console.log('[PAYMENT]', version, 'PurchasePage mounted for era:', eraId);
    console.log('[PAYMENT]', version, 'User is guest:', isGuest);
    fetchEraInfo();
  }, [eraId]);

  const fetchEraInfo = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('[PAYMENT]', version, 'Fetching era info');
      
      if (!eraService) {
        throw new Error('EraService not available');
      }
      
      const eraConfig = await eraService.getEraById(eraId);
      
      if (!eraConfig) {
        throw new Error(`Era not found: ${eraId}`);
      }
      
      console.log('[PAYMENT]', version, 'Era loaded:', eraConfig.name);
      setEraInfo(eraConfig);

      if (eraConfig.promotional?.stripe_price_id) {
        console.log('[PAYMENT]', version, 'Fetching price');
        try {
          const price = await stripeService.fetchPrice(eraConfig.promotional.stripe_price_id);
          console.log('[PAYMENT]', version, 'Price loaded:', price.formatted);
          setPriceInfo(price);
          eraConfig.priceFormatted = price.formatted;
          setEraInfo(eraConfig);
        } catch (priceError) {
          console.error('[PAYMENT]', version, 'Price fetch failed:', priceError);
        }
      }
      
    } catch (err) {
      console.error('[PAYMENT]', version, 'Era info fetch error:', err);
      setError(err.message || 'Failed to load era information');
    } finally {
      setLoading(false);
    }
  };

  const handleStripeSuccess = async (paymentIntentId) => {
    try {
      console.log('[PAYMENT]', version, 'Granting era access');
      
      await grantEraAccess(userProfile.id, eraId, {
        stripe_payment_intent_id: paymentIntentId
      });

      setSuccess(`Successfully unlocked ${eraInfo.name}!`);
      setTimeout(() => {
        onComplete && onComplete(eraId);
      }, 2000);
    } catch (err) {
      console.error('[PAYMENT]', version, 'Era access grant failed:', err);
      setError('Payment processed but failed to unlock era. Please contact support.');
    }
  };

  const handleStripeError = (errorMessage) => {
    console.error('[PAYMENT]', version, 'Stripe error:', errorMessage);
    setError(errorMessage);
  };

  // Handle login/signup redirect for guest users
  const handleGuestLogin = () => {
    console.log('[PAYMENT]', version, 'Guest user redirecting to login');
    onCancel(); // Close purchase page
    dispatch(events.LOGIN); // Go back to login page
  };

  const handleVoucherRedemption = async () => {
    if (!userProfile) {
      setError('You must be logged in to redeem a voucher');
      return;
    }
    
    // Guest users cannot redeem vouchers
    if (isGuest) {
      setError('Guest users cannot redeem vouchers. Please create an account to continue.');
      return;
    }

    if (!voucherCode.trim()) {
      setError('Please enter a voucher code');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      console.log('[PAYMENT]', version, 'Redeeming voucher');
      
      await redeemVoucher(userProfile.id, voucherCode.trim());
      
      setSuccess(`Voucher redeemed successfully! ${eraInfo.name} is now unlocked.`);
      setTimeout(() => {
        onComplete && onComplete(eraId);
      }, 2000);
    } catch (err) {
      console.error('[PAYMENT]', version, 'Voucher redemption failed:', err);
      
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

  // Loading state
  if (loading) {
    return (
      <div className="card card--narrow">
        <div className="loading">
          <div className="spinner spinner--lg"></div>
          <p>Loading era information...</p>
        </div>
      </div>
    );
  }

  // Error state - no era info
  if (error && !eraInfo) {
    return (
      <div className="card card--narrow">
        <div className="card-header">
          <h2 className="card-title">Error</h2>
        </div>
        <div className="card-body">
          <p className="message message--error">{error}</p>
        </div>
        <div className="card-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // Build features list
  const features = [];
  if (eraInfo.promotional?.features) {
    features.push(...eraInfo.promotional.features);
  } else {
    features.push(`Choose your alliance: US Navy or Imperial Navy`);
    features.push(`Command legendary ships: USS Enterprise, Akagi, Yorktown`);
    features.push(`${eraInfo.rows}x${eraInfo.cols} battlefield with authentic Pacific terrain`);
  }

  // Image URL construction - CDN first, fallback to public/assets/images
  const backgroundImageUrl = eraInfo.promotional?.background_image
    ? gameCDN
      ? `${gameCDN}/assets/images/${eraInfo.promotional.background_image}`
      : `/assets/images/${eraInfo.promotional.background_image}`
    : null;

  const promotionalImageUrl = eraInfo.promotional?.promotional_image
    ? gameCDN
      ? `${gameCDN}/assets/images/${eraInfo.promotional.promotional_image}`
      : `/assets/images/${eraInfo.promotional.promotional_image}`
    : null;

  return (
    <div className="card card--wide">
      {/* Header */}
      <div className="card-header">
        <h2 className="card-title">Unlock {eraInfo.name}</h2>
      </div>

      {/* Body - Scrollable content */}
      <div className="card-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Images - centered with 30px spacing */}
        {(backgroundImageUrl || promotionalImageUrl) && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '30px',
            marginBottom: 'var(--space-lg)',
            flexWrap: 'wrap'
          }}>
            {backgroundImageUrl && (
              <img
                src={backgroundImageUrl}
                alt={`${eraInfo.name} background`}
                style={{
                  maxWidth: '400px',
                  height: '200px',
                  objectFit: 'contain',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-subtle)'
                }}
              />
            )}
            {promotionalImageUrl && (
              <img
                src={promotionalImageUrl}
                alt={`${eraInfo.name} promotional`}
                style={{
                  maxWidth: '400px',
                  height: '200px',
                  objectFit: 'contain',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-subtle)'
                }}
              />
            )}
          </div>
        )}

        {/* Description */}
        <p style={{ marginBottom: 'var(--space-lg)' }}>
          {eraInfo.promotional?.marketing_description || eraInfo.era_description}
        </p>

        {/* Features */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{
            color: 'var(--primary)',
            marginBottom: 'var(--space-md)',
            fontSize: '1.1rem'
          }}>
            What's Included:
          </h3>
          <ul style={{
            listStyleType: 'none',
            padding: 0,
            margin: 0
          }}>
            {features.map((feature, index) => (
              <li
                key={index}
                style={{
                  padding: 'var(--space-xs) 0',
                  paddingLeft: 'var(--space-md)',
                  position: 'relative',
                  color: 'var(--text-secondary)'
                }}
              >
                <span style={{
                  position: 'absolute',
                  left: 0,
                  color: 'var(--primary)'
                }}>✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Guest User Message - Prompt to create account */}
        {isGuest && (
          <div style={{
            background: 'var(--bg-overlay)',
            padding: 'var(--space-lg)',
            borderRadius: 'var(--border-radius)',
            marginBottom: 'var(--space-lg)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center'
          }}>
            <h3 style={{
              color: 'var(--primary)',
              marginBottom: 'var(--space-md)',
              fontSize: '1.1rem'
            }}>
              Create an Account to Purchase
            </h3>
            <p style={{
              marginBottom: 'var(--space-lg)',
              color: 'var(--text-secondary)'
            }}>
              Guest users cannot make purchases. Create a free account to unlock premium eras and save your progress!
            </p>
            <button
              onClick={handleGuestLogin}
              className="btn btn--primary btn--lg btn--block"
            >
              Login or Sign Up
            </button>
            <p style={{
              marginTop: 'var(--space-md)',
              fontSize: '0.875rem',
              color: 'var(--text-dim)'
            }}>
              Creating an account takes less than 30 seconds
            </p>
          </div>
        )}

        {/* Payment Method Tabs - Only show for registered users */}
        {!isGuest && (
          <div style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-lg)',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <button
              className={purchaseMethod === 'stripe' ? 'btn btn--primary btn--sm' : 'btn btn--secondary btn--sm'}
              onClick={() => setPurchaseMethod('stripe')}
            >
              Credit/Debit Card
            </button>
            <button
              className={purchaseMethod === 'voucher' ? 'btn btn--primary btn--sm' : 'btn btn--secondary btn--sm'}
              onClick={() => setPurchaseMethod('voucher')}
            >
              Voucher Code
            </button>
          </div>
        )}

        {/* Stripe Payment - Only for registered users */}
        {!isGuest && purchaseMethod === 'stripe' && (
          <div>
            <div style={{
              textAlign: 'center',
              marginBottom: 'var(--space-lg)',
              padding: 'var(--space-md)',
              background: 'var(--bg-overlay)',
              borderRadius: 'var(--border-radius)'
            }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: 'var(--primary)',
                marginBottom: 'var(--space-xs)'
              }}>
                {priceInfo?.formatted || '[price unavailable]'}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-dim)'
              }}>
                One-time purchase
              </div>
            </div>

            <div style={{
              background: 'var(--bg-overlay)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--border-radius)',
              marginBottom: 'var(--space-lg)',
              border: '1px solid var(--border-subtle)'
            }}>
              <p style={{
                margin: 0,
                marginBottom: 'var(--space-sm)',
                color: 'var(--primary)',
                fontWeight: 'bold'
              }}>
                Secure payment powered by Stripe
              </p>
              <ul style={{
                margin: 0,
                paddingLeft: 'var(--space-lg)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                <li>Instant access after payment</li>
                <li>No subscription or recurring charges</li>
                <li>30-day money-back guarantee</li>
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

        {/* Voucher Redemption - Only for registered users */}
        {!isGuest && purchaseMethod === 'voucher' && (
          <div>
            <p style={{
              marginBottom: 'var(--space-md)',
              color: 'var(--text-secondary)'
            }}>
              Have a voucher code? Enter it below to unlock this era for free!
            </p>
            
            <div className="form-group">
              <input
                type="text"
                placeholder={`Enter voucher code (e.g., ${eraInfo.era || 'midway'}-abc123)`}
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                disabled={isProcessing}
                className="form-input"
              />
            </div>

            <button
              onClick={handleVoucherRedemption}
              disabled={isProcessing || !voucherCode.trim()}
              className="btn btn--success btn--lg btn--block"
            >
              {isProcessing ? 'Redeeming...' : 'Redeem Voucher'}
            </button>

            <p style={{
              marginTop: 'var(--space-md)',
              fontSize: '0.875rem',
              color: 'var(--text-dim)',
              textAlign: 'center'
            }}>
              Voucher codes are case-sensitive and can only be used once.
            </p>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="message message--error" style={{ marginTop: 'var(--space-md)' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="message message--success" style={{ marginTop: 'var(--space-md)' }}>
            {success}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="card-footer">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="btn btn--secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PurchasePage;

// EOF
