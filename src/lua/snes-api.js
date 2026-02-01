/**
 * SNESApi for Super Mario World
 * Exposes SMW operations to Lua scripts through a whitelist-based API
 * Provides safe access to memory operations and game functions
 */

class SNESApi {
  constructor(sniClient, gameOps, expandedOps, hoellOps) {
    this.sniClient = sniClient;
    this.gameOps = gameOps; // Basic operations (operations.js)
    this.expandedOps = expandedOps; // Working SMW operations (operations-working.js)
    this.hoellOps = hoellOps; // HoellCC operations (operations-hoellcc.js)
  }

  /**
   * Create an API object for a specific gift context
   * This API is exposed to Lua scripts via the global SNES variable
   */
  createAPI(giftContext) {
    return {
      // Low-level memory access
      memory: {
        /**
         * Read memory from SNES
         * @param address - Memory address (e.g., 0x7E0DBF for coins)
         * @param size - Number of bytes to read
         * @returns Array containing the read data
         */
        read: async (address, size) => {
          try {
            const buffer = await this.sniClient.readMemory(address, size);
            // Convert Buffer to array of numbers for easier Lua manipulation
            return Array.from(buffer);
          } catch (error) {
            console.error(`[SNESApi] Memory read error at 0x${address.toString(16)}:`, error);
            throw error;
          }
        },

        /**
         * Write memory to SNES
         * @param address - Memory address
         * @param data - Array of bytes to write
         * @returns true if successful
         */
        write: async (address, data) => {
          try {
            // Convert array to Buffer
            const buffer = Buffer.from(data);
            await this.sniClient.writeMemory(address, buffer);
            return true;
          } catch (error) {
            console.error(`[SNESApi] Memory write error at 0x${address.toString(16)}:`, error);
            return false;
          }
        }
      },

      // High-level game operations
      game: {
        // === Resources ===

        /**
         * Add coins to player
         * @param amount - Number of coins to add (default: 10)
         * @returns true if successful
         */
        addCoins: async (amount = 10) => {
          try {
            const result = await this.expandedOps.addCoins(amount);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] addCoins error:', error);
            return false;
          }
        },

        /**
         * Remove coins from player
         * @param amount - Number of coins to remove (default: 10)
         * @returns true if successful
         */
        removeCoins: async (amount = 10) => {
          try {
            const result = await this.expandedOps.removeCoins(amount);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] removeCoins error:', error);
            return false;
          }
        },

        /**
         * Add lives to player
         * @param count - Number of lives to add (default: 1)
         * @returns true if successful
         */
        addLives: async (count = 1) => {
          try {
            const result = await this.expandedOps.addLife(count);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] addLives error:', error);
            return false;
          }
        },

        /**
         * Remove lives from player
         * @param count - Number of lives to remove (default: 1)
         * @returns true if successful
         */
        removeLives: async (count = 1) => {
          try {
            const result = await this.expandedOps.removeLife(count);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] removeLives error:', error);
            return false;
          }
        },

        // === Powerups ===

        /**
         * Give Super Mushroom to player
         * @returns true if successful
         */
        giveMushroom: async () => {
          try {
            const result = await this.expandedOps.giveMushroom();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] giveMushroom error:', error);
            return false;
          }
        },

        /**
         * Give Fire Flower to player
         * @returns true if successful
         */
        giveFireFlower: async () => {
          try {
            const result = await this.expandedOps.giveFireFlower();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] giveFireFlower error:', error);
            return false;
          }
        },

        /**
         * Give Cape Feather to player
         * @returns true if successful
         */
        giveCapeFeather: async () => {
          try {
            const result = await this.expandedOps.giveCapeFeather();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] giveCapeFeather error:', error);
            return false;
          }
        },

        /**
         * Give Starman (invincibility) to player
         * @param duration - Duration in seconds (default: 20)
         * @returns true if successful
         */
        giveStarman: async (duration = 20) => {
          try {
            const result = await this.expandedOps.giveStarman(duration);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] giveStarman error:', error);
            return false;
          }
        },

        /**
         * Remove player's current powerup (make small)
         * @returns true if successful
         */
        removePowerup: async () => {
          try {
            const result = await this.expandedOps.removePowerup();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] removePowerup error:', error);
            return false;
          }
        },

        // === Player Control ===

        /**
         * Kill the player
         * @returns true if successful
         */
        killPlayer: async () => {
          try {
            const result = await this.gameOps.killPlayer();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] killPlayer error:', error);
            return false;
          }
        },

        /**
         * Freeze player in place
         * @returns true if successful
         */
        freezePlayer: async () => {
          try {
            const result = await this.hoellOps.freezePlayer();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] freezePlayer error:', error);
            return false;
          }
        },

        /**
         * Unfreeze player
         * @returns true if successful
         */
        unfreezePlayer: async () => {
          try {
            const result = await this.hoellOps.unfreezePlayer();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] unfreezePlayer error:', error);
            return false;
          }
        },

        // === Movement ===

        /**
         * Kick player to the right
         * @returns true if successful
         */
        kickRight: async () => {
          try {
            const result = await this.hoellOps.kickRight();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] kickRight error:', error);
            return false;
          }
        },

        /**
         * Kick player to the left
         * @returns true if successful
         */
        kickLeft: async () => {
          try {
            const result = await this.hoellOps.kickLeft();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] kickLeft error:', error);
            return false;
          }
        },

        /**
         * Kick player upward
         * @returns true if successful
         */
        kickUp: async () => {
          try {
            const result = await this.hoellOps.kickUp();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] kickUp error:', error);
            return false;
          }
        },

        /**
         * Push player to the right
         * @param speed - Push speed (default: 32)
         * @returns true if successful
         */
        pushRight: async (speed = 32) => {
          try {
            const result = await this.hoellOps.pushRight(speed);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] pushRight error:', error);
            return false;
          }
        },

        /**
         * Push player to the left
         * @param speed - Push speed (default: 32)
         * @returns true if successful
         */
        pushLeft: async (speed = 32) => {
          try {
            const result = await this.hoellOps.pushLeft(speed);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] pushLeft error:', error);
            return false;
          }
        },

        /**
         * Modify player movement speed
         * @param multiplier - Speed multiplier (1.0 = normal, 2.0 = double, etc.)
         * @param duration - Duration in seconds (default: 30)
         * @returns true if successful
         */
        modifySpeed: async (multiplier, duration = 30) => {
          try {
            const result = await this.expandedOps.modifyMarioSpeed(multiplier, duration);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] modifySpeed error:', error);
            return false;
          }
        },

        // === Environmental Effects ===

        /**
         * Enable water physics mode
         * @returns true if successful
         */
        setWaterMode: async () => {
          try {
            const result = await this.hoellOps.setWaterMode();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] setWaterMode error:', error);
            return false;
          }
        },

        /**
         * Disable water physics mode
         * @returns true if successful
         */
        setLandMode: async () => {
          try {
            const result = await this.hoellOps.setLandMode();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] setLandMode error:', error);
            return false;
          }
        },

        /**
         * Enable water mode for a duration
         * @param duration - Duration in seconds (default: 30)
         * @returns true if successful
         */
        setWaterModeTimed: async (duration = 30) => {
          try {
            const result = await this.hoellOps.setWaterModeTimed(duration);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] setWaterModeTimed error:', error);
            return false;
          }
        },

        /**
         * Enable ice/slippery physics mode
         * @returns true if successful
         */
        setIceMode: async () => {
          try {
            const result = await this.hoellOps.setIceMode();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] setIceMode error:', error);
            return false;
          }
        },

        /**
         * Disable ice/slippery physics mode
         * @returns true if successful
         */
        setDryMode: async () => {
          try {
            const result = await this.hoellOps.setDryMode();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] setDryMode error:', error);
            return false;
          }
        },

        /**
         * Enable ice mode for a duration
         * @param duration - Duration in seconds (default: 30)
         * @returns true if successful
         */
        setIceModeTimed: async (duration = 30) => {
          try {
            const result = await this.hoellOps.setIceModeTimed(duration);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] setIceModeTimed error:', error);
            return false;
          }
        },

        // === Items ===

        /**
         * Activate P-Switch
         * @param duration - Duration in seconds (default: 20)
         * @returns true if successful
         */
        activatePSwitch: async (duration = 20) => {
          try {
            const result = await this.expandedOps.activatePSwitch(duration);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] activatePSwitch error:', error);
            return false;
          }
        },

        /**
         * Activate Silver P-Switch
         * @param duration - Duration in frames (default: 255)
         * @returns true if successful
         */
        activateSilverPSwitch: async (duration = 255) => {
          try {
            const result = await this.hoellOps.activateSilverPSwitch(duration);
            return result.success;
          } catch (error) {
            console.error('[SNESApi] activateSilverPSwitch error:', error);
            return false;
          }
        },

        /**
         * Spawn Silver P-Switch (requires MarioMod)
         * @returns true if successful
         */
        spawnSilverPSwitch: async () => {
          try {
            const result = await this.hoellOps.spawnSilverPSwitch();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] spawnSilverPSwitch error:', error);
            return false;
          }
        },

        // === Enemy Spawning (requires MarioMod) ===

        /**
         * Spawn random enemy (tileset-aware)
         * @returns true if successful
         */
        spawnRandomEnemy: async () => {
          try {
            const result = await this.hoellOps.spawnRandomEnemy();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] spawnRandomEnemy error:', error);
            return false;
          }
        },

        /**
         * Spawn Green Koopa
         * @returns true if successful
         */
        spawnGreenKoopa: async () => {
          try {
            const result = await this.hoellOps.spawnGreenKoopa();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] spawnGreenKoopa error:', error);
            return false;
          }
        },

        /**
         * Spawn Red Koopa
         * @returns true if successful
         */
        spawnRedKoopa: async () => {
          try {
            const result = await this.hoellOps.spawnRedKoopa();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] spawnRedKoopa error:', error);
            return false;
          }
        },

        /**
         * Spawn Goomba
         * @returns true if successful
         */
        spawnGoomba: async () => {
          try {
            const result = await this.hoellOps.spawnGoomba();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] spawnGoomba error:', error);
            return false;
          }
        },

        /**
         * Spawn Bob-omb
         * @returns true if successful
         */
        spawnBobOmb: async () => {
          try {
            const result = await this.hoellOps.spawnBobOmb();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] spawnBobOmb error:', error);
            return false;
          }
        },

        /**
         * Spawn Boo
         * @returns true if successful
         */
        spawnBoo: async () => {
          try {
            const result = await this.hoellOps.spawnBoo();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] spawnBoo error:', error);
            return false;
          }
        },

        // === Level Warps ===

        /**
         * Warp to a random level
         * @returns true if successful
         */
        warpToRandomLevel: async () => {
          try {
            const result = await this.expandedOps.warpToRandomLevel();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] warpToRandomLevel error:', error);
            return false;
          }
        },

        /**
         * Warp to World 1
         * @returns true if successful
         */
        warpToWorld1: async () => {
          try {
            const result = await this.expandedOps.warpToWorld1();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] warpToWorld1 error:', error);
            return false;
          }
        },

        /**
         * Warp to Bowser's Castle
         * @returns true if successful
         */
        warpToBowserCastle: async () => {
          try {
            const result = await this.expandedOps.warpToBowserCastle();
            return result.success;
          } catch (error) {
            console.error('[SNESApi] warpToBowserCastle error:', error);
            return false;
          }
        }
      },

      // Gift context (read-only)
      gift: {
        name: giftContext.giftName || 'Unknown',
        sender: giftContext.displayName || 'Unknown',
        username: giftContext.uniqueId || 'Unknown',
        amount: giftContext.amount || 1,
        coinValue: giftContext.coinValue || 0,
        timestamp: giftContext.timestamp || new Date().toISOString(),
        source: giftContext.source || 'unknown'
      },

      // Utility functions
      util: {
        /**
         * Log a message (appears in console with [Lua Script] prefix)
         * @param message - Message to log
         */
        log: (message) => {
          const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
          console.log(`[${timestamp}] [Lua Script] ${message}`);
        },

        /**
         * Sleep for a specified duration
         * @param milliseconds - Duration to sleep
         * @returns Promise that resolves after the duration
         */
        sleep: (milliseconds) => {
          return new Promise(resolve => setTimeout(resolve, milliseconds));
        },

        /**
         * Generate a random integer between min and max (inclusive)
         * @param min - Minimum value
         * @param max - Maximum value
         * @returns Random integer
         */
        random: (min, max) => {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        }
      }
    };
  }
}

module.exports = SNESApi;
