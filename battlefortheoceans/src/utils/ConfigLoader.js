// src/utils/ConfigLoader.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v1.1.0";

/**
 * ConfigLoader - Centralized configuration loading utility
 * Loads game-config.json and era configs from /public/config/
 * Provides caching to avoid repeated fetches
 * v1.1.0: Added ship graphics loading from single SVG file
 */

class ConfigLoader {
  constructor() {
    this.cache = new Map();
    this.configPath = '/config';
    this.gameConfig = null;
    this.eraList = null;
    this.shipGraphicsCache = new Map(); // Cache loaded ship SVG files by era
  }

  /**
   * Load and cache game-config.json
   * @returns {Promise<Object>} Game configuration object
   */
  async loadGameConfig() {
    if (this.gameConfig) {
      console.log(`[CONFIG] ${version} Using cached game-config`);
      return this.gameConfig;
    }

    try {
      console.log(`[CONFIG] ${version} Loading game-config.json`);
      const response = await fetch(`${this.configPath}/game-config.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load game-config.json: ${response.status}`);
      }

      this.gameConfig = await response.json();
      console.log(`[CONFIG] ${version} Game config loaded (v${this.gameConfig.version})`);
      
      return this.gameConfig;
    } catch (error) {
      console.error(`[CONFIG] ${version} Error loading game-config:`, error);
      throw error;
    }
  }

  /**
   * Load ship graphics SVG file for a specific era
   * Parses and caches the SVG document for symbol access
   * @param {string} eraId - Era identifier (e.g., 'traditional', 'midway')
   * @returns {Promise<Document>} Parsed SVG document
   */
  async loadShipGraphics(eraId) {
    const cacheKey = `ships-${eraId}`;
    
    if (this.shipGraphicsCache.has(cacheKey)) {
      console.log(`[CONFIG] ${version} Using cached ship graphics: ${eraId}`);
      return this.shipGraphicsCache.get(cacheKey);
    }

    try {
      console.log(`[CONFIG] ${version} Loading ship graphics: ships-${eraId}.svg`);
      const response = await fetch(`/assets/ships/ships-${eraId}.svg`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ships-${eraId}.svg: ${response.status}`);
      }

      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      
      // Check for parsing errors
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error(`SVG parsing error: ${parserError.textContent}`);
      }

      this.shipGraphicsCache.set(cacheKey, svgDoc);
      console.log(`[CONFIG] ${version} Ship graphics loaded for era: ${eraId}`);
      
      return svgDoc;
    } catch (error) {
      console.error(`[CONFIG] ${version} Error loading ship graphics for ${eraId}:`, error);
      throw error;
    }
  }

  /**
   * Get ship cell symbol ID for rendering
   * @param {string} shipClass - Ship class name (e.g., 'carrier', 'battleship')
   * @param {number} cellIndex - Cell index (0 = stern, n-1 = bow)
   * @returns {string} Symbol ID (e.g., 'carrier-cell-0')
   */
  getShipCellSymbolId(shipClass, cellIndex) {
    // Normalize ship class name (lowercase, hyphenate spaces)
    const normalizedClass = shipClass.toLowerCase().replace(/\s+/g, '-');
    return `${normalizedClass}-cell-${cellIndex}`;
  }

  /**
   * Get ship cell symbol element from loaded SVG
   * @param {string} eraId - Era identifier
   * @param {string} shipClass - Ship class name
   * @param {number} cellIndex - Cell index (0 = stern, n-1 = bow)
   * @returns {Promise<SVGSymbolElement|null>} Symbol element or null if not found
   */
  async getShipCellSymbol(eraId, shipClass, cellIndex) {
    try {
      const svgDoc = await this.loadShipGraphics(eraId);
      const symbolId = this.getShipCellSymbolId(shipClass, cellIndex);
      const symbol = svgDoc.getElementById(symbolId);
      
      if (!symbol) {
        console.warn(`[CONFIG] ${version} Symbol not found: ${symbolId} in era ${eraId}`);
        return null;
      }
      
      return symbol;
    } catch (error) {
      console.error(`[CONFIG] ${version} Error getting ship cell symbol:`, error);
      return null;
    }
  }

  /**
   * Load a specific era configuration
   * @param {string} eraId - Era identifier (e.g., 'traditional', 'midway')
   * @returns {Promise<Object>} Era configuration object
   */
  async loadEraConfig(eraId) {
    const cacheKey = `era-${eraId}`;
    
    if (this.cache.has(cacheKey)) {
      console.log(`[CONFIG] ${version} Using cached era: ${eraId}`);
      return this.cache.get(cacheKey);
    }

    try {
      console.log(`[CONFIG] ${version} Loading era config: ${eraId}`);
      const response = await fetch(`${this.configPath}/era-${eraId}.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load era-${eraId}.json: ${response.status}`);
      }

      const eraConfig = await response.json();
      this.cache.set(cacheKey, eraConfig);
      
      console.log(`[CONFIG] ${version} Era config loaded: ${eraConfig.name} (v${eraConfig.version})`);
      
      return eraConfig;
    } catch (error) {
      console.error(`[CONFIG] ${version} Error loading era ${eraId}:`, error);
      throw error;
    }
  }

  /**
   * List all available eras
   * Scans /public/config/ for era-*.json files
   * @returns {Promise<Array>} Array of era metadata objects
   */
  async listEras() {
    if (this.eraList) {
      console.log(`[CONFIG] ${version} Using cached era list`);
      return this.eraList;
    }

    try {
      console.log(`[CONFIG] ${version} Loading era list`);
      const response = await fetch(`${this.configPath}/era-list.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load era-list.json: ${response.status}`);
      }

      this.eraList = await response.json();
      console.log(`[CONFIG] ${version} Found ${this.eraList.length} eras`);
      
      return this.eraList;
    } catch (error) {
      console.error(`[CONFIG] ${version} Error loading era list:`, error);
      throw error;
    }
  }

  /**
   * Preload all era configs for faster access
   * @returns {Promise<void>}
   */
  async preloadAllEras() {
    try {
      const eras = await this.listEras();
      console.log(`[CONFIG] ${version} Preloading ${eras.length} era configs`);
      
      const promises = eras.map(era => this.loadEraConfig(era.id));
      await Promise.all(promises);
      
      console.log(`[CONFIG] ${version} All era configs preloaded`);
    } catch (error) {
      console.error(`[CONFIG] ${version} Error preloading eras:`, error);
    }
  }

  /**
   * Get ship silhouette path for a specific ship (DEPRECATED)
   * Use getShipCellSymbol() instead for new ship graphics system
   * @deprecated
   */
  getShipSilhouettePath(eraId, shipClass, cellIndex) {
    console.warn(`[CONFIG] ${version} getShipSilhouettePath is deprecated, use getShipCellSymbol instead`);
    if (!this.gameConfig) {
      console.warn(`[CONFIG] ${version} Game config not loaded, using default path`);
      return `/assets/ships/default/${cellIndex}.svg`;
    }

    const template = this.gameConfig.ship_silhouettes?.path_template;
    if (!template) {
      return `/assets/ships/ships-${eraId}.svg#${this.getShipCellSymbolId(shipClass, cellIndex)}`;
    }
    
    const path = template
      .replace('{era}', eraId)
      .replace('{class}', shipClass)
      .replace('{index}', cellIndex);

    return path;
  }

  /**
   * Get defense modifier for a ship class
   * @param {string} shipClass - Ship class name
   * @returns {number} Defense modifier (0.5 = takes 2x damage, 1.5 = takes 0.67x damage)
   */
  getDefenseModifier(shipClass) {
    if (!this.gameConfig) {
      console.warn(`[CONFIG] ${version} Game config not loaded, using 1.0 default`);
      return 1.0;
    }

    return this.gameConfig.defense_modifiers?.[shipClass] || 1.0;
  }

  /**
   * Get size category for a ship size
   * @param {number} size - Ship size (number of cells)
   * @returns {string} Size category ('small', 'medium', 'large')
   */
  getSizeCategory(size) {
    if (!this.gameConfig) {
      console.warn(`[CONFIG] ${version} Game config not loaded`);
      return 'medium';
    }

    const categories = this.gameConfig.size_categories;
    
    for (const [category, sizes] of Object.entries(categories)) {
      if (sizes.includes(size)) {
        return category;
      }
    }

    return 'medium'; // Default fallback
  }

  /**
   * Clear all cached configs (for testing/development)
   */
  clearCache() {
    console.log(`[CONFIG] ${version} Clearing config cache`);
    this.cache.clear();
    this.gameConfig = null;
    this.eraList = null;
    this.shipGraphicsCache.clear();
  }

  /**
   * Get game config value by path (e.g., 'animations.shot_animation')
   * @param {string} path - Dot-notation path to config value
   * @param {*} defaultValue - Default value if path not found
   * @returns {*} Config value
   */
  getConfigValue(path, defaultValue = null) {
    if (!this.gameConfig) {
      console.warn(`[CONFIG] ${version} Game config not loaded`);
      return defaultValue;
    }

    const parts = path.split('.');
    let value = this.gameConfig;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue;
      }
    }

    return value;
  }
}

// Export singleton instance
const configLoader = new ConfigLoader();

export default configLoader;

// Also export class for testing
export { ConfigLoader };

// EOF
