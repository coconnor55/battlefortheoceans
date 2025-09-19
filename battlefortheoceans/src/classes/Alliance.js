// src/classes/Alliance.js
// Copyright(c) 2025, Clint H. O'Connor

const version = "v0.1.2"

class Alliance {
  constructor(name, owner, avatar = null) {
    this.id = `alliance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.owner = owner; // playerId who owns/controls this alliance
    this.avatar = avatar;
    this.players = []; // array of Player objects
    this.createdAt = Date.now();
  }

  /**
   * Add player to this alliance
   */
  addPlayer(player) {
    if (!player || this.players.includes(player)) {
      return false;
    }
    
    this.players.push(player);
    console.log(`Player ${player.name} added to alliance ${this.name}`);
    return true;
  }

  /**
   * Remove player from this alliance
   */
  removePlayer(player) {
    const index = this.players.indexOf(player);
    if (index === -1) {
      return false;
    }
    
    this.players.splice(index, 1);
    console.log(`Player ${player.name} removed from alliance ${this.name}`);
    return true;
  }

  /**
   * Change the owner of this alliance
   */
  changeOwner(newOwnerId) {
    const previousOwner = this.owner;
    this.owner = newOwnerId;
    console.log(`Alliance ${this.name} ownership changed from ${previousOwner} to ${newOwnerId}`);
    return true;
  }

  /**
   * Get display name for alliance (substitutes player name for single-member alliances)
   */
  getName() {
    // If alliance has exactly one player, use player's name
    if (this.players.length === 1) {
      return this.players[0].name;
    }
    
    // Otherwise use configured alliance name
    return this.name;
  }

  /**
   * Set alliance name (for player-initiated renaming)
   */
  setName(newName) {
    const oldName = this.name;
    this.name = newName;
    console.log(`Alliance renamed from "${oldName}" to "${newName}"`);
    return true;
  }

  /**
   * Check if alliance is defeated - all players eliminated
   */
  isDefeated() {
    return this.players.length === 0 || this.players.every(player => player.isEliminated);
  }

  /**
   * Get alliance statistics
   */
  getStats() {
    return {
      id: this.id,
      name: this.name,
      owner: this.owner,
      playerCount: this.players.length,
      activePlayers: this.players.filter(p => !p.isEliminated).length,
      isDefeated: this.isDefeated()
    };
  }

  /**
   * Create alliance from config
   */
  static fromConfig(config, owner = null) {
    return new Alliance(config.name, owner, config.avatar);
  }
}

export default Alliance;
// EOF
