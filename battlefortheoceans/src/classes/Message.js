// src/classes/Message.js
// Copyright(c) 2025, Clint H. O'Connor

import MessageHelper from '../utils/MessageHelper.js';

const version = "v0.1.6";

/**
 * v0.1.6: Fixed turn message not updating on game start
 * - getCurrentMessages() now always uses computed turn message
 * - Ensures messages update correctly when game transitions from setup -> playing
 * - Fixes "Preparing game..." stuck message on PlayingPage entry
 *
 * v0.1.5: Object-to-String Pre-processing
 * - Added comprehensive pre-processing in post() to convert all object types to strings
 * - Handles: players array, winner, attacker, target, opponent objects
 * - Extracts turns/duration from gameStats object
 * - Prevents [object Object] in message display
 *
 * v0.1.4: Players Array Formatting
 * - Fixed players array formatting in post() method
 * - Converts player objects to "Name1 vs Name2" string before variable substitution
 *
 * v0.1.3: Debug logging and game_start fix
 * - Added debug logging to track variable substitution
 * - Fixed generateGameStartMessage to properly format player names
 * - Fixed logging to use [MESSAGE] prefix for debug filter
 *
 * v0.1.2: Progressive Fog of War Message Support
 * - Updated post() to handle era-specific message types directly
 * - Removed hardcoded switch statement that caused "Unknown message"
 * - Now looks up any message type from era config messages
 * - Supports: attack_hit_unknown, attack_hit_size_*, attack_hit_critical, ship_sunk, attack_miss
 * - Falls back to legacy message types for backward compatibility
 */

class Message {
    // All messages in the game must go through the message class to facilitate logging.
    
  constructor(gameInstance, eraConfig) {
    this.gameInstance = gameInstance;
    this.eraConfig = eraConfig;
    this.version = version;
    
    // Message channels/destinations
    this.channels = {
      CONSOLE: 'console',      // Main game console display
      LOG: 'log',              // Game log for replay/email
      SYSTEM: 'system',        // System notifications (errors, connection)
      CHAT: 'chat',            // Player communication (future)
      UI: 'ui'                 // UI state messages (turn indicators)
    };
    
    // Legacy message types (for backward compatibility)
    this.types = {
      HIT: 'hit',
      MISS: 'miss',
      SUNK: 'sunk',
      TURN: 'turn',
      GAME_START: 'game_start',
      GAME_END: 'game_end',
      ERROR: 'error',
      SYSTEM: 'system'
    };
    
    // Current messages for each channel
    this.currentMessages = new Map();
    
    // Message history for log/email
    this.messageHistory = [];
    
    // Message subscribers (UI components)
    this.subscribers = new Set();
    
    this.log('Message system initialized');
  }

  /**
   * Subscribe to message updates (for UI components)
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of message changes
   */
  notifySubscribers() {
    this.subscribers.forEach(callback => {
      try {
        callback(this.getCurrentMessages());
      } catch (error) {
        console.error(version, 'Subscriber notification error:', error);
      }
    });
  }

  /**
   * Get current messages for all channels
   * v0.1.6: Always use computed turn message (not stored UI message)
   *         This ensures messages update correctly when game state changes
   */
  getCurrentMessages() {
    // Always compute turn message from current game state
    // This ensures it updates when game transitions from setup -> playing
    const turnMessage = this.getCurrentTurnMessage();
    
    return {
      console: this.currentMessages.get(this.channels.CONSOLE) || '',
      system: this.currentMessages.get(this.channels.SYSTEM) || '',
      ui: this.currentMessages.get(this.channels.UI) || '',
      turn: turnMessage
    };
  }

  /**
   * Generate turn-based UI message
   */
  getCurrentTurnMessage() {
    if (!this.gameInstance) return 'Initializing game...';
    
    const currentPlayer = this.gameInstance.getCurrentPlayer();
    
    if (this.gameInstance.state === 'finished') {
      const winner = this.gameInstance.winner;
      if (winner?.type === 'human') {
        return this.getEraMessage('victory') || 'Victory! You sank the enemy fleet!';
      } else {
        return this.getEraMessage('defeat') || 'Defeat! Your fleet has been sunk.';
      }
    }

    if (this.gameInstance.state === 'playing') {
      if (currentPlayer?.type === 'human') {
        const gameRules = this.gameInstance.gameRules;
        if (!gameRules.turn_required) {
          return this.getEraMessage('rapid_fire') || 'Rapid Fire! Click to fire continuously!';
        } else {
          return this.getEraMessage('player_turn') || 'Your turn - click to fire!';
        }
      } else {
        const aiName = currentPlayer?.name || 'Opponent';
        return this.getEraMessage('ai_turn', { opponent: aiName }) ||
               `${aiName} is taking their turn...`;
      }
    }

    return this.gameInstance.state === 'setup' ? 'Preparing game...' : 'Game starting...';
  }

  /**
   * Get era-specific message with variable substitution
   */
  getEraMessage(messageKey, variables = {}) {
    if (!this.eraConfig?.messages?.[messageKey]) return null;
    
    return MessageHelper.getGameMessage(
      this.eraConfig,
      messageKey,
      variables
    );
  }

  /**
   * Post message to specific channel(s)
   * v0.1.2: Now handles era-specific message types directly
   */
  post(messageType, data = {}, channels = [this.channels.CONSOLE, this.channels.LOG]) {
    const timestamp = Date.now();
    const turn = this.gameInstance?.currentTurn || 0;
    
    console.log(`[MESSAGE] ${version} post() called - type: ${messageType}, data:`, data);
    
    let messageText = '';
    
    // Pre-process data to ensure proper formatting
    const processedData = { ...data };
    
    // Special handling for players array (convert to string)
    if (processedData.players && Array.isArray(processedData.players)) {
      processedData.players = processedData.players.map(p => p?.name || 'Unknown').join(' vs ');
    }
    
    // Special handling for winner object (convert to name string)
    if (processedData.winner && typeof processedData.winner === 'object') {
      processedData.winner = processedData.winner.name || 'Unknown';
    }
    
    // Special handling for attacker/target objects (convert to name string)
    if (processedData.attacker && typeof processedData.attacker === 'object') {
      processedData.attacker = processedData.attacker.name || 'Unknown';
    }
    if (processedData.target && typeof processedData.target === 'object') {
      processedData.target = processedData.target.name || 'Unknown';
    }
    
    // Special handling for opponent object (convert to name string)
    if (processedData.opponent && typeof processedData.opponent === 'object') {
      processedData.opponent = processedData.opponent.name || 'Opponent';
    }
    
    // Extract gameStats if present
    if (processedData.gameStats) {
      processedData.turns = processedData.gameStats.totalTurns || 0;
      processedData.duration = processedData.gameStats.duration || 0;
    }
    
    // First try to get message from era config (new progressive fog of war messages)
    const eraMessage = this.getEraMessage(messageType, processedData);
    
    console.log(`[MESSAGE] ${version} getEraMessage('${messageType}') returned:`, eraMessage);
    
    if (eraMessage) {
      // Era config has this message type - use it directly
      messageText = eraMessage;
    } else {
      // Fall back to legacy hardcoded message generation
      switch (messageType) {
        case this.types.HIT:
          messageText = this.generateHitMessage(data);
          break;
        case this.types.MISS:
          messageText = this.generateMissMessage(data);
          break;
        case this.types.SUNK:
          messageText = this.generateSunkMessage(data);
          break;
        case this.types.TURN:
          messageText = this.generateTurnMessage(data);
          break;
        case this.types.GAME_START:
          messageText = this.generateGameStartMessage(data);
          break;
        case this.types.GAME_END:
          messageText = this.generateGameEndMessage(data);
          break;
        case this.types.ERROR:
          messageText = data.message || 'An error occurred';
          break;
        case this.types.SYSTEM:
          messageText = data.message || 'System notification';
          break;
        default:
          // Unknown legacy type - log warning
          console.warn(`[Message ${version}] Unknown message type: ${messageType}`);
          messageText = data.message || `[${messageType}]`;
      }
    }

    const messageObject = {
      type: messageType,
      text: messageText,
      timestamp,
      turn,
      data: { ...data }
    };

    // Update current messages for specified channels
    channels.forEach(channel => {
      if (channel === this.channels.CONSOLE || channel === this.channels.UI) {
        this.currentMessages.set(channel, messageText);
      }
    });

    // Always add to history if LOG channel included
    if (channels.includes(this.channels.LOG)) {
      this.messageHistory.push(messageObject);
    }

    // Notify UI subscribers
    this.notifySubscribers();
    
    return messageObject;
  }

  /**
   * Generate hit message using era configuration templates
   * Uses era-specific messages with proper variable substitution
   */
  generateHitMessage({ attacker, target, shipName, position }) {
    const isPlayerAttacking = attacker?.type === 'human';
    
    const variables = {
      cell: position || 'unknown',
      opponent: attacker?.name || 'Opponent',
      ship: shipName || 'Ship'
    };
    
    if (isPlayerAttacking) {
      // Player hits enemy - use attack_hit template (no ship type revealed)
      return this.getEraMessage('attack_hit', variables) ||
             `Fired at ${variables.cell}, HIT!`;
    } else {
      // Enemy hits player - use opponent_attack_hit template
      return this.getEraMessage('opponent_attack_hit', variables) ||
             `${variables.opponent} fired at ${variables.cell}, HIT!`;
    }
  }

  /**
   * Generate miss message using era configuration templates
   */
  generateMissMessage({ attacker, position }) {
    const isPlayerAttacking = attacker?.type === 'human';
    
    const variables = {
      cell: position || 'unknown',
      opponent: attacker?.name || 'Opponent'
    };
    
    if (isPlayerAttacking) {
      return this.getEraMessage('attack_miss', variables) ||
             `Fired at ${variables.cell}, miss.`;
    } else {
      return this.getEraMessage('opponent_attack_miss', variables) ||
             `${variables.opponent} fired at ${variables.cell}, miss.`;
    }
  }

  /**
   * Generate sunk message using era configuration templates
   * Ship type revealed only when sunk
   */
  generateSunkMessage({ attacker, target, shipName, position }) {
    const isPlayerAttacking = attacker?.type === 'human';
    
    const variables = {
      cell: position || 'unknown',
      opponent: attacker?.name || 'Opponent',
      ship: shipName || 'Ship'
    };
    
    if (isPlayerAttacking) {
      // Player sinks enemy ship - use ship_sunk template
      return this.getEraMessage('ship_sunk', variables) ||
             `${variables.ship} SUNK at ${variables.cell}!`;
    } else {
      // Enemy sinks player ship - use opponent_attack_sunk template
      return this.getEraMessage('opponent_attack_sunk', variables) ||
             `${variables.opponent} fired at ${variables.cell}, HIT! ${variables.ship} SUNK!`;
    }
  }

  /**
   * Generate turn message
   */
  generateTurnMessage({ player, turnNumber }) {
    const variables = {
      player: player?.name || 'Unknown',
      turn: turnNumber || 0
    };
    
    return this.getEraMessage('turn_start', variables) ||
           `Turn ${variables.turn}: ${variables.player}'s turn`;
  }

  /**
   * Generate game start message
   */
  generateGameStartMessage({ eraName, players }) {
    // Format players as "Name1 vs Name2"
    let playerNames = 'Unknown players';
    if (players && Array.isArray(players) && players.length > 0) {
      playerNames = players.map(p => p?.name || 'Unknown').join(' vs ');
    }
    
    const variables = {
      era: eraName || this.eraConfig?.name || 'Battle',
      players: playerNames
    };
    
    console.log(`[MESSAGE] ${version} generateGameStartMessage variables:`, variables);
    
    const message = this.getEraMessage('game_start', variables);
    console.log(`[MESSAGE] ${version} getEraMessage result:`, message);
    
    return message || `${variables.era} begins! ${variables.players}`;
  }

  /**
   * Generate game end message
   */
  generateGameEndMessage({ winner, gameStats }) {
    const variables = {
      winner: winner?.name || 'Unknown',
      duration: gameStats?.duration || 0,
      turns: gameStats?.totalTurns || 0
    };
    
    return this.getEraMessage('game_end', variables) ||
           `Game Over! ${variables.winner} wins after ${variables.turns} turns!`;
  }

  /**
   * Get formatted message history for export
   */
  getFormattedHistory() {
    const header = `Game Log: ${this.eraConfig?.name || 'Battleship'}\n` +
                   `Date: ${new Date().toISOString()}\n\n`;
    
    const entries = this.messageHistory.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `[${time}] Turn ${entry.turn}: ${entry.text}`;
    }).join('\n');
    
    return header + entries;
  }

  /**
   * Clear all messages and history
   */
  clear() {
    this.currentMessages.clear();
    this.messageHistory = [];
    this.notifySubscribers();
  }

  /**
   * Logging utility
   */
  log(message) {
    console.log(`[MESSAGE] ${version} ${message}`);
  }
}

export default Message;
// EOF
