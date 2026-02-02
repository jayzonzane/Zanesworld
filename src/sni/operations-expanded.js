const {
  MEMORY_ADDRESSES,
  POWERUP_TYPES,
  RESERVE_ITEMS,
  YOSHI_COLORS,
  SPRITE_TYPES,
  GAME_MODES,
  CONTROLLER_BUTTONS,
  SNES_WRAM_BASE
} = require('./memory-complete');

class ExpandedGameOperations {
  constructor(sniClient) {
    this.client = sniClient;

    // Timer-based physics chaos properties
    this.physicsModActive = false;
    this.physicsModStartTime = null;
    this.physicsModDuration = 0;
    this.physicsModInterval = null;
    this.physicsModType = null;
    this.physicsModOriginalValues = {};

    // Enemy wave properties
    this.enemyWaveActive = false;
    this.enemyWaveStartTime = null;
    this.enemyWaveDuration = 0;
    this.enemyWaveInterval = null;
    this.enemyWaveSlots = [];

    // Temporary effect timers
    this.activeTimers = new Map(); // Generic timer storage for timed effects
  }

  // ============= HELPER METHODS =============

  async readWithRetry(address, size, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.client.readMemory(address, size);
        return result;
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error(`[readWithRetry] Failed after ${maxAttempts} attempts:`, error.message);
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  async writeWithRetry(address, data, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.client.writeMemory(address, data);
        return true;
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error(`[writeWithRetry] Failed after ${maxAttempts} attempts:`, error.message);
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  // Get Mario's current position
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
      console.error('[getMarioPosition] Error:', error.message);
      return { x: 0, y: 0 };
    }
  }

  // Find an empty sprite slot (returns slot index 0-11, or -1 if none available)
  async findEmptySpriteSlot() {
    try {
      const statusArray = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS, 12);
      for (let i = 0; i < 12; i++) {
        if (statusArray[i] === 0x00) {
          return i;
        }
      }
      return -1; // No empty slots
    } catch (error) {
      console.error('[findEmptySpriteSlot] Error:', error.message);
      return -1;
    }
  }

  // Spawn a sprite at specific coordinates
  async spawnSpriteAtPosition(spriteType, x, y, slotIndex = null) {
    try {
      // Find empty slot if not specified
      if (slotIndex === null) {
        slotIndex = await this.findEmptySpriteSlot();
      }

      if (slotIndex === -1) {
        console.log('[spawnSpriteAtPosition] No empty sprite slots available');
        return false;
      }

      // Write sprite type
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_TYPE + slotIndex, Buffer.from([spriteType]));

      // Write position (split into low/high bytes)
      const xLow = x & 0xFF;
      const xHigh = (x >> 8) & 0xFF;
      const yLow = y & 0xFF;
      const yHigh = (y >> 8) & 0xFF;

      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_X_LOW + slotIndex, Buffer.from([xLow]));
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_X_HIGH + slotIndex, Buffer.from([xHigh]));
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_Y_LOW + slotIndex, Buffer.from([yLow]));
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_Y_HIGH + slotIndex, Buffer.from([yHigh]));

      // Activate sprite (0x08 = normal active status for most sprites)
      await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS + slotIndex, Buffer.from([0x08]));

      console.log(`[spawnSpriteAtPosition] Spawned sprite type ${spriteType} at slot ${slotIndex}, position (${x}, ${y})`);
      return slotIndex;
    } catch (error) {
      console.error('[spawnSpriteAtPosition] Error:', error.message);
      return false;
    }
  }

  // ============= CATEGORY 1: POWER-UP MANAGEMENT (15 methods) =============

  // Set Mario's power-up state directly
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

  // Give Super Mushroom (upgrade to Super Mario)
  async giveMushroom() {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.POWERUP_STATUS, 1);
      if (current[0] === POWERUP_TYPES.SMALL) {
        await this.setMarioPowerup(POWERUP_TYPES.SUPER);
        console.log('[giveMushroom] Upgraded Small Mario to Super Mario');
      } else {
        // If already powered up, add to reserve
        await this.writeWithRetry(MEMORY_ADDRESSES.RESERVE_ITEM, Buffer.from([RESERVE_ITEMS.MUSHROOM]));
        console.log('[giveMushroom] Added mushroom to reserve');
      }
      return true;
    } catch (error) {
      console.error('[giveMushroom] Error:', error.message);
      return false;
    }
  }

  // Give Fire Flower
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

  // Give Cape Feather
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

  // Give Star Power (invincibility)
  async giveStarman(duration = 20) {
    try {
      // Star timer: ~0x30 (48 decimal) for standard duration
      const timerValue = Math.min(duration * 2.4, 255); // Convert seconds to frames (~60fps)
      await this.writeWithRetry(MEMORY_ADDRESSES.STAR_POWER_TIMER, Buffer.from([timerValue]));
      console.log(`[giveStarman] Activated Star Power for ${duration} seconds`);
      return true;
    } catch (error) {
      console.error('[giveStarman] Error:', error.message);
      return false;
    }
  }

  // Remove current power-up (downgrade)
  async removePowerup() {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.POWERUP_STATUS, 1);
      if (current[0] > POWERUP_TYPES.SMALL) {
        // Downgrade one level
        if (current[0] === POWERUP_TYPES.SUPER) {
          await this.setMarioPowerup(POWERUP_TYPES.SMALL);
        } else {
          await this.setMarioPowerup(POWERUP_TYPES.SUPER);
        }
        console.log('[removePowerup] Downgraded power-up');
      }
      return true;
    } catch (error) {
      console.error('[removePowerup] Error:', error.message);
      return false;
    }
  }

  // Give Yoshi (spawn Yoshi sprite or set Yoshi state)
  async giveYoshi(color = YOSHI_COLORS.GREEN) {
    try {
      // Set Yoshi color
      await this.writeWithRetry(MEMORY_ADDRESSES.YOSHI_COLOR, Buffer.from([color]));

      // Directly set riding Yoshi flag (address $187A: 0=not riding, 1=riding)
      await this.writeWithRetry(0x7E187A, Buffer.from([0x01]));

      console.log(`[giveYoshi] Gave ${Object.keys(YOSHI_COLORS)[color]} Yoshi - Mario should now be riding Yoshi`);
      return true;
    } catch (error) {
      console.error('[giveYoshi] Error:', error.message);
      return false;
    }
  }

  // Remove Yoshi (if riding)
  async removeYoshi() {
    try {
      // Clear Yoshi color (indicates not riding Yoshi)
      await this.writeWithRetry(MEMORY_ADDRESSES.YOSHI_COLOR, Buffer.from([0xFF]));
      console.log('[removeYoshi] Removed Yoshi');
      return true;
    } catch (error) {
      console.error('[removeYoshi] Error:', error.message);
      return false;
    }
  }

  // Give reserve item
  async giveReserveItem(itemType = RESERVE_ITEMS.MUSHROOM) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.RESERVE_ITEM, Buffer.from([itemType]));
      console.log(`[giveReserveItem] Set reserve item to ${itemType}`);
      return true;
    } catch (error) {
      console.error('[giveReserveItem] Error:', error.message);
      return false;
    }
  }

  // Clear reserve item
  async clearReserveItem() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.RESERVE_ITEM, Buffer.from([RESERVE_ITEMS.NONE]));
      console.log('[clearReserveItem] Cleared reserve item');
      return true;
    } catch (error) {
      console.error('[clearReserveItem] Error:', error.message);
      return false;
    }
  }

  // Add life
  async addLife(count = 1) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.LIVES, 1);
      const newLives = Math.min(current[0] + count, 99); // Max 99 lives
      // Write to both addresses to ensure it works in-game and overworld
      await this.writeWithRetry(MEMORY_ADDRESSES.LIVES, Buffer.from([newLives]));
      await this.writeWithRetry(0x7E0DBE, Buffer.from([newLives])); // Alternate lives address
      console.log(`[addLife] Added ${count} life/lives (now ${newLives})`);
      return true;
    } catch (error) {
      console.error('[addLife] Error:', error.message);
      return false;
    }
  }

  // Remove life
  async removeLife(count = 1) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.LIVES, 1);
      const newLives = Math.max(current[0] - count, 0);
      // Write to both addresses to ensure it works in-game and overworld
      await this.writeWithRetry(MEMORY_ADDRESSES.LIVES, Buffer.from([newLives]));
      await this.writeWithRetry(0x7E0DBE, Buffer.from([newLives])); // Alternate lives address
      console.log(`[removeLife] Removed ${count} life/lives (now ${newLives})`);
      return true;
    } catch (error) {
      console.error('[removeLife] Error:', error.message);
      return false;
    }
  }

  // Add coins
  async addCoins(amount = 10) {
    try {
      const current = await this.readWithRetry(MEMORY_ADDRESSES.COINS, 1);
      let newCoins = current[0] + amount;

      // Check for 100-coin 1-ups
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

  // Remove coins
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

  // Activate P-Switch
  async activatePSwitch(duration = 9) {
    try {
      // P-Switch timer: ~0x200 frames for 9 seconds
      const timerValue = Math.min(duration * 60, 0x3FF); // ~60 fps, max 0x3FF
      const timerLow = timerValue & 0xFF;
      const timerHigh = (timerValue >> 8) & 0xFF;

      // P-Switch timer is 2 bytes
      await this.writeWithRetry(MEMORY_ADDRESSES.P_SWITCH_TIMER, Buffer.from([timerLow]));
      await this.writeWithRetry(MEMORY_ADDRESSES.P_SWITCH_TIMER + 1, Buffer.from([timerHigh]));

      console.log(`[activatePSwitch] Activated P-Switch for ${duration} seconds`);
      return true;
    } catch (error) {
      console.error('[activatePSwitch] Error:', error.message);
      return false;
    }
  }

  // ============= CATEGORY 2: ENEMY/HAZARD SPAWNING (20 methods) =============

  // Spawn enemy near Mario with offset
  async spawnEnemyNearMario(spriteType, offsetX = 32, offsetY = 0) {
    try {
      const pos = await this.getMarioPosition();
      const slot = await this.spawnSpriteAtPosition(spriteType, pos.x + offsetX, pos.y + offsetY);
      console.log(`[spawnEnemyNearMario] Spawned sprite ${spriteType} near Mario`);
      return slot !== false;
    } catch (error) {
      console.error('[spawnEnemyNearMario] Error:', error.message);
      return false;
    }
  }

  // Spawn random enemy near Mario
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

  // Spawn enemy wave with timer
  async spawnEnemyWave(count = 5, duration = 30) {
    try {
      console.log(`[spawnEnemyWave] Starting enemy wave: ${count} enemies for ${duration} seconds`);

      this.enemyWaveActive = true;
      this.enemyWaveStartTime = Date.now();
      this.enemyWaveDuration = duration * 1000;
      this.enemyWaveSlots = [];

      // Initial spawn
      for (let i = 0; i < Math.min(count, 3); i++) {
        await this.spawnRandomEnemy();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Set up interval to respawn enemies during duration
      this.enemyWaveInterval = setInterval(async () => {
        const elapsed = Date.now() - this.enemyWaveStartTime;

        if (elapsed >= this.enemyWaveDuration) {
          clearInterval(this.enemyWaveInterval);
          this.enemyWaveInterval = null;
          this.enemyWaveActive = false;
          console.log('[spawnEnemyWave] Enemy wave ended');
          return;
        }

        // Respawn if slots are empty
        await this.spawnRandomEnemy();
      }, 2000); // Respawn every 2 seconds

      return true;
    } catch (error) {
      console.error('[spawnEnemyWave] Error:', error.message);
      return false;
    }
  }

  // Spawn Koopa wave
  async spawnKoopaWave(duration = 20) {
    try {
      console.log(`[spawnKoopaWave] Spawning Koopa wave for ${duration} seconds`);

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
        console.log('[spawnKoopaWave] Koopa wave ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[spawnKoopaWave] Error:', error.message);
      return false;
    }
  }

  // Spawn Buzzy Beetle wave
  async spawnBuzzyBeetleWave(duration = 20) {
    try {
      console.log(`[spawnBuzzyBeetleWave] Spawning Buzzy Beetle wave for ${duration} seconds`);

      const interval = setInterval(async () => {
        await this.spawnEnemyNearMario(SPRITE_TYPES.BUZZY_BEETLE, 40, -16);
      }, 2000);

      this.activeTimers.set('buzzyWave', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('buzzyWave');
        console.log('[spawnBuzzyBeetleWave] Buzzy Beetle wave ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[spawnBuzzyBeetleWave] Error:', error.message);
      return false;
    }
  }

  // Spawn Piranha Plant wave
  async spawnPiranhaPlantWave(duration = 20) {
    try {
      console.log(`[spawnPiranhaPlantWave] Spawning Piranha Plant wave for ${duration} seconds`);

      const interval = setInterval(async () => {
        const offset = Math.random() > 0.5 ? 64 : -64;
        await this.spawnEnemyNearMario(SPRITE_TYPES.PIRANHA_PLANT, offset, 0);
      }, 3000);

      this.activeTimers.set('piranhaWave', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('piranhaWave');
        console.log('[spawnPiranhaPlantWave] Piranha Plant wave ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[spawnPiranhaPlantWave] Error:', error.message);
      return false;
    }
  }

  // Spawn Boo circle
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

      console.log(`[spawnBooCircle] Spawned ${count} Boos in circle`);
      return true;
    } catch (error) {
      console.error('[spawnBooCircle] Error:', error.message);
      return false;
    }
  }

  // Spawn Bullet Bill barrage
  async spawnBulletBillBarrage(duration = 15) {
    try {
      console.log(`[spawnBulletBillBarrage] Starting Bullet Bill barrage for ${duration} seconds`);

      const interval = setInterval(async () => {
        // Spawn from right side
        await this.spawnEnemyNearMario(SPRITE_TYPES.BULLET_BILL, 80, Math.floor(Math.random() * 40) - 20);
      }, 1000);

      this.activeTimers.set('bulletBillBarrage', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('bulletBillBarrage');
        console.log('[spawnBulletBillBarrage] Bullet Bill barrage ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[spawnBulletBillBarrage] Error:', error.message);
      return false;
    }
  }

  // Spawn Thwomp
  async spawnThwomp() {
    try {
      const pos = await this.getMarioPosition();
      await this.spawnSpriteAtPosition(SPRITE_TYPES.THWOMP, pos.x, pos.y - 64);
      console.log('[spawnThwomp] Spawned Thwomp above Mario');
      return true;
    } catch (error) {
      console.error('[spawnThwomp] Error:', error.message);
      return false;
    }
  }

  // Spawn Chargin' Chuck
  async spawnCharginChuck() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.CHARGIN_CHUCK, 48, 0);
      console.log('[spawnCharginChuck] Spawned Chargin\' Chuck');
      return true;
    } catch (error) {
      console.error('[spawnCharginChuck] Error:', error.message);
      return false;
    }
  }

  // Spawn Bob-omb
  async spawnBobOmb() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.BOB_OMB, 32, -16);
      console.log('[spawnBobOmb] Spawned Bob-omb');
      return true;
    } catch (error) {
      console.error('[spawnBobOmb] Error:', error.message);
      return false;
    }
  }

  // Spawn Magikoopa
  async spawnMagikoopa() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.MAGIKOOPA, 64, -32);
      console.log('[spawnMagikoopa] Spawned Magikoopa');
      return true;
    } catch (error) {
      console.error('[spawnMagikoopa] Error:', error.message);
      return false;
    }
  }

  // Spawn Dry Bones
  async spawnDryBones() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.DRY_BONES, 40, 0);
      console.log('[spawnDryBones] Spawned Dry Bones');
      return true;
    } catch (error) {
      console.error('[spawnDryBones] Error:', error.message);
      return false;
    }
  }

  // Clear all enemies
  async clearAllEnemies() {
    try {
      // Clear all 12 sprite slots
      for (let i = 0; i < 12; i++) {
        await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS + i, Buffer.from([0x00]));
      }
      console.log('[clearAllEnemies] Cleared all enemy sprites');
      return true;
    } catch (error) {
      console.error('[clearAllEnemies] Error:', error.message);
      return false;
    }
  }

  // Make enemies invisible
  async makeEnemiesInvisible(duration = 30) {
    try {
      console.log(`[makeEnemiesInvisible] Making enemies invisible for ${duration} seconds`);

      // Hide all sprites by setting Y position off-screen
      const interval = setInterval(async () => {
        // Batch create buffer for all 128 sprite Y positions
        // Each sprite in OAM is 4 bytes, Y position is at offset +1
        const offscreenBuffer = Buffer.alloc(128);
        offscreenBuffer.fill(240); // 240 = off-screen Y position

        // Write all Y positions in a single batch for better performance
        for (let i = 0; i < 128; i++) {
          const yPosAddr = MEMORY_ADDRESSES.OAM_SPRITE_TABLE + (i * 4) + 1;
          await this.writeWithRetry(yPosAddr, Buffer.from([240]));
        }
      }, 8); // ~120fps refresh for smoother invisibility

      this.activeTimers.set('invisibleEnemies', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('invisibleEnemies');
        console.log('[makeEnemiesInvisible] Enemy visibility restored');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[makeEnemiesInvisible] Error:', error.message);
      return false;
    }
  }

  // Double enemy speed
  async doubleEnemySpeed(duration = 20) {
    try {
      console.log(`[doubleEnemySpeed] Doubling enemy speed for ${duration} seconds`);

      const interval = setInterval(async () => {
        // Read and double X/Y velocity for all active sprites
        for (let i = 0; i < 12; i++) {
          const status = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_STATUS + i, 1);
          if (status[0] !== 0x00) {
            const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_X_SPEED + i, 1);
            const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.SPRITE_Y_SPEED + i, 1);

            // Double the speeds (treating as signed bytes)
            let newXSpeed = (xSpeed[0] << 24 >> 24) * 2; // Convert to signed
            let newYSpeed = (ySpeed[0] << 24 >> 24) * 2;

            // Clamp to byte range
            newXSpeed = Math.max(-128, Math.min(127, newXSpeed));
            newYSpeed = Math.max(-128, Math.min(127, newYSpeed));

            await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_X_SPEED + i, Buffer.from([newXSpeed & 0xFF]));
            await this.writeWithRetry(MEMORY_ADDRESSES.SPRITE_Y_SPEED + i, Buffer.from([newYSpeed & 0xFF]));
          }
        }
      }, 100); // Refresh every 100ms

      this.activeTimers.set('doubleEnemySpeed', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('doubleEnemySpeed');
        console.log('[doubleEnemySpeed] Enemy speed restored');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[doubleEnemySpeed] Error:', error.message);
      return false;
    }
  }

  // Spawn Rex
  async spawnRex() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.REX, 40, 0);
      console.log('[spawnRex] Spawned Rex');
      return true;
    } catch (error) {
      console.error('[spawnRex] Error:', error.message);
      return false;
    }
  }

  // Spawn Wiggler
  async spawnWiggler() {
    try {
      await this.spawnEnemyNearMario(SPRITE_TYPES.WIGGLER, 48, 0);
      console.log('[spawnWiggler] Spawned Wiggler');
      return true;
    } catch (error) {
      console.error('[spawnWiggler] Error:', error.message);
      return false;
    }
  }

  // Spawn boss (Reznor or Bowser)
  async spawnBoss(bossType = 'reznor') {
    try {
      const bossSprite = bossType === 'bowser' ? SPRITE_TYPES.BOWSER : SPRITE_TYPES.REZNOR;
      const pos = await this.getMarioPosition();
      await this.spawnSpriteAtPosition(bossSprite, pos.x + 64, pos.y);
      console.log(`[spawnBoss] Spawned ${bossType}`);
      return true;
    } catch (error) {
      console.error('[spawnBoss] Error:', error.message);
      return false;
    }
  }

  // ============= CATEGORY 3: LEVEL/WORLD WARPING (15 methods) =============

  // Warp to specific level
  async warpToLevel(levelNumber, sublevel = 0) {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.TRANSLEVEL_NUMBER, Buffer.from([levelNumber]));
      console.log(`[warpToLevel] Warped to level ${levelNumber}`);
      return true;
    } catch (error) {
      console.error('[warpToLevel] Error:', error.message);
      return false;
    }
  }

  // Warp to World 1 (Yoshi's Island)
  async warpToWorld1() {
    return await this.warpToLevel(0x00); // Level 101 (Yoshi's Island 1)
  }

  // Warp to World 2 (Donut Plains)
  async warpToWorld2() {
    return await this.warpToLevel(0x18); // Level 105 (Donut Plains 1)
  }

  // Warp to World 3 (Vanilla Dome)
  async warpToWorld3() {
    return await this.warpToLevel(0x2E); // Level 109 (Vanilla Dome 1)
  }

  // Warp to World 4 (Twin Bridges)
  async warpToWorld4() {
    return await this.warpToLevel(0x40); // Level 10D (Cheese Bridge Area)
  }

  // Warp to World 5 (Forest of Illusion)
  async warpToWorld5() {
    return await this.warpToLevel(0x4E); // Level 111 (Forest of Illusion 1)
  }

  // Warp to World 6 (Chocolate Island)
  async warpToWorld6() {
    return await this.warpToLevel(0x5C); // Level 115 (Chocolate Island 1)
  }

  // Warp to World 7 (Valley of Bowser)
  async warpToWorld7() {
    return await this.warpToLevel(0x6E); // Level 11A (Valley of Bowser 1)
  }

  // Warp to Special World (Star World)
  async warpToSpecialWorld() {
    return await this.warpToLevel(0x76); // Level 1C6 (Star World 1)
  }

  // Warp to Bowser's Castle
  async warpToBowserCastle() {
    return await this.warpToLevel(0x0D); // Level 0D (Bowser's Castle)
  }

  // Warp to random level
  async warpToRandomLevel() {
    const levels = [0x00, 0x18, 0x2E, 0x40, 0x4E, 0x5C, 0x6E, 0x76];
    const randomLevel = levels[Math.floor(Math.random() * levels.length)];
    return await this.warpToLevel(randomLevel);
  }

  // Force secret exit
  async forceSecretExit() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.EXIT_TYPE, Buffer.from([0x01]));
      console.log('[forceSecretExit] Set exit type to secret');
      return true;
    } catch (error) {
      console.error('[forceSecretExit] Error:', error.message);
      return false;
    }
  }

  // Set checkpoint
  async setCheckpoint() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.CHECKPOINT_FLAG, Buffer.from([0x01]));
      console.log('[setCheckpoint] Set midpoint checkpoint');
      return true;
    } catch (error) {
      console.error('[setCheckpoint] Error:', error.message);
      return false;
    }
  }

  // Clear checkpoint
  async clearCheckpoint() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.CHECKPOINT_FLAG, Buffer.from([0x00]));
      console.log('[clearCheckpoint] Cleared checkpoint');
      return true;
    } catch (error) {
      console.error('[clearCheckpoint] Error:', error.message);
      return false;
    }
  }

  // Return to world map
  async returnToWorldMap() {
    try {
      await this.writeWithRetry(MEMORY_ADDRESSES.GAME_MODE, Buffer.from([GAME_MODES.OVERWORLD]));
      console.log('[returnToWorldMap] Returned to overworld');
      return true;
    } catch (error) {
      console.error('[returnToWorldMap] Error:', error.message);
      return false;
    }
  }

  // Warp to Ghost House
  async warpToGhostHouse() {
    return await this.warpToLevel(0x14); // Level 14 (Donut Ghost House)
  }

  // ============= CATEGORY 4: PHYSICS/MOVEMENT CHAOS (15 methods) =============

  // Modify Mario's speed
  async modifyMarioSpeed(multiplier, duration = 30) {
    try {
      console.log(`[modifyMarioSpeed] Modifying speed by ${multiplier}x for ${duration} seconds`);

      const interval = setInterval(async () => {
        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);

        // Treat as signed byte
        let speed = xSpeed[0] << 24 >> 24;

        // If speed is very low, set a minimum to make the effect noticeable
        if (Math.abs(speed) > 0 && Math.abs(speed) < 8) {
          speed = speed > 0 ? 16 : -16;
        }

        speed = Math.floor(speed * multiplier);
        speed = Math.max(-128, Math.min(127, speed));

        await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
      }, 16); // ~60fps refresh

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

  // Half speed
  async halfSpeed(duration = 30) {
    return await this.modifyMarioSpeed(0.5, duration);
  }

  // Double speed (use 3x multiplier for more noticeable effect)
  async doubleSpeed(duration = 30) {
    return await this.modifyMarioSpeed(3.0, duration);
  }

  // Modify jump height
  async modifyJumpHeight(multiplier, duration = 30) {
    try {
      console.log(`[modifyJumpHeight] Modifying jump height by ${multiplier}x for ${duration} seconds`);

      const interval = setInterval(async () => {
        const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, 1);

        // Only modify upward velocity (negative Y = up)
        let speed = ySpeed[0] << 24 >> 24;
        if (speed < 0) { // Jumping (moving up)
          speed = Math.floor(speed * multiplier);
          speed = Math.max(-128, Math.min(0, speed));
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16); // ~60fps refresh

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

  // Moon jump
  async moonJump(duration = 30) {
    return await this.modifyJumpHeight(1.5, duration);
  }

  // Tiny jump
  async tinyJump(duration = 30) {
    return await this.modifyJumpHeight(0.3, duration);
  }

  // Modify gravity
  async modifyGravity(multiplier, duration = 30) {
    try {
      console.log(`[modifyGravity] Modifying gravity by ${multiplier}x for ${duration} seconds`);

      const interval = setInterval(async () => {
        const ySpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, 1);

        // Only modify downward velocity (positive Y = down)
        let speed = ySpeed[0] << 24 >> 24;
        if (speed > 0) { // Falling (moving down)
          speed = Math.floor(speed * multiplier);
          speed = Math.max(0, Math.min(127, speed));
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_Y_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 16); // ~60fps refresh

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

  // Low gravity
  async lowGravity(duration = 30) {
    return await this.modifyGravity(0.5, duration);
  }

  // High gravity
  async highGravity(duration = 30) {
    return await this.modifyGravity(2.0, duration);
  }

  // Reverse controls
  async reverseControls(duration = 20) {
    try {
      console.log(`[reverseControls] Reversing controls for ${duration} seconds`);

      const interval = setInterval(async () => {
        const controller = await this.readWithRetry(MEMORY_ADDRESSES.CONTROLLER_1_CURRENT, 1);
        let buttons = controller[0];

        // Swap left and right bits
        const left = (buttons & CONTROLLER_BUTTONS.LEFT) !== 0;
        const right = (buttons & CONTROLLER_BUTTONS.RIGHT) !== 0;

        if (left) {
          buttons = (buttons & ~CONTROLLER_BUTTONS.LEFT) | CONTROLLER_BUTTONS.RIGHT;
        } else if (right) {
          buttons = (buttons & ~CONTROLLER_BUTTONS.RIGHT) | CONTROLLER_BUTTONS.LEFT;
        }

        await this.writeWithRetry(MEMORY_ADDRESSES.CONTROLLER_1_CURRENT, Buffer.from([buttons]));
      }, 16); // ~60fps refresh

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

  // Enable ice physics (slippery controls)
  async enableIcePhysics(duration = 30) {
    try {
      console.log(`[enableIcePhysics] Enabling ice physics for ${duration} seconds`);

      // Reduce friction by continuously adding momentum
      const interval = setInterval(async () => {
        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;

        // Add slight momentum in current direction (ice slide effect)
        if (speed > 0) {
          speed = Math.min(127, speed + 1);
        } else if (speed < 0) {
          speed = Math.max(-128, speed - 1);
        }

        await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
      }, 100); // Update every 100ms

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

  // Disable running
  async disableRunning(duration = 20) {
    try {
      console.log(`[disableRunning] Disabling running for ${duration} seconds`);

      const interval = setInterval(async () => {
        // Set P-meter to 0 AND cap horizontal speed
        await this.writeWithRetry(MEMORY_ADDRESSES.P_METER, Buffer.from([0x00]));

        // Cap speed to prevent running
        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;
        if (Math.abs(speed) > 16) {
          speed = speed > 0 ? 16 : -16;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 8); // ~120fps refresh for responsive control

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

  // Force continuous run
  async forceContinuousRun(duration = 20) {
    try {
      console.log(`[forceContinuousRun] Forcing continuous run for ${duration} seconds`);

      const interval = setInterval(async () => {
        // Set P-meter to max AND boost horizontal speed
        await this.writeWithRetry(MEMORY_ADDRESSES.P_METER, Buffer.from([112]));

        // Boost speed to running level
        const xSpeed = await this.readWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, 1);
        let speed = xSpeed[0] << 24 >> 24;
        if (Math.abs(speed) > 0 && Math.abs(speed) < 32) {
          speed = speed > 0 ? 40 : -40;
          await this.writeWithRetry(MEMORY_ADDRESSES.PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
        }
      }, 8); // ~120fps refresh for responsive control

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

  // Random physics chaos
  async randomPhysicsChaos(duration = 30) {
    const physicsMods = [
      () => this.halfSpeed(duration),
      () => this.doubleSpeed(duration),
      () => this.moonJump(duration),
      () => this.tinyJump(duration),
      () => this.lowGravity(duration),
      () => this.highGravity(duration),
      () => this.enableIcePhysics(duration)
    ];

    const randomMod = physicsMods[Math.floor(Math.random() * physicsMods.length)];
    console.log('[randomPhysicsChaos] Applying random physics modifier');
    return await randomMod();
  }

  // ============= KO PLAYER (MAIN ACTION) =============
  // killPlayer method removed - using hoellOps version with poison mushroom multi-sprite tester
  // The hoellOps.killPlayer will be called via fallback chain

  // ============= CATEGORY 5: CHAOS EFFECTS (Block/Floor Manipulation) =============

  // Spawn random blocks around Mario
  async spawnRandomBlocks(count = 5) {
    try {
      console.log(`[spawnRandomBlocks] Spawning ${count} random blocks around Mario`);

      const pos = await this.getMarioPosition();

      for (let i = 0; i < count; i++) {
        // Random offset around Mario
        const offsetX = Math.floor(Math.random() * 128) - 64;
        const offsetY = Math.floor(Math.random() * 80) - 40;

        // Spawn various block-like sprites
        const blockTypes = [
          SPRITE_TYPES.SPRINGBOARD,      // Springboard
          SPRITE_TYPES.P_SWITCH,         // P-Switch
          SPRITE_TYPES.TRAMPOLINE,       // Trampoline
          SPRITE_TYPES.MOVING_PLATFORM,  // Moving platform
          SPRITE_TYPES.FALLING_PLATFORM  // Falling platform (creates chaos!)
        ];

        const randomBlock = blockTypes[Math.floor(Math.random() * blockTypes.length)];
        await this.spawnSpriteAtPosition(randomBlock, pos.x + offsetX, pos.y + offsetY);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[spawnRandomBlocks] Spawned ${count} random blocks`);
      return true;
    } catch (error) {
      console.error('[spawnRandomBlocks] Error:', error.message);
      return false;
    }
  }

  // Remove floor blocks beneath Mario (spawn munchers to create obstacles)
  async removeFloorBlocks(count = 3, duration = 20) {
    try {
      console.log(`[removeFloorBlocks] Creating ${count} floor hazards for ${duration} seconds`);

      const interval = setInterval(async () => {
        const pos = await this.getMarioPosition();

        // Spawn munchers (spiky obstacles) beneath Mario
        for (let i = 0; i < count; i++) {
          const offsetX = Math.floor(Math.random() * 64) - 32;

          // Spawn muncher sprites near floor (these act like "removed floor")
          // Sprite type 0x89 = Muncher (spiky floor hazard)
          await this.spawnSpriteAtPosition(0x89, pos.x + offsetX, pos.y + 32);
        }
      }, 3000); // Spawn every 3 seconds

      this.activeTimers.set('floorRemoval', interval);

      setTimeout(() => {
        clearInterval(interval);
        this.activeTimers.delete('floorRemoval');
        console.log('[removeFloorBlocks] Floor hazard spawning ended');
      }, duration * 1000);

      return true;
    } catch (error) {
      console.error('[removeFloorBlocks] Error:', error.message);
      return false;
    }
  }

  // ============= CLEANUP =============
  cleanup() {
    // Clear all active timers
    if (this.physicsModInterval) {
      clearInterval(this.physicsModInterval);
      this.physicsModInterval = null;
    }
    if (this.enemyWaveInterval) {
      clearInterval(this.enemyWaveInterval);
      this.enemyWaveInterval = null;
    }

    // Clear all generic timers
    for (const [key, timer] of this.activeTimers.entries()) {
      clearInterval(timer);
      this.activeTimers.delete(key);
    }

    console.log('[cleanup] Cleared all active timers and intervals');
  }
}

module.exports = ExpandedGameOperations;
