/**
 * GiftAPIClient - Fetches gift data from streamtoearn.io API
 * Handles parsing, validation, and normalization of gift data
 */

const https = require('https');

class GiftAPIClient {
  constructor(config = {}) {
    this.apiBaseUrl = config.apiBaseUrl || 'https://streamtoearn.io';
    this.timeout = config.timeout || 10000; // 10 seconds
    this.region = config.region || 'US';
  }

  /**
   * Fetch gifts from streamtoearn.io API
   * @param {string} region - Region code (US, EU, etc.)
   * @returns {Promise<Object>} Normalized gift data
   */
  async fetchGifts(region = this.region) {
    try {
      console.log(`🌐 Fetching gifts from streamtoearn.io (region: ${region})...`);

      const url = `${this.apiBaseUrl}/gifts?region=${region}`;
      const rawData = await this._makeRequest(url);

      console.log(`✅ Received gift data (${rawData.length} gifts)`);

      // Validate response structure
      if (!this._validateResponse(rawData)) {
        throw new Error('Invalid API response structure');
      }

      // Normalize to internal format
      const normalizedData = this.normalizeGiftData(rawData);

      return {
        success: true,
        gifts: normalizedData.gifts,
        images: normalizedData.images,
        rawCount: rawData.length,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Failed to fetch gifts:', error.message);
      return {
        success: false,
        error: error.message,
        errorType: this._categorizeError(error)
      };
    }
  }

  /**
   * Make HTTP GET request with timeout
   * @private
   */
  _makeRequest(url) {
    return new Promise((resolve, reject) => {
      let timeoutHandle = null;
      let isResolved = false;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      };

      const safeReject = (error) => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        reject(error);
      };

      const safeResolve = (data) => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        resolve(data);
      };

      timeoutHandle = setTimeout(() => {
        safeReject(new Error(`Request timeout after ${this.timeout}ms`));
      }, this.timeout);

      try {
        const request = https.get(url, (response) => {
          if (isResolved) return;
          clearTimeout(timeoutHandle);

          if (response.statusCode !== 200) {
            safeReject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            response.resume(); // Drain response to free up memory
            return;
          }

          let data = '';

          response.on('data', (chunk) => {
            if (isResolved) return;
            try {
              data += chunk;
            } catch (error) {
              safeReject(new Error(`Data chunk error: ${error.message}`));
            }
          });

          response.on('end', () => {
            if (isResolved) return;
            try {
              // Check if response is HTML or JSON
              const trimmedData = data.trim();
              if (!trimmedData) {
                safeReject(new Error('Empty response received'));
                return;
              }

              if (trimmedData.startsWith('<')) {
                // HTML response - parse it
                console.log('📄 Received HTML response, parsing gifts...');
                const parsedGifts = this._parseHTMLGifts(data);
                safeResolve(parsedGifts);
              } else {
                // JSON response
                const parsed = JSON.parse(data);
                safeResolve(parsed);
              }
            } catch (error) {
              safeReject(new Error(`Failed to parse response: ${error.message}`));
            }
          });

          response.on('error', (error) => {
            safeReject(new Error(`Response stream error: ${error.message}`));
          });

        }).on('error', (error) => {
          // Handle DNS failures, connection refused, etc.
          if (error.code === 'ENOTFOUND') {
            safeReject(new Error(`DNS lookup failed: Cannot resolve ${error.hostname || 'hostname'}`));
          } else if (error.code === 'ECONNREFUSED') {
            safeReject(new Error('Connection refused by server'));
          } else if (error.code === 'ETIMEDOUT') {
            safeReject(new Error('Connection timed out'));
          } else if (error.code === 'ECONNRESET') {
            safeReject(new Error('Connection reset by server'));
          } else {
            safeReject(new Error(`Network error: ${error.message}`));
          }
        });

        // Handle request errors (before connection is established)
        request.on('timeout', () => {
          request.destroy();
          safeReject(new Error('Request timeout'));
        });

      } catch (error) {
        // Catch synchronous errors (e.g., invalid URL)
        safeReject(new Error(`Request setup error: ${error.message}`));
      }
    });
  }

  /**
   * Parse gift data from HTML page
   * @private
   */
  _parseHTMLGifts(html) {
    const gifts = [];

    // Simple regex-based parsing for gift data
    // Pattern: <div class="gift">...<img src="URL"...<p class="gift-name">NAME</p>...<p class="gift-price">COINS
    const giftPattern = /<div class="gift">[\s\S]*?<img src="([^"]+)"[\s\S]*?<p class="gift-name">([^<]+)<\/p>[\s\S]*?<p class="gift-price">(\d+)/g;

    let match;
    while ((match = giftPattern.exec(html)) !== null) {
      const imageUrl = match[1];
      const name = this._decodeHTML(match[2]);
      const coins = parseInt(match[3]);

      if (name && coins) {
        gifts.push({
          name: name.trim(),
          coins: coins,
          imageUrl: imageUrl
        });
      }
    }

    console.log(`📦 Parsed ${gifts.length} gifts from HTML`);
    return gifts;
  }

  /**
   * Decode HTML entities
   * @private
   */
  _decodeHTML(text) {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x27;': "'",
      '&apos;': "'"
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return entities[entity] || entity;
    });
  }

  /**
   * Validate API response structure
   * @private
   */
  _validateResponse(data) {
    if (!Array.isArray(data)) {
      console.error('Invalid response: Not an array');
      return false;
    }

    if (data.length === 0) {
      console.error('Invalid response: Empty array');
      return false;
    }

    // Check first few items have required fields
    const sampleSize = Math.min(5, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const gift = data[i];
      if (!gift.name || typeof gift.coins !== 'number') {
        console.error(`Invalid gift structure at index ${i}:`, gift);
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize gift data from API format to internal TIKTOK_GIFTS format
   * @param {Array} apiData - Raw API response
   * @returns {Object} Normalized data {gifts, images}
   */
  normalizeGiftData(apiData) {
    const gifts = {}; // Grouped by coin value
    const images = {}; // Image URLs by coin value and gift name

    apiData.forEach(item => {
      const { name, coins, imageUrl } = item;

      // Group gifts by coin value
      if (!gifts[coins]) {
        gifts[coins] = [];
      }
      gifts[coins].push(name);

      // Store image URLs
      if (imageUrl) {
        if (!images[coins]) {
          images[coins] = {};
        }
        images[coins][name] = {
          cdn: imageUrl,
          local: `./gift-images/${this._sanitizeForFilename(name)}_${coins}.webp`
        };
      }
    });

    // Sort gift names within each coin value
    for (const coins in gifts) {
      gifts[coins].sort();
    }

    console.log(`📦 Normalized ${Object.keys(gifts).length} coin values, ${apiData.length} total gifts`);

    return { gifts, images };
  }

  /**
   * Sanitize gift name for filename
   * @private
   */
  _sanitizeForFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Categorize error type for better handling
   * @private
   */
  _categorizeError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('enotfound') || message.includes('econnrefused')) {
      return 'network';
    }
    if (message.includes('parse') || message.includes('json')) {
      return 'parse_error';
    }
    if (message.includes('http')) {
      return 'http_error';
    }
    if (message.includes('invalid')) {
      return 'validation_error';
    }

    return 'unknown';
  }

  /**
   * Get human-readable error message
   * @param {string} errorType - Error type from _categorizeError
   * @returns {string} User-friendly error message
   */
  getErrorMessage(errorType) {
    const messages = {
      timeout: 'Request timed out. Please check your internet connection and try again.',
      network: 'Unable to reach streamtoearn.io. Please check your internet connection.',
      parse_error: 'Received invalid data from the server. The API may have changed.',
      http_error: 'Server returned an error. The API may be temporarily unavailable.',
      validation_error: 'Received unexpected data format. The API may have changed.',
      unknown: 'An unexpected error occurred. Please try again later.'
    };

    return messages[errorType] || messages.unknown;
  }
}

module.exports = GiftAPIClient;
