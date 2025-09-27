// src/services/EraService.js
// Copyright(c) 2025, Clint H. O'Connor

import { supabase } from '../utils/supabaseClient';

const version = 'v0.1.2';

class EraService {
  constructor() {
    this.eraCache = new Map(); // Cache eras to avoid repeated API calls
    this.lastFetchTime = null;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
    console.log(`[EraService ${version}] EraService initialized`);
  }

  /**
   * Fetch all available eras from database
   * @returns {Promise<Array>} Array of era configurations
   */
  async getAllEras() {
    try {
      // Check cache first
      if (this.eraCache.size > 0 && this.lastFetchTime &&
          (Date.now() - this.lastFetchTime) < this.cacheExpiry) {
        console.log(`[EraService ${version}] Using cached eras`);
        return Array.from(this.eraCache.values());
      }

      console.log(`[EraService ${version}] Fetching all eras from database`);
      
      const { data, error, status } = await supabase
        .from('era_configs')
        .select('id, config, created_at')
        .order('created_at', { ascending: false });
        
      if (error) {
        throw new Error(`Database error (${status}): ${error.message}`);
      }

      console.log(`[EraService ${version}] Raw data from Supabase:`, data?.length || 0, 'rows');
      
      // Parse and validate era configs
      const parsedEras = [];
      for (const row of (data || [])) {
        try {
          const config = typeof row.config === 'object' ? row.config : JSON.parse(row.config);
          const eraWithId = {
            ...config,
            id: row.id,
            created_at: row.created_at
          };
          
          // Basic validation
          if (this.validateEraConfig(eraWithId)) {
            parsedEras.push(eraWithId);
            this.eraCache.set(row.id, eraWithId); // Cache individual era
          }
        } catch (parseError) {
          console.error(`[EraService ${version}] Error parsing config for era ${row.id}:`, parseError);
        }
      }
      
      this.lastFetchTime = Date.now();
      console.log(`[EraService ${version}] Successfully parsed ${parsedEras.length} eras`);
      
      return parsedEras;
      
    } catch (error) {
      console.error(`[EraService ${version}] Error fetching eras:`, error);
      throw error;
    }
  }

  /**
   * Fetch single era by ID
   * @param {string} eraId - Era identifier
   * @returns {Promise<Object|null>} Era configuration or null
   */
  async getEraById(eraId) {
    try {
      // Check cache first
      if (this.eraCache.has(eraId)) {
        console.log(`[EraService ${version}] Using cached era:`, eraId);
        return this.eraCache.get(eraId);
      }

      console.log(`[EraService ${version}] Fetching era by ID:`, eraId);
      
      const { data, error } = await supabase
        .from('era_configs')
        .select('id, config, created_at')
        .eq('id', eraId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          console.warn(`[EraService ${version}] Era not found:`, eraId);
          return null;
        }
        throw error;
      }

      // Parse configuration
      const config = typeof data.config === 'object' ? data.config : JSON.parse(data.config);
      const eraWithId = {
        ...config,
        id: data.id,
        created_at: data.created_at
      };
      
      // Validate configuration
      if (!this.validateEraConfig(eraWithId)) {
        throw new Error(`Invalid era configuration for ${eraId}`);
      }
      
      // Cache the result
      this.eraCache.set(eraId, eraWithId);
      
      console.log(`[EraService ${version}] Era loaded:`, eraWithId.name);
      return eraWithId;
      
    } catch (error) {
      console.error(`[EraService ${version}] Error fetching era ${eraId}:`, error);
      throw error;
    }
  }

  /**
   * Get promotable eras (those with promotional data)
   * @returns {Promise<Array>} Eras that can be promoted to users
   */
  async getPromotableEras() {
    try {
      const allEras = await this.getAllEras();
      
      const promotableEras = allEras.filter(era => {
        return era.promotional &&
               era.promotional.stripe_price_id &&
               !era.free;
      });
      
      console.log(`[EraService ${version}] Found ${promotableEras.length} promotable eras`);
      return promotableEras;
      
    } catch (error) {
      console.error(`[EraService ${version}] Error getting promotable eras:`, error);
      throw error;
    }
  }

  /**
   * Get free eras (available to all users)
   * @returns {Promise<Array>} Free era configurations
   */
  async getFreeEras() {
    try {
      const allEras = await this.getAllEras();
      const freeEras = allEras.filter(era => era.free === true);
      
      console.log(`[EraService ${version}] Found ${freeEras.length} free eras`);
      return freeEras;
      
    } catch (error) {
      console.error(`[EraService ${version}] Error getting free eras:`, error);
      throw error;
    }
  }

  /**
   * Validate era configuration has required fields
   * @param {Object} eraConfig - Era configuration to validate
   * @returns {boolean} True if valid
   */
  validateEraConfig(eraConfig) {
    const requiredFields = ['name', 'rows', 'cols', 'terrain', 'game_rules'];
    
    for (const field of requiredFields) {
      if (!eraConfig[field]) {
        console.error(`[EraService ${version}] Missing required field '${field}' in era:`, eraConfig.id);
        return false;
      }
    }
    
    // Validate game rules structure
    if (eraConfig.game_rules.turn_required === undefined ||
        eraConfig.game_rules.turn_on_hit === undefined ||
        eraConfig.game_rules.turn_on_miss === undefined) {
      console.error(`[EraService ${version}] Invalid game_rules in era:`, eraConfig.id);
      return false;
    }
    
    return true;
  }

  /**
   * Clear era cache (useful for testing or when configs change)
   */
  clearCache() {
    console.log(`[EraService ${version}] Clearing era cache`);
    this.eraCache.clear();
    this.lastFetchTime = null;
  }

  /**
   * Get cached era without making API call
   * @param {string} eraId - Era identifier
   * @returns {Object|null} Cached era or null
   */
  getCachedEra(eraId) {
    return this.eraCache.get(eraId) || null;
  }

  /**
   * Check if era cache is fresh
   * @returns {boolean} True if cache is valid
   */
  isCacheValid() {
    return this.eraCache.size > 0 &&
           this.lastFetchTime &&
           (Date.now() - this.lastFetchTime) < this.cacheExpiry;
  }

  /**
   * Get cache statistics for debugging
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.eraCache.size,
      lastFetch: this.lastFetchTime ? new Date(this.lastFetchTime).toISOString() : null,
      isValid: this.isCacheValid(),
      expiryTime: this.cacheExpiry / 1000 / 60 + ' minutes'
    };
  }

  /**
   * Get message from era configuration with fallback and interpolation
   * @param {Object} eraConfig - Era configuration containing messages
   * @param {string} messageType - Type of message (victory, defeat, player_win, etc.)
   * @param {Object} context - Context for message interpolation (winner, opponent, etc.)
   * @returns {string} Formatted message
   */
  getMessage(eraConfig, messageType, context = {}) {
    try {
      if (!eraConfig || !eraConfig.messages) {
        return this.getDefaultMessage(messageType, context);
      }

      const messages = eraConfig.messages;
      let message = messages[messageType];

      // Handle array messages (pick random one)
      if (Array.isArray(message)) {
        message = message[Math.floor(Math.random() * message.length)];
      }

      // Fallback to default if message not found
      if (!message) {
        console.warn(`[EraService ${version}] Message type '${messageType}' not found in era ${eraConfig.name}`);
        return this.getDefaultMessage(messageType, context);
      }

      // Interpolate context variables
      return this.interpolateMessage(message, context);
      
    } catch (error) {
      console.error(`[EraService ${version}] Error getting message:`, error);
      return this.getDefaultMessage(messageType, context);
    }
  }

  /**
   * Get game state message (victory, defeat, turn info, etc.)
   * @param {Object} eraConfig - Era configuration
   * @param {Object} gameState - Current game state
   * @returns {string} Appropriate state message
   */
  getGameStateMessage(eraConfig, gameState) {
    const { state, winner, currentPlayer, gameRules } = gameState;

    if (state === 'finished') {
      if (winner?.type === 'human') {
        return this.getMessage(eraConfig, 'victory', { winner, gameState });
      } else {
        return this.getMessage(eraConfig, 'defeat', { winner, gameState });
      }
    }

    if (state === 'playing') {
      if (currentPlayer?.type === 'human') {
        if (!gameRules?.turn_required) {
          return this.getMessage(eraConfig, 'rapid_fire', { currentPlayer });
        } else {
          return this.getMessage(eraConfig, 'player_turn', { currentPlayer });
        }
      } else {
        return this.getMessage(eraConfig, 'ai_turn', {
          opponent: currentPlayer?.name || 'Opponent'
        });
      }
    }

    if (state === 'setup') {
      return this.getMessage(eraConfig, 'game_start', gameState);
    }

    return 'Game in progress...';
  }

  /**
   * Interpolate variables in message strings
   * @param {string} message - Message template with {variable} placeholders
   * @param {Object} context - Variables to substitute
   * @returns {string} Interpolated message
   */
  interpolateMessage(message, context) {
    if (!message || typeof message !== 'string') return message;

    return message.replace(/\{(\w+)\}/g, (match, key) => {
      if (context.hasOwnProperty(key)) {
        const value = context[key];
        // Handle objects by using their name property
        if (value && typeof value === 'object' && value.name) {
          return value.name;
        }
        return String(value);
      }
      return match; // Keep placeholder if no substitution found
    });
  }

  /**
   * Get default message when era config doesn't have specific message
   * @param {string} messageType - Type of message needed
   * @param {Object} context - Context for fallback
   * @returns {string} Default message
   */
  getDefaultMessage(messageType, context = {}) {
    const defaults = {
      'victory': 'Victory! You sank the enemy fleet!',
      'defeat': 'Defeat! Your fleet has been sunk.',
      'player_turn': 'Your turn - click to fire!',
      'ai_turn': 'Opponent is taking their turn...',
      'rapid_fire': 'Rapid Fire! Click to fire continuously!',
      'game_start': 'Battle begins!',
      'player_win': 'Victory! You sank the enemy fleet!',
      'player_lose': 'Defeat! Your fleet has been sunk.',
      'attack_hit': 'Hit!',
      'attack_miss': 'Miss!',
      'ship_sunk': 'Enemy ship sunk!',
      'turn_start': 'Turn {turn}: {player}\'s turn',
      'game_end': 'Game Over! {winner} wins!'
    };

    const defaultMessage = defaults[messageType] || 'Game message';
    return this.interpolateMessage(defaultMessage, context);
  }
}

export default EraService;

// EOF
