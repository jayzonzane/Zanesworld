/**
 * HoellCC Operations
 *
 * Extended SMW operations ported from HoellCC C# implementation
 * Total: 120 net-new operations (127 total minus 7 duplicates)
 *
 * Ported from: HoellCC/HoellCC/Services/SmwOperations.cs
 *
 * Categories:
 * - Environmental Physics (7 operations)
 * - Speed Control (5 operations)
 * - Silver P-Switch (2 operations)
 * - Enemy Spawns (43 operations)
 * - Power-up Spawns (5 operations)
 * - Helper Spawns (8 operations)
 * - MarioMod Block Operations (5 operations)
 * - Chaos/Random (2 operations)
 */

const MarioModSpawner = require('./mariomod-spawner');

class HoellCCOperations {
  constructor(sniClient) {
    this.client = sniClient;
    this.spawner = new MarioModSpawner(sniClient);
    this.activeTimers = new Map(); // Track timed effects for cleanup

    // Memory addresses (0x7E0000 base)
    this.ADDR_UNDERWATER_FLAG = 0x7E0085;
    this.ADDR_ICE_FLAG = 0x7E0086;
    this.ADDR_PLAYER_FROZEN = 0x7E0088;
    this.ADDR_PLAYER_X_SPEED = 0x7E007B;
    this.ADDR_PLAYER_Y_SPEED = 0x7E007D;
    this.ADDR_PSWITCH_TIMER = 0x7E14AD;
    this.ADDR_CAMERA_X = 0x7E1462;        // Camera X position (2 bytes)
    this.ADDR_PLAYER_ANIMATION = 0x7E0071; // Player animation state
    this.ADDR_SILVER_PSWITCH_TIMER = 0x7E14AE;
    this.MARIOMOD_KAIZO_BLOCK_TRIGGER = 0x7E1DEF;
    this.MARIOMOD_SPRITE_REPLACE_TRIGGER = 0x7E1DF0;
  }

  // ========================================================================
  // ENVIRONMENTAL PHYSICS (7 operations)
  // ========================================================================

  /**
   * Enables swimming physics on land
   * Port from HoellCC SmwOperations.cs (water mode operations)
   */
  async setWaterMode() {
    try {
      await this.client.writeMemory(this.ADDR_UNDERWATER_FLAG, Buffer.from([0x01]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Disables swimming physics (normal land physics)
   */
  async setLandMode() {
    try {
      await this.client.writeMemory(this.ADDR_UNDERWATER_FLAG, Buffer.from([0x00]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enables water mode for a duration, then auto-reverts
   * @param {number} duration - Duration in seconds (default: 30)
   */
  async setWaterModeTimed(duration = 30) {
    const result = await this.setWaterMode();
    if (result.success) {
      // Clear any existing timer
      if (this.activeTimers.has('waterMode')) {
        clearTimeout(this.activeTimers.get('waterMode'));
      }

      // Set new timer
      const timer = setTimeout(async () => {
        await this.setLandMode();
        this.activeTimers.delete('waterMode');
      }, duration * 1000);

      this.activeTimers.set('waterMode', timer);
    }
    return result;
  }

  /**
   * Enables ice/slippery physics
   */
  async setIceMode() {
    try {
      await this.client.writeMemory(this.ADDR_ICE_FLAG, Buffer.from([0x01]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Disables ice physics (normal traction)
   */
  async setDryMode() {
    try {
      await this.client.writeMemory(this.ADDR_ICE_FLAG, Buffer.from([0x00]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enables ice mode for a duration, then auto-reverts
   * @param {number} duration - Duration in seconds (default: 30)
   */
  async setIceModeTimed(duration = 30) {
    const result = await this.setIceMode();
    if (result.success) {
      // Clear any existing timer
      if (this.activeTimers.has('iceMode')) {
        clearTimeout(this.activeTimers.get('iceMode'));
      }

      // Set new timer
      const timer = setTimeout(async () => {
        await this.setDryMode();
        this.activeTimers.delete('iceMode');
      }, duration * 1000);

      this.activeTimers.set('iceMode', timer);
    }
    return result;
  }

  /**
   * Freezes player movement (locks Mario in place)
   */
  async freezePlayer() {
    try {
      // Clear any existing freeze interval
      if (this.activeTimers.has('freezePlayer')) {
        clearInterval(this.activeTimers.get('freezePlayer'));
      }

      // Continuously lock player speeds to 0
      const interval = setInterval(async () => {
        try {
          await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([0x00]));
          await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([0x00]));
        } catch (err) {
          console.error('[freezePlayer] Error locking speeds:', err.message);
        }
      }, 16); // Every frame

      this.activeTimers.set('freezePlayer', interval);
      console.log('[freezePlayer] Player frozen');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Unfreezes player movement
   */
  async unfreezePlayer() {
    try {
      // Stop the freeze interval
      if (this.activeTimers.has('freezePlayer')) {
        clearInterval(this.activeTimers.get('freezePlayer'));
        this.activeTimers.delete('freezePlayer');
        console.log('[unfreezePlayer] Player unfrozen');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========================================================================
  // SPEED CONTROL (5 operations)
  // ========================================================================

  /**
   * Launches Mario to the right with upward velocity
   * Port from HoellCC SmwOperations.cs kick operations
   */
  async kickRight() {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([64])); // +64 right
      await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([224])); // -32 up (signed)
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Launches Mario to the left with upward velocity
   */
  async kickLeft() {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([192])); // -64 left (signed)
      await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([224])); // -32 up (signed)
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Launches Mario straight up
   */
  async kickUp() {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_Y_SPEED, Buffer.from([192])); // -64 up (signed)
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Pushes Mario to the right
   * @param {number} speed - Speed value (default: 32)
   */
  async pushRight(speed = 32) {
    try {
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([speed & 0xFF]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Pushes Mario to the left
   * @param {number} speed - Speed value (default: 32)
   */
  async pushLeft(speed = 32) {
    try {
      const signedSpeed = (256 - speed) & 0xFF;
      await this.client.writeMemory(this.ADDR_PLAYER_X_SPEED, Buffer.from([signedSpeed]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========================================================================
  // SILVER P-SWITCH (2 operations)
  // ========================================================================

  /**
   * Activates Silver P-Switch (turns enemies into silver coins)
   * @param {number} duration - Timer value in frames (default: 255)
   */
  async activateSilverPSwitch(duration = 255) {
    try {
      await this.client.writeMemory(this.ADDR_SILVER_PSWITCH_TIMER, Buffer.from([duration & 0xFF]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Spawns a Silver P-Switch item
   */
  async spawnSilverPSwitch() {
    return await this.spawner.spawnSprite(0x26, 32, 0);
  }

  // ========================================================================
  // ENEMY SPAWNS (43 operations)
  // All using MarioMod position-relative spawning
  // Sprite IDs from HoellCC SmwOperations.cs:336-540
  // ========================================================================

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

  async spawnBobOmb() {
    return await this.spawner.spawnEnemy(0x0D, 32, 0);
  }

  async spawnRex() {
    return await this.spawner.spawnEnemy(0x0F, 32, 0);
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

  async spawnMagikoopa() {
    return await this.spawner.spawnEnemy(0x14, 32, 0);
  }

  async spawnWiggler() {
    return await this.spawner.spawnEnemy(0x15, 32, 0);
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

  async spawnThwomp() {
    return await this.spawner.spawnEnemy(0x1F, 0, -64);
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

  async spawnDryBones() {
    return await this.spawner.spawnEnemy(0x28, 32, 0);
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

  // ========================================================================
  // POWER-UP SPAWNS (5 operations)
  // ========================================================================

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

  // ========================================================================
  // HELPER SPAWNS (8 operations)
  // NOTE: MarioMod uses custom sprite IDs that differ from standard SMW
  // Many helpers spawn incorrect sprites - need MarioMod sprite table documentation
  // TODO: Implement area-specific spawn detection (some items only work in certain levels)
  // ========================================================================

  async spawnYoshi() {
    // Yoshi sprite - spawns adult Yoshi directly (not egg)
    // Port from HoellCC SmwOperations.cs:434
    return await this.spawner.spawnSprite(0x35, 32, 0);
  }

  async spawnBabyYoshi() {
    // Baby Yoshi sprite - spawns baby Yoshi directly
    // Port from HoellCC SmwOperations.cs:440
    return await this.spawner.spawnSprite(0x2D, 32, 0);
  }

  async spawnLakituCloud() {
    // DISABLED: Cloud not directly spawnable via MarioMod
    console.log('[spawnLakituCloud] Not implemented - cloud requires specific level context');
    return { success: false, error: 'Cloud spawn not available' };
  }

  async spawnBluePSwitch() {
    // DISABLED: Spawns incorrect sprite (wrong ID for MarioMod)
    console.log('[spawnBluePSwitch] Disabled - incorrect sprite ID for MarioMod');
    return { success: false, error: 'Blue P-Switch spawn needs correct MarioMod sprite ID' };
  }

  async spawnBeanstalk() {
    // DISABLED: May be area-specific or wrong sprite ID
    console.log('[spawnBeanstalk] Disabled - may require specific level context');
    return { success: false, error: 'Beanstalk spawn needs area detection' };
  }

  async spawnKey() {
    // DISABLED: Spawns flying coin instead of key (wrong sprite ID)
    console.log('[spawnKey] Disabled - spawns incorrect sprite');
    return { success: false, error: 'Key spawn needs correct MarioMod sprite ID' };
  }

  async spawnSpringboard() {
    // DISABLED: Spawns end level tape instead of springboard (wrong sprite ID)
    console.log('[spawnSpringboard] Disabled - spawns incorrect sprite');
    return { success: false, error: 'Springboard spawn needs correct MarioMod sprite ID' };
  }

  async spawnPSwitch() {
    // DISABLED: Spawns incorrect sprite (wrong ID for MarioMod)
    console.log('[spawnPSwitch] Disabled - incorrect sprite ID for MarioMod');
    return { success: false, error: 'P-Switch spawn needs correct MarioMod sprite ID' };
  }

  // ========================================================================
  // MARIOMOD BLOCK OPERATIONS (5 operations)
  // Require MarioMod patch
  // ========================================================================

  /**
   * Spawns a purple poison mushroom (custom sprite for ROM hacks)
   * The mushroom will spawn near Mario and kill him when touched
   */
  async spawnPoisonMushroom() {
    // Purple poison mushroom - custom sprite (common in ROM hacks)
    // Sprite ID 0xC7 (199 decimal) - Invisible Mushroom slot, often repurposed
    // Spawn slightly above Mario so it falls down
    return await this.spawner.spawnSprite(0xC7, 0, -32, true);
  }

  /**
   * Kill player with poison mushroom (visual death effect)
   * Spawns a purple poison mushroom on Mario's position
   */
  async killPlayer() {
    try {
      console.log('[killPlayer] Killing Mario by setting timer to 1 second...');

      // Set game timer to 1 second to trigger time-up death
      // Timer digits: 0x7E0F31 (hundreds), 0x7E0F32 (tens), 0x7E0F33 (ones)
      await this.client.writeMemory(0x7E0F31, Buffer.from([0x00])); // Hundreds = 0
      await this.client.writeMemory(0x7E0F32, Buffer.from([0x00])); // Tens = 0
      await this.client.writeMemory(0x7E0F33, Buffer.from([0x01])); // Ones = 1

      console.log('[killPlayer] Timer set to 001 - time-up death will trigger in 1 second');
      return { success: true };
    } catch (error) {
      console.error('[killPlayer] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Spawns Kaizo blocks ONCE at the start of each jump
   * Blocks spawn immediately when jump is detected
   */
  async spawnKaizoBlock() {
    try {
      let wasJumping = false;
      const allSpawnedBlocks = []; // Track all spawned blocks for cleanup
      const MAX_BLOCKS = 100; // Maximum blocks to prevent level crash

      // Monitor for jump START - detect transition to upward velocity
      const checkInterval = setInterval(async () => {
        try {
          // Read Y velocity to detect if Mario is jumping upward
          const ySpeed = await this.client.readMemory(0x7E007D, 1); // PLAYER_Y_SPEED
          const yVel = ySpeed[0] << 24 >> 24; // Convert to signed
          const isJumping = yVel < -5; // Jumping if moving upward with decent speed

          // JUMP START DETECTED - Spawn blocks ONCE
          if (isJumping && !wasJumping) {
            console.log('[spawnKaizoBlock] Jump START detected - spawning blocks NOW');

            // Check if we've hit the block limit (safety check)
            if (allSpawnedBlocks.length >= MAX_BLOCKS) {
              console.log(`[spawnKaizoBlock] Block limit reached (${MAX_BLOCKS}) - skipping spawn`);
              wasJumping = isJumping;
              return;
            }

            // Read X velocity to determine direction
            const xSpeed = await this.client.readMemory(0x7E007B, 1); // PLAYER_X_SPEED
            const xVel = xSpeed[0] << 24 >> 24; // Convert to signed

            // Spawn 5 blocks directly in Mario's path
            const blockOffsets = [];
            if (xVel > 0) {
              // Moving right
              blockOffsets.push({ x: 8, y: 0 });
              blockOffsets.push({ x: 16, y: 0 });
              blockOffsets.push({ x: 24, y: 0 });
              blockOffsets.push({ x: 32, y: 0 });
              blockOffsets.push({ x: 40, y: 0 });
            } else if (xVel < 0) {
              // Moving left
              blockOffsets.push({ x: -8, y: 0 });
              blockOffsets.push({ x: -16, y: 0 });
              blockOffsets.push({ x: -24, y: 0 });
              blockOffsets.push({ x: -32, y: 0 });
              blockOffsets.push({ x: -40, y: 0 });
            } else {
              // Standing still - blocks directly above
              blockOffsets.push({ x: -8, y: 0 });
              blockOffsets.push({ x: 0, y: 0 });
              blockOffsets.push({ x: 8, y: 0 });
            }

            // Spawn all invisible blocks (Map16 0x0021)
            for (const offset of blockOffsets) {
              await this.spawner.spawnBlockViaMarioMod(0x0021, offset.x, offset.y);
              allSpawnedBlocks.push(offset);
            }

            console.log(`[spawnKaizoBlock] Spawned ${blockOffsets.length} blocks at jump start (xVel: ${xVel})`);
          }

          // Update state for next frame
          wasJumping = isJumping;
        } catch (error) {
          console.error('[spawnKaizoBlock] Monitor error:', error.message);
          clearInterval(checkInterval);
          this.activeTimers.delete('spawnKaizoBlock');
        }
      }, 16); // Check every frame (~60fps)

      this.activeTimers.set('spawnKaizoBlock', checkInterval);

      // Auto-cancel after 10 seconds if no jump
      setTimeout(() => {
        if (this.activeTimers.has('spawnKaizoBlock')) {
          clearInterval(this.activeTimers.get('spawnKaizoBlock'));
          this.activeTimers.delete('spawnKaizoBlock');
          console.log('[spawnKaizoBlock] Timeout - no jump button press detected');
        }
      }, 10000);

      console.log('[spawnKaizoBlock] Armed - waiting for jump...');
      return { success: true };
    } catch (error) {
      console.error('[spawnKaizoBlock] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Spawns a Muncher (green spiky plant block)
   * Munchers are static green spiky plants that damage Mario
   * Yoshi can eat them, but Mario cannot jump on them
   * Port from HoellCC SmwOperations.cs:555
   */
  async spawnMuncher() {
    // Muncher is a BLOCK (Map16 0x012F), not a sprite!
    // Positioned: xNeg=32 (32px left), yPos=16 (16px up)
    return await this.spawner.spawnBlockViaMarioMod(0x012F, -32, 16);
  }

  /**
   * Arms a Muncher block to spawn when Mario next jumps
   * Port from HoellCC SmwOperations.cs:556
   */
  async spawnMuncherOnJump() {
    // Muncher block (Map16 0x012F) spawns on next jump
    // Positioned: xPos=16, xNeg=16 (centered?), yPos=0, yNeg=0 (same height)
    return await this.spawner.spawnBlockOnJumpViaMarioMod(0x012F, 0, 0);
  }

  /**
   * Spawns a custom block at specified offset
   * @param {number} blockId - Block ID to spawn
   * @param {number} xOffset - X offset from Mario
   * @param {number} yOffset - Y offset from Mario
   */
  async spawnCustomBlock(blockId = 0x01, xOffset = 0, yOffset = 0) {
    return await this.spawner.spawnBlockViaMarioMod(blockId, xOffset, yOffset);
  }

  /**
   * Creates a pit ahead of Mario in his movement direction (chaos effect)
   * Spawns air blocks to create a deadly gap in the floor
   */
  async despawnFloorBlocks() {
    try {
      console.log('[despawnFloorBlocks] Creating pit ahead of Mario');

      // Read Mario's X velocity to determine direction
      const xSpeed = await this.client.readMemory(0x7E007B, 1); // PLAYER_X_SPEED
      const xVel = xSpeed[0] << 24 >> 24; // Convert to signed

      // Determine pit location based on movement direction
      let pitStartX;
      if (xVel > 0) {
        // Moving right - create pit 48-64 pixels ahead
        pitStartX = 48 + Math.floor(Math.random() * 17); // 48-64 pixels right
        console.log(`[despawnFloorBlocks] Moving right - pit at +${pitStartX}px`);
      } else if (xVel < 0) {
        // Moving left - create pit 48-64 pixels ahead
        pitStartX = -(48 + Math.floor(Math.random() * 17)); // 48-64 pixels left
        console.log(`[despawnFloorBlocks] Moving left - pit at ${pitStartX}px`);
      } else {
        // Standing still - create pit directly ahead (random direction)
        pitStartX = Math.random() < 0.5 ? 48 : -48;
        console.log(`[despawnFloorBlocks] Standing still - random pit at ${pitStartX > 0 ? '+' : ''}${pitStartX}px`);
      }

      // Create a 3-4 block wide pit
      const pitWidth = 3 + Math.floor(Math.random() * 2); // 3 or 4 blocks
      const pitBlocks = [];

      for (let i = 0; i < pitWidth; i++) {
        const xOffset = pitStartX + (i * 16 * Math.sign(pitStartX || 1));
        // Create vertical hole (remove multiple layers)
        pitBlocks.push({ x: xOffset, y: 16 });  // Floor level
        pitBlocks.push({ x: xOffset, y: 32 });  // Lower floor
        pitBlocks.push({ x: xOffset, y: 48 });  // Even lower
      }

      // Spawn air blocks to create the pit (Map16 0x0025)
      for (const block of pitBlocks) {
        await this.spawner.spawnBlockViaMarioMod(0x0025, block.x, block.y);
      }

      console.log(`[despawnFloorBlocks] Created ${pitWidth}-block wide pit ahead of Mario`);
      return { success: true };
    } catch (error) {
      console.error('[despawnFloorBlocks] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Spawns grinder/buzzsaw sprites ahead of Mario (chaos effect)
   * Creates deadly spinning saw hazards in his path
   */
  async floorToLava() {
    try {
      console.log('[floorToLava] Spawning grinders ahead of Mario');

      // Read Mario's X velocity to determine direction
      const xSpeed = await this.client.readMemory(0x7E007B, 1); // PLAYER_X_SPEED
      const xVel = xSpeed[0] << 24 >> 24; // Convert to signed

      // Determine grinder spawn location based on movement direction
      let spawnStartX;
      if (xVel > 0) {
        // Moving right - spawn grinders 48-64 pixels ahead
        spawnStartX = 48 + Math.floor(Math.random() * 17); // 48-64 pixels right
        console.log(`[floorToLava] Moving right - grinders at +${spawnStartX}px`);
      } else if (xVel < 0) {
        // Moving left - spawn grinders 48-64 pixels ahead
        spawnStartX = -(48 + Math.floor(Math.random() * 17)); // 48-64 pixels left
        console.log(`[floorToLava] Moving left - grinders at ${spawnStartX}px`);
      } else {
        // Standing still - spawn grinders directly ahead (random direction)
        spawnStartX = Math.random() < 0.5 ? 48 : -48;
        console.log(`[floorToLava] Standing still - random grinders at ${spawnStartX > 0 ? '+' : ''}${spawnStartX}px`);
      }

      // Spawn 2-3 grinders (non-line-guided, sprite 0xB4 / 180)
      const numGrinders = 2 + Math.floor(Math.random() * 2); // 2-3 grinders

      for (let i = 0; i < numGrinders; i++) {
        const xOffset = spawnStartX + (i * 24 * Math.sign(spawnStartX || 1));
        const offsets = this.spawner.convertSignedOffsets(xOffset, 16); // 16px below Mario

        await this.spawner.spawnSpriteViaMarioMod(
          103, // Sprite 0x67 - Line-guided grinder
          offsets.xPos,
          offsets.xNeg,
          offsets.yPos,
          offsets.yNeg,
          false // Not a custom sprite
        );
      }

      console.log(`[floorToLava] Spawned ${numGrinders} grinders ahead of Mario`);
      return { success: true };
    } catch (error) {
      console.error('[floorToLava] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Replaces a random alive sprite with a different random sprite (chaos effect)
   */
  async replaceRandomSprite() {
    try {
      await this.client.writeMemory(this.MARIOMOD_SPRITE_REPLACE_TRIGGER, Buffer.from([0x01]));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========================================================================
  // CHAOS/RANDOM OPERATIONS (2 operations)
  // ========================================================================

  /**
   * Detects current sprite tileset/GFX setting
   * Returns tileset category: 'universal', 'castle', 'ghost', 'underground', 'water'
   */
  async detectSpriteTileset() {
    try {
      // Try sprite GFX header address (commonly 0x7E0109)
      const gfxData = await this.client.readMemory(0x7E0109, 1);
      const spriteGfx = gfxData[0];

      // Sprite GFX values (approximate, may need adjustment):
      // 0x00-0x02 = Overworld/Grass (universal)
      // 0x03-0x05 = Castle/Fortress
      // 0x06-0x07 = Ghost House
      // 0x08-0x09 = Underground/Cave
      // 0x0A-0x0C = Water/Athletic

      if (spriteGfx >= 0x03 && spriteGfx <= 0x05) return 'castle';
      if (spriteGfx >= 0x06 && spriteGfx <= 0x07) return 'ghost';
      if (spriteGfx >= 0x08 && spriteGfx <= 0x09) return 'underground';
      if (spriteGfx >= 0x0A && spriteGfx <= 0x0C) return 'water';

      return 'universal';
    } catch (error) {
      console.error('[detectSpriteTileset] Error detecting tileset:', error.message);
      return 'universal'; // Safe fallback
    }
  }

  /**
   * Spawns a random enemy from tileset-appropriate pool
   * Detects current level tileset and spawns compatible sprites only
   *
   * Based on SMW Central sprite tileset compatibility:
   * - Universal: Work in all levels (basic enemies)
   * - Castle: Thwomp, Magikoopa, Dry Bones, etc.
   * - Ghost House: Boo, Big Boo, Fishin' Boo, etc.
   * - Underground: Buzzy Beetle, Spike Top, Swooper, etc.
   * - Water: Cheep Cheep, Blurp, Porcu-Puffer, etc.
   */
  async spawnRandomEnemy() {
    try {
      const tileset = await this.detectSpriteTileset();
      console.log(`[spawnRandomEnemy] Detected tileset: ${tileset}`);

      // Sprite pools organized by tileset compatibility
      const spritePools = {
        // Universal sprites - work everywhere (basic overworld enemies)
        universal: [
          0x00, // Green Koopa
          0x01, // Red Koopa
          0x02, // Spiny
          0x03, // Goomba
          0x04, // Hopping Flame
          0x05, // Koopa (unused shell color)
          0x06, // Green Shell (kicked)
          0x07, // Yellow Shell
          0x08, // Green Paratroopa
          0x09, // Red Paratroopa (straight)
          0x0A, // Red Paratroopa (circle)
          0x0B, // Blue Paratroopa
          0x0C, // Jumping Piranha Plant
          0x0D, // Bob-omb
          0x0E, // Ninji
          0x0F, // Rex
          0x10, // Para Goomba
          0x1A, // Piranha Plant
          0x1C, // Bullet Bill
        ],

        // Castle/Fortress tileset
        castle: [
          0x1F, // Magikoopa
          0x20, // Magikoopa's magic
          0x21, // Ball 'n' Chain
          0x22, // Banzai Bill
          0x23, // Fishbone
          0x24, // Thwimp
          0x25, // Podoboo (lava bubble)
          0x26, // Thwomp
          0x27, // Dry Bones
          0x1D, // Hammer Bro
          0x1E, // Sumo Bro
          // Include some universal
          0x00, 0x01, 0x0D, 0x1C
        ],

        // Ghost House tileset
        ghost: [
          0x28, // Boo
          0x37, // Big Boo
          0x38, // Eerie (ghost platform enemy)
          0xAE, // Fishin' Boo
          0x0D, // Bob-omb
          // Include some universal
          0x00, 0x01, 0x02, 0x03
        ],

        // Underground/Cave tileset
        underground: [
          0x11, // Buzzy Beetle
          0x13, // Spike Top
          0x15, // Swooper (bat)
          0x16, // Floating Skull
          0x1B, // Monty Mole
          0x2A, // Blargg (lava monster)
          0x2E, // Chuck (various types)
          0x12, // Lakitu
          // Include some universal
          0x00, 0x01, 0x02, 0x0D, 0x0E, 0x0F
        ],

        // Water/Athletic tileset
        water: [
          0x3A, // Rip Van Fish
          0x3B, // Porcupuffer
          0x3C, // Cheep Cheep (swimming)
          0x3D, // Blurp
          0x41, // Urchin
          0x42, // Torpedo Ted
          0x43, // Floating Mine
          0x44, // Blooper
          // Include some universal
          0x00, 0x01, 0x08, 0x0A
        ]
      };

      // Get appropriate pool for current tileset
      const pool = spritePools[tileset] || spritePools.universal;
      const randomId = pool[Math.floor(Math.random() * pool.length)];

      console.log(`[spawnRandomEnemy] Spawning sprite 0x${randomId.toString(16).toUpperCase().padStart(2, '0')} for tileset '${tileset}'`);
      return await this.spawner.spawnEnemy(randomId, 32, 0);

    } catch (error) {
      console.error('[spawnRandomEnemy] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Spawns alternating Bullet Bills from left and right for duration
   * Port from HoellCC SmwOperations.cs:350-370
   * @param {number} duration - Duration in seconds (default: 30)
   */
  async spawnBulletBillStorm(duration = 30) {
    const endTime = Date.now() + (duration * 1000);
    let fromLeft = true;

    // Create interval that spawns bullets every 800ms
    const stormInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(stormInterval);
        this.activeTimers.delete('bulletStorm');
        return;
      }

      // Random height offset (-60 to +60 pixels from Mario)
      const randomYOffset = Math.floor(Math.random() * 120) - 60;
      // Alternate spawn from left (-128px) and right (+128px)
      const xOffset = fromLeft ? -128 : 128;

      await this.spawner.spawnSprite(0x1C, xOffset, randomYOffset); // Bullet Bill sprite ID
      fromLeft = !fromLeft;
    }, 800);

    this.activeTimers.set('bulletStorm', stormInterval);
    return { success: true };
  }

  /**
   * Cleanup method - clears all active timers
   * Call this when disconnecting or resetting
   */
  cleanup() {
    for (const [key, timer] of this.activeTimers.entries()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.activeTimers.clear();
  }
}

module.exports = HoellCCOperations;
