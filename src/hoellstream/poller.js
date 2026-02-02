/**
 * HoellStream Poller
 * Polls the HoellStream API for TikTok gift events and forwards them to EventProcessor
 */
const logger = require('../utils/logger');

class HoellStreamPoller {
  constructor(gameOperations, config = {}) {
    this.gameOps = gameOperations;  // SMW operations
    this.restorationManager = null; // ItemRestorationManager (kept for backward compatibility)
    this.eventProcessor = null; // EventProcessor handles all gift processing now
    this.pollInterval = null;
    this.isPolling = false;
    this.startTime = null; // Track when polling started (to filter old events)
    this.lastPollTime = null; // Track last successful poll time

    // Configuration
    this.apiBaseUrl = config.apiBaseUrl || 'http://localhost:3000/api/messages/stream';
    this.pollIntervalMs = config.pollIntervalMs || 2000; // 2 seconds
    this.debugMode = config.debugMode !== undefined ? config.debugMode : true;

    this.log('🎁 HoellStream Poller initialized');
  }

  /**
   * Set the event processor (called from main.js after initialization)
   */
  setEventProcessor(eventProcessor) {
    this.eventProcessor = eventProcessor;
    this.log('🎁 EventProcessor connected to HoellStream poller');
  }

  /**
   * Set the restoration manager (called from main.js after initialization)
   * DEPRECATED: Kept for backward compatibility - EventProcessor handles this now
   */
  setRestorationManager(restorationManager) {
    this.restorationManager = restorationManager;
    this.log('⏱️ ItemRestorationManager connected to poller (deprecated)');
  }


  /**
   * Start polling the HoellStream API
   */
  start() {
    if (this.isPolling) {
      this.log('⚠️  Polling already active', 'warn');
      return;
    }

    this.isPolling = true;
    // Set start time to filter out events from before app connected
    this.startTime = new Date();
    this.lastPollTime = this.startTime.toISOString();
    this.log(`🎁 HoellStream: Polling started (ignoring events before ${this.lastPollTime})`);

    // Poll immediately, then set interval
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stop() {
    if (!this.isPolling) {
      return;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isPolling = false;
    this.log('🎁 HoellStream: Polling stopped');
  }

  /**
   * Poll the API for recent events
   */
  async poll() {
    try {
      // Use stream endpoint for messages
      const url = this.apiBaseUrl;

      this.log(`📡 Polling ${url}...`);

      const response = await fetch(url);

      this.log(`📥 Response status: ${response.status}`);

      if (!response.ok) {
        this.log(`⚠️  HoellStream: API returned ${response.status}`, 'warn');
        return;
      }

      // Handle Server-Sent Events stream - read with timeout
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const events = [];

      // Read from stream with 1 second timeout
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 1000));
      const readChunk = async () => {
        const { done, value } = await reader.read();
        if (done) return null;
        return decoder.decode(value, { stream: true });
      };

      // Read chunks until timeout
      const timeoutPromise = timeout;
      while (true) {
        const chunkPromise = readChunk();
        const chunk = await Promise.race([chunkPromise, timeoutPromise]);

        if (chunk === null) break; // Timeout or stream ended

        buffer += chunk;

        // Parse complete SSE messages from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6);
              const event = JSON.parse(jsonStr);
              events.push(event);
            } catch (e) {
              this.log(`⚠️ Failed to parse event: ${e.message}`, 'warn');
            }
          }
        }
      }

      // Clean up reader
      try { reader.cancel(); } catch (e) { console.error('[Poller] Reader cancel error:', e.message); }

      // Wrap in expected format
      const data = { events, count: events.length };

      this.log(`📦 Received ${data.events ? data.events.length : 0} total events`);

      if (!data.events || !Array.isArray(data.events)) {
        this.log('⚠️  HoellStream: Invalid response format', 'warn');
        return;
      }

      // Debug: log event types
      if (data.events.length > 0 && this.debugMode) {
        data.events.forEach(evt => {
          this.log(`🔍 Event type: "${evt.type}" | giftName: "${evt.giftName || 'N/A'}" | platform: "${evt.platform}"`);
        });
      }

      // Filter for gift events only
      let giftEvents = data.events.filter(event => event.type === 'gift');
      this.log(`🎁 Found ${giftEvents.length} gift events (before time filter)`);

      // Filter out events from before app started (prevents processing old events on restart)
      const beforeFilter = giftEvents.length;
      giftEvents = giftEvents.filter(event => {
        const eventTime = new Date(event.timestamp);
        const isNew = eventTime >= this.startTime;
        if (!isNew) {
          this.log(`⏰ Filtering out old event: ${event.giftName} from ${event.timestamp} (before ${this.startTime.toISOString()})`);
        }
        return isNew;
      });
      this.log(`✅ After time filter: ${giftEvents.length} new gift events (filtered out ${beforeFilter - giftEvents.length} old)`);

      if (giftEvents.length > 0) {
        this.log(`🎁 HoellStream: Processing ${giftEvents.length} new gift events`);
      }

      // Process events in chronological order (oldest first)
      const sortedEvents = giftEvents.sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const event of sortedEvents) {
        this.log(`🔄 Processing event: ${event.giftName} from ${event.displayName}`);
        await this.processEvent(event);
      }

    } catch (error) {
      // Log detailed error information
      if (error.code === 'ECONNREFUSED') {
        this.log('⚠️  HoellStream: API connection refused (is HoellStream running?)', 'warn');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        this.log(`⚠️  HoellStream: Fetch error - ${error.message}`, 'error');
      } else {
        this.log(`⚠️  HoellStream: Poll error - ${error.message}`, 'error');
        console.error('Full error:', error);
      }
    }
  }

  /**
   * Process a single event by normalizing and forwarding to EventProcessor
   */
  async processEvent(event) {
    if (!this.eventProcessor) {
      this.log('⚠️ EventProcessor not connected - event will be dropped', 'warn');
      return;
    }

    // Normalize HoellStream event to standard format
    const normalizedEvent = {
      id: event.id,
      type: 'gift',
      source: 'hoellstream',
      giftName: event.giftName,
      amount: event.amount || 1,
      displayName: event.displayName || 'Unknown',
      timestamp: event.timestamp,
      platform: event.platform || 'tiktok',
      uniqueId: event.uniqueId || '',
      raw: event
    };

    // Forward to EventProcessor
    this.log(`📤 Forwarding event to EventProcessor: ${normalizedEvent.giftName} from ${normalizedEvent.displayName}`);
    await this.eventProcessor.processEvent(normalizedEvent);
  }

  /**
   * Clear the seen events cache (useful for testing)
   * DEPRECATED: EventProcessor now handles deduplication
   */
  clearSeenEvents() {
    this.log(`🗑️  clearSeenEvents() is deprecated - use EventProcessor.clearSeenEvents() instead`, 'warn');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      isPolling: this.isPolling,
      pollIntervalMs: this.pollIntervalMs,
      apiBaseUrl: this.apiBaseUrl,
      lastPollTime: this.lastPollTime,
      trackingSince: this.lastPollTime
    };
  }

  /**
   * Internal logging helper - uses configurable logger for performance
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const prefix = `[${timestamp}]`;

    switch (level) {
      case 'error':
        logger.error(`${prefix} ${message}`);
        break;
      case 'warn':
        logger.warn(`${prefix} ${message}`);
        break;
      case 'success':
        logger.info(`${prefix} ✅ ${message}`);
        break;
      case 'debug':
        logger.debug(`${prefix} ${message}`);
        break;
      default:
        logger.info(`${prefix} ${message}`);
    }
  }
}

module.exports = HoellStreamPoller;
