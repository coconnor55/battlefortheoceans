// src/utils/MessageHelper.js (v0.1.0)
// Copyright(c) 2025, Clint H. O'Connor

/**
 * Utility for handling dynamic messages from era configs
 * Provides random selection and template replacement
 */
class MessageHelper {
  /**
   * Get a random message from an array of messages
   * @param {string|string[]} messages - Single message or array of messages
   * @returns {string} - Selected message
   */
  static getRandomMessage(messages) {
    if (!messages) return '';
    if (typeof messages === 'string') return messages;
    if (Array.isArray(messages) && messages.length > 0) {
      const randomIndex = Math.floor(Math.random() * messages.length);
      return messages[randomIndex];
    }
    return '';
  }

  /**
   * Replace template variables in a message
   * @param {string} message - Message with template variables
   * @param {Object} variables - Object with variable replacements
   * @returns {string} - Message with variables replaced
   */
  static replaceVariables(message, variables = {}) {
    if (!message || typeof message !== 'string') return message;
    
    let result = message;
    
    // Replace all template variables like {opponent}, {ship}, {cell}
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, variables[key] || '');
    });
    
    return result;
  }

  /**
   * Get a formatted message with random selection and variable replacement
   * @param {string|string[]} messages - Message or array of messages
   * @param {Object} variables - Variables to replace in the message
   * @returns {string} - Final formatted message
   */
  static getMessage(messages, variables = {}) {
    const selectedMessage = this.getRandomMessage(messages);
    return this.replaceVariables(selectedMessage, variables);
  }

  /**
   * Get context-appropriate messages for game events
   * @param {Object} eraConfig - Era configuration with messages
   * @param {string} context - Message context (hit, miss, sunk, win, lose, etc.)
   * @param {Object} variables - Variables for template replacement
   * @returns {string} - Formatted message
   */
  static getGameMessage(eraConfig, context, variables = {}) {
    if (!eraConfig?.messages || !context) return '';

    const messages = eraConfig.messages[context];
    return this.getMessage(messages, variables);
  }

  /**
   * Convert column number to Excel-style column letters (A, B, ..., Z, AA, AB, AC, ...)
   * @param {number} col - Column number (0-based)
   * @returns {string} - Excel-style column letters
   */
  static colToExcelLetters(col) {
    let result = '';
    col++; // Convert to 1-based for calculation (Excel columns are 1-based: A=1, B=2, ...)
    
    while (col > 0) {
      col--; // Adjust to 0-based for modulo (A=0, B=1, ..., Z=25)
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26);
    }
    
    return result;
  }

  /**
   * Format a cell coordinate as a readable string (e.g., "A1", "J10", "AA1")
   * @param {number} row - Row number (0-based)
   * @param {number} col - Column number (0-based)
   * @returns {string} - Formatted cell reference
   */
  static formatCell(row, col) {
    const letter = this.colToExcelLetters(col); // Convert to Excel-style: A, B, ..., Z, AA, AB, AC, ...
    const number = row + 1; // Convert to 1-based numbering
    return `${letter}${number}`;
  }

  /**
   * Get a transition message for completing placement
   * @param {Object} eraConfig - Era configuration
   * @returns {string} - Random transition message
   */
  static getTransitionMessage(eraConfig) {
    return this.getGameMessage(eraConfig, 'transition');
  }

  /**
   * Get attack result messages
   * @param {Object} eraConfig - Era configuration
   * @param {string} result - Attack result ('hit', 'miss')
   * @param {number} row - Target row
   * @param {number} col - Target column
   * @param {string} shipName - Name of ship if hit/sunk
   * @returns {string} - Formatted attack message
   */
  static getAttackMessage(eraConfig, result, row, col, shipName = null) {
    const cell = this.formatCell(row, col);
    const variables = { cell, ship: shipName };

    if (result === 'hit') {
      return this.getGameMessage(eraConfig, 'attack_hit', variables);
    } else if (result === 'miss') {
      return this.getGameMessage(eraConfig, 'attack_miss', variables);
    }
    
    return `Fired at ${cell}`;
  }

  /**
   * Get opponent attack messages
   * @param {Object} eraConfig - Era configuration
   * @param {Object} opponent - Opponent data
   * @param {string} result - Attack result
   * @param {number} row - Target row
   * @param {number} col - Target column
   * @param {string} shipName - Name of ship if hit/sunk
   * @returns {string} - Formatted opponent message
   */
  static getOpponentAttackMessage(eraConfig, opponent, result, row, col, shipName = null) {
    const cell = this.formatCell(row, col);
    const variables = {
      opponent: opponent?.name || 'Opponent',
      cell,
      ship: shipName
    };

    if (result === 'hit' && shipName) {
      return this.getGameMessage(eraConfig, 'opponent_attack_sunk', variables);
    } else if (result === 'hit') {
      return this.getGameMessage(eraConfig, 'opponent_attack_hit', variables);
    }
    
    return `${opponent?.name || 'Opponent'} fired at ${cell}, miss.`;
  }

  /**
   * Get win/lose messages
   * @param {Object} eraConfig - Era configuration
   * @param {Object} opponent - Opponent data
   * @param {boolean} playerWon - True if player won
   * @returns {string} - Formatted end game message
   */
  static getEndGameMessage(eraConfig, opponent, playerWon) {
    const variables = { opponent: opponent?.name || 'Opponent' };
    
    if (playerWon) {
      return this.getGameMessage(eraConfig, 'player_win', variables);
    } else {
      return this.getGameMessage(eraConfig, 'player_lose', variables);
    }
  }
}

export default MessageHelper;

// EOF - EOF - EOF
