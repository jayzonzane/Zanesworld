const { MEMORY_ADDRESSES, GAME_MODES } = require('./memory');

/**
 * ZeldaOperations class provides operations specific to The Legend of Zelda: A Link to the Past.
 * This includes health management, dungeon warps, and game state reading.
 *
 * @class ZeldaOperations
 */
class ZeldaOperations {
  constructor(sniClient) {
    this.client = sniClient;
  }

  async readWithRetry(address, size, maxAttempts = 3) {
    let attempts = 0;
    let lastError;

    while (attempts < maxAttempts) {
      try {
        console.log(`Read attempt ${attempts + 1}/${maxAttempts} for address 0x${address.toString(16)}`);
        const data = await this.client.readMemory(address, size);

        if (data && data.length > 0) {
          console.log(`Successfully read ${data.length} byte(s): 0x${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          return data;
        }

        console.warn('Read returned empty data');
      } catch (error) {
        console.error(`Read attempt ${attempts + 1} failed:`, error.message);
        lastError = error;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempts)); // Progressive delay
      }
    }

    throw lastError || new Error('Failed to read memory after ' + maxAttempts + ' attempts');
  }

  async getCurrentHealth() {
    try {
      const health = await this.readWithRetry(MEMORY_ADDRESSES.CURRENT_HEALTH, 1);
      return health[0];
    } catch (error) {
      console.error('Error reading current health:', error);
      throw error;
    }
  }

  async getMaxHealth() {
    try {
      const maxHealth = await this.readWithRetry(MEMORY_ADDRESSES.MAX_HEALTH, 1);
      return maxHealth[0];
    } catch (error) {
      console.error('Error reading max health:', error);
      throw error;
    }
  }

  async addHeartContainer() {
    try {
      console.log('=== Adding Heart Container ===');

      // Read current max health
      const currentMax = await this.getMaxHealth();
      console.log(`Current max health: 0x${currentMax.toString(16)} (${currentMax / 8} hearts)`);

      // Check if already at max
      if (currentMax >= 0xA0) {
        console.log('Already at maximum hearts (20)');
        return { success: false, error: 'Already at maximum hearts' };
      }

      // Add one heart (0x08) to max health
      const newMax = Math.min(currentMax + 0x08, 0xA0); // Cap at 20 hearts
      console.log(`New max will be: 0x${newMax.toString(16)} (${newMax / 8} hearts)`);

      // Write new max health
      console.log(`Writing to MAX_HEALTH (0x${MEMORY_ADDRESSES.MAX_HEALTH.toString(16)})`);
      await this.client.writeMemory(MEMORY_ADDRESSES.MAX_HEALTH, Buffer.from([newMax]));

      // Small delay before verification
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify the write
      const verifyMax = await this.getMaxHealth();
      if (verifyMax !== newMax) {
        console.warn(`Write verification failed. Expected 0x${newMax.toString(16)}, got 0x${verifyMax.toString(16)}`);
      } else {
        console.log('Max health write verified successfully');
      }

      // Also fill current health to new max
      console.log(`Writing to CURRENT_HEALTH (0x${MEMORY_ADDRESSES.CURRENT_HEALTH.toString(16)})`);
      await this.client.writeMemory(MEMORY_ADDRESSES.CURRENT_HEALTH, Buffer.from([newMax]));

      console.log('=== Heart Container Added Successfully ===');
      return { success: true, newMax: newMax / 8 };
    } catch (error) {
      console.error('Error adding heart container:', error);
      return { success: false, error: error.message };
    }
  }

  async removeHeartContainer() {
    try {
      console.log('=== Removing Heart Container ===');

      // Read current max health - it's at different address than add
      const currentMax = await this.getMaxHealth();
      console.log(`Current max health: 0x${currentMax.toString(16)} (${currentMax / 8} hearts)`);

      // Check if at minimum
      if (currentMax <= 0x18) {
        console.log('Already at minimum hearts (3)');
        return { success: false, error: 'Already at minimum hearts' };
      }

      // Remove one heart, minimum 3 hearts (0x18)
      const newMax = Math.max(currentMax - 0x08, 0x18);
      console.log(`New max will be: 0x${newMax.toString(16)} (${newMax / 8} hearts)`);

      // IMPORTANT: For remove, we need to write to both the saved max health AND current
      // The save file has max health at a slightly different offset
      console.log(`Writing to MAX_HEALTH (0x${MEMORY_ADDRESSES.MAX_HEALTH.toString(16)})`);
      await this.client.writeMemory(MEMORY_ADDRESSES.MAX_HEALTH, Buffer.from([newMax]));

      // Also update the "displayed" max health which might be cached elsewhere
      // Some ALTTP memory addresses have both a "current" and "saved" version
      const alternateMaxAddress = MEMORY_ADDRESSES.MAX_HEALTH - 1; // Try 0x36C instead of 0x36D
      console.log(`Also writing to alternate address (0x${alternateMaxAddress.toString(16)})`);
      await this.client.writeMemory(alternateMaxAddress, Buffer.from([newMax]));

      // Small delay before verification
      await new Promise(resolve => setTimeout(resolve, 100));

      // Adjust current health to not exceed new max
      const currentHealth = await this.getCurrentHealth();
      if (currentHealth > newMax) {
        console.log(`Adjusting current health from 0x${currentHealth.toString(16)} to 0x${newMax.toString(16)}`);
        await this.client.writeMemory(MEMORY_ADDRESSES.CURRENT_HEALTH, Buffer.from([newMax]));
      }

      console.log('=== Heart Container Removed Successfully ===');
      return { success: true, newMax: newMax / 8 };
    } catch (error) {
      console.error('Error removing heart container:', error);
      return { success: false, error: error.message };
    }
  }

  // killPlayer method removed - using game-specific implementations
  // For SMW: hoellOps.killPlayer (multi-sprite tester)
  // For Zelda: implement separately if needed

  async warpToEasternPalace() {
    try {
      console.log('Warping to Eastern Palace...');

      // This is a simplified warp - for a complete implementation, you'd need to:
      // 1. Save the current state
      // 2. Trigger a transition
      // 3. Load the new room
      // 4. Position the player

      // Set the room ID to Eastern Palace entrance (0xC9)
      const roomId = MEMORY_ADDRESSES.EASTERN_PALACE_ROOM;
      await this.client.writeMemory(MEMORY_ADDRESSES.CURRENT_ROOM, Buffer.from([roomId & 0xFF]));
      await this.client.writeMemory(MEMORY_ADDRESSES.CURRENT_ROOM_HIGH, Buffer.from([roomId >> 8]));

      // Set player position in the room
      // X position (little-endian)
      const xPos = MEMORY_ADDRESSES.EASTERN_PALACE_X;
      await this.client.writeMemory(MEMORY_ADDRESSES.PLAYER_X_POS,
                                    Buffer.from([xPos & 0xFF, xPos >> 8]));

      // Y position (little-endian)
      const yPos = MEMORY_ADDRESSES.EASTERN_PALACE_Y;
      await this.client.writeMemory(MEMORY_ADDRESSES.PLAYER_Y_POS,
                                    Buffer.from([yPos & 0xFF, yPos >> 8]));

      // Set dungeon ID (Eastern Palace = 0x02)
      await this.client.writeMemory(MEMORY_ADDRESSES.DUNGEON_ID, Buffer.from([0x02]));

      // Set indoors flag
      await this.client.writeMemory(MEMORY_ADDRESSES.INDOORS_FLAG, Buffer.from([0x01]));

      // Trigger a module transition to load the room properly
      // This sets the game to loading/transition mode
      await this.client.writeMemory(MEMORY_ADDRESSES.MODULE_INDEX, Buffer.from([0x11]));
      await this.client.writeMemory(MEMORY_ADDRESSES.SUBMODULE_INDEX, Buffer.from([0x00]));

      console.log('Warp command sent');
      return { success: true, message: 'Warped to Eastern Palace entrance' };
    } catch (error) {
      console.error('Error warping to Eastern Palace:', error);
      throw error;
    }
  }

  async getGameState() {
    try {
      const gameMode = await this.client.readMemory(MEMORY_ADDRESSES.GAME_MODE, 1);
      const currentRoom = await this.client.readMemory(MEMORY_ADDRESSES.CURRENT_ROOM, 2);
      const currentHealth = await this.getCurrentHealth();
      const maxHealth = await this.getMaxHealth();

      return {
        gameMode: gameMode[0],
        roomId: currentRoom[0] | (currentRoom[1] << 8),
        currentHealth: currentHealth,
        maxHealth: maxHealth,
        currentHearts: currentHealth / 8,
        maxHearts: maxHealth / 8
      };
    } catch (error) {
      console.error('Error getting game state:', error);
      throw error;
    }
  }
}

module.exports = ZeldaOperations;
