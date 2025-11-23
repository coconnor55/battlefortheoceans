// src/utils/ConfigLoader.js
// Copyright(c) 2025, Clint H. O'Connor
// v1.1.4: Consistent era asset loading - all paths use ConfigLoader
//         - Added getEraAssetPath() for relative paths from config files
//         - Added getEraCaptainPath() for captain avatars
//         - Config files now use relative paths (images/, videos/, captains/)
//         - All asset loading goes through ConfigLoader with CDN fallback
// v1.1.3: Added CDN support with automatic fallback to local assets
//         - Added getAssetPath() method to construct CDN or local paths
//         - Updated getEraImagePath(), getEraVideoPath(), getEraShipPath() to use CDN
//         - CDN base URL from REACT_APP_GAME_CDN environment variable
//         - Automatic fallback to /public folder if CDN fails or not configured
// v1.1.2: CDN support with automatic fallback to public assets (documented)
// v1.1.1: Updated for new era-based asset structure
//         - Changed from /assets/ships/{era}/ to /assets/eras/{era}/ships/
//         - Changed from combined ships-{era}.svg to individual ship files
//         - Added loadShipGraphic() for individual ship SVG loading
//         - Added getEraImagePath(), getEraVideoPath(), getEraShipPath() helpers
//         - Removed getShipCellSymbol() methods (no longer using combined SVG symbols)
// v1.1.0: Added ship graphics loading from single SVG file

const version = "v1.1.4";

// CDN base URL from environment variable (bunny.net CDN)
const CDN_BASE_URL = process.env.REACT_APP_GAME_CDN || '';

/**
 * ConfigLoader - Centralized configuration loading utility
 * Loads game-config.json and era configs from /public/config/
 * Provides caching to avoid repeated fetches
 * New in v1.1.3: CDN support with automatic fallback to public assets
 * New in v1.1.1: Era-based asset structure (/assets/eras/{era}/)
 */

class ConfigLoader {
  constructor() {
    this.cache = new Map();
    this.configPath = '/config';
    this.gameConfig = null;
    this.eraList = null;
    this.shipGraphicsCache = new Map(); // Cache loaded ship SVG files
  }

  /**
   * Get asset path with CDN support and fallback
   * Tries CDN first if available, falls back to public folder
   * @param {string} relativePath - Path relative to public folder (e.g., '/assets/eras/traditional/ships/battleship.svg')
   * @returns {string} Full path (CDN or local)
   */
  getAssetPath(relativePath) {
    // Remove leading slash if present for consistency
    const cleanPath = relativePath.startsWitch('/') ? relativePath.slice(1) : relativePath;
    
    // If CDN is configured, use it; otherwise use local path
    if (CDN_BASE_URL) {
      return `${CDN_BASE_URL}/${cleanPath}`;
    }
    
    // Fallback to local public folder
    return `/${cleanPath}`;
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
   * Load individual ship graphic SVG file
   * @param {string} eraId - Era identifier (e.g., 'traditional', 'midway')
   * @param {string} shipClass - Ship class name (e.g., 'battleship', 'carrier')
   * @param {string|null} color - Optional color variant ('red', 'blue', or null for default)
   * @returns {Promise<Document>} Parsed SVG document
   */
  async loadShipGraphic(eraId, shipClass, color = null) {
    // Normalize ship class name (lowercase, hyphenate spaces)
    const normalizedClass = shipClass.toLowerCase().replace(/\s+/g, '-');
    
    // Build filename
    const filename = color
      ? `${normalizedClass}-${color}.svg`
      : `${normalizedClass}.svg`;
    
    const cacheKey = `${eraId}-${filename}`;
    
    if (this.shipGraphicsCache.has(cacheKey)) {
      console.log(`[CONFIG] ${version} Using cached ship graphic: ${filename}`);
      return this.shipGraphicsCache.get(cacheKey);
    }

    try {
      const path = this.getEraShipPath(eraId, normalizedClass, color);
      console.log(`[CONFIG] ${version} Loading ship graphic: ${path}`);
      
      let response = await fetch(path);
      
      // If CDN fails, try fallback to local public folder
      if (!response.ok && CDN_BASE_URL) {
        const fallbackPath = `/assets/eras/${eraId}/ships/${filename}`;
        console.log(`[CONFIG] ${version} CDN failed, trying fallback: ${fallbackPath}`);
        response = await fetch(fallbackPath);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.status}`);
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
      console.log(`[CONFIG] ${version} Ship graphic loaded: ${filename}`);
      
      return svgDoc;
    } catch (error) {
      console.error(`[CONFIG] ${version} Error loading ship graphic:`, error);
      throw error;
    }
  }

  /**
   * Get path to era image asset
   * @param {string} eraId - Era identifier
   * @param {string} filename - Image filename (e.g., 'background.jpg', 'promotional.jpg')
   * @returns {string} Full path to image
   */
  getEraImagePath(eraId, filename) {
    const relativePath = `assets/eras/${eraId}/images/${filename}`;
    return this.getAssetPath(relativePath);
  }

  /**
   * Get path to era video asset
   * @param {string} eraId - Era identifier
   * @param {string} filename - Video filename (e.g., 'victory.mp4', 'defeat.mp4')
   * @returns {string} Full path to video (CDN or local)
   */
  getEraVideoPath(eraId, filename) {
    const relativePath = `assets/eras/${eraId}/videos/${filename}`;
    return this.getAssetPath(relativePath);
  }

  /**
   * Get path to era ship asset
   * @param {string} eraId - Era identifier
   * @param {string} shipClass - Ship class (normalized: lowercase, hyphenated)
   * @param {string|null} color - Optional color variant ('red', 'blue', or null)
   * @returns {string} Full path to ship SVG (CDN or local)
   */
  getEraShipPath(eraId, shipClass, color = null) {
    const filename = color
      ? `${shipClass}-${color}.svg`
      : `${shipClass}.svg`;
    
    const relativePath = `assets/eras/${eraId}/ships/${filename}`;
    return this.getAssetPath(relativePath);
  }

  /**
   * Get path to era captain avatar asset
   * @param {string} eraId - Era identifier
   * @param {string} filename - Captain avatar filename (e.g., 'anne-bonney.webp')
   * @returns {string} Full path to captain avatar (CDN or local)
   */
  getEraCaptainPath(eraId, filename) {
    const relativePath = `assets/eras/${eraId}/captains/${filename}`;
    return this.getAssetPath(relativePath);
  }

  /**
   * Get path to era asset from relative path in config
   * Config files provide relative paths like "images/background.jpg" or "videos/victory.mp4"
   * This method constructs the full path with CDN support
   * @param {string} eraId - Era identifier
   * @param {string} relativePath - Relative path from config (e.g., "images/background.jpg", "captains/anne-bonney.webp")
   * @returns {string} Full path to asset (CDN or local)
   */
  getEraAssetPath(eraId, relativePath) {
    // Remove leading slash if present
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const fullRelativePath = `assets/eras/${eraId}/${cleanPath}`;
    return this.getAssetPath(fullRelativePath);
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
  async loadEraList() {
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
      const eras = await this.loadEraList();
      console.log(`[CONFIG] ${version} Preloading ${eras.length} era configs`);
      
      const promises = eras.map(era => this.loadEraConfig(era.id));
      await Promise.all(promises);
      
      console.log(`[CONFIG] ${version} All era configs preloaded`);
    } catch (error) {
      console.error(`[CONFIG] ${version} Error preloading eras:`, error);
    }
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
