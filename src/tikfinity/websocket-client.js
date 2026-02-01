/**
 * TikFinity WebSocket Client
 * Connects to TikFinity Desktop App WebSocket server (ws://localhost:21213/)
 */
const WebSocket = require('ws');
const EventEmitter = require('events');

class TikFinityWebSocketClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.url = config.url || 'ws://localhost:21213/';
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectDelay = config.reconnectDelay || 2000; // 2 seconds
    this.reconnectBackoffMultiplier = 1.5;
    this.reconnectTimer = null;
    this.debugMode = config.debugMode !== undefined ? config.debugMode : true;

    this.log('🎁 TikFinity WebSocket client initialized');
  }

  /**
   * Connect to TikFinity WebSocket
   */
  connect() {
    if (this.connected) {
      this.log('⚠️ Already connected to TikFinity', 'warn');
      return;
    }

    this.log(`🔌 Connecting to TikFinity at ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      // Connection opened
      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.log('✅ Connected to TikFinity WebSocket', 'success');
        this.emit('connected');
      });

      // Message received
      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleEvent(event);
        } catch (error) {
          this.log(`⚠️ Failed to parse TikFinity message: ${error.message}`, 'warn');
        }
      });

      // Connection closed
      this.ws.on('close', (code, reason) => {
        this.connected = false;
        this.log(`⚠️ TikFinity connection closed (code: ${code}, reason: ${reason || 'none'})`, 'warn');
        this.emit('disconnected');

        // Attempt reconnect if not manually closed
        if (code !== 1000) { // 1000 = normal closure
          this.scheduleReconnect();
        }
      });

      // Error occurred
      this.ws.on('error', (error) => {
        // Only log if not connection refused (common when TikFinity not running)
        if (error.code === 'ECONNREFUSED') {
          this.log(`⚠️ TikFinity connection refused (is TikFinity Desktop App running?)`, 'warn');
        } else {
          this.log(`❌ TikFinity WebSocket error: ${error.message}`, 'error');
        }
        this.emit('error', error);
      });

    } catch (error) {
      this.log(`❌ Failed to connect to TikFinity: ${error.message}`, 'error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from TikFinity WebSocket
   */
  disconnect() {
    if (!this.ws) {
      return;
    }

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.log('🔌 Disconnecting from TikFinity...');
    this.ws.close(1000, 'Normal closure'); // 1000 = normal closure
    this.ws = null;
    this.connected = false;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log(`❌ Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`, 'error');
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(this.reconnectBackoffMultiplier, this.reconnectAttempts - 1);

    this.log(`🔄 Reconnecting to TikFinity in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, 'warn');

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Handle incoming event from TikFinity
   */
  handleEvent(event) {
    if (this.debugMode) {
      const dataPreview = JSON.stringify(event.data).substring(0, 100);
      this.log(`📥 TikFinity event: ${event.event} | ${dataPreview}...`);
    }

    // Emit the raw event (will be normalized by EventProcessor)
    this.emit('event', event);
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get WebSocket URL
   */
  getUrl() {
    return this.url;
  }

  /**
   * Internal logging helper
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const prefix = `[${timestamp}] [TikFinity]`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'success':
        console.log(`${prefix} ✅ ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
}

module.exports = TikFinityWebSocketClient;
