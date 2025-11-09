// src/services/StripeService.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.1: Export singleton instance instead of class
//         - Matches pattern of all other services
//         - Services are stateless and should be shared singletons
//         - Simplifies usage in components
// v0.1.0: Initial version

const version = 'v0.1.1';

class StripeService {
  constructor() {
    this.priceCache = new Map(); // Cache prices to avoid repeated API calls
    console.log(`[StripeService ${version}] StripeService initialized`);
  }

  /**
   * Fetch price information from Stripe Price API
   * @param {string} priceId - Stripe price ID (e.g., 'price_1SAnf9FKFdXJ01egovJFaN47')
   * @returns {Promise<{amount: number, currency: string, formatted: string}>}
   */
  async fetchPrice(priceId) {
    if (!priceId) {
      throw new Error('Price ID is required');
    }

    // Check cache first
    if (this.priceCache.has(priceId)) {
      console.log(`[StripeService ${version}] Using cached price for:`, priceId);
      return this.priceCache.get(priceId);
    }

    try {
      console.log(`[StripeService ${version}] Fetching price from Stripe:`, priceId);
      
      // Call your Netlify function to fetch price info
      const response = await fetch('/.netlify/functions/get_price_info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const priceData = await response.json();
      console.log(`[StripeService ${version}] Price data fetched:`, priceData);

      // Format the price for display
      const formatted = this.formatPrice(priceData.unit_amount, priceData.currency);
      
      const result = {
        amount: priceData.unit_amount / 100, // Convert cents to dollars
        currency: priceData.currency,
        formatted: formatted,
        raw: priceData
      };

      // Cache the result
      this.priceCache.set(priceId, result);
      
      return result;
    } catch (error) {
      console.error(`[StripeService ${version}] Error fetching price:`, error);
      
      // Return fallback price to prevent UI breakage
      const fallback = {
        amount: 99.99,
        currency: 'usd',
        formatted: '$99.99',
        error: error.message
      };
      
      console.warn(`[StripeService ${version}] Using fallback price:`, fallback);
      return fallback;
    }
  }

  /**
   * Format price amount for display
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code (e.g., 'usd')
   * @returns {string} Formatted price (e.g., '$4.99')
   */
  formatPrice(amount, currency) {
    const dollars = amount / 100;
    
    // Format based on currency
    switch (currency.toLowerCase()) {
      case 'usd':
        return `$${dollars.toFixed(2)}`;
      case 'eur':
        return `€${dollars.toFixed(2)}`;
      case 'gbp':
        return `£${dollars.toFixed(2)}`;
      default:
        return `${dollars.toFixed(2)} ${currency.toUpperCase()}`;
    }
  }

  /**
   * Clear price cache (useful for testing or when prices change)
   */
  clearCache() {
    console.log(`[StripeService ${version}] Clearing price cache`);
    this.priceCache.clear();
  }

  /**
   * Get cached price without making API call
   * @param {string} priceId - Stripe price ID
   * @returns {Object|null} Cached price data or null
   */
  getCachedPrice(priceId) {
    return this.priceCache.get(priceId) || null;
  }
}

// Export singleton instance (not class)
const stripeServiceSingleton = new StripeService();
export default stripeServiceSingleton;

// EOF
