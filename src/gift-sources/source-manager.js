/**
 * GiftSourceManager
 * Manages active gift source selection (HoellStream OR TikFinity)
 * Ensures only ONE source is active at a time
 */
class GiftSourceManager {
  constructor() {
    this.activeSource = null; // 'hoellstream' or 'tikfinity'
    this.hoellstreamPoller = null;
    this.tikfinityClient = null;
    this.eventProcessor = null;
    this.isPollingActive = false;
    this.tikfinityEventHandler = null; // Store handler for cleanup
  }

  /**
   * Initialize the source manager with source clients
   */
  initialize(hoellstreamPoller, tikfinityClient, eventProcessor) {
    this.hoellstreamPoller = hoellstreamPoller;
    this.tikfinityClient = tikfinityClient;
    this.eventProcessor = eventProcessor;
    console.log('🎁 GiftSourceManager initialized');
  }

  /**
   * Start polling with the specified source
   */
  async startPolling(source) {
    if (this.isPollingActive) {
      throw new Error('Polling already active. Stop current source first.');
    }

    if (source !== 'hoellstream' && source !== 'tikfinity') {
      throw new Error(`Invalid source: ${source}. Must be 'hoellstream' or 'tikfinity'.`);
    }

    console.log(`🎁 Starting gift polling with source: ${source}`);

    if (source === 'hoellstream') {
      // Start HoellStream HTTP polling
      this.hoellstreamPoller.start();
    } else if (source === 'tikfinity') {
      // Set up TikFinity WebSocket event listener
      this.tikfinityEventHandler = (tikfinityEvent) => {
        console.log('🔍 [TikFinity] Event received:', tikfinityEvent);
        // Normalize and process event
        const normalized = this.eventProcessor.normalizeTikFinityEvent(tikfinityEvent);
        console.log('🔍 [TikFinity] Normalized event:', normalized);
        if (normalized) {
          this.eventProcessor.processEvent(normalized);
        } else {
          console.log('⚠️ [TikFinity] Event failed normalization');
        }
      };

      this.tikfinityClient.on('event', this.tikfinityEventHandler);

      // Connect to TikFinity WebSocket
      this.tikfinityClient.connect();
    }

    this.activeSource = source;
    this.isPollingActive = true;
    console.log(`✅ ${source} polling started`);
  }

  /**
   * Stop polling (stops active source)
   */
  async stopPolling() {
    if (!this.isPollingActive) {
      console.log('⚠️ No active polling to stop');
      return;
    }

    console.log(`🛑 Stopping ${this.activeSource} polling...`);

    if (this.activeSource === 'hoellstream') {
      this.hoellstreamPoller.stop();
    } else if (this.activeSource === 'tikfinity') {
      this.tikfinityClient.disconnect();
      if (this.tikfinityEventHandler) {
        this.tikfinityClient.removeListener('event', this.tikfinityEventHandler);
        this.tikfinityEventHandler = null;
      }
    }

    this.activeSource = null;
    this.isPollingActive = false;
    console.log('✅ Gift polling stopped');
  }

  /**
   * Get active source name
   */
  getActiveSource() {
    return this.activeSource;
  }

  /**
   * Check if polling is active
   */
  isPolling() {
    return this.isPollingActive;
  }

  /**
   * Get statistics for active source
   */
  getStats() {
    if (!this.isPollingActive) {
      return { polling: false };
    }

    if (this.activeSource === 'hoellstream') {
      return {
        polling: true,
        source: 'hoellstream',
        ...this.hoellstreamPoller.getStats()
      };
    } else if (this.activeSource === 'tikfinity') {
      return {
        polling: true,
        source: 'tikfinity',
        connected: this.tikfinityClient.isConnected(),
        url: this.tikfinityClient.getUrl()
      };
    }
  }
}

module.exports = GiftSourceManager;
