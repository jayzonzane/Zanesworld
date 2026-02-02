const { MEMORY_ADDRESSES, POWERUP_TYPES, RESERVE_ITEMS, CONTROLLER_BUTTONS } = require('./memory-complete');

/**
 * Simplified SMW Operations - Only Direct Memory Manipulation
 * NO SPRITE SPAWNING - Focus on vanilla SMW (US 1.0) operations that work
 */
class WorkingSMWOperations {
  constructor(sniClient) {
    this.sniClient = sniClient;
    this.activeTimers = new Map();
  }

  // ============= HELPER METHODS =============

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

  // ============= POWER-UPS (Direct Memory) =============

  async setMarioPowerup(powerupType) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.POWERUP_STATUS, Buffer.from([powerupType]));
      console.log(`[setMarioPowerup] Set power-up to ${powerupType}`);
      return true;
    } catch (error) {
      console.error('[setMarioPowerup] Error:', error.message);
      return false;
    }
  }

  async giveMushroom() {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.POWERUP_STATUS, 1);
      if (current[0] === POWERUP_TYPES.SMALL) {
        await this.setMarioPowerup(POWERUP_TYPES.SUPER);
        console.log('[giveMushroom] Upgraded Small Mario to Super Mario');
      } else {
        await this.writeWithRetry(MEMORY_ADDRESSES.RESERVE_ITEM, Buffer.from([RESERVE_ITEMS.MUSHROOM]));
        console.log('[giveMushroom] Added mushroom to reserve');
      }
      return true;
    } catch (error) {
      console.error('[giveMushroom] Error:', error.message);
      return false;
    }
  }

  async giveFireFlower() {
    try {
      await this.setMarioPowerup(POWERUP_TYPES.FIRE);
      console.log('[giveFireFlower] Gave Fire Flower');
      return true;
    } catch (error) {
      console.error('[giveFireFlower] Error:', error.message);
      return false;
    }
  }

  async giveCapeFeather() {
    try {
      await this.setMarioPowerup(POWERUP_TYPES.CAPE);
      console.log('[giveCapeFeather] Gave Cape Feather');
      return true;
    } catch (error) {
      console.error('[giveCapeFeather] Error:', error.message);
      return false;
    }
  }

  async giveStarman(duration = 20) {
    try {
      const starDuration = Math.min(duration * 4, 255); // ~4 frames per second
      await this.writeWithRetry(MEMORY_ADDRESSES.INVINCIBILITY_TIMER, Buffer.from([starDuration]));
      console.log(`[giveStarman] Gave star power for ${duration} seconds`);
      return true;
    } catch (error) {
      console.error('[giveStarman] Error:', error.message);
      return false;
    }
  }

  async removePowerup() {
    try {
      await this.setMarioPowerup(POWERUP_TYPES.SMALL);
      console.log('[removePowerup] Removed power-up (now Small Mario)');
      return true;
    } catch (error) {
      console.error('[removePowerup] Error:', error.message);
      return false;
    }
  }

  async activatePSwitch(duration = 20) {
    try {
      const pSwitchDuration = Math.min(duration * 4, 255);
      await this.writeWithRetry(MEMORY_ADDRESSES.P_SWITCH_TIMER, Buffer.from([pSwitchDuration]));
      console.log(`[activatePSwitch] Activated P-Switch for ${duration} seconds`);
      return true;
    } catch (error) {
      console.error('[activatePSwitch] Error:', error.message);
      return false;
    }
  }

  // ============= LIVES & COINS (Direct Memory) =============

  async addLife(count = 1) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.LIVES, 1);
      const newLives = Math.min(current[0] + count, 99);
      await this.writeWithRetry(MEMORY_ADDRESSES.LIVES, Buffer.from([newLives]));
      await this.writeWithRetry(0x7E0DBE, Buffer.from([newLives]));
      console.log(`[addLife] Added ${count} life/lives (now ${newLives})`);
      return true;
    } catch (error) {
      console.error('[addLife] Error:', error.message);
      return false;
    }
  }

  async removeLife(count = 1) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.LIVES, 1);
      const newLives = Math.max(current[0] - count, 0);
      await this.writeWithRetry(MEMORY_ADDRESSES.LIVES, Buffer.from([newLives]));
      await this.writeWithRetry(0x7E0DBE, Buffer.from([newLives]));
      console.log(`[removeLife] Removed ${count} life/lives (now ${newLives})`);
      return true;
    } catch (error) {
      console.error('[removeLife] Error:', error.message);
      return false;
    }
  }

  async killPlayer() {
    try {
      console.log('[killPlayer] Killing Mario with poison mushroom...');

      // Try spawning poison mushroom (requires MarioMod ROM hack)
      // This requires hoellOps to be available in main.js
      // The poison mushroom will be spawned via the operations fallback chain

      // Fallback: Use pit death if poison mushroom spawn fails
      // Make Mario small first for visual effect
      const currentPowerup = await this.readWithRetry(MEMORY_ADDRESSES.POWERUP_STATUS, 1);
      if (currentPowerup[0] > 0) {
        await this.setMarioPowerup(POWERUP_TYPES.SMALL);
        console.log('[killPlayer] Shrunk Mario to small');
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Trigger pit death as guaranteed kill method
      await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_POSITION, Buffer.from([0xFF]));
      await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_POSITION + 1, Buffer.from([0x02]));

      console.log('[killPlayer] Death triggered (shrink + pit death)');
      return { success: true };
    } catch (error) {
      console.error('[killPlayer] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async addCoins(amount = 10) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.COINS, 1);
      let newCoins = current[0] + amount;

      while (newCoins >= 100) {
        await this.addLife(1);
        newCoins -= 100;
      }

      await this.writeWithRetry(MEMORY_ADDRESSES.COINS, Buffer.from([newCoins]));
      console.log(`[addCoins] Added ${amount} coins (now ${newCoins})`);
      return true;
    } catch (error) {
      console.error('[addCoins] Error:', error.message);
      return false;
    }
  }

  async removeCoins(amount = 10) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.COINS, 1);
      const newCoins = Math.max(current[0] - amount, 0);
      await this.writeWithRetry(MEMORY_ADDRESSES.COINS, Buffer.from([newCoins]));
      console.log(`[removeCoins] Removed ${amount} coins (now ${newCoins})`);
      return true;
    } catch (error) {
      console.error('[removeCoins] Error:', error.message);
      return false;
    }
  }

  // ============= LEVEL WARPING (Direct Memory) =============

  async warpToLevel(levelID) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.TRANSLEVEL_NUMBER, Buffer.from([levelID]));
      console.log(`[warpToLevel] Warped to level ${levelID.toString(16)}`);
      return true;
    } catch (error) {
      console.error('[warpToLevel] Error:', error.message);
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

  // ============= PHYSICS CHAOS (Direct Memory Manipulation) =============

  async modifyMarioSpeed(multiplier, duration = 30) {
    try {
      console.log(`[modifyMarioSpeed] Modifying speed by ${multiplier}x for ${duration} seconds`);

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
        console.log('[modifyMarioSpeed] Speed modifier ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[modifyMarioSpeed] Error:', error.message);
      return false;
    }
  }

  async halfSpeed(duration = 30) {
    return await this.modifyMarioSpeed(0.5, duration);
  }

  async doubleSpeed(duration = 30) {
    return await this.modifyMarioSpeed(3.0, duration);
  }

  async modifyJumpHeight(multiplier, duration = 30) {
    try {
      console.log(`[modifyJumpHeight] Modifying jump height by ${multiplier}x for ${duration} seconds`);

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
        console.log('[modifyJumpHeight] Jump modifier ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[modifyJumpHeight] Error:', error.message);
      return false;
    }
  }

  async moonJump(duration = 30) {
    try {
      console.log(`[moonJump] Moon jump for ${duration} seconds - caps at screen top`);

      const interval = setInterval(async () => {
        const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, 1);
        const yScreen = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SCREEN, 1);
        let speed = ySpeed[0] << 24 >> 24;
        let yPos = yScreen[0];

        // If Mario goes off top of screen (not visible)
        if (yPos < 16) {
          // Force fall down - Mario went too high
          speed = 8; // Moderate fall speed to bring Mario back down
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        } else if (speed < 0) {
          // Still jumping up, multiply jump power
          speed = Math.floor(speed * 2.0);
          speed = Math.max(-128, Math.min(0, speed));
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16);

      this.activeTimers.set('jumpMod', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('jumpMod');
        console.log('[moonJump] Moon jump ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[moonJump] Error:', error.message);
      return false;
    }
  }

  async tinyJump(duration = 30) {
    return await this.modifyJumpHeight(0.3, duration);
  }

  async modifyGravity(multiplier, duration = 30) {
    try {
      console.log(`[modifyGravity] Modifying gravity by ${multiplier}x for ${duration} seconds`);

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
        console.log('[modifyGravity] Gravity modifier ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[modifyGravity] Error:', error.message);
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
      console.log(`[reverseControls] Reversing controls for ${duration} seconds`);

      const interval = setInterval(async () => {
        // Read controller to see what player is pressing
        const controller = await this.readWithRetry(MEMORY_ADDRESSES.CONTROLLER_1_CURRENT, 1);
        const buttons = controller[0];
        const pressingLeft = (buttons & CONTROLLER_BUTTONS.LEFT) !== 0;
        const pressingRight = (buttons & CONTROLLER_BUTTONS.RIGHT) !== 0;

        // Read current X velocity
        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24; // Convert to signed byte

        // Reverse the velocity based on input
        // If pressing RIGHT, velocity should be NEGATIVE (moving left)
        // If pressing LEFT, velocity should be POSITIVE (moving right)
        if (pressingRight && speed > 0) {
          // Moving right but should move left - reverse it
          speed = -speed;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        } else if (pressingLeft && speed < 0) {
          // Moving left but should move right - reverse it
          speed = -speed;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16);

      this.activeTimers.set('reverseControls', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('reverseControls');
        console.log('[reverseControls] Controls restored');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[reverseControls] Error:', error.message);
      return false;
    }
  }

  async enableIcePhysics(duration = 30) {
    try {
      console.log(`[enableIcePhysics] Enabling ice physics for ${duration} seconds`);

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
        console.log('[enableIcePhysics] Ice physics ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[enableIcePhysics] Error:', error.message);
      return false;
    }
  }

  async disableRunning(duration = 20) {
    try {
      console.log(`[disableRunning] Disabling running for ${duration} seconds`);

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
        console.log('[disableRunning] Running re-enabled');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[disableRunning] Error:', error.message);
      return false;
    }
  }

  async forceContinuousRun(duration = 20) {
    try {
      console.log(`[forceContinuousRun] Forcing continuous run for ${duration} seconds`);

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
        console.log('[forceContinuousRun] Forced run ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[forceContinuousRun] Error:', error.message);
      return false;
    }
  }

  async randomPhysicsChaos(duration = 30) {
    console.log(`[randomPhysicsChaos] Starting chaos for ${duration} seconds - switching effects every 3-5s`);

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

      // Pick a different effect than last time
      let newEffect;
      do {
        newEffect = physicsMods[Math.floor(Math.random() * physicsMods.length)];
      } while (newEffect === lastEffect && physicsMods.length > 1);

      lastEffect = newEffect;
      return newEffect;
    };

    const applyNextEffect = async () => {
      if (Date.now() >= endTime) {
        // Duration expired, stop chaos
        console.log('[randomPhysicsChaos] Chaos ended');
        if (currentTimer) clearTimeout(currentTimer);
        this.activeTimers.delete('randomChaos');
        return;
      }

      // Clear any existing physics timers before applying new effect
      const timerKeys = ['speedMod', 'jumpMod', 'gravityMod', 'iceMod'];
      timerKeys.forEach(key => {
        if (this.activeTimers.has(key)) {
          clearInterval(this.activeTimers.get(key));
          this.activeTimers.delete(key);
        }
      });

      // Pick and apply random effect
      const effect = pickRandomEffect();
      const effectDuration = 3 + Math.random() * 2; // 3-5 seconds
      console.log(`[randomPhysicsChaos] Applying ${effect} for ${effectDuration.toFixed(1)}s`);

      // Apply the effect for 3-5 seconds
      await this[effect](effectDuration);

      // Schedule next effect change
      currentTimer = setTimeout(applyNextEffect, effectDuration * 1000);
    };

    // Start the chaos chain
    await applyNextEffect();
    this.activeTimers.set('randomChaos', currentTimer);

    return true;
  }

  // ============= CLEANUP =============
  cleanup() {
    for (const [key, timer] of this.activeTimers.entries()) {
      clearInterval(timer);
      this.activeTimers.delete(key);
    }
    console.log('[cleanup] Cleared all active timers');
  }
}

module.exports = WorkingSMWOperations;
