/**
 * Super Mario World Operations
 *
 * Complete SMW operations manager with 120+ methods organized into 13 categories:
 * - Power-Up Management, Environmental Physics, Speed Control, Physics Chaos,
 * - Basic Enemy Spawning, MarioMod Enemy Spawning, Power-Up Spawning,
 * - Helper Item Spawning, Level Navigation, Kaizo Operations, Chaos Effects,
 * - Silver P-Switch, and Cleanup utilities.
 *
 * Requires:
 * - SNI client connection
 * - MarioMod ASM patch for advanced operations
 *
 * @module operations-smw
 * @requires ./memory-complete
 * @requires ./mariomod-spawner
 *
 * @example
 * const SMWOperations = require('./operations-smw');
 * const smwOps = new SMWOperations(sniClient);
 * await smwOps.giveMushroom();
 * await smwOps.moonJump(30);
 */

const { MEMORY_ADDRESSES, POWERUP_TYPES, RESERVE_ITEMS, YOSHI_COLORS, SPRITE_TYPES, GAME_MODES, CONTROLLER_BUTTONS } = require('./memory-complete');
const MarioModSpawner = require('./mariomod-spawner');
const logger = require('../utils/logger');

// Physics Constants
const PHYSICS_MODIFIERS = {
  HALF_SPEED: 0.5,
  DOUBLE_SPEED: 3.0,
  MOON_JUMP_MULTIPLIER: 2.0,
  TINY_JUMP_MULTIPLIER: 0.3,
  LOW_GRAVITY: 0.5,
  HIGH_GRAVITY: 1.5,
  ICE_FRICTION: 0.98
};

// Timer Constants (in seconds)
const TIMER_DURATIONS = {
  DEFAULT_EFFECT: 30,
  SHORT_EFFECT: 10,
  MEDIUM_EFFECT: 20,
  LONG_EFFECT: 60
};

// Pixel Offsets for Spawn Positions
const SPAWN_OFFSETS = {
  CLOSE: 8,
  NEAR: 16,
  MEDIUM: 32,
  FAR: 48,
  VERY_FAR: 64,
  EXTREME: 80,
  BULLET_DISTANCE: 96,
  CIRCLE_RADIUS: 64
};

// Speed Values (signed bytes for SNES memory)
const SPEED_VALUES = {
  KICK_RIGHT_X: 64,
  KICK_LEFT_X: 192,
  KICK_UP_Y: 192,
  KICK_Y: 224,
  PUSH_DEFAULT: 32,
  RUN_MIN: 32,
  RUN_FORCED: 40,
  WALK_MAX: 16,
  P_METER_FULL: 112
};

// Miscellaneous Constants
const MISC_CONSTANTS = {
  MAX_SPRITE_SLOTS: 12,
  MAX_OAM_SPRITES: 128,
  SPRITE_INVISIBLE_Y: 240,
  MAX_KAIZO_BLOCKS: 100,
  KAIZO_TIMEOUT: 10000,
  SNI_DELAY_MS: 50
};

/**
 * SMWOperations class - Provides comprehensive Super Mario World game manipulation
 *
 * @class SMWOperations
 */
class SMWOperations {
  /**
   * Create an SMWOperations instance
   *
   * @param {SNIClient} sniClient - Connected SNI client instance
   */
  constructor(sniClient) {
    this.sniClient = sniClient;
    this.client = sniClient; // Alias for compatibility
    this.spawner = new MarioModSpawner(sniClient);
    this.activeTimers = new Map();

    // HoellCC memory addresses
    this.ADDR_UNDERWATER_FLAG = 0x7E0085;
    this.ADDR_ICE_FLAG = 0x7E0086;
    this.ADDR_PLAYER_FROZEN = 0x7E0088;
    this.ADDR_PLAYER_X_SPEED = 0x7E007B;
    this.ADDR_PLAYER_Y_SPEED = 0x7E007D;
    this.ADDR_PSWITCH_TIMER = 0x7E14AD;
    this.ADDR_CAMERA_X = 0x7E1462;
    this.ADDR_PLAYER_ANIMATION = 0x7E0071;
    this.ADDR_SILVER_PSWITCH_TIMER = 0x7E14AE;
    this.MARIOMOD_KAIZO_BLOCK_TRIGGER = 0x7E1DEF;
    this.MARIOMOD_SPRITE_REPLACE_TRIGGER = 0x7E1DF0;
  }

  // ============================================================================
  // SECTION 1: HELPER METHODS
  // ============================================================================

  /**
   * Read memory with automatic retry on failure
   *
   * @param {number} address - Memory address to read from
   * @param {number} length - Number of bytes to read
   * @param {number} attempts - Maximum retry attempts
   * @returns {Promise<Buffer>} Memory data as Buffer
   * @throws {Error} After all retry attempts fail
   *
   * @example
   * const data = await smwOps.readWithRetry(0x7E0019, 1, 3);
   */
  async readWithRetry(address, length, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.sniClient.readMemory(address, length);
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Write memory with automatic retry on failure
   *
   * @param {number} address - Memory address to write to
   * @param {Buffer} data - Data to write
   * @param {number} attempts - Maximum retry attempts
   * @returns {Promise<void>}
   * @throws {Error} After all retry attempts fail
   *
   * @example
   * await smwOps.writeWithRetry(0x7E0019, Buffer.from([0x01]));
   */
  async writeWithRetry(address, data, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.sniClient.writeMemory(address, data);
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Get Mario's current position in the level
   *
   * @returns {Promise<{x: number, y: number}>} Mario's position as 16-bit coordinates
   *
   * @example
   * const pos = await smwOps.getMarioPosition();
   * console.log(`Mario at (${pos.x}, ${pos.y})`);
   */
  async getMarioPosition() {
    try {
      const xLow = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_POSITION, 1);
      const yLow = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_POSITION, 1);
      const xHigh = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_POSITION + 1, 1);
      const yHigh = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_POSITION + 1, 1);

      return {
        x: (xHigh[0] << 8) | xLow[0],
        y: (yHigh[0] << 8) | yLow[0]
      };
    } catch (error) {
      logger.error('[getMarioPosition] Error:', error.message);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Find the first available empty sprite slot
   *
   * @returns {Promise<number>} Sprite slot index (0-11) or -1 if all slots occupied
   *
   * @example
   * const slot = await smwOps.findEmptySpriteSlot();
   * if (slot !== -1) console.log(`Found empty slot: ${slot}`);
   */
  async findEmptySpriteSlot() {
    try {
      const statusArray = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS, MISC_CONSTANTS.MAX_SPRITE_SLOTS);
      for (let i = 0; i < MISC_CONSTANTS.MAX_SPRITE_SLOTS; i++) {
        if (statusArray[i] === 0x00) {
          return i;
        }
      }
      return -1;
    } catch (error) {
      logger.error('[findEmptySpriteSlot] Error:', error.message);
      return -1;
    }
  }

  /**
   * Spawn a sprite at a specific position
   *
   * @param {number} spriteType - Sprite type ID (see SPRITE_TYPES)
   * @param {number} x - X coordinate (16-bit)
   * @param {number} y - Y coordinate (16-bit)
   * @param {number|null} slotIndex - Optional sprite slot, auto-finds if null
   * @returns {Promise<number|boolean>} Sprite slot index on success, false on failure
   *
   * @example
   * await smwOps.spawnSpriteAtPosition(SPRITE_TYPES.GOOMBA, 100, 200);
   */
  async spawnSpriteAtPosition(spriteType, x, y, slotIndex = null) {
    try {
      if (slotIndex === null) {
        slotIndex = await this.findEmptySpriteSlot();
      }

      if (slotIndex === -1) {
        logger.debug('[spawnSpriteAtPosition] No empty sprite slots available');
        return false;
      }

      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_TYPE + slotIndex, Buffer.from([spriteType]));

      const xLow = x & 0xFF;
      const xHigh = (x >> 8) & 0xFF;
      const yLow = y & 0xFF;
      const yHigh = (y >> 8) & 0xFF;

      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_X_LOW + slotIndex, Buffer.from([xLow]));
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_X_HIGH + slotIndex, Buffer.from([xHigh]));
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_Y_LOW + slotIndex, Buffer.from([yLow]));
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_Y_HIGH + slotIndex, Buffer.from([yHigh]));

      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS + slotIndex, Buffer.from([0x08]));

      logger.debug(`[spawnSpriteAtPosition] Spawned sprite type ${spriteType} at slot ${slotIndex}, position (${x}, ${y})`);
      return slotIndex;
    } catch (error) {
      logger.error('[spawnSpriteAtPosition] Error:', error.message);
      return false;
    }
  }

  // ============================================================================
  // SECTION 2: POWER-UP MANAGEMENT (Direct Memory)
  // Source: operations-working.js (preferred for direct memory manipulation)
  // ============================================================================

  /**
   * Set Mario's current power-up state
   *
   * @param {number} powerupType - Power-up type (see POWERUP_TYPES constants)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.setMarioPowerup(POWERUP_TYPES.FIRE);
   */
  async setMarioPowerup(powerupType) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.POWERUP_STATUS, Buffer.from([powerupType]));
      logger.debug(`[setMarioPowerup] Set power-up to ${powerupType}`);
      return true;
    } catch (error) {
      logger.error('[setMarioPowerup] Error:', error.message);
      return false;
    }
  }

  /**
   * Give Mario a Mushroom power-up
   * Upgrades Small Mario to Super, or adds to reserve if already Super
   *
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.giveMushroom();
   */
  async giveMushroom() {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.POWERUP_STATUS, 1);
      if (current[0] === POWERUP_TYPES.SMALL) {
        await this.setMarioPowerup(POWERUP_TYPES.SUPER);
        logger.debug('[giveMushroom] Upgraded Small Mario to Super Mario');
      } else {
        await this.writeWithRetry(MEMORY_ADDRESSES.RESERVE_ITEM, Buffer.from([RESERVE_ITEMS.MUSHROOM]));
        logger.debug('[giveMushroom] Added mushroom to reserve');
      }
      return true;
    } catch (error) {
      logger.error('[giveMushroom] Error:', error.message);
      return false;
    }
  }

  /**
   * Give Mario a Fire Flower power-up
   *
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.giveFireFlower();
   */
  async giveFireFlower() {
    try {
      await this.setMarioPowerup(POWERUP_TYPES.FIRE);
      logger.debug('[giveFireFlower] Gave Fire Flower');
      return true;
    } catch (error) {
      logger.error('[giveFireFlower] Error:', error.message);
      return false;
    }
  }

  /**
   * Give Mario a Cape Feather power-up
   *
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.giveCapeFeather();
   */
  async giveCapeFeather() {
    try {
      await this.setMarioPowerup(POWERUP_TYPES.CAPE);
      logger.debug('[giveCapeFeather] Gave Cape Feather');
      return true;
    } catch (error) {
      logger.error('[giveCapeFeather] Error:', error.message);
      return false;
    }
  }

  /**
   * Give Mario invincibility (Star power)
   *
   * @param {number} duration - Duration in seconds (default 20)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.giveStarman(30);
   */
  async giveStarman(duration = 20) {
    try {
      const starDuration = Math.min(duration * 4, 255);
      await this.writeWithRetry(MEMORY_ADDRESSES.INVINCIBILITY_TIMER, Buffer.from([starDuration]));
      logger.debug(`[giveStarman] Gave star power for ${duration} seconds`);
      return true;
    } catch (error) {
      logger.error('[giveStarman] Error:', error.message);
      return false;
    }
  }

  /**
   * Remove Mario's power-up (revert to Small Mario)
   *
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.removePowerup();
   */
  async removePowerup() {
    try {
      await this.setMarioPowerup(POWERUP_TYPES.SMALL);
      logger.debug('[removePowerup] Removed power-up (now Small Mario)');
      return true;
    } catch (error) {
      logger.error('[removePowerup] Error:', error.message);
      return false;
    }
  }

  /**
   * Activate a P-Switch
   *
   * @param {number} duration - Duration in seconds (default 20)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.activatePSwitch(30);
   */
  async activatePSwitch(duration = 20) {
    try {
      const pSwitchDuration = Math.min(duration * 4, 255);
      await this.writeWithRetry(MEMORY_ADDRESSES.P_SWITCH_TIMER, Buffer.from([pSwitchDuration]));
      logger.debug(`[activatePSwitch] Activated P-Switch for ${duration} seconds`);
      return true;
    } catch (error) {
      logger.error('[activatePSwitch] Error:', error.message);
      return false;
    }
  }

  /**
   * Give Mario a Yoshi
   *
   * @param {number} color - Yoshi color (see YOSHI_COLORS constants, default GREEN)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.giveYoshi(YOSHI_COLORS.RED);
   */
  async giveYoshi(color = YOSHI_COLORS.GREEN) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.YOSHI_COLOR, Buffer.from([color]));
      await this.writeWithRetry(0x7E187A, Buffer.from([0x01]));
      logger.debug(`[giveYoshi] Gave ${Object.keys(YOSHI_COLORS)[color]} Yoshi - Mario should now be riding Yoshi`);
      return true;
    } catch (error) {
      logger.error('[giveYoshi] Error:', error.message);
      return false;
    }
  }

  /**
   * Remove Mario's Yoshi
   *
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.removeYoshi();
   */
  async removeYoshi() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.YOSHI_COLOR, Buffer.from([0xFF]));
      logger.debug('[removeYoshi] Removed Yoshi');
      return true;
    } catch (error) {
      logger.error('[removeYoshi] Error:', error.message);
      return false;
    }
  }

  /**
   * Set Mario's reserve item box
   *
   * @param {number} itemType - Reserve item type (see RESERVE_ITEMS constants)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.giveReserveItem(RESERVE_ITEMS.FEATHER);
   */
  async giveReserveItem(itemType = RESERVE_ITEMS.MUSHROOM) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.RESERVE_ITEM, Buffer.from([itemType]));
      logger.debug(`[giveReserveItem] Set reserve item to ${itemType}`);
      return true;
    } catch (error) {
      logger.error('[giveReserveItem] Error:', error.message);
      return false;
    }
  }

  /**
   * Clear Mario's reserve item box
   *
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.clearReserveItem();
   */
  async clearReserveItem() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.RESERVE_ITEM, Buffer.from([RESERVE_ITEMS.NONE]));
      logger.debug('[clearReserveItem] Cleared reserve item');
      return true;
    } catch (error) {
      logger.error('[clearReserveItem] Error:', error.message);
      return false;
    }
  }

  // ============================================================================
  // SECTION 3: LIVES & COINS (Direct Memory)
  // Source: operations-expanded.js (preferred for dual-address writes)
  // ============================================================================

  /**
   * Add lives to Mario's life counter
   *
   * @param {number} count - Number of lives to add (default 1, max 99)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.addLife(5);
   */
  async addLife(count = 1) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.LIVES, 1);
      const newLives = Math.min(current[0] + count, 99);
      await this.writeWithRetry(MEMORY_ADDRESSES.LIVES, Buffer.from([newLives]));
      await this.writeWithRetry(0x7E0DBE, Buffer.from([newLives]));
      logger.debug(`[addLife] Added ${count} life/lives (now ${newLives})`);
      return true;
    } catch (error) {
      logger.error('[addLife] Error:', error.message);
      return false;
    }
  }

  /**
   * Remove lives from Mario's life counter
   *
   * @param {number} count - Number of lives to remove (default 1, min 0)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.removeLife(2);
   */
  async removeLife(count = 1) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.LIVES, 1);
      const newLives = Math.max(current[0] - count, 0);
      await this.writeWithRetry(MEMORY_ADDRESSES.LIVES, Buffer.from([newLives]));
      await this.writeWithRetry(0x7E0DBE, Buffer.from([newLives]));
      logger.debug(`[removeLife] Removed ${count} life/lives (now ${newLives})`);
      return true;
    } catch (error) {
      logger.error('[removeLife] Error:', error.message);
      return false;
    }
  }

  /**
   * Add coins to Mario's coin counter
   * Automatically grants 1-ups when reaching 100 coins
   *
   * @param {number} amount - Number of coins to add (default 10)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.addCoins(50);
   */
  async addCoins(amount = 10) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.COINS, 1);
      let newCoins = current[0] + amount;

      while (newCoins >= 100) {
        await this.addLife(1);
        newCoins -= 100;
      }

      await this.writeWithRetry(MEMORY_ADDRESSES.COINS, Buffer.from([newCoins]));
      logger.debug(`[addCoins] Added ${amount} coins (now ${newCoins})`);
      return true;
    } catch (error) {
      logger.error('[addCoins] Error:', error.message);
      return false;
    }
  }

  /**
   * Remove coins from Mario's coin counter
   *
   * @param {number} amount - Number of coins to remove (default 10, min 0)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.removeCoins(25);
   */
  async removeCoins(amount = 10) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.COINS, 1);
      const newCoins = Math.max(current[0] - amount, 0);
      await this.writeWithRetry(MEMORY_ADDRESSES.COINS, Buffer.from([newCoins]));
      logger.debug(`[removeCoins] Removed ${amount} coins (now ${newCoins})`);
      return true;
    } catch (error) {
      logger.error('[removeCoins] Error:', error.message);
      return false;
    }
  }

  // ============================================================================
  // SECTION 4: LEVEL WARPING (Direct Memory)
  // Source: operations-working.js (clean implementation)
  // ============================================================================

  async warpToLevel(levelID) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.TRANSLEVEL_NUMBER, Buffer.from([levelID]));
      logger.debug(`[warpToLevel] Warped to level ${levelID.toString(16)}`);
      return true;
    } catch (error) {
      logger.error('[warpToLevel] Error:', error.message);
      return false;
    }
  }

  async warpToWorld1() { return await this.warpToLevel(0x101); }
  async warpToWorld2() { return await this.warpToLevel(0x102); }
  async warpToWorld3() { return await this.warpToLevel(0x103); }
  async warpToWorld4() { return await this.warpToLevel(0x104); }
  async warpToWorld5() { return await this.warpToLevel(0x105); }
  async warpToWorld6() { return await this.warpToLevel(0x106); }
  async warpToWorld7() { return await this.warpToLevel(0x107); }

  async warpToSpecialWorld() { return await this.warpToLevel(0x109); }

  async warpToBowserCastle() { return await this.warpToLevel(0x1D7); }

  async warpToRandomLevel() {
    const levels = [0x101, 0x102, 0x103, 0x104, 0x105, 0x106, 0x107, 0x109];
    const randomLevel = levels[Math.floor(Math.random() * levels.length)];
    return await this.warpToLevel(randomLevel);
  }

  async warpToGhostHouse() {
    return await this.warpToLevel(0x14);
  }

  async forceSecretExit() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.EXIT_TYPE, Buffer.from([0x01]));
      logger.debug('[forceSecretExit] Set exit type to secret');
      return true;
    } catch (error) {
      logger.error('[forceSecretExit] Error:', error.message);
      return false;
    }
  }

  async setCheckpoint() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.CHECKPOINT_FLAG, Buffer.from([0x01]));
      logger.debug('[setCheckpoint] Set midpoint checkpoint');
      return true;
    } catch (error) {
      logger.error('[setCheckpoint] Error:', error.message);
      return false;
    }
  }

  async clearCheckpoint() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.CHECKPOINT_FLAG, Buffer.from([0x00]));
      logger.debug('[clearCheckpoint] Cleared checkpoint');
      return true;
    } catch (error) {
      logger.error('[clearCheckpoint] Error:', error.message);
      return false;
    }
  }

  async returnToWorldMap() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.GAME_MODE, Buffer.from([GAME_MODES.OVERWORLD]));
      logger.debug('[returnToWorldMap] Returned to overworld');
      return true;
    } catch (error) {
      logger.error('[returnToWorldMap] Error:', error.message);
      return false;
    }
  }

  // ============================================================================
  // SECTION 5: PHYSICS CHAOS (Speed/Jump/Gravity)
  // Source: operations-working.js (superior implementation with bounds checking)
  // ============================================================================

  /**
   * Modify Mario's horizontal movement speed
   *
   * @param {number} multiplier - Speed multiplier (0.5 = half speed, 2.0 = double speed)
   * @param {number} duration - Duration in seconds (default 30)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.modifyMarioSpeed(2.0, 60);
   */
  async modifyMarioSpeed(multiplier, duration = 30) {
    try {
      logger.debug(`[modifyMarioSpeed] Modifying speed by ${multiplier}x for ${duration} seconds`);

      const interval = setInterval(async () => {
        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;

        if (Math.abs(speed) > 0 && Math.abs(speed) < 8) {
          speed = speed > 0 ? 16 : -16;
        }

        speed = Math.floor(speed * multiplier);
        speed = Math.max(-128, Math.min(127, speed));

        await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
      }, 16);

      this.activeTimers.set('speedMod', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('speedMod');
        logger.debug('[modifyMarioSpeed] Speed modifier ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[modifyMarioSpeed] Error:', error.message);
      return false;
    }
  }

  /**
   * Slow Mario's movement to half speed
   *
   * @param {number} duration - Duration in seconds (default 30)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.halfSpeed(45);
   */
  async halfSpeed(duration = 30) {
    return await this.modifyMarioSpeed(PHYSICS_MODIFIERS.HALF_SPEED, duration);
  }

  /**
   * Increase Mario's movement to triple speed
   *
   * @param {number} duration - Duration in seconds (default 30)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.doubleSpeed(30);
   */
  async doubleSpeed(duration = 30) {
    return await this.modifyMarioSpeed(PHYSICS_MODIFIERS.DOUBLE_SPEED, duration);
  }

  /**
   * Modify Mario's jump height
   *
   * @param {number} multiplier - Jump height multiplier (0.3 = tiny, 2.0 = moon jump)
   * @param {number} duration - Duration in seconds (default 30)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.modifyJumpHeight(2.5, 60);
   */
  async modifyJumpHeight(multiplier, duration = 30) {
    try {
      logger.debug(`[modifyJumpHeight] Modifying jump height by ${multiplier}x for ${duration} seconds`);

      const interval = setInterval(async () => {
        const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, 1);
        let speed = ySpeed[0] << 24 >> 24;

        if (speed < 0) {
          speed = Math.floor(speed * multiplier);
          speed = Math.max(-128, Math.min(0, speed));
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16);

      this.activeTimers.set('jumpMod', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('jumpMod');
        logger.debug('[modifyJumpHeight] Jump modifier ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[modifyJumpHeight] Error:', error.message);
      return false;
    }
  }

  /**
   * Enable moon jump (high jump with screen-top cap)
   *
   * @param {number} duration - Duration in seconds (default 30)
   * @returns {Promise<boolean>} Success status
   *
   * @example
   * await smwOps.moonJump(60);
   */
  async moonJump(duration = 30) {
    try {
      logger.debug(`[moonJump] Moon jump for ${duration} seconds - caps at screen top`);

      const interval = setInterval(async () => {
        const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, 1);
        const yScreen = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SCREEN, 1);
        let speed = ySpeed[0] << 24 >> 24;
        let yPos = yScreen[0];

        if (yPos < 16) {
          speed = 8;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        } else if (speed < 0) {
          speed = Math.floor(speed * 2.0);
          speed = Math.max(-128, Math.min(0, speed));
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16);

      this.activeTimers.set('jumpMod', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('jumpMod');
        logger.debug('[moonJump] Moon jump ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[moonJump] Error:', error.message);
      return false;
    }
  }

  async tinyJump(duration = 30) {
    return await this.modifyJumpHeight(0.3, duration);
  }

  async modifyGravity(multiplier, duration = 30) {
    try {
      logger.debug(`[modifyGravity] Modifying gravity by ${multiplier}x for ${duration} seconds`);

      const interval = setInterval(async () => {
        const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, 1);
        let speed = ySpeed[0] << 24 >> 24;

        if (speed > 0) {
          speed = Math.floor(speed * multiplier);
          speed = Math.max(0, Math.min(127, speed));
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16);

      this.activeTimers.set('gravityMod', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('gravityMod');
        logger.debug('[modifyGravity] Gravity modifier ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[modifyGravity] Error:', error.message);
      return false;
    }
  }

  async lowGravity(duration = 30) {
    return await this.modifyGravity(0.5, duration);
  }

  async highGravity(duration = 30) {
    return await this.modifyGravity(1.5, duration);
  }

  async reverseControls(duration = 20) {
    try {
      logger.debug(`[reverseControls] Reversing controls for ${duration} seconds`);

      const interval = setInterval(async () => {
        const controller = await this.readWithRetry(MEMORY_ADDRESSES.CONTROLLER_1_CURRENT, 1);
        const buttons = controller[0];
        const pressingLeft = (buttons & CONTROLLER_BUTTONS.LEFT) !== 0;
        const pressingRight = (buttons & CONTROLLER_BUTTONS.RIGHT) !== 0;

        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;

        if (pressingRight && speed > 0) {
          speed = -speed;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        } else if (pressingLeft && speed < 0) {
          speed = -speed;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16);

      this.activeTimers.set('reverseControls', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('reverseControls');
        logger.debug('[reverseControls] Controls restored');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[reverseControls] Error:', error.message);
      return false;
    }
  }

  async enableIcePhysics(duration = 30) {
    try {
      logger.debug(`[enableIcePhysics] Enabling ice physics for ${duration} seconds`);

      const interval = setInterval(async () => {
        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;

        if (Math.abs(speed) > 2) {
          speed = Math.floor(speed * 0.98);
        }

        await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
      }, 16);

      this.activeTimers.set('icePhysics', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('icePhysics');
        logger.debug('[enableIcePhysics] Ice physics ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[enableIcePhysics] Error:', error.message);
      return false;
    }
  }

  async disableRunning(duration = 20) {
    try {
      logger.debug(`[disableRunning] Disabling running for ${duration} seconds`);

      const interval = setInterval(async () => {
        await this.writeWithRetry(MEMORY_ADDRESSES.P_METER, Buffer.from([0x00]));

        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;
        if (Math.abs(speed) > 16) {
          speed = speed > 0 ? 16 : -16;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 8);

      this.activeTimers.set('disableRunning', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('disableRunning');
        logger.debug('[disableRunning] Running re-enabled');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[disableRunning] Error:', error.message);
      return false;
    }
  }

  async forceContinuousRun(duration = 20) {
    try {
      logger.debug(`[forceContinuousRun] Forcing continuous run for ${duration} seconds`);

      const interval = setInterval(async () => {
        await this.writeWithRetry(MEMORY_ADDRESSES.P_METER, Buffer.from([112]));

        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;
        if (Math.abs(speed) > 0 && Math.abs(speed) < 32) {
          speed = speed > 0 ? 40 : -40;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 8);

      this.activeTimers.set('forceContinuousRun', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('forceContinuousRun');
        logger.debug('[forceContinuousRun] Forced run ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[forceContinuousRun] Error:', error.message);
      return false;
    }
  }

  async randomPhysicsChaos(duration = 30) {
    logger.debug(`[randomPhysicsChaos] Starting chaos for ${duration} seconds - switching effects every 3-5s`);

    let lastEffect = null;
    let currentTimer = null;
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);

    const pickRandomEffect = () => {
      const physicsMods = [
        'halfSpeed',
        'doubleSpeed',
        'moonJump',
        'tinyJump',
        'lowGravity',
        'highGravity',
        'enableIcePhysics'
      ];

      let newEffect;
      do {
        newEffect = physicsMods[Math.floor(Math.random() * physicsMods.length)];
      } while (newEffect === lastEffect && physicsMods.length > 1);

      lastEffect = newEffect;
      return newEffect;
    };

    const applyNextEffect = async () => {
      if (Date.now() >= endTime) {
        logger.debug('[randomPhysicsChaos] Chaos ended');
        if (currentTimer) clearTimeout(currentTimer);
        this.activeTimers.delete('randomChaos');
        return;
      }

      const timerKeys = ['speedMod', 'jumpMod', 'gravityMod', 'iceMod'];
      timerKeys.forEach(key => {
        if (this.activeTimers.has(key)) {
          clearInterval(this.activeTimers.get(key));
          this.activeTimers.delete(key);
        }
      });

      const effect = pickRandomEffect();
      const effectDuration = 3 + Math.random() * 2;
      logger.debug(`[randomPhysicsChaos] Applying ${effect} for ${effectDuration.toFixed(1)}s`);

      await this[effect](effectDuration);

      currentTimer = setTimeout(applyNextEffect, effectDuration * 1000);
    };

    await applyNextEffect();
    this.activeTimers.set('randomChaos', currentTimer);

    return true;
  }

  // ============================================================================
  // SECTION 6: ENVIRONMENTAL PHYSICS
  // Source: operations-hoellcc.js (unique functionality)
  // ============================================================================

  async setWaterMode() {
    try {
      await this.client.writeMemory(this.ADDR_UNDERWATER_FLAG, Buffer.from([0x01]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setLandMode() {
    try {
      await this.client.writeMemory(this.ADDR_UNDERWATER_FLAG, Buffer.from([0x00]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setWaterModeTimed(duration = 30) {
    const result = await this.setWaterMode();
    if (result.success) {
      if (this.activeTimers.has('waterMode')) {
        clearTimeout(this.activeTimers.get('waterMode'));
      }

      const timer = setTimeout(async () => {
        await this.setLandMode();
        this.activeTimers.delete('waterMode');
      }, duration * 1000);

      this.activeTimers.set('waterMode', timer);
    }
    return result;
  }

  async setIceMode() {
    try {
      await this.client.writeMemory(this.ADDR_ICE_FLAG, Buffer.from([0x01]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setDryMode() {
    try {
      await this.client.writeMemory(this.ADDR_ICE_FLAG, Buffer.from([0x00]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setIceModeTimed(duration = 30) {
    const result = await this.setIceMode();
    if (result.success) {
      if (this.activeTimers.has('iceMode')) {
        clearTimeout(this.activeTimers.get('iceMode'));
      }

      const timer = setTimeout(async () => {
        await this.setDryMode();
        this.activeTimers.delete('iceMode');
      }, duration * 1000);

      this.activeTimers.set('iceMode', timer);
    }
    return result;
  }

  async freezePlayer() {
    try {
      if (this.activeTimers.has('freezePlayer')) {
        clearInterval(this.activeTimers.get('freezePlayer'));
      }

      const interval = setInterval(async () => {
        try {
          await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([0x00]));
          await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([0x00]));
        } catch (err) {
          logger.error('[freezePlayer] Error locking speeds:', err.message);
        }
      }, 16);

      this.activeTimers.set('freezePlayer', interval);
      logger.debug('[freezePlayer] Player frozen');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async unfreezePlayer() {
    try {
      if (this.activeTimers.has('freezePlayer')) {
        clearInterval(this.activeTimers.get('freezePlayer'));
        this.activeTimers.delete('freezePlayer');
        logger.debug('[unfreezePlayer] Player unfrozen');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async kickRight() {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([64]));
      await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([224]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async kickLeft() {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([192]));
      await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([224]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async kickUp() {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([192]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async pushRight(speed = 32) {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async pushLeft(speed = 32) {
    try {
      const signedSpeed = (256 - speed) & 0xFF;
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([signedSpeed]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async activateSilverPSwitch(duration = 255) {
    try {
      await this.client.writeMemory(this.ADDR_SILVER_PSWITCH_TIMER, Buffer.from([duration & 0xFF]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async spawnSilverPSwitch() {
    return await this.spawner.spawnSprite(0x26, 32, 0);
  }

  // ============================================================================
  // SECTION 7: BASIC ENEMY SPAWNING (Expanded)
  // Source: operations-expanded.js (position-based spawning)
  // ============================================================================

  async spawnEnemyNearMario(spriteType, offsetX = 32, offsetY = 0) {
    try {
      const pos = await this.getMarioPosition();
      const slot = await this.spawnSpriteAtPosition(spriteType, pos.x + offsetX, pos.y + offsetY);
      logger.debug(`[spawnEnemyNearMario] Spawned sprite ${spriteType} near Mario`);
      return slot !== false;
    } catch (error) {
      logger.error('[spawnEnemyNearMario] Error:', error.message);
      return false;
    }
  }

  async spawnRandomEnemy() {
    const enemies = [
      SPRITE_TYPES.GREEN_KOOPA_TROOPA,
      SPRITE_TYPES.RED_KOOPA_TROOPA,
      SPRITE_TYPES.GOOMBA,
      SPRITE_TYPES.BUZZY_BEETLE,
      SPRITE_TYPES.SPINY,
      SPRITE_TYPES.PIRANHA_PLANT,
      SPRITE_TYPES.BOO,
      SPRITE_TYPES.DRY_BONES,
      SPRITE_TYPES.REX,
      SPRITE_TYPES.MONTY_MOLE
    ];
    const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
    return await this.spawnEnemyNearMario(randomEnemy);
  }

  async spawnEnemyWave(count = 5, duration = 30) {
    try {
      logger.debug(`[spawnEnemyWave] Starting enemy wave: ${count} enemies for ${duration} seconds`);

      for (let i = 0; i < Math.min(count, 3); i++) {
        await this.spawnRandomEnemy();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const interval = setInterval(async () => {
        await this.spawnRandomEnemy();
      }, 2000);

      this.activeTimers.set('enemyWave', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('enemyWave');
        logger.debug('[spawnEnemyWave] Enemy wave ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[spawnEnemyWave] Error:', error.message);
      return false;
    }
  }

  async spawnKoopaWave(duration = 20) {
    try {
      logger.debug(`[spawnKoopaWave] Spawning Koopa wave for ${duration} seconds`);

      const interval = setInterval(async () => {
        const koopaTypes = [
          SPRITE_TYPES.GREEN_KOOPA_TROOPA,
          SPRITE_TYPES.RED_KOOPA_TROOPA,
          SPRITE_TYPES.GREEN_KOOPA_PARATROOPA,
          SPRITE_TYPES.RED_KOOPA_PARATROOPA
        ];
        const koopa = koopaTypes[Math.floor(Math.random() * koopaTypes.length)];
        await this.spawnEnemyNearMario(koopa, 48, 0);
      }, 1500);

      this.activeTimers.set('koopaWave', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('koopaWave');
        logger.debug('[spawnKoopaWave] Koopa wave ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[spawnKoopaWave] Error:', error.message);
      return false;
    }
  }

  async spawnBuzzyBeetleWave(duration = 20) {
    try {
      logger.debug(`[spawnBuzzyBeetleWave] Spawning Buzzy Beetle wave for ${duration} seconds`);

      const interval = setInterval(async () => {
        await this.spawnEnemyNearMario(SPRITE_TYPES.BUZZY_BEETLE, 40, -16);
      }, 2000);

      this.activeTimers.set('buzzyWave', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('buzzyWave');
        logger.debug('[spawnBuzzyBeetleWave] Buzzy Beetle wave ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[spawnBuzzyBeetleWave] Error:', error.message);
      return false;
    }
  }

  async spawnPiranhaPlantWave(duration = 20) {
    try {
      logger.debug(`[spawnPiranhaPlantWave] Spawning Piranha Plant wave for ${duration} seconds`);

      const interval = setInterval(async () => {
        const offset = Math.random() > 0.5 ? 64 : -64;
        await this.spawnEnemyNearMario(SPRITE_TYPES.PIRANHA_PLANT, offset, 0);
      }, 3000);

      this.activeTimers.set('piranhaWave', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('piranhaWave');
        logger.debug('[spawnPiranhaPlantWave] Piranha Plant wave ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[spawnPiranhaPlantWave] Error:', error.message);
      return false;
    }
  }

  async spawnBooCircle(count = 4) {
    try {
      const pos = await this.getMarioPosition();
      const radius = 64;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = pos.x + Math.cos(angle) * radius;
        const y = pos.y + Math.sin(angle) * radius;
        await this.spawnSpriteAtPosition(SPRITE_TYPES.BOO, Math.floor(x), Math.floor(y));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.debug(`[spawnBooCircle] Spawned ${count} Boos in circle`);
      return true;
    } catch (error) {
      logger.error('[spawnBooCircle] Error:', error.message);
      return false;
    }
  }

  async spawnBulletBillBarrage(duration = 15) {
    try {
      logger.debug(`[spawnBulletBillBarrage] Starting Bullet Bill barrage for ${duration} seconds`);

      const interval = setInterval(async () => {
        await this.spawnEnemyNearMario(SPRITE_TYPES.BULLET_BILL, 80, Math.floor(Math.random() * 40) - 20);
      }, 1000);

      this.activeTimers.set('bulletBillBarrage', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('bulletBillBarrage');
        logger.debug('[spawnBulletBillBarrage] Bullet Bill barrage ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[spawnBulletBillBarrage] Error:', error.message);
      return false;
    }
  }

  async spawnThwomp() {
    try {
      const pos = await this.getMarioPosition();
      await this.spawnSpriteAtPosition(SPRITE_TYPES.THWOMP, pos.x, pos.y - 64);
      logger.debug('[spawnThwomp] Spawned Thwomp above Mario');
      return true;
    } catch (error) {
      logger.error('[spawnThwomp] Error:', error.message);
      return false;
    }
  }

  async spawnCharginChuck() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.CHARGIN_CHUCK, 48, 0);
      logger.debug('[spawnCharginChuck] Spawned Chargin\' Chuck');
      return true;
    } catch (error) {
      logger.error('[spawnCharginChuck] Error:', error.message);
      return false;
    }
  }

  async spawnBobOmb() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.BOB_OMB, 32, -16);
      logger.debug('[spawnBobOmb] Spawned Bob-omb');
      return true;
    } catch (error) {
      logger.error('[spawnBobOmb] Error:', error.message);
      return false;
    }
  }

  async spawnMagikoopa() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.MAGIKOOPA, 64, -32);
      logger.debug('[spawnMagikoopa] Spawned Magikoopa');
      return true;
    } catch (error) {
      logger.error('[spawnMagikoopa] Error:', error.message);
      return false;
    }
  }

  async spawnDryBones() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.DRY_BONES, 40, 0);
      logger.debug('[spawnDryBones] Spawned Dry Bones');
      return true;
    } catch (error) {
      logger.error('[spawnDryBones] Error:', error.message);
      return false;
    }
  }

  async clearAllEnemies() {
    try {
      for (let i = 0; i < 12; i++) {
        await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS + i, Buffer.from([0x00]));
      }
      logger.debug('[clearAllEnemies] Cleared all enemy sprites');
      return true;
    } catch (error) {
      logger.error('[clearAllEnemies] Error:', error.message);
      return false;
    }
  }

  async makeEnemiesInvisible(duration = 30) {
    try {
      logger.debug(`[makeEnemiesInvisible] Making enemies invisible for ${duration} seconds`);

      const interval = setInterval(async () => {
        for (let i = 0; i < 128; i++) {
          const yPosAddr = MEMORY_ADDRESSES.OAM_SPRITE_TABLE + (i * 4) + 1;
          await this.writeWithRetry(yPosAddr, Buffer.from([240]));
        }
      }, 8);

      this.activeTimers.set('invisibleEnemies', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('invisibleEnemies');
        logger.debug('[makeEnemiesInvisible] Enemy visibility restored');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[makeEnemiesInvisible] Error:', error.message);
      return false;
    }
  }

  async doubleEnemySpeed(duration = 20) {
    try {
      logger.debug(`[doubleEnemySpeed] Doubling enemy speed for ${duration} seconds`);

      const interval = setInterval(async () => {
        for (let i = 0; i < 12; i++) {
          const status = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS + i, 1);
          if (status[0] !== 0x00) {
            const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_X_SPEED + i, 1);
            const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_Y_SPEED + i, 1);

            let newXSpeed = (xSpeed[0] << 24 >> 24) * 2;
            let newYSpeed = (ySpeed[0] << 24 >> 24) * 2;

            newXSpeed = Math.max(-128, Math.min(127, newXSpeed));
            newYSpeed = Math.max(-128, Math.min(127, newYSpeed));

            await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_X_SPEED + i, Buffer.from([newXSpeed & 0xFF]));
            await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_Y_SPEED + i, Buffer.from([newYSpeed & 0xFF]));
          }
        }
      }, 100);

      this.activeTimers.set('doubleEnemySpeed', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('doubleEnemySpeed');
        logger.debug('[doubleEnemySpeed] Enemy speed restored');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[doubleEnemySpeed] Error:', error.message);
      return false;
    }
  }

  async spawnRex() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.REX, 40, 0);
      logger.debug('[spawnRex] Spawned Rex');
      return true;
    } catch (error) {
      logger.error('[spawnRex] Error:', error.message);
      return false;
    }
  }

  async spawnWiggler() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.WIGGLER, 48, 0);
      logger.debug('[spawnWiggler] Spawned Wiggler');
      return true;
    } catch (error) {
      logger.error('[spawnWiggler] Error:', error.message);
      return false;
    }
  }

  async spawnBoss(bossType = 'reznor') {
    try {
      const bossSprite = bossType === 'bowser' ? SPRITE_TYPES.BOWSER : SPRITE_TYPES.REZNOR;
      const pos = await this.getMarioPosition();
      await this.spawnSpriteAtPosition(bossSprite, pos.x + 64, pos.y);
      logger.debug(`[spawnBoss] Spawned ${bossType}`);
      return true;
    } catch (error) {
      logger.error('[spawnBoss] Error:', error.message);
      return false;
    }
  }

  async spawnRandomBlocks(count = 5) {
    try {
      logger.debug(`[spawnRandomBlocks] Spawning ${count} random blocks around Mario`);

      const pos = await this.getMarioPosition();

      for (let i = 0; i < count; i++) {
        const offsetX = Math.floor(Math.random() * 128) - 64;
        const offsetY = Math.floor(Math.random() * 80) - 40;

        const blockTypes = [
          SPRITE_TYPES.SPRINGBOARD,
          SPRITE_TYPES.P_SWITCH,
          SPRITE_TYPES.TRAMPOLINE,
          SPRITE_TYPES.MOVING_PLATFORM,
          SPRITE_TYPES.FALLING_PLATFORM
        ];

        const randomBlock = blockTypes[Math.floor(Math.random() * blockTypes.length)];
        await this.spawnSpriteAtPosition(randomBlock, pos.x + offsetX, pos.y + offsetY);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      logger.debug(`[spawnRandomBlocks] Spawned ${count} random blocks`);
      return true;
    } catch (error) {
      logger.error('[spawnRandomBlocks] Error:', error.message);
      return false;
    }
  }

  async removeFloorBlocks(count = 3, duration = 20) {
    try {
      logger.debug(`[removeFloorBlocks] Creating ${count} floor hazards for ${duration} seconds`);

      const interval = setInterval(async () => {
        const pos = await this.getMarioPosition();

        for (let i = 0; i < count; i++) {
          const offsetX = Math.floor(Math.random() * 64) - 32;
          await this.spawnSpriteAtPosition(0x89, pos.x + offsetX, pos.y + 32);
        }
      }, 3000);

      this.activeTimers.set('floorRemoval', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('floorRemoval');
        logger.debug('[removeFloorBlocks] Floor hazard spawning ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      logger.error('[removeFloorBlocks] Error:', error.message);
      return false;
    }
  }

  // ============================================================================
  // SECTION 8: MARIOMOD ENEMY SPAWNING (HoellCC)
  // Source: operations-hoellcc.js (MarioMod spawner integration)
  // ============================================================================

  async spawnGreenKoopa() {
    return await this.spawner.spawnEnemy(0x00, 32, 0);
  }

  async spawnRedKoopa() {
    return await this.spawner.spawnEnemy(0x01, 32, 0);
  }

  async spawnSpiny() {
    return await this.spawner.spawnEnemy(0x02, 32, 0);
  }

  async spawnGoomba() {
    return await this.spawner.spawnEnemy(0x03, 32, 0);
  }

  async spawnGreenParatroopa() {
    return await this.spawner.spawnEnemy(0x08, 32, -16);
  }

  async spawnRedParatroopa() {
    return await this.spawner.spawnEnemy(0x0A, 32, -16);
  }

  async spawnNinji() {
    return await this.spawner.spawnEnemy(0x0E, 32, -16);
  }

  async spawnParaGoomba() {
    return await this.spawner.spawnEnemy(0x10, 32, -16);
  }

  async spawnLakitu() {
    return await this.spawner.spawnEnemy(0x11, 32, -32);
  }

  async spawnMontyMole() {
    return await this.spawner.spawnEnemy(0x12, 32, 0);
  }

  async spawnPiranhaPlant() {
    return await this.spawner.spawnEnemy(0x1A, 32, 0);
  }

  async spawnBulletBill() {
    return await this.spawner.spawnEnemy(0x1C, -64, 0);
  }

  async spawnHammerBro() {
    return await this.spawner.spawnEnemy(0x1D, 32, 0);
  }

  async spawnSumoBro() {
    return await this.spawner.spawnEnemy(0x1E, 32, 0);
  }

  async spawnBoo() {
    return await this.spawner.spawnEnemy(0x20, -32, 0);
  }

  async spawnBigBoo() {
    return await this.spawner.spawnEnemy(0x21, -32, 0);
  }

  async spawnBanzaiBill() {
    return await this.spawner.spawnEnemy(0x22, -96, 0);
  }

  async spawnFishinBoo() {
    return await this.spawner.spawnEnemy(0x23, 32, -32);
  }

  async spawnThwimp() {
    return await this.spawner.spawnEnemy(0x24, 32, -32);
  }

  async spawnPokey() {
    return await this.spawner.spawnEnemy(0x25, 32, 0);
  }

  async spawnDinoRhino() {
    return await this.spawner.spawnEnemy(0x27, 32, 0);
  }

  async spawnBonyBeetle() {
    return await this.spawner.spawnEnemy(0x29, 32, 0);
  }

  async spawnMagikoopa2() {
    return await this.spawner.spawnEnemy(0x2A, 32, 0);
  }

  async spawnReznor() {
    return await this.spawner.spawnEnemy(0x2D, 0, -32);
  }

  async spawnFishingLakitu() {
    return await this.spawner.spawnEnemy(0x30, 32, -32);
  }

  async spawnSwooper() {
    return await this.spawner.spawnEnemy(0x35, 0, -64);
  }

  async spawnChargingChuck() {
    return await this.spawner.spawnEnemy(0x06, 32, 0);
  }

  async spawnClappingChuck() {
    return await this.spawner.spawnEnemy(0x3F, 32, 0);
  }

  async spawnSplittingChuck() {
    return await this.spawner.spawnEnemy(0x41, 32, 0);
  }

  async spawnJumpingChuck() {
    return await this.spawner.spawnEnemy(0x43, 32, 0);
  }

  async spawnKoopaKid() {
    return await this.spawner.spawnEnemy(0x4D, 32, 0);
  }

  async spawnHotHead() {
    return await this.spawner.spawnEnemy(0x50, 32, 0);
  }

  async spawnMechaKoopa() {
    return await this.spawner.spawnEnemy(0x55, 32, 0);
  }

  async spawnCheepCheep() {
    return await this.spawner.spawnEnemy(0x5A, 32, 0);
  }

  async spawnBlurp() {
    return await this.spawner.spawnEnemy(0x5D, 32, 0);
  }

  async spawnPorcupuffer() {
    return await this.spawner.spawnEnemy(0x5E, 32, 0);
  }

  async spawnBeachKoopa() {
    return await this.spawner.spawnEnemy(0x09, 32, 0);
  }

  // ============================================================================
  // SECTION 9: POWER-UP SPAWNS (HoellCC)
  // Source: operations-hoellcc.js (MarioMod spawner)
  // ============================================================================

  async spawnStar() {
    return await this.spawner.spawnSprite(0x4B, 32, 0);
  }

  async spawnFeather() {
    return await this.spawner.spawnSprite(0x4C, 32, 0);
  }

  async spawnFireFlower() {
    return await this.spawner.spawnSprite(0x4A, 32, 0);
  }

  async spawnPBalloon() {
    return await this.spawner.spawnSprite(0x53, 32, 0);
  }

  async spawnItemBox() {
    return await this.spawner.spawnSprite(0x3E, 32, 0);
  }

  // ============================================================================
  // SECTION 10: HELPER SPAWNS (HoellCC)
  // Source: operations-hoellcc.js
  // ============================================================================

  async spawnYoshi() {
    return await this.spawner.spawnSprite(0x35, 32, 0);
  }

  async spawnBabyYoshi() {
    return await this.spawner.spawnSprite(0x2D, 32, 0);
  }

  async spawnLakituCloud() {
    logger.debug('[spawnLakituCloud] Not implemented - cloud requires specific level context');
    return { success: false, error: 'Cloud spawn not available' };
  }

  async spawnBluePSwitch() {
    logger.debug('[spawnBluePSwitch] Disabled - incorrect sprite ID for MarioMod');
    return { success: false, error: 'Blue P-Switch spawn needs correct MarioMod sprite ID' };
  }

  async spawnBeanstalk() {
    logger.debug('[spawnBeanstalk] Disabled - may require specific level context');
    return { success: false, error: 'Beanstalk spawn needs area detection' };
  }

  async spawnKey() {
    logger.debug('[spawnKey] Disabled - spawns incorrect sprite');
    return { success: false, error: 'Key spawn needs correct MarioMod sprite ID' };
  }

  async spawnSpringboard() {
    logger.debug('[spawnSpringboard] Disabled - spawns incorrect sprite');
    return { success: false, error: 'Springboard spawn needs correct MarioMod sprite ID' };
  }

  async spawnPSwitch() {
    logger.debug('[spawnPSwitch] Disabled - incorrect sprite ID for MarioMod');
    return { success: false, error: 'P-Switch spawn needs correct MarioMod sprite ID' };
  }

  // ============================================================================
  // SECTION 11: KAIZO OPERATIONS (HoellCC)
  // Source: operations-hoellcc.js (canonical killPlayer and kaizo blocks)
  // ============================================================================

  async killPlayer() {
    try {
      logger.debug('[killPlayer] Killing Mario by setting timer to 1 second...');

      await this.client.writeMemory(0x7E0F31, Buffer.from([0x00]));
      await this.client.writeMemory(0x7E0F32, Buffer.from([0x00]));
      await this.client.writeMemory(0x7E0F33, Buffer.from([0x01]));

      logger.debug('[killPlayer] Timer set to 001 - time-up death will trigger in 1 second');
      return { success: true };
    } catch (error) {
      logger.error('[killPlayer] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async spawnPoisonMushroom() {
    return await this.spawner.spawnSprite(0xC7, 0, -32, true);
  }

  async spawnKaizoBlock() {
    try {
      let wasJumping = false;
      const allSpawnedBlocks = [];
      const MAX_BLOCKS = 100;

      const checkInterval = setInterval(async () => {
        try {
          const ySpeed = await this.client.readMemory(0x7E007D, 1);
          const yVel = ySpeed[0] << 24 >> 24;
          const isJumping = yVel < -5;

          if (isJumping && !wasJumping) {
            logger.debug('[spawnKaizoBlock] Jump START detected - spawning blocks NOW');

            if (allSpawnedBlocks.length >= MAX_BLOCKS) {
              logger.debug(`[spawnKaizoBlock] Block limit reached (${MAX_BLOCKS}) - skipping spawn`);
              wasJumping = isJumping;
              return;
            }

            const xSpeed = await this.client.readMemory(0x7E007B, 1);
            const xVel = xSpeed[0] << 24 >> 24;

            const blockOffsets = [];
            if (xVel > 0) {
              blockOffsets.push({ x: 8, y: 0 });
              blockOffsets.push({ x: 16, y: 0 });
              blockOffsets.push({ x: 24, y: 0 });
              blockOffsets.push({ x: 32, y: 0 });
              blockOffsets.push({ x: 40, y: 0 });
            } else if (xVel < 0) {
              blockOffsets.push({ x: -8, y: 0 });
              blockOffsets.push({ x: -16, y: 0 });
              blockOffsets.push({ x: -24, y: 0 });
              blockOffsets.push({ x: -32, y: 0 });
              blockOffsets.push({ x: -40, y: 0 });
            } else {
              blockOffsets.push({ x: -8, y: 0 });
              blockOffsets.push({ x: 0, y: 0 });
              blockOffsets.push({ x: 8, y: 0 });
            }

            for (const offset of blockOffsets) {
              await this.spawner.spawnBlockViaMarioMod(0x0021, offset.x, offset.y);
              allSpawnedBlocks.push(offset);
            }

            logger.debug(`[spawnKaizoBlock] Spawned ${blockOffsets.length} blocks at jump start (xVel: ${xVel})`);
          }

          wasJumping = isJumping;
        } catch (error) {
          logger.error('[spawnKaizoBlock] Monitor error:', error.message);
          clearInterval(checkInterval);
          this.activeTimers.delete('spawnKaizoBlock');
        }
      }, 16);

      this.activeTimers.set('spawnKaizoBlock', checkInterval);

      setTimeout(() => {
        if (this.activeTimers.has('spawnKaizoBlock')) {
          clearInterval(this.activeTimers.get('spawnKaizoBlock'));
          this.activeTimers.delete('spawnKaizoBlock');
          logger.debug('[spawnKaizoBlock] Timeout - no jump button press detected');
        }
      }, 10000);

      logger.debug('[spawnKaizoBlock] Armed - waiting for jump...');
      return { success: true };
    } catch (error) {
      logger.error('[spawnKaizoBlock] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async spawnMuncher() {
    return await this.spawner.spawnBlockViaMarioMod(0x012F, -32, 16);
  }

  async spawnMuncherOnJump() {
    return await this.spawner.spawnBlockOnJumpViaMarioMod(0x012F, 0, 0);
  }

  async spawnCustomBlock(blockId = 0x01, xOffset = 0, yOffset = 0) {
    return await this.spawner.spawnBlockViaMarioMod(blockId, xOffset, yOffset);
  }

  async despawnFloorBlocks() {
    try {
      logger.debug('[despawnFloorBlocks] Creating pit ahead of Mario');

      const xSpeed = await this.client.readMemory(0x7E007B, 1);
      const xVel = xSpeed[0] << 24 >> 24;

      let pitStartX;
      if (xVel > 0) {
        pitStartX = 48 + Math.floor(Math.random() * 17);
        logger.debug(`[despawnFloorBlocks] Moving right - pit at +${pitStartX}px`);
      } else if (xVel < 0) {
        pitStartX = -(48 + Math.floor(Math.random() * 17));
        logger.debug(`[despawnFloorBlocks] Moving left - pit at ${pitStartX}px`);
      } else {
        pitStartX = Math.random() < 0.5 ? 48 : -48;
        logger.debug(`[despawnFloorBlocks] Standing still - random pit at ${pitStartX > 0 ? '+' : ''}${pitStartX}px`);
      }

      const pitWidth = 3 + Math.floor(Math.random() * 2);
      const pitBlocks = [];

      for (let i = 0; i < pitWidth; i++) {
        const xOffset = pitStartX + (i * 16 * Math.sign(pitStartX || 1));
        pitBlocks.push({ x: xOffset, y: 16 });
        pitBlocks.push({ x: xOffset, y: 32 });
        pitBlocks.push({ x: xOffset, y: 48 });
      }

      for (const block of pitBlocks) {
        await this.spawner.spawnBlockViaMarioMod(0x0025, block.x, block.y);
      }

      logger.debug(`[despawnFloorBlocks] Created ${pitWidth}-block wide pit ahead of Mario`);
      return { success: true };
    } catch (error) {
      logger.error('[despawnFloorBlocks] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async floorToLava() {
    try {
      logger.debug('[floorToLava] Spawning grinders ahead of Mario');

      const xSpeed = await this.client.readMemory(0x7E007B, 1);
      const xVel = xSpeed[0] << 24 >> 24;

      let spawnStartX;
      if (xVel > 0) {
        spawnStartX = 48 + Math.floor(Math.random() * 17);
        logger.debug(`[floorToLava] Moving right - grinders at +${spawnStartX}px`);
      } else if (xVel < 0) {
        spawnStartX = -(48 + Math.floor(Math.random() * 17));
        logger.debug(`[floorToLava] Moving left - grinders at ${spawnStartX}px`);
      } else {
        spawnStartX = Math.random() < 0.5 ? 48 : -48;
        logger.debug(`[floorToLava] Standing still - random grinders at ${spawnStartX > 0 ? '+' : ''}${spawnStartX}px`);
      }

      const numGrinders = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < numGrinders; i++) {
        const xOffset = spawnStartX + (i * 24 * Math.sign(spawnStartX || 1));
        const offsets = this.spawner.convertSignedOffsets(xOffset, 16);

        await this.spawner.spawnSpriteViaMarioMod(
          103,
          offsets.xPos,
          offsets.xNeg,
          offsets.yPos,
          offsets.yNeg,
          false
        );
      }

      logger.debug(`[floorToLava] Spawned ${numGrinders} grinders ahead of Mario`);
      return { success: true };
    } catch (error) {
      logger.error('[floorToLava] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async replaceRandomSprite() {
    try {
      await this.client.writeMemory(this.MARIOMOD_SPRITE_REPLACE_TRIGGER, Buffer.from([0x01]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // SECTION 12: CHAOS/RANDOM OPERATIONS (HoellCC)
  // Source: operations-hoellcc.js
  // ============================================================================

  async detectSpriteTileset() {
    try {
      const gfxData = await this.client.readMemory(0x7E0109, 1);
      const spriteGfx = gfxData[0];

      if (spriteGfx >= 0x03 && spriteGfx <= 0x05) return 'castle';
      if (spriteGfx >= 0x06 && spriteGfx <= 0x07) return 'ghost';
      if (spriteGfx >= 0x08 && spriteGfx <= 0x09) return 'underground';
      if (spriteGfx >= 0x0A && spriteGfx <= 0x0C) return 'water';

      return 'universal';
    } catch (error) {
      logger.error('[detectSpriteTileset] Error detecting tileset:', error.message);
      return 'universal';
    }
  }

  async spawnBulletBillStorm(duration = 30) {
    const endTime = Date.now() + (duration * 1000);
    let fromLeft = true;

    const stormInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(stormInterval);
        this.activeTimers.delete('bulletStorm');
        return;
      }

      const randomYOffset = Math.floor(Math.random() * 120) - 60;
      const xOffset = fromLeft ? -128 : 128;

      await this.spawner.spawnSprite(0x1C, xOffset, randomYOffset);
      fromLeft = !fromLeft;
    }, 800);

    this.activeTimers.set('bulletStorm', stormInterval);
    return { success: true };
  }

  // ============================================================================
  // SECTION 13: CLEANUP
  // Source: Combined from all three files
  // ============================================================================

  cleanup() {
    for (const [key, timer] of this.activeTimers.entries()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.activeTimers.clear();
    logger.debug('[cleanup] Cleared all active timers and intervals');
  }
}

module.exports = SMWOperations;
