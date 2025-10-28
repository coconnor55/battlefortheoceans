// src/pages/PurchasePage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.4.4: Use singleton StripeService instance
//         - Changed import from StripeService (class) to stripeService (instance)
//         - Removed line 132: const stripeService = new StripeService()
//         - StripeService now exports singleton per v0.1.1
// v0.4.3: Show both Pay and Dev/Test buttons for admin/tester
//         - Removed !canBypassPayment condition from payment form visibility
//         - Admin/tester can now test Stripe payment flow
//         - Dev/Test button shown at top for quick bypass
//         - Pay button shown below for Stripe testing
// v0.4.2: Added payment bypass for admin/tester roles
//         - Admin and tester users can grant access without going through Stripe
//         - Button shows "Grant Access (Dev/Test)" instead of payment amount
//         - Direct call to grantEraAccess() bypasses Stripe entirely
//         - Console logs show bypass usage for audit trail
// v0.4.1: Previous version

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useGame } from '../context/GameContext';
import stripeService from '../services/StripeService';

const version = 'v0.4.4';

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
          eraId: eraInfo.era
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
        <label className="form-label">Card Information</label>
        <div className="stripe-card-input">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-body)',
                  '::placeholder': {
                    color: '#888888',
                  },
                },
                invalid: {
                  color: '#FF3366',
                },
              },
            }}
          />
        </div>
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
  const { userProfile, grantEraAccess, redeemVoucher, getEraById, dispatch, events } = useGame();
  const [purchaseMethod, setPurchaseMethod] = useState('stripe');
  const [voucherCode, setVoucherCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [eraInfo, setEraInfo] = useState(null);
  const [priceInfo, setPriceInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const gameCDN = process.env.REACT_APP_GAME_CDN || '';
  
  // Check if user is guest
  const isGuest = userProfile?.id?.startsWith('guest-');
  
  // v0.4.2: Check if user is admin or tester (can bypass payment)
  const canBypassPayment = ['admin', 'tester'].includes(userProfile?.role);

  useEffect(() => {
    console.log('[PAYMENT]', version, 'PurchasePage mounted for era:', eraId);
    console.log('[PAYMENT]', version, 'User is guest:', isGuest);
    console.log('[PAYMENT]', version, 'User can bypass payment:', canBypassPayment);
    fetchEraInfo();
  }, [eraId]);

  const fetchEraInfo = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('[PAYMENT]', version, 'Fetching era info');
      
      const eraConfig = await getEraById(eraId);
        
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

  // v0.4.2: Direct access grant for admin/tester (bypasses Stripe)
  const handleDirectAccessGrant = async () => {
    setIsProcessing(true);
    setError('');

    try {
      console.log('[PAYMENT]', version, `Admin/Tester bypass - granting access directly to ${eraId}`);
      
      const granted = await grantEraAccess(userProfile.id, eraId, {
        bypass_reason: `${userProfile.role}_testing`,
        bypass_timestamp: new Date().toISOString()
      });

      if (granted) {
        setSuccess(`Dev/Test access granted for ${eraInfo.name}!`);
        setTimeout(() => {
          onComplete && onComplete(eraId);
        }, 1500);
      } else {
        throw new Error('Failed to grant access');
      }
    } catch (err) {
      console.error('[PAYMENT]', version, 'Direct access grant failed:', err);
      setError('Failed to grant access. Please contact support.');
    } finally {
      setIsProcessing(false);
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

  const handleGuestLogin = () => {
    console.log('[PAYMENT]', version, 'Guest user redirecting to login');
    onCancel();
    dispatch(events.LOGIN);
  };

  const handleVoucherRedemption = async () => {
    if (!userProfile) {
      setError('You must be logged in to redeem a voucher');
      return;
    }
    
    if (isGuest) {
      setError('Guest users cannot redeem vouchers. Please create an account to continue.');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      console.log('[PAYMENT]', version, 'Redeeming voucher:', voucherCode);
      
      const result = await redeemVoucher(userProfile.id, voucherCode);
      
      if (result.success) {
        console.log('[PAYMENT]', version, 'Voucher redeemed successfully');
        setSuccess(`Successfully unlocked ${eraInfo.name}!`);
        setTimeout(() => {
          onComplete && onComplete(eraId);
        }, 2000);
      } else {
        throw new Error(result.error || 'Invalid voucher code');
      }
    } catch (err) {
      console.error('[PAYMENT]', version, 'Voucher redemption failed:', err);
      if (err.message.includes('not found')) {
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

  // Image URL construction
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
    <div className="card card--wide purchase-card">
      <div className="card-header">
        <h2 className="card-title">Unlock {eraInfo.name}</h2>
      </div>

      <div className="card-body purchase-body">
        {/* Images */}
        {(backgroundImageUrl || promotionalImageUrl) && (
          <div className="image-grid">
            {backgroundImageUrl && (
              <img
                src={backgroundImageUrl}
                alt={`${eraInfo.name} background`}
                className="promo-image"
              />
            )}
            {promotionalImageUrl && (
              <img
                src={promotionalImageUrl}
                alt={`${eraInfo.name} promotional`}
                className="promo-image"
              />
            )}
          </div>
        )}

        {/* Description */}
        <p className="item-description mb-lg">
          {eraInfo.promotional?.marketing_description || eraInfo.era_description}
        </p>

        {/* Features */}
        <div className="mb-lg">
          <h3 className="section-header">What's Included:</h3>
          <ul className="feature-checklist">
            {features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>

        {/* v0.4.3: Admin/Tester Direct Access - ALWAYS SHOW for admin/tester */}
        {canBypassPayment && (
          <div className="info-card info-card--center mb-lg">
            <h3>Dev/Test Access</h3>
            <p>
              As a {userProfile.role}, you can grant yourself access to this era for testing without payment.
            </p>
            <button
              onClick={handleDirectAccessGrant}
              disabled={isProcessing}
              className="btn btn--warning btn--lg btn--block"
            >
              {isProcessing ? 'Granting Access...' : 'Grant Access (Dev/Test)'}
            </button>
            <p className="form-help mt-md">
              This bypass is logged for audit purposes. Use Pay button below to test Stripe.
            </p>
          </div>
        )}

        {/* Guest User Message */}
        {isGuest && (
          <div className="info-card info-card--center">
            <h3>Create an Account to Purchase</h3>
            <p>
              Guest users cannot make purchases. Create a free account to unlock premium eras and save your progress!
            </p>
            <button
              onClick={handleGuestLogin}
              className="btn btn--primary btn--lg btn--block"
            >
              Login or Sign Up
            </button>
            <p className="form-help mt-md">
              Creating an account takes less than 30 seconds
            </p>
          </div>
        )}

        {/* v0.4.3: Payment Method Tabs - Show for all non-guest users (including admin/tester) */}
        {!isGuest && (
          <div className="tab-buttons mb-lg">
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

        {/* v0.4.3: Stripe Payment - Show for all non-guest users (including admin/tester) */}
        {!isGuest && purchaseMethod === 'stripe' && (
          <div>
            <div className="price-box mb-lg">
              <div className="price-amount">
                {priceInfo?.formatted || '[price unavailable]'}
              </div>
              <div className="price-note">One-time purchase</div>
            </div>

            <div className="info-card mb-lg">
              <p className="info-card__title">Secure payment powered by Stripe</p>
              <ul className="info-list">
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

        {/* v0.4.3: Voucher Redemption - Show for all non-guest users (including admin/tester) */}
        {!isGuest && purchaseMethod === 'voucher' && (
          <div>
            <p className="item-description mb-md">
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

            <p className="form-help text-center mt-md">
              Voucher codes are case-sensitive and can only be used once.
            </p>
          </div>
        )}

        {/* Messages */}
        {error && <div className="message message--error mt-md">{error}</div>}
        {success && <div className="message message--success mt-md">{success}</div>}
      </div>

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
