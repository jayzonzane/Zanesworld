/**
 * Lua Operations Wrappers for Super Mario World
 * Provides compatibility layer between LuaConnectorClient and main application
 * These wrappers match the interface expected by main.js for operations classes
 */

/**
 * LuaGameOperations - Basic game operations wrapper
 * Wraps LuaConnectorClient to match GameOperations interface
 */
class LuaGameOperations {
  constructor(luaClient) {
    this.client = luaClient;
  }

  /**
   * Check if client is connected
   */
  isConnected() {
    return this.client && this.client.isConnected();
  }

  /**
   * Kill the player (Mario dies)
   */
  async killPlayer() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.killPlayer();
  }

  /**
   * Delete all save data (not applicable to SMW, placeholder)
   */
  async deleteAllSaves() {
    console.warn('deleteAllSaves not implemented for SMW Lua connector');
    return { success: false, message: 'Not implemented for SMW' };
  }

  /**
   * Warp to a specific level
   */
  async warpToLevel(levelID) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.warpToLevel(levelID);
  }

  /**
   * Warp to a random level
   */
  async warpToRandomLevel() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.warpToRandomLevel();
  }
}

/**
 * LuaExpandedOperations - Advanced game operations wrapper
 * Wraps LuaConnectorClient to match ExpandedOperations interface
 */
class LuaExpandedOperations {
  constructor(luaClient) {
    this.client = luaClient;
  }

  /**
   * Check if client is connected
   */
  isConnected() {
    return this.client && this.client.isConnected();
  }

  // ========================================================================
  // Resources
  // ========================================================================

  /**
   * Add coins to Mario
   */
  async addCoins(amount = 10) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.addCoins(amount);
  }

  /**
   * Remove coins from Mario
   */
  async removeCoins(amount = 10) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.removeCoins(amount);
  }

  /**
   * Set Mario's coins to exact amount
   */
  async setCoins(amount) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setCoins(amount);
  }

  /**
   * Add lives to Mario
   */
  async addLife(count = 1) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.addLife(count);
  }

  /**
   * Remove lives from Mario
   */
  async removeLife(count = 1) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.removeLife(count);
  }

  // ========================================================================
  // Powerups
  // ========================================================================

  /**
   * Give Super Mushroom (Super Mario)
   */
  async giveMushroom() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.giveMushroom();
  }

  /**
   * Give Fire Flower (Fire Mario)
   */
  async giveFireFlower() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.giveFireFlower();
  }

  /**
   * Give Cape Feather (Cape Mario)
   */
  async giveCapeFeather() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.giveCapeFeather();
  }

  /**
   * Give Starman (invincibility)
   */
  async giveStarman(duration = 20) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.giveStarman(duration);
  }

  /**
   * Remove powerup (revert to Small Mario)
   */
  async removePowerup() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.removePowerup();
  }

  /**
   * Set Mario's powerup directly
   */
  async setMarioPowerup(powerupType) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setMarioPowerup(powerupType);
  }

  // ========================================================================
  // Items & Effects
  // ========================================================================

  /**
   * Activate P-Switch
   */
  async activatePSwitch(duration = 20) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.activatePSwitch(duration);
  }

  /**
   * Activate Silver P-Switch
   */
  async activateSilverPSwitch(duration = 255) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.activateSilverPSwitch(duration);
  }

  /**
   * Spawn Silver P-Switch (requires MarioMod)
   */
  async spawnSilverPSwitch() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnSilverPSwitch();
  }

  // ========================================================================
  // Movement & Speed
  // ========================================================================

  /**
   * Modify Mario's movement speed
   */
  async modifyMarioSpeed(multiplier, duration = 30) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.modifyMarioSpeed(multiplier, duration);
  }

  // ========================================================================
  // Level Warps (aliases for compatibility)
  // ========================================================================

  /**
   * Warp to World 1
   */
  async warpToWorld1() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.warpToWorld1();
  }

  /**
   * Warp to Bowser's Castle
   */
  async warpToBowserCastle() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.warpToBowserCastle();
  }
}

/**
 * LuaHoellOperations - HoellCC operations wrapper
 * Wraps LuaConnectorClient to match HoellOperations interface
 */
class LuaHoellOperations {
  constructor(luaClient) {
    this.client = luaClient;
  }

  /**
   * Check if client is connected
   */
  isConnected() {
    return this.client && this.client.isConnected();
  }

  // ========================================================================
  // Player Control
  // ========================================================================

  /**
   * Freeze Mario in place
   */
  async freezePlayer() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.freezePlayer();
  }

  /**
   * Unfreeze Mario
   */
  async unfreezePlayer() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.unfreezePlayer();
  }

  // ========================================================================
  // Movement
  // ========================================================================

  /**
   * Kick Mario to the right
   */
  async kickRight() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.kickRight();
  }

  /**
   * Kick Mario to the left
   */
  async kickLeft() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.kickLeft();
  }

  /**
   * Kick Mario upward
   */
  async kickUp() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.kickUp();
  }

  /**
   * Push Mario to the right
   */
  async pushRight(speed = 32) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.pushRight(speed);
  }

  /**
   * Push Mario to the left
   */
  async pushLeft(speed = 32) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.pushLeft(speed);
  }

  // ========================================================================
  // Environmental Effects
  // ========================================================================

  /**
   * Enable water physics (permanent)
   */
  async setWaterMode() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setWaterMode();
  }

  /**
   * Disable water physics
   */
  async setLandMode() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setLandMode();
  }

  /**
   * Enable water physics for duration
   */
  async setWaterModeTimed(duration = 30) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setWaterModeTimed(duration);
  }

  /**
   * Enable ice/slippery physics (permanent)
   */
  async setIceMode() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setIceMode();
  }

  /**
   * Disable ice physics
   */
  async setDryMode() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setDryMode();
  }

  /**
   * Enable ice physics for duration
   */
  async setIceModeTimed(duration = 30) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.setIceModeTimed(duration);
  }

  // ========================================================================
  // Enemy Spawning (requires MarioMod)
  // ========================================================================

  /**
   * Spawn random enemy (tileset-aware)
   */
  async spawnRandomEnemy() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnRandomEnemy();
  }

  /**
   * Spawn Green Koopa Troopa
   */
  async spawnGreenKoopa() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnGreenKoopa();
  }

  /**
   * Spawn Red Koopa Troopa
   */
  async spawnRedKoopa() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnRedKoopa();
  }

  /**
   * Spawn Goomba
   */
  async spawnGoomba() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnGoomba();
  }

  /**
   * Spawn Bob-omb
   */
  async spawnBobOmb() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnBobOmb();
  }

  /**
   * Spawn Boo
   */
  async spawnBoo() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnBoo();
  }

  // ========================================================================
  // Items
  // ========================================================================

  /**
   * Activate Silver P-Switch (alias for compatibility)
   */
  async activateSilverPSwitch(duration = 255) {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.activateSilverPSwitch(duration);
  }

  /**
   * Spawn Silver P-Switch (alias for compatibility)
   */
  async spawnSilverPSwitch() {
    if (!this.isConnected()) {
      throw new Error('Lua connector not connected');
    }
    return await this.client.spawnSilverPSwitch();
  }
}

module.exports = {
  LuaGameOperations,
  LuaExpandedOperations,
  LuaHoellOperations
};
