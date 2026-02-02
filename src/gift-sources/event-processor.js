/**
 * EventProcessor - Source-Agnostic Gift Event Processing
 *
 * Unified gift event processing logic shared between HoellStream and TikFinity.
 * Handles:
 * - Event normalization from multiple sources
 * - Gift mapping to game operations
 * - Threshold tracking (count-based and value-based)
 * - Script execution for custom gift actions
 * - Duplicate event detection
 *
 * @module event-processor
 * @requires ../utils/logger
 *
 * @example
 * const EventProcessor = require('./event-processor');
 * const processor = new EventProcessor(gameOps, basicOps, { debugMode: true });
 * processor.updateMappings(giftMappings);
 * await processor.processEvent(normalizedEvent);
 */

const logger = require('../utils/logger');

/**
 * EventProcessor class - Processes gift events from multiple sources
 *
 * @class EventProcessor
 */
class EventProcessor {
  /**
   * Create an EventProcessor instance
   *
   * @param {Object} gameOperations - Game operations instance (SMW operations)
   * @param {Object} config - Configuration options
   * @param {boolean} config.debugMode - Enable debug logging (default true)
   * @param {Object} config.giftDatabase - TikTok gift database for coin value lookups
   */
  constructor(gameOperations, config = {}) {
    this.gameOps = gameOperations;  // SMW operations only
    this.restorationManager = null; // ItemRestorationManager (set via setRestorationManager)
    this.scriptEngine = null; // ScriptEngine (set via setScriptEngine)
    this.seenEventIds = new Set();
    this.startTime = null; // Track when processing started (to filter old events)

    // Gift mappings (loaded dynamically from settings)
    this.giftMappings = {};

    // Gift name overrides (for handling renamed gifts)
    this.giftNameOverrides = {}; // Format: { "coinValue-originalName": "overriddenName" }
    this.reverseOverrides = {}; // Format: { "overriddenName": "originalName" } for reverse lookup

    // Threshold tracking (resets each session)
    this.thresholdCounts = new Map(); // gift name -> current count
    this.thresholdConfigs = new Map(); // gift name -> { type, target, action, params }
    this.totalCoinValue = 0; // Track total coin value for value-based thresholds

    // Configuration
    this.debugMode = config.debugMode !== undefined ? config.debugMode : true;

    // Load TIKTOK_GIFTS database for coin value lookups
    this.giftDatabase = config.giftDatabase || null;
    // Create indexed Map for O(1) gift lookups
    this.giftIndex = new Map(); // giftName (lowercase) -> { giftName: string, coins: number }

    if (this.giftDatabase) {
      this._buildGiftIndex();
      const giftCount = Object.values(this.giftDatabase).reduce((sum, arr) => sum + arr.length, 0);
      this.log(`📚 Gift database loaded with ${giftCount} gifts (indexed for O(1) lookups)`);
    } else {
      this.log(`⚠️ No gift database provided - coin value tracking disabled`, 'warn');
    }

    this.log('🎁 EventProcessor initialized');
  }

  /**
   * Build indexed Map from gift database for O(1) lookups
   * @private
   */
  _buildGiftIndex() {
    this.giftIndex.clear();
    for (const [coins, giftNames] of Object.entries(this.giftDatabase)) {
      const coinValue = parseInt(coins);
      for (const giftName of giftNames) {
        this.giftIndex.set(giftName.toLowerCase(), {
          giftName: giftName,
          coins: coinValue
        });
      }
    }
  }

  /**
   * Set the restoration manager (called from main.js after initialization)
   *
   * @param {ItemRestorationManager} restorationManager - Restoration manager instance
   */
  setRestorationManager(restorationManager) {
    this.restorationManager = restorationManager;
    this.log('⏱️ ItemRestorationManager connected to EventProcessor');
  }

  /**
   * Set the script engine (called from main.js after initialization)
   *
   * @param {ScriptEngine} scriptEngine - Script engine instance for Lua execution
   */
  setScriptEngine(scriptEngine) {
    this.scriptEngine = scriptEngine;
    this.log('📜 ScriptEngine connected to EventProcessor');
  }

  /**
   * Set the main window for event emission (called from main.js after initialization)
   *
   * @param {BrowserWindow} mainWindow - Electron main window instance
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
    this.log('🪟 MainWindow connected to EventProcessor');
  }

  /**
   * Set the action console window for event emission (called from main.js when popup opens)
   *
   * @param {BrowserWindow} actionConsoleWindow - Action console window instance
   */
  setActionConsoleWindow(actionConsoleWindow) {
    this.actionConsoleWindow = actionConsoleWindow;
    this.log('🎮 ActionConsoleWindow connected to EventProcessor');
  }

  /**
   * Load gift name overrides from file
   *
   * @param {Object} overrides - Gift name overrides map (format: "coinValue-originalName" -> "overriddenName")
   *
   * @example
   * await processor.loadGiftNameOverrides({ "1-Rose": "Flower" });
   */
  async loadGiftNameOverrides(overrides) {
    this.giftNameOverrides = overrides || {};

    // Build reverse lookup map (overriddenName -> originalName)
    this.reverseOverrides = {};
    for (const [key, overriddenName] of Object.entries(this.giftNameOverrides)) {
      // Key format: "coinValue-originalName"
      const parts = key.split('-');
      const originalName = parts.slice(1).join('-'); // Handle names with dashes
      this.reverseOverrides[overriddenName] = originalName;
    }

    const count = Object.keys(this.giftNameOverrides).length;
    this.log(`📝 Loaded ${count} gift name overrides (${Object.keys(this.reverseOverrides).length} reverse mappings)`);
  }

  /**
   * Resolve gift name for mapping lookup
   * If the gift name is an override (new name), return the original name for mapping lookup
   * Otherwise return the name as-is
   *
   * @param {string} giftName - Gift name to resolve
   * @returns {string} Original gift name for mapping lookup
   *
   * @example
   * const originalName = processor.resolveGiftNameForMapping("Flower");
   * // Returns "Rose" if "Flower" is an override for "Rose"
   */
  resolveGiftNameForMapping(giftName) {
    // First, check if this is an overridden name (new name)
    if (this.reverseOverrides[giftName]) {
      const originalName = this.reverseOverrides[giftName];
      this.log(`🔄 Resolving overridden name "${giftName}" to original "${originalName}" for mapping lookup`);
      return originalName;
    }

    // Otherwise, use the name as-is
    return giftName;
  }

  /**
   * Update game operations (called when switching between SNI and Lua connector)
   *
   * @param {Object} gameOperations - Game operations instance (SMW operations)
   */
  updateOperations(gameOperations) {
    this.gameOps = gameOperations;  // SMW operations only
    this.log('🔄 EventProcessor operations updated');
    this.log(`   gameOps type: ${this.gameOps.constructor.name}`);
  }

  /**
   * Set start time for filtering old events
   *
   * @param {Date} startTime - Processing start timestamp
   */
  setStartTime(startTime) {
    this.startTime = startTime;
    this.log(`🕒 Event processing start time set to ${startTime.toISOString()}`);
  }

  /**
   * Look up coin value for a gift name from TIKTOK_GIFTS database
   * Uses O(1) Map lookup instead of O(n) linear search
   *
   * @param {string} giftName - Gift name to lookup
   * @returns {number} Coin value for the gift (0 if not found)
   *
   * @example
   * const value = processor.getGiftCoinValue("Rose");
   * console.log(`Rose costs ${value} coins`);
   */
  getGiftCoinValue(giftName) {
    // Check if database is loaded
    if (!this.giftDatabase || !this.giftIndex) {
      return 0;
    }

    // O(1) lookup using indexed Map
    const giftData = this.giftIndex.get(giftName.toLowerCase());
    if (giftData) {
      this.log(`💰 Looked up "${giftName}": ${giftData.coins} coins`, 'info');
      return giftData.coins;
    }

    // Gift not found in database
    this.log(`⚠️ Gift "${giftName}" not found in database`, 'warn');
    return 0;
  }

  /**
   * Update gift database and rebuild index (called when database changes)
   *
   * @param {Object} database - Gift database object (format: { coinValue: [giftNames] })
   *
   * @example
   * processor.loadGiftDatabase({ "1": ["Rose", "Heart"], "5": ["Panda"] });
   */
  loadGiftDatabase(database) {
    this.giftDatabase = database;
    if (database) {
      this._buildGiftIndex();
      const giftCount = Object.values(database).reduce((sum, arr) => sum + arr.length, 0);
      this.log(`🔄 Gift database reloaded with ${giftCount} gifts (index rebuilt)`);
    } else {
      this.giftIndex.clear();
      this.log(`⚠️ Gift database cleared`, 'warn');
    }
  }

  /**
   * Update gift mappings (called when settings are saved)
   *
   * @param {Object} mappings - Gift mappings object (giftName -> mapping config)
   *
   * @example
   * processor.updateMappings({ "Rose": { action: "giveMushroom", type: "operation" } });
   */
  updateMappings(mappings) {
    this.giftMappings = mappings;
    this.log(`🔄 Updated gift mappings: ${Object.keys(mappings).length} gifts configured`);
  }

  /**
   * Normalize TikFinity event to HoellStream format
   *
   * @param {Object} tikfinityEvent - Raw TikFinity event object
   * @returns {Object|null} Normalized event or null if invalid
   *
   * @example
   * const normalized = processor.normalizeTikFinityEvent(rawEvent);
   * if (normalized) await processor.processEvent(normalized);
   */
  normalizeTikFinityEvent(tikfinityEvent) {
    // Log all incoming TikFinity events for debugging
    this.log(`📥 Raw TikFinity event: ${JSON.stringify(tikfinityEvent)}`, 'info');

    if (!tikfinityEvent) {
      this.log('⚠️ Received null/undefined TikFinity event', 'warn');
      return null;
    }

    if (tikfinityEvent.event !== 'gift') {
      this.log(`⚠️ Ignoring non-gift TikFinity event: ${tikfinityEvent.event}`, 'info');
      return null; // Only process gift events
    }

    const data = tikfinityEvent.data;
    if (!data) {
      this.log('⚠️ TikFinity gift event has no data field', 'warn');
      return null;
    }

    if (!data.giftName) {
      this.log(`⚠️ TikFinity gift event missing giftName: ${JSON.stringify(data)}`, 'warn');
      return null;
    }

    // Generate unique event ID
    const eventId = `tikfinity_${data.userId || 'unknown'}_${Date.now()}_${data.giftId || 'unknown'}`;

    // Look up diamond/coin value
    const diamondCount = this.getGiftCoinValue(data.giftName);

    const normalized = {
      id: eventId,
      platform: 'tiktok',
      type: 'gift',
      username: data.uniqueId || 'Unknown',
      displayName: data.uniqueId || 'Unknown', // TikFinity doesn't provide separate displayName
      giftName: data.giftName,
      amount: data.repeatCount || 1,
      diamondCount: diamondCount,
      timestamp: new Date().toISOString(), // TikFinity events are real-time
      source: 'tikfinity' // Add source tag for debugging
    };

    this.log(`✅ Normalized TikFinity event: ${normalized.giftName} x${normalized.amount} from ${normalized.displayName}`, 'success');
    return normalized;
  }

  /**
   * Process a single event (source-agnostic)
   *
   * @param {Object} event - Normalized event object
   * @param {string} event.id - Unique event ID
   * @param {string} event.giftName - Gift name
   * @param {number} event.amount - Gift amount/multiplier
   * @param {string} event.displayName - User display name
   * @param {string} event.source - Event source (hoellstream/tikfinity)
   * @returns {Promise<void>}
   *
   * @example
   * await processor.processEvent({
   *   id: "evt_123",
   *   giftName: "Rose",
   *   amount: 1,
   *   displayName: "User123",
   *   source: "tikfinity"
   * });
   */
  async processEvent(event) {
    console.log('🔍 [EventProcessor.processEvent] Called!');
    console.log('   Event:', event);
    console.log('   gameOps type:', this.gameOps ? this.gameOps.constructor.name : 'null');

    const processStartTime = Date.now();

    // Check if we've already processed this event
    if (this.seenEventIds.has(event.id)) {
      if (this.debugMode) {
        this.log(`✋ Already processed event: ${event.id}`);
      }
      return;
    }

    // Mark as seen
    this.seenEventIds.add(event.id);

    const giftName = event.giftName;
    const giftAmount = event.amount || 1;
    const amountText = giftAmount > 1 ? ` x${giftAmount}` : '';

    // Log ALL received gifts (regardless of mapping)
    const source = event.source === 'hoellstream' ? 'HoellStream' : event.source === 'tikfinity' ? 'TikFinity' : event.source;
    this.log(`📥 [${source}] ${giftName}${amountText} from ${event.displayName}`, 'info');

    // Calculate event age (time from event to now)
    const eventTime = new Date(event.timestamp);
    const eventAge = Date.now() - eventTime.getTime();
    if (eventAge > 1000) {
      this.log(`⏱️ Event age: ${eventAge}ms (gift received ${(eventAge/1000).toFixed(1)}s ago)`, 'warn');
    }

    // Look up coin value from TIKTOK_GIFTS database
    const coinValue = this.getGiftCoinValue(giftName);

    // Emit gift activity event to renderer (for activity log)
    const activityData = {
      giftName,
      amount: giftAmount,
      displayName: event.displayName,
      source: event.source,
      timestamp: event.timestamp,
      coinValue
    };

    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('gift-activity', activityData);
    }

    // Also send to action console popup if it's open
    if (this.actionConsoleWindow && !this.actionConsoleWindow.isDestroyed()) {
      this.actionConsoleWindow.webContents.send('gift-activity', activityData);
    }

    // ALWAYS track coin value for value-based thresholds (even for unmapped gifts)
    if (coinValue > 0) {
      const coinValueAdded = coinValue * giftAmount;
      this.totalCoinValue += coinValueAdded;
      this.log(`💎 Total coin value this session: ${this.totalCoinValue.toLocaleString()} (+${coinValueAdded.toLocaleString()} from ${giftName} x${giftAmount})`, 'success');

      // Check value-based threshold for ALL gifts
      await this.checkValueThreshold();
    } else {
      this.log(`⚠️ No coin value found for "${giftName}" - not adding to total`, 'warn');
    }

    // Resolve gift name (handle overrides: if this is an overridden name, get the original)
    const resolvedName = this.resolveGiftNameForMapping(giftName);

    // Check if we have a mapping for this gift (using resolved name)
    const mapping = this.giftMappings[resolvedName];

    if (!mapping) {
      this.log(`❓ No action mapped for ${giftName}${resolvedName !== giftName ? ` (resolved from ${resolvedName})` : ''}`, 'info');

      // Still check count-based thresholds for unmapped gifts (use display name for tracking)
      await this.checkThreshold(giftName);

      const processingTime = Date.now() - processStartTime;
      this.log(`⏱️ Processing time: ${processingTime}ms`, 'info');
      return;
    }

    // Execute the mapped action (pass the display name for logging, but we found the mapping via resolved name)
    await this.handleGift(giftName, mapping, event);

    const processingTime = Date.now() - processStartTime;
    this.log(`⏱️ Total processing time: ${processingTime}ms`, 'info');
  }

  /**
   * Handle a gift by executing its mapped action
   */
  async handleGift(giftName, mapping, event) {
    const { type, action, script, emoji, description, params } = mapping;

    // Get the gift amount (multiplier) from the event
    const giftAmount = event.amount || 1;
    const amountText = giftAmount > 1 ? ` x${giftAmount}` : '';

    this.log(`🎁 ${emoji} ${giftName}${amountText} received from ${event.displayName}`, 'success');

    // Log action type
    if (type === 'script' && script) {
      this.log(`   → Type: Script | Script: ${script} | Description: ${description}`, 'info');
    } else {
      this.log(`   → Type: Operation | Action: ${action} | Description: ${description} | Params: ${JSON.stringify(params)}`, 'info');
    }

    // Check threshold tracking for this gift (count-based)
    await this.checkThreshold(giftName);

    // Small delay to prevent overwhelming SNI connection with rapid gifts (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check if this is a Lua script action
    if (type === 'script' && script) {
      return await this.executeScriptAction(script, giftName, event, description);
    }

    // Otherwise, execute built-in operation
    return await this.executeOperationAction(action, params, event, description);
  }

  /**
   * Execute Lua script action (NEW)
   */
  async executeScriptAction(scriptName, giftName, event, description) {
    if (!this.scriptEngine) {
      this.log('❌ ScriptEngine not initialized', 'error');
      return;
    }

    try {
      this.log(`📜 Executing script: ${scriptName}`, 'info');

      // Get coin value for context
      const coinValue = this.getGiftCoinValue(giftName);

      // Create gift context for script
      const giftContext = {
        giftName: giftName,
        displayName: event.displayName,
        username: event.username,
        amount: event.amount || 1,
        coinValue: coinValue,
        timestamp: event.timestamp
      };

      // Execute script with timeout protection
      const result = await this.scriptEngine.executeScript(scriptName, giftContext);

      if (result.success) {
        this.log(`✅ ${description} completed successfully (${result.executionTime}ms)`, 'success');
      } else {
        this.log(`⚠️ Script error: ${result.error}`, 'warn');
        if (result.lineNumber) {
          this.log(`   at line ${result.lineNumber}`, 'warn');
        }
      }

      return result;
    } catch (error) {
      this.log(`❌ Script execution failed: ${error.message}`, 'error');
      console.error('Script error:', error);
    }
  }

  /**
   * Execute built-in operation action (REFACTORED from handleGift)
   */
  async executeOperationAction(action, params, event, description) {
    const giftAmount = event.amount || 1;

    try {
      let result;

      this.log(`🔧 Executing action: ${action}`, 'info');
      this.log(`   Using operations: gameOps=${this.gameOps.constructor.name}`, 'info');

      // Special handling for disableItem action (only relevant for ALTTP - skip for SMW)
      if (action === 'disableItem') {
        this.log(`⚠️ disableItem not applicable to SMW - skipping`, 'warn');
        return;
      }

      // Special handling for timed event actions (with duration parameter)
      // These are ALTTP-specific, SMW would have different timed events
      const timedActions = [
        'triggerChickenAttack', 'triggerEnemyWaves', 'triggerBeeSwarmWaves', 'makeEnemiesInvisible',
        'moonJump', 'tinyJump', 'lowGravity', 'highGravity', 'modifyJumpHeight', 'modifyGravity'
      ];
      if (timedActions.includes(action)) {
        // Check which operations object has the action
        let ops = null;
        if (typeof this.gameOps[action] === 'function') {
          ops = this.gameOps; // expandedOps
        } else {
          this.log(`❌ Invalid action: ${action} does not exist in either operations`, 'error');
          return;
        }

        const duration = (params && params.duration) ? params.duration : 60;
        this.log(`🔧 Calling ${action}(${duration}) [timed event, params=${JSON.stringify(params)}]`, 'info');
        result = await ops[action](duration);

        if (result && result.success === false) {
          this.log(`⚠️  Action failed: ${result.error || 'Unknown error'}`, 'warn');
        } else {
          this.log(`✅ ${description} completed successfully (${duration}s)`, 'success');
        }

        return;
      }

      // Check which operations object has the action
      let ops = null;
      if (typeof this.gameOps[action] === 'function') {
        ops = this.gameOps; // expandedOps
        this.log(`   Found action in expandedOps`, 'info');
        this.log(`   Found action in basicOps`, 'info');
      } else {
        this.log(`❌ Invalid action: ${action} does not exist in either operations`, 'error');
        return;
      }

      // Actions that don't take any parameters
      const noParamActions = ['deleteAllSaves', 'killPlayer', 'spawnRandomEnemy', 'despawnFloorBlocks'];

      // Execute the game operation
      if (noParamActions.includes(action)) {
        // These actions don't take parameters
        this.log(`🔧 Calling ${action}() [no params needed]`, 'info');
        result = await ops[action]();
      } else if (params && Object.keys(params).length > 0) {
        // Get the first value from params object (level, amount, count, name, num, type, etc.)
        const paramValue = Object.values(params)[0];
        this.log(`🔧 Calling ${action}(${paramValue}, ${giftAmount}) [with params]`, 'info');
        result = await ops[action](paramValue, giftAmount);
      } else {
        // For operations without params, pass the gift amount as first parameter
        this.log(`🔧 Calling ${action}(${giftAmount}) [with gift amount]`, 'info');
        result = await ops[action](giftAmount);
      }

      if (result && result.success === false) {
        this.log(`⚠️  Action failed: ${result.error || 'Unknown error'}`, 'warn');
      } else {
        this.log(`✅ ${description} completed successfully`, 'success');
      }

    } catch (error) {
      // Enhanced error logging with connection diagnostics
      if (error.message.includes('UNAVAILABLE') || error.message.includes('Connection') || error.message.includes('ECONNREFUSED')) {
        this.log(`❌ Connection error executing ${action}: ${error.message}`, 'error');
        this.log(`⚠️  SNI connection lost - check if SNI.exe is running and restart it if needed`, 'warn');
      } else if (error.message.includes('No device selected')) {
        this.log(`❌ No device selected - connect to SNI first`, 'error');
      } else if (error.message.includes('timeout') || error.code === 4) {
        this.log(`❌ Timeout executing ${action} - SNI may be overloaded, retrying next gift`, 'error');
      } else {
        this.log(`❌ Error executing ${action}: ${error.message}`, 'error');
        console.error('Full error stack:', error);
      }
    }
  }

  /**
   * Execute a gift action (used by threshold system)
   */
  async executeGiftAction(action, description, params = {}) {
    try {
      let result;

      // Special handling for disableItem action (only relevant for ALTTP - skip for SMW)
      if (action === 'disableItem') {
        this.log(`⚠️ disableItem not applicable to SMW - skipping`, 'warn');
        return;
      }

      // Special handling for timed event actions (with duration parameter)
      const timedActions = [
        'triggerChickenAttack', 'triggerEnemyWaves', 'triggerBeeSwarmWaves', 'makeEnemiesInvisible',
        'moonJump', 'tinyJump', 'lowGravity', 'highGravity', 'modifyJumpHeight', 'modifyGravity'
      ];
      if (timedActions.includes(action)) {
        // Check which operations object has the action
        let ops = null;
        if (typeof this.gameOps[action] === 'function') {
          ops = this.gameOps; // expandedOps
        } else {
          this.log(`❌ Invalid action: ${action} does not exist in either operations`, 'error');
          return;
        }

        const duration = (params && params.duration) ? params.duration : 60;
        this.log(`🔧 Calling ${action}(${duration}) [timed event, params=${JSON.stringify(params)}]`, 'info');
        result = await ops[action](duration);

        if (result && result.success === false) {
          this.log(`⚠️  Action failed: ${result.error || 'Unknown error'}`, 'warn');
        } else {
          this.log(`✅ ${description} completed successfully (${duration}s)`, 'success');
        }

        return;
      }

      // Check which operations object has the action
      let ops = null;
      if (typeof this.gameOps[action] === 'function') {
        ops = this.gameOps; // expandedOps
        this.log(`   [Threshold] Found action in expandedOps`, 'info');
        this.log(`   [Threshold] Found action in basicOps`, 'info');
      } else {
        this.log(`❌ [Threshold] Invalid action: ${action} does not exist in either operations`, 'error');
        return;
      }

      // Actions that don't take any parameters
      const noParamActions = ['deleteAllSaves', 'killPlayer', 'spawnRandomEnemy', 'despawnFloorBlocks'];

      // Execute the game operation
      if (noParamActions.includes(action)) {
        // These actions don't take parameters
        this.log(`🔧 [Threshold] Calling ${action}() [no params needed]`, 'info');
        result = await ops[action]();
      } else if (params && Object.keys(params).length > 0) {
        // Get the first value from params object (level, amount, count, name, num, type, etc.)
        const paramValue = Object.values(params)[0];
        this.log(`🔧 [Threshold] Calling ${action}(${paramValue}) [with params]`, 'info');
        result = await ops[action](paramValue);
      } else {
        // For operations without params
        this.log(`🔧 [Threshold] Calling ${action}() [no params]`, 'info');
        result = await ops[action]();
      }

      if (result && result.success === false) {
        this.log(`⚠️  Action failed: ${result.error || 'Unknown error'}`, 'warn');
      } else {
        this.log(`✅ ${description} completed successfully`, 'success');
      }

    } catch (error) {
      this.log(`❌ Error executing ${action}: ${error.message}`, 'error');
    }
  }

  /**
   * Load threshold configurations from storage
   */
  async loadThresholdConfigs(thresholds) {
    this.thresholdConfigs.clear();
    this.thresholdCounts.clear();

    if (!thresholds || Object.keys(thresholds).length === 0) {
      this.log('📊 No threshold configurations loaded');
      return;
    }

    for (const [giftName, config] of Object.entries(thresholds)) {
      this.thresholdConfigs.set(giftName, config);
      this.thresholdCounts.set(giftName, 0); // Initialize count to 0
      this.log(`📊 Threshold loaded: ${config.target} x "${giftName}" → ${config.action}`);
    }

    this.log(`📊 Loaded ${this.thresholdConfigs.size} threshold configurations`);
  }

  /**
   * Increment threshold count for a gift and check if threshold is met
   */
  async checkThreshold(giftName) {
    // Debug: Show all configured thresholds
    if (this.thresholdConfigs.size > 0) {
      this.log(`🔍 Checking threshold for "${giftName}" (Configured: ${Array.from(this.thresholdConfigs.keys()).join(', ')})`, 'info');
    }

    if (!this.thresholdConfigs.has(giftName)) {
      this.log(`⏭️ No threshold configured for "${giftName}"`, 'info');
      return; // Gift not configured for threshold
    }

    const config = this.thresholdConfigs.get(giftName);
    const currentCount = (this.thresholdCounts.get(giftName) || 0) + 1;
    this.thresholdCounts.set(giftName, currentCount);

    this.log(`📊 Threshold progress: ${currentCount}/${config.target} x "${giftName}"`, 'success');

    // Check if threshold is met
    if (currentCount >= config.target) {
      this.log(`🎯 Threshold reached! ${config.target} x "${giftName}" → Triggering ${config.action}`, 'success');

      // Reset counter
      this.thresholdCounts.set(giftName, 0);

      // Execute the action
      await this.executeGiftAction(config.action, config.description || config.action, config.params || {});
    }
  }

  /**
   * Check value-based threshold (total coin value)
   */
  async checkValueThreshold() {
    // Check if there's a value-based threshold configured
    if (!this.thresholdConfigs.has('__VALUE_TOTAL__')) {
      return;
    }

    const config = this.thresholdConfigs.get('__VALUE_TOTAL__');

    this.log(`📊 Value threshold progress: ${this.totalCoinValue.toLocaleString()}/${config.target.toLocaleString()} coins`, 'success');

    // Check if threshold is met
    if (this.totalCoinValue >= config.target) {
      this.log(`🎯 VALUE THRESHOLD REACHED! ${config.target.toLocaleString()} total coins → Triggering ${config.action}`, 'success');

      // Reset counter
      this.totalCoinValue = 0;

      // Execute the action
      await this.executeGiftAction(config.action, config.description || config.action, config.params || {});
    }
  }

  /**
   * Get current threshold status for all configured thresholds
   */
  getThresholdStatus() {
    const status = [];

    for (const [giftName, config] of this.thresholdConfigs.entries()) {
      let current;

      if (giftName === '__VALUE_TOTAL__') {
        // Value-based threshold
        current = this.totalCoinValue;
      } else {
        // Count-based threshold
        current = this.thresholdCounts.get(giftName) || 0;
      }

      status.push({
        giftName,
        current,
        target: config.target,
        action: config.action,
        description: config.description || config.action,
        progress: `${current}/${config.target}`
      });
    }

    return status;
  }

  /**
   * Clear the seen events cache (useful for testing)
   */
  clearSeenEvents() {
    const count = this.seenEventIds.size;
    this.seenEventIds.clear();
    this.log(`🗑️  Cleared ${count} seen events from cache`);
  }

  /**
   * Internal logging helper - uses configurable logger for performance
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const prefix = `[${timestamp}] [EventProcessor]`;

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

module.exports = EventProcessor;
