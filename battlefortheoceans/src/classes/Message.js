// src/classes/Message.js
// Copyright(c) 2025, Clint H. O'Connor

import MessageHelper from '../utils/MessageHelper.js';

const version = "v0.1.1";

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
    
    // Message types
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
   */
  getCurrentMessages() {
    return {
      console: this.currentMessages.get(this.channels.CONSOLE) || '',
      system: this.currentMessages.get(this.channels.SYSTEM) || '',
      ui: this.currentMessages.get(this.channels.UI) || '',
      turn: this.getCurrentTurnMessage()
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
   */
  post(messageType, data = {}, channels = [this.channels.CONSOLE, this.channels.LOG]) {
    const timestamp = Date.now();
    const turn = this.gameInstance?.currentTurn || 0;
    
    let messageText = '';
    
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
        messageText = data.message || 'Unknown message';
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
    const variables = {
      era: eraName || this.eraConfig?.name || 'Battle',
      players: players?.map(p => p.name).join(' vs ') || 'Unknown players'
    };
    
    return this.getEraMessage('game_start', variables) ||
           `${variables.era} begins! ${variables.players}`;
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
    console.log(`[Message ${version}] ${message}`);
  }
}

export default Message;
// EOF 

