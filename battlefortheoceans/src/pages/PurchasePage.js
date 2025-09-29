// src/pages/PurchasePage.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useGame } from '../context/GameContext';
import StripeService from '../services/StripeService';

const version = 'v0.2.9';

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
          priceId: eraInfo.promotional.stripe_price_id,
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
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb'
      }}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                '::placeholder': {
                  color: '#9ca3af',
                },
              },
              invalid: {
                color: '#ef4444',
              },
            },
          }}
        />
      </div>
      
      <button
        type="submit"
        style={{
          width: '95%',
          padding: '1.25rem 2rem',
          fontSize: '1.25rem',
          fontWeight: '600',
          backgroundColor: isProcessing ? '#94a3b8' : '#0ea5e9',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          marginBottom: '1rem'
        }}
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? 'Processing...' : `Pay ${eraInfo.priceFormatted || '[unavailable]'}`}
      </button>
    </form>
  );
};

const PurchasePage = ({ eraId, onComplete, onCancel }) => {
  const { userProfile, grantEraAccess, redeemVoucher, eraService } = useGame();
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

  useEffect(() => {
    fetchEraInfo();
  }, [eraId]);

  const fetchEraInfo = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(version, 'Fetching era info for:', eraId);
      
      if (!eraService) {
        throw new Error('EraService not available from GameContext');
      }
      
      // Fetch era config using EraService
      const eraConfig = await eraService.getEraById(eraId);
      
      if (!eraConfig) {
        throw new Error(`Era not found: ${eraId}`);
      }
      
      console.log(version, 'Era config loaded via EraService:', eraConfig.name);
      setEraInfo(eraConfig);

      // Fetch price if Stripe price ID is available
      if (eraConfig.promotional?.stripe_price_id) {
        console.log(version, 'Fetching price for:', eraConfig.promotional.stripe_price_id);
        try {
          const price = await stripeService.fetchPrice(eraConfig.promotional.stripe_price_id);
          console.log(version, 'Price fetched successfully:', price);
          setPriceInfo(price);
          
          // Add formatted price to era info for easy access
          eraConfig.priceFormatted = price.formatted;
          setEraInfo(eraConfig);
        } catch (priceError) {
          console.error(version, 'Failed to fetch price:', priceError);
          // Continue without price - will show [unavailable]
        }
      } else {
        console.log(version, 'No stripe_price_id found in era config');
      }
      
    } catch (err) {
      console.error(version, 'Error fetching era info:', err);
      setError(err.message || 'Failed to load era information');
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          padding: '3rem',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          textAlign: 'center'
        }}>
          <div className="spinner spinner-lg"></div>
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading era information...</p>
        </div>
      </div>
    );
  }

  if (error && !eraInfo) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          maxWidth: '500px'
        }}>
          <p style={{ color: '#ef4444', marginBottom: '1.5rem' }}>{error}</p>
          <button
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6b7280',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
            onClick={onCancel}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Build features list from era config
  const features = [];
  if (eraInfo.promotional?.features) {
    features.push(...eraInfo.promotional.features);
  } else {
    // Fallback features generated from era config
    features.push(`Choose your alliance: US Navy or Imperial Navy`);
    features.push(`Command legendary ships: USS Enterprise, Akagi, Yorktown`);
    features.push(`${eraInfo.rows}x${eraInfo.cols} battlefield with authentic Pacific terrain`);
  }

  const backgroundImageUrl = eraInfo.promotional?.background_image
    ? `${gameCDN}/${eraInfo.promotional.background_image}`
    : null;

  const promotionalImageUrl = eraInfo.promotional?.promotional_image
    ? `${gameCDN}/${eraInfo.promotional.promotional_image}`
    : null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%'
    }}>
      <div style={{
        width: '90%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
      {/* Header */}
      <div style={{
        padding: '2rem',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: 0
        }}>
          Unlock {eraInfo.name}
        </h2>
      </div>

      {/* Content - Scrollable */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2rem'
      }}>
        {/* Images Side by Side */}
        <div style={{
          display: 'flex',
          gap: '2rem',
          marginBottom: '2rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Background Image */}
          {backgroundImageUrl && (
            <div style={{ flex: '1', minWidth: '250px', maxWidth: '400px' }}>
              <img
                src={backgroundImageUrl}
                alt={`${eraInfo.name} background`}
                style={{
                  width: '100%',
                  height: '250px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
          )}

          {/* Promotional Image */}
          {promotionalImageUrl && (
            <div style={{ flex: '1', minWidth: '250px', maxWidth: '400px' }}>
              <img
                src={promotionalImageUrl}
                alt={`${eraInfo.name} promotional`}
                style={{
                  width: '100%',
                  height: '250px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
          )}
        </div>

        {/* Description */}
        <p style={{
          fontSize: '1.125rem',
          color: '#4b5563',
          lineHeight: '1.75',
          marginBottom: '2rem'
        }}>
          {eraInfo.promotional?.marketing_description || eraInfo.era_description}
        </p>

        {/* Features */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#0ea5e9',
            marginBottom: '1rem'
          }}>
            What's Included:
          </h3>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            {features.map((feature, index) => (
              <li key={index} style={{
                fontSize: '1rem',
                color: '#374151',
                marginBottom: '0.5rem',
                paddingLeft: '1.5rem',
                position: 'relative'
              }}>
                <span style={{
                  position: 'absolute',
                  left: 0,
                  color: '#10b981'
                }}>✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Payment Method Tabs */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <button
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: purchaseMethod === 'stripe' ? '#0ea5e9' : '#6b7280',
              border: 'none',
              borderBottom: purchaseMethod === 'stripe' ? '2px solid #0ea5e9' : 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              marginBottom: '-2px'
            }}
            onClick={() => setPurchaseMethod('stripe')}
          >
            Credit/Debit Card
          </button>
          <button
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: purchaseMethod === 'voucher' ? '#0ea5e9' : '#6b7280',
              border: 'none',
              borderBottom: purchaseMethod === 'voucher' ? '2px solid #0ea5e9' : 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              marginBottom: '-2px'
            }}
            onClick={() => setPurchaseMethod('voucher')}
          >
            Voucher Code
          </button>
        </div>

        {/* Stripe Payment */}
        {purchaseMethod === 'stripe' && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0ea5e9',
              marginBottom: '1rem'
            }}>
              <span style={{ fontSize: '2rem' }}>{priceInfo?.formatted || '[price unavailable]'}</span>
              <span style={{ fontSize: '1rem', marginLeft: '0.5rem', color: '#6b7280' }}>One-time purchase</span>
            </div>

            <div style={{
              backgroundColor: '#f0f9ff',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: '#0369a1',
                margin: 0,
                marginBottom: '0.75rem'
              }}>
                Secure payment powered by Stripe
              </p>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                fontSize: '0.875rem',
                color: '#075985'
              }}>
                <li style={{ marginBottom: '0.25rem' }}>✓ Instant access after payment</li>
                <li style={{ marginBottom: '0.25rem' }}>✓ No subscription or recurring charges</li>
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

        {/* Voucher Redemption */}
        {purchaseMethod === 'voucher' && (
          <div>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '1rem'
            }}>
              Have a voucher code? Enter it below to unlock this era for free!
            </p>
            
            <input
              type="text"
              placeholder={`Enter voucher code (e.g., ${eraInfo.era || 'midway'}-abc123)`}
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              disabled={isProcessing}
              style={{
                width: '95%',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}
            />

            <button
              onClick={handleVoucherRedemption}
              disabled={isProcessing || !voucherCode.trim()}
              style={{
                width: '95%',
                padding: '1.25rem 2rem',
                fontSize: '1.25rem',
                fontWeight: '600',
                backgroundColor: isProcessing || !voucherCode.trim() ? '#94a3b8' : '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: isProcessing || !voucherCode.trim() ? 'not-allowed' : 'pointer',
                marginBottom: '1rem'
              }}
            >
              {isProcessing ? 'Redeeming...' : 'Redeem Voucher'}
            </button>

            <p style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              margin: 0
            }}>
              Voucher codes are case-sensitive and can only be used once.
            </p>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            color: '#166534',
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid #bbf7d0'
          }}>
            {success}
          </div>
        )}
      </div>

      {/* Footer with Cancel */}
      <div style={{
        padding: '1.5rem 2rem',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <button
          onClick={onCancel}
          disabled={isProcessing}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
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
