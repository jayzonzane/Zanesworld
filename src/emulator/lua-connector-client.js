/**
 * Lua Connector Client for Super Mario World
 * Connects to the Zanesworld Lua connector running in the emulator
 * Uses TCP socket with pipe-delimited protocol
 */

const net = require('net');
const EventEmitter = require('events');

class LuaConnectorClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.host = null;
    this.port = null;
    this.buffer = ''; // Buffer for incomplete messages
    this.pendingCommands = new Map(); // commandId -> {resolve, reject}
    this.commandId = 0;
  }

  /**
   * Connect to the Lua connector
   * @param {string} host - Hostname (usually 'localhost')
   * @param {number} port - Port number (default: 65399)
   */
  async connect(host = 'localhost', port = 65399) {
    return new Promise((resolve, reject) => {
      // Ensure port is a number
      const numPort = typeof port === 'string' ? parseInt(port) : port;
      console.log(`Connecting to Lua connector at ${host}:${numPort}...`);

      this.host = host;
      this.port = numPort;
      this.client = new net.Socket();

      // Connection timeout
      const timeout = setTimeout(() => {
        this.client.destroy();
        reject(new Error('Connection timeout'));
      }, 5000);

      this.client.connect(numPort, host, () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log(`✅ Connected to Lua connector at ${host}:${numPort}`);
        this.emit('connected');
        resolve();
      });

      this.client.on('data', (data) => {
        this.handleData(data);
      });

      this.client.on('close', () => {
        console.log('Connection to Lua connector closed');
        this.connected = false;
        this.emit('disconnected');

        // Reject all pending commands
        for (const [id, promise] of this.pendingCommands.entries()) {
          promise.reject(new Error('Connection closed'));
        }
        this.pendingCommands.clear();
      });

      this.client.on('error', (err) => {
        console.error('Lua connector error:', err.message);
        console.error('Error code:', err.code);
        console.error('Full error:', err);
        if (!this.connected) {
          clearTimeout(timeout);
          reject(err);
        }
        this.emit('error', err);
      });
    });
  }

  /**
   * Handle incoming data from the connector
   */
  handleData(data) {
    this.buffer += data.toString();

    // Process complete lines (ending with \n)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        this.processResponse(line.trim());
      }
    }
  }

  /**
   * Process a response line from the connector
   */
  processResponse(line) {
    console.log('[Lua Connector] <-', line);

    // Parse pipe-delimited response: "OK|message" or "ERROR|message"
    const parts = line.split('|');
    const status = parts[0];
    const message = parts.slice(1).join('|');

    // For now, we'll use a simple callback system
    // Since we don't have request IDs, we'll resolve the oldest pending command
    if (this.pendingCommands.size > 0) {
      const firstId = this.pendingCommands.keys().next().value;
      const promise = this.pendingCommands.get(firstId);
      this.pendingCommands.delete(firstId);

      if (status === 'OK') {
        promise.resolve({ success: true, message });
      } else {
        promise.reject(new Error(message || 'Command failed'));
      }
    }
  }

  /**
   * Send a command to the connector
   * @param {string} command - Command name
   * @param {...any} params - Command parameters
   */
  async sendCommand(command, ...params) {
    if (!this.connected) {
      throw new Error('Not connected to Lua connector');
    }

    return new Promise((resolve, reject) => {
      // Build pipe-delimited command
      const parts = [command, ...params.map(p => String(p))];
      const message = parts.join('|') + '\n';

      console.log('[Lua Connector] ->', message.trim());

      // Store promise for this command
      const id = this.commandId++;
      this.pendingCommands.set(id, { resolve, reject });

      // Send command
      this.client.write(message, (err) => {
        if (err) {
          this.pendingCommands.delete(id);
          reject(err);
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingCommands.has(id)) {
          this.pendingCommands.delete(id);
          reject(new Error('Command timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Disconnect from the connector
   */
  disconnect() {
    if (this.client) {
      this.connected = false;
      this.client.destroy();
      this.client = null;
      console.log('Disconnected from Lua connector');
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  // ========================================================================
  // Memory Operations (compatible with SNI client interface)
  // ========================================================================

  /**
   * Read memory from SNES
   * Note: The Lua connector doesn't support raw memory reads yet
   * This is a placeholder for compatibility
   */
  async readMemory(address, size) {
    throw new Error('Raw memory read not supported by Lua connector');
  }

  /**
   * Write memory to SNES
   * Note: The Lua connector doesn't support raw memory writes yet
   * This is a placeholder for compatibility
   */
  async writeMemory(address, buffer) {
    throw new Error('Raw memory write not supported by Lua connector');
  }

  // ========================================================================
  // SMW Game Operations (via Lua connector commands)
  // ========================================================================

  // Resources
  async addCoins(amount) {
    const result = await this.sendCommand('AddCoins', amount);
    return { success: true, message: result.message };
  }

  async removeCoins(amount) {
    const result = await this.sendCommand('RemoveCoins', amount);
    return { success: true, message: result.message };
  }

  async setCoins(amount) {
    const result = await this.sendCommand('SetCoins', amount);
    return { success: true, message: result.message };
  }

  async addLife(count) {
    const result = await this.sendCommand('AddLives', count || 1);
    return { success: true, message: result.message };
  }

  async removeLife(count) {
    const result = await this.sendCommand('RemoveLives', count || 1);
    return { success: true, message: result.message };
  }

  // Powerups
  async giveMushroom() {
    const result = await this.sendCommand('GiveMushroom');
    return { success: true, message: result.message };
  }

  async giveFireFlower() {
    const result = await this.sendCommand('GiveFireFlower');
    return { success: true, message: result.message };
  }

  async giveCapeFeather() {
    const result = await this.sendCommand('GiveCapeFeather');
    return { success: true, message: result.message };
  }

  async giveStarman(duration) {
    const result = await this.sendCommand('GiveStarman', duration || 20);
    return { success: true, message: result.message };
  }

  async removePowerup() {
    const result = await this.sendCommand('RemovePowerup');
    return { success: true, message: result.message };
  }

  async setMarioPowerup(powerupType) {
    const result = await this.sendCommand('SetPowerup', powerupType);
    return { success: true, message: result.message };
  }

  // Player Control
  async killPlayer() {
    const result = await this.sendCommand('KillPlayer');
    return { success: true, message: result.message };
  }

  async freezePlayer() {
    const result = await this.sendCommand('FreezePlayer');
    return { success: true, message: result.message };
  }

  async unfreezePlayer() {
    const result = await this.sendCommand('UnfreezePlayer');
    return { success: true, message: result.message };
  }

  // Movement
  async kickRight() {
    const result = await this.sendCommand('KickRight');
    return { success: true, message: result.message };
  }

  async kickLeft() {
    const result = await this.sendCommand('KickLeft');
    return { success: true, message: result.message };
  }

  async kickUp() {
    const result = await this.sendCommand('KickUp');
    return { success: true, message: result.message };
  }

  async pushRight(speed) {
    const result = await this.sendCommand('PushRight', speed || 32);
    return { success: true, message: result.message };
  }

  async pushLeft(speed) {
    const result = await this.sendCommand('PushLeft', speed || 32);
    return { success: true, message: result.message };
  }

  async modifyMarioSpeed(multiplier, duration) {
    const result = await this.sendCommand('ModifySpeed', multiplier, duration || 30);
    return { success: true, message: result.message };
  }

  // Environmental Effects
  async setWaterMode() {
    const result = await this.sendCommand('SetWaterMode');
    return { success: true, message: result.message };
  }

  async setLandMode() {
    const result = await this.sendCommand('SetLandMode');
    return { success: true, message: result.message };
  }

  async setWaterModeTimed(duration) {
    const result = await this.sendCommand('SetWaterModeTimed', duration || 30);
    return { success: true, message: result.message };
  }

  async setIceMode() {
    const result = await this.sendCommand('SetIceMode');
    return { success: true, message: result.message };
  }

  async setDryMode() {
    const result = await this.sendCommand('SetDryMode');
    return { success: true, message: result.message };
  }

  async setIceModeTimed(duration) {
    const result = await this.sendCommand('SetIceModeTimed', duration || 30);
    return { success: true, message: result.message };
  }

  // Items
  async activatePSwitch(duration) {
    const result = await this.sendCommand('ActivatePSwitch', duration || 20);
    return { success: true, message: result.message };
  }

  async activateSilverPSwitch(duration) {
    const result = await this.sendCommand('ActivateSilverPSwitch', duration || 255);
    return { success: true, message: result.message };
  }

  async spawnSilverPSwitch() {
    const result = await this.sendCommand('SpawnSilverPSwitch');
    return { success: true, message: result.message };
  }

  // Enemy Spawning (requires MarioMod)
  async spawnRandomEnemy() {
    const result = await this.sendCommand('SpawnRandomEnemy');
    return { success: true, message: result.message };
  }

  async spawnGreenKoopa() {
    const result = await this.sendCommand('SpawnGreenKoopa');
    return { success: true, message: result.message };
  }

  async spawnRedKoopa() {
    const result = await this.sendCommand('SpawnRedKoopa');
    return { success: true, message: result.message };
  }

  async spawnGoomba() {
    const result = await this.sendCommand('SpawnGoomba');
    return { success: true, message: result.message };
  }

  async spawnBobOmb() {
    const result = await this.sendCommand('SpawnBobOmb');
    return { success: true, message: result.message };
  }

  async spawnBoo() {
    const result = await this.sendCommand('SpawnBoo');
    return { success: true, message: result.message };
  }

  // Level Warps
  async warpToLevel(levelID) {
    const result = await this.sendCommand('WarpToLevel', levelID);
    return { success: true, message: result.message };
  }

  async warpToRandomLevel() {
    const result = await this.sendCommand('WarpToRandomLevel');
    return { success: true, message: result.message };
  }

  async warpToWorld1() {
    return await this.warpToLevel(0x101);
  }

  async warpToBowserCastle() {
    return await this.warpToLevel(0x1D7);
  }

  // System
  async getVersion() {
    const result = await this.sendCommand('Version');
    return result.message;
  }

  async ping() {
    const result = await this.sendCommand('Ping');
    return { success: true, message: result.message };
  }

  // ========================================================================
  // Compatibility methods (for SNI interface compatibility)
  // ========================================================================

  /**
   * List devices (compatibility - Lua connector doesn't have devices)
   */
  async listDevices() {
    return [{
      uri: 'lua://localhost:65399',
      displayName: 'Lua Connector',
      kind: 'Lua',
      capabilities: []
    }];
  }

  /**
   * Select device (compatibility - auto-selected on connect)
   */
  selectDevice(device) {
    this.deviceURI = device.uri;
    console.log('Lua connector device selected:', device.displayName);
  }
}

module.exports = LuaConnectorClient;
