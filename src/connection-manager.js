/**
 * Connection Manager Module
 * Manages SNI and Lua client connections
 *
 * @module connection-manager
 */

class ConnectionManager {
  /**
   * Create a connection manager
   * @param {Object} sniClient - SNI client instance
   * @param {Object} luaClient - Lua connector client instance
   * @param {Object} mainWindow - Electron main window instance
   * @param {Object} smwOps - SMW operations instance
   */
  constructor(sniClient, luaClient, mainWindow, smwOps) {
    this.sniClient = sniClient;
    this.luaClient = luaClient;
    this.mainWindow = mainWindow;
    this.smwOps = smwOps;
    this.connectionMode = 'sni';  // 'sni' or 'lua'
  }

  /**
   * Get current connection mode
   * @returns {string} Current connection mode ('sni' or 'lua')
   */
  getConnectionMode() {
    return this.connectionMode;
  }

  /**
   * Set connection mode
   * @param {string} mode - Connection mode ('sni' or 'lua')
   */
  setConnectionMode(mode) {
    if (mode !== 'sni' && mode !== 'lua') {
      throw new Error('Invalid connection mode. Must be "sni" or "lua"');
    }
    this.connectionMode = mode;
  }

  /**
   * Auto-connect to SNI and select first device
   * @returns {Promise<void>}
   */
  async autoConnectSNI() {
    try {
      console.log('🔌 Auto-connecting to SNI...');
      await this.sniClient.connect('localhost', 8191);
      const devices = await this.sniClient.listDevices();

      if (devices && devices.length > 0) {
        console.log(`📱 Found ${devices.length} device(s), auto-selecting first one...`);
        this.sniClient.selectDevice(devices[0]);

        // Start indoors monitoring for stored chicken attacks
        if (this.smwOps) {
          this.smwOps.startIndoorsMonitoring();
          console.log('🐔 Indoors monitoring started for stored chicken attacks');
        }

        // Notify renderer about successful connection
        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('sni-auto-connected', {
            success: true,
            device: devices[0]
          });
        }

        console.log('✅ Auto-connected to device:', devices[0].uri);
      } else {
        console.log('⚠️ No devices found');
        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('sni-auto-connected', {
            success: false,
            error: 'No devices found'
          });
        }
      }
    } catch (error) {
      console.error('❌ Auto-connect failed:', error.message);
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('sni-auto-connected', {
          success: false,
          error: error.message
        });
      }
    }
  }

  /**
   * Connect to SNI
   * @param {string} host - SNI host
   * @param {number} port - SNI port
   * @returns {Promise<Object>} Connection result
   */
  async connectSNI(host, port) {
    try {
      await this.sniClient.connect(host, port);
      const devices = await this.sniClient.listDevices();
      return { success: true, devices };
    } catch (error) {
      console.error('SNI connection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from SNI
   * @returns {Promise<Object>} Disconnection result
   */
  async disconnectSNI() {
    try {
      if (this.sniClient && this.sniClient.disconnect) {
        this.sniClient.disconnect();
      }
      return { success: true, message: 'Disconnected from SNI' };
    } catch (error) {
      console.error('SNI disconnection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Select SNI device
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} Selection result
   */
  async selectSNIDevice(deviceInfo) {
    try {
      this.sniClient.selectDevice(deviceInfo);

      // Start indoors monitoring for stored chicken attacks
      if (this.smwOps) {
        this.smwOps.startIndoorsMonitoring();
        console.log('🐔 Indoors monitoring started for stored chicken attacks');
      }

      return { success: true };
    } catch (error) {
      console.error('Device selection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Connect to Lua connector (emulator mode)
   * @param {string} host - Lua connector host (default: 'localhost')
   * @param {number} port - Lua connector port (default: 65399)
   * @returns {Promise<Object>} Connection result
   */
  async connectLua(host = 'localhost', port = 65399) {
    try {
      if (!this.luaClient) {
        return { success: false, error: 'Lua client not initialized' };
      }
      await this.luaClient.connect(host, port);
      return { success: true, message: 'Connected to Lua connector' };
    } catch (error) {
      console.error('Lua connector connection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from Lua connector
   * @returns {Promise<Object>} Disconnection result
   */
  async disconnectLua() {
    try {
      if (!this.luaClient) {
        return { success: false, error: 'Lua client not initialized' };
      }
      this.luaClient.disconnect();
      return { success: true, message: 'Disconnected from Lua connector' };
    } catch (error) {
      console.error('Lua disconnection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get Lua connector status
   * @returns {Object} Lua connector status
   */
  getLuaStatus() {
    try {
      if (!this.luaClient) {
        return { success: false, error: 'Lua client not initialized' };
      }
      return {
        success: true,
        connected: this.luaClient.isConnected()
      };
    } catch (error) {
      console.error('Error getting Lua status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get SNI connection status
   * @returns {Object} SNI connection status
   */
  getSNIStatus() {
    try {
      if (!this.sniClient) {
        return { success: false, error: 'SNI client not initialized' };
      }
      return {
        success: true,
        connected: !!this.sniClient.deviceURI,
        deviceURI: this.sniClient.deviceURI
      };
    } catch (error) {
      console.error('Error getting SNI status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if any connection is active
   * @returns {boolean} True if either SNI or Lua is connected
   */
  isConnected() {
    const sniConnected = !!(this.sniClient && this.sniClient.deviceURI);
    const luaConnected = !!(this.luaClient && this.luaClient.isConnected());
    return sniConnected || luaConnected;
  }

  /**
   * Set up Lua client event listeners
   * @param {Object} mainWindow - Electron main window instance
   */
  setupLuaEventListeners(mainWindow) {
    if (!this.luaClient) return;

    this.luaClient.on('connected', () => {
      console.log('✅ Lua connector connected');
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('lua-connected');
      }
    });

    this.luaClient.on('disconnected', () => {
      console.log('❌ Lua connector disconnected');
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('lua-disconnected');
      }
    });

    this.luaClient.on('error', (err) => {
      console.error('❌ Lua connector error:', err.message);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('lua-error', { error: err.message });
      }
    });
  }
}

module.exports = { ConnectionManager };
