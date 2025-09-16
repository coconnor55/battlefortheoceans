// src/classes/HumanPlayer.js
// Copyright(c) 2025, Clint H. O'Connor

import Player from './Player.js';

const version = "v0.1.0"

class HumanPlayer extends Player {
  constructor(id, name, sessionData = {}) {
    super(id, name, 'human');
    
    // Human-specific properties
    this.sessionId = sessionData.sessionId || null;
    this.isOnline = true;
    this.lastSeen = Date.now();
    
    // UI state
    this.pendingAction = null;
    this.isWaitingForInput = false;
    this.inputTimeout = null;
    
    // Preferences
    this.preferences = {
      autoConfirmShots: false,
      showAnimations: true,
      soundEnabled: true,
      tutorialEnabled: true,
      ...sessionData.preferences
    };
    
    console.log(`HumanPlayer ${this.name} created`);
  }

  /**
   * Human target selection - returns a Promise that resolves when user makes selection
   */
  async selectTarget(gameState, availableTargets, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      this.isWaitingForInput = true;
      this.lastSeen = Date.now();
      
      // Set up timeout
      this.inputTimeout = setTimeout(() => {
        this.isWaitingForInput = false;
        reject(new Error(`Human player ${this.name} timed out waiting for target selection`));
      }, timeoutMs);
      
      // Store resolve function to be called when user clicks
      this.pendingAction = {
        type: 'target-selection',
        resolve: (target) => {
          this.clearPendingAction();
          resolve(target);
        },
        reject: (error) => {
          this.clearPendingAction();
          reject(error);
        },
        availableTargets,
        createdAt: Date.now()
      };
      
      console.log(`HumanPlayer ${this.name} waiting for target selection`);
    });
  }

  /**
   * Handle user click/input for target selection
   */
  handleUserInput(inputType, data) {
    if (!this.pendingAction || !this.isWaitingForInput) {
      console.warn(`HumanPlayer ${this.name}: Unexpected input ${inputType}`);
      return false;
    }

    this.lastSeen = Date.now();

    switch (inputType) {
      case 'cell-click':
        if (this.pendingAction.type === 'target-selection') {
          const { row, col, targetPlayerId } = data;
          
          // Validate target
          const validTarget = this.pendingAction.availableTargets.find(t => t.id === targetPlayerId);
          if (!validTarget) {
            console.warn(`HumanPlayer ${this.name}: Invalid target ${targetPlayerId}`);
            return false;
          }
          
          this.pendingAction.resolve({ player: validTarget, row, col });
          return true;
        }
        break;
        
      case 'cancel':
        this.pendingAction.reject(new Error('User cancelled action'));
        return true;
        
      default:
        console.warn(`HumanPlayer ${this.name}: Unknown input type ${inputType}`);
        return false;
    }
    
    return false;
  }

  /**
   * Clear pending action and timeout
   */
  clearPendingAction() {
    if (this.inputTimeout) {
      clearTimeout(this.inputTimeout);
      this.inputTimeout = null;
    }
    
    this.pendingAction = null;
    this.isWaitingForInput = false;
  }

  /**
   * Human reaction to being attacked (can show notifications)
   */
  onAttacked(attacker, attackResult) {
    super.onAttacked(attacker, attackResult);
    
    // Could trigger UI notifications, sound effects, etc.
    this.lastSeen = Date.now();
    
    if (attackResult.result === 'hit' || attackResult.result === 'sunk') {
      console.log(`HumanPlayer ${this.name}: Ship ${attackResult.ship?.name} ${attackResult.result} by ${attacker.name}!`);
      
      // Trigger UI notification
      this.showNotification({
        type: attackResult.result,
        message: `Your ${attackResult.ship?.name} was ${attackResult.result} by ${attacker.name}!`,
        duration: 3000,
        priority: attackResult.result === 'sunk' ? 'high' : 'normal'
      });
    }
  }

  /**
   * Show notification to human player (to be handled by UI)
   */
  showNotification(notification) {
    // This would be handled by the UI layer
    console.log(`Notification for ${this.name}:`, notification);
    
    // Could emit event for UI to handle
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('player-notification', {
        detail: { player: this, notification }
      }));
    }
  }

  /**
   * Update player preferences
   */
  updatePreferences(newPreferences) {
    this.preferences = { ...this.preferences, ...newPreferences };
    console.log(`HumanPlayer ${this.name} preferences updated`);
  }

  /**
   * Handle player going offline/online
   */
  setOnlineStatus(isOnline) {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      this.lastSeen = Date.now();
      
      if (!isOnline && this.pendingAction) {
        this.pendingAction.reject(new Error('Player went offline'));
      }
      
      console.log(`HumanPlayer ${this.name} is now ${isOnline ? 'online' : 'offline'}`);
    }
  }

  /**
   * Check if player is responsive (for multiplayer timeouts)
   */
  isResponsive() {
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    return this.isOnline && (Date.now() - this.lastSeen) < timeoutMs;
  }

  /**
   * Get human-specific status
   */
  getHumanStatus() {
    return {
      ...this.getStats(),
      sessionId: this.sessionId,
      isOnline: this.isOnline,
      lastSeen: new Date(this.lastSeen).toISOString(),
      isWaitingForInput: this.isWaitingForInput,
      isResponsive: this.isResponsive(),
      preferences: this.preferences,
      pendingAction: this.pendingAction ? {
        type: this.pendingAction.type,
        createdAt: new Date(this.pendingAction.createdAt).toISOString()
      } : null
    };
  }

  /**
   * Reset for new game (preserve preferences)
   */
  reset() {
    super.reset();
    this.clearPendingAction();
    console.log(`HumanPlayer ${this.name} reset for new game`);
  }

  /**
   * Handle disconnection
   */
  disconnect() {
    this.setOnlineStatus(false);
    this.clearPendingAction();
    
    if (this.isActive) {
      console.log(`HumanPlayer ${this.name} disconnected during active game`);
      // Game logic can decide whether to pause, eliminate player, or wait for reconnection
    }
  }

  /**
   * Handle reconnection
   */
  reconnect(sessionData = {}) {
    this.setOnlineStatus(true);
    this.sessionId = sessionData.sessionId || this.sessionId;
    
    if (sessionData.preferences) {
      this.updatePreferences(sessionData.preferences);
    }
    
    console.log(`HumanPlayer ${this.name} reconnected`);
  }

  /**
   * Serialize including human-specific data
   */
  serialize() {
    return {
      ...super.serialize(),
      sessionId: this.sessionId,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      preferences: this.preferences,
      humanStatus: this.getHumanStatus()
    };
  }
}

export default HumanPlayer;
// EOF
