/**
 * Application Initialization Module
 * Handles Electron app startup and window creation
 *
 * @module initialization
 */

const { BrowserWindow, app, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Create main application window
 * @param {Object} filePaths - Application file paths
 * @returns {BrowserWindow} Main window instance
 */
function createMainWindow(filePaths) {
  // Load saved window bounds or use defaults
  let windowBounds = {
    width: 900,
    height: 850
  };

  try {
    const savedBounds = fs.readFileSync(filePaths.WINDOW_SETTINGS, 'utf8');
    const parsedBounds = JSON.parse(savedBounds);
    windowBounds = { ...windowBounds, ...parsedBounds };
    console.log('📐 Loaded saved window position:', windowBounds);
  } catch (error) {
    console.log('📐 Using default window position');
  }

  const mainWindow = new BrowserWindow({
    ...windowBounds,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico')
  });

  mainWindow.loadFile('renderer/index-full.html');

  // Save window bounds when moved or resized
  const saveWindowBounds = () => {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(filePaths.WINDOW_SETTINGS, JSON.stringify(bounds, null, 2), 'utf8');
  };

  // Debounce to avoid excessive file writes
  let saveBoundsTimeout;
  const debouncedSave = () => {
    clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(saveWindowBounds, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('close', saveWindowBounds);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

/**
 * Initialize SNI and Lua clients with operations
 * @returns {Object} Initialized clients and operations
 */
function initializeClients() {
  const SNIClient = require('./sni/client');
  const SMWOperations = require('./sni/operations-smw');
  const LuaConnectorClient = require('./emulator/lua-connector-client');
  const { LuaGameOperations, LuaExpandedOperations, LuaHoellOperations } = require('./emulator/lua-operations');

  // Initialize SNI client and operations
  const sniClient = new SNIClient();
  const smwOps = new SMWOperations(sniClient);
  console.log('🎮 SNI operations initialized');

  // Initialize Lua connector client (not connected by default)
  const luaClient = new LuaConnectorClient();
  console.log('🎮 Lua connector client initialized (not connected)');

  // Initialize Lua operations (will be instantiated when mode switches)
  let luaGameOps = null;
  let luaExpandedOps = null;
  let luaHoellOps = null;

  return {
    sniClient,
    smwOps,
    luaClient,
    luaGameOps,
    luaExpandedOps,
    luaHoellOps
  };
}

/**
 * Initialize all services (pollers, processors, managers, etc.)
 * @param {Object} clients - Client instances
 * @param {Object} mainWindow - Main window instance
 * @returns {Object} Initialized services
 */
function initializeServices(clients, mainWindow) {
  const { sniClient, smwOps, luaClient } = clients;

  const HoellStreamPoller = require('./hoellstream/poller');
  const TikFinityWebSocketClient = require('./tikfinity/websocket-client');
  const ItemRestorationManager = require('./item-restoration/restoration-manager');
  const EventProcessor = require('./gift-sources/event-processor');
  const GiftSourceManager = require('./gift-sources/source-manager');
  const ScriptEngine = require('./lua/script-engine');
  const SNESApi = require('./lua/snes-api');

  let GiftUpdater;
  try {
    GiftUpdater = require('./gift-updater');
    console.log('✅ GiftUpdater module loaded successfully');
  } catch (error) {
    console.error('❌ Failed to require GiftUpdater module:', error);
    console.error('Stack:', error.stack);
  }

  // Initialize ItemRestorationManager
  const restorationManager = new ItemRestorationManager(smwOps);
  console.log('⏱️ ItemRestorationManager initialized');

  // Load TIKTOK_GIFTS database for the poller
  let giftDatabase = null;
  try {
    const { TIKTOK_GIFTS } = require('../renderer/tiktok-gifts.js');
    giftDatabase = TIKTOK_GIFTS;
    console.log('📚 Loaded TIKTOK_GIFTS database for poller');
  } catch (error) {
    console.error('⚠️ Failed to load TIKTOK_GIFTS database:', error);
  }

  // Initialize HoellStream poller
  const hoellPoller = new HoellStreamPoller(smwOps, {
    pollIntervalMs: 2000,
    debugMode: true,
    giftDatabase: giftDatabase
  });
  console.log('🎁 HoellStream poller initialized');

  // Connect restoration manager to poller (deprecated - kept for backward compatibility)
  hoellPoller.setRestorationManager(restorationManager);

  // Initialize EventProcessor
  const eventProcessor = new EventProcessor(smwOps, {
    debugMode: true,
    giftDatabase: giftDatabase
  });
  console.log('🎁 EventProcessor initialized');

  // Connect services
  eventProcessor.setRestorationManager(restorationManager);
  eventProcessor.setMainWindow(mainWindow);
  hoellPoller.setEventProcessor(eventProcessor);

  // Initialize TikFinity WebSocket client
  const tikfinityClient = new TikFinityWebSocketClient({
    url: 'ws://localhost:21213/',
    debugMode: true
  });
  console.log('🎁 TikFinity WebSocket client initialized');

  // Initialize Lua Scripting (SNESApi + ScriptEngine)
  const snesAPI = new SNESApi(sniClient, smwOps);
  console.log('📜 SNESApi initialized');

  const scriptEngine = new ScriptEngine({
    timeout: 10000,
    scriptsDir: path.join(__dirname, '..', 'scripts'),
    snesAPI: snesAPI,
    debugMode: true
  });
  console.log('📜 ScriptEngine initialized');

  // Connect ScriptEngine to EventProcessor
  eventProcessor.setScriptEngine(scriptEngine);
  console.log('📜 ScriptEngine connected to EventProcessor');

  // Initialize GiftSourceManager
  const sourceManager = new GiftSourceManager();
  sourceManager.initialize(hoellPoller, tikfinityClient, eventProcessor);
  console.log('🎁 GiftSourceManager initialized');

  // Initialize Gift Updater
  let giftUpdater = null;
  try {
    if (!GiftUpdater) {
      console.error('❌ GiftUpdater module not loaded - skipping initialization');
    } else {
      giftUpdater = new GiftUpdater(app.getPath('userData'));
      console.log('🔄 GiftUpdater initialized');
    }
  } catch (error) {
    console.error('❌ Failed to initialize GiftUpdater:', error);
    console.error('Stack:', error.stack);
  }

  return {
    restorationManager,
    hoellPoller,
    tikfinityClient,
    eventProcessor,
    sourceManager,
    scriptEngine,
    snesAPI,
    giftUpdater,
    giftDatabase
  };
}

/**
 * Load gift mappings from file on startup
 * @param {string} filePath - Path to gift mappings file
 * @param {Object} eventProcessor - Event processor instance
 */
async function loadGiftMappingsOnStartup(filePath, eventProcessor) {
  try {
    const fs = require('fs').promises;
    const data = await fs.readFile(filePath, 'utf8');
    const mappings = JSON.parse(data);
    eventProcessor.updateMappings(mappings);
    console.log(`📂 Loaded ${Object.keys(mappings).length} gift mappings on startup`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📂 No gift mappings file found, starting with empty mappings');
      eventProcessor.updateMappings({});
    } else {
      console.error('Error loading gift mappings on startup:', error);
      eventProcessor.updateMappings({});
    }
  }
}

/**
 * Load threshold configs from file on startup
 * @param {string} filePath - Path to threshold configs file
 * @param {Object} eventProcessor - Event processor instance
 */
async function loadThresholdConfigsOnStartup(filePath, eventProcessor) {
  try {
    const fs = require('fs').promises;
    const data = await fs.readFile(filePath, 'utf8');
    const thresholds = JSON.parse(data);
    await eventProcessor.loadThresholdConfigs(thresholds);
    console.log(`📂 Loaded ${Object.keys(thresholds).length} threshold configurations on startup`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📂 No threshold configs file found, starting with empty thresholds');
      await eventProcessor.loadThresholdConfigs({});
    } else {
      console.error('Error loading threshold configs on startup:', error);
      await eventProcessor.loadThresholdConfigs({});
    }
  }
}

/**
 * Load gift name overrides from file on startup
 * @param {string} filePath - Path to gift name overrides file
 * @param {Object} eventProcessor - Event processor instance
 */
async function loadGiftNameOverridesOnStartup(filePath, eventProcessor) {
  try {
    const fs = require('fs').promises;
    const data = await fs.readFile(filePath, 'utf8');
    const overrides = JSON.parse(data);
    eventProcessor.loadGiftNameOverrides(overrides);
    console.log(`📂 Loaded ${Object.keys(overrides).length} gift name overrides on startup`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📂 No gift name overrides file found, starting with empty overrides');
      eventProcessor.loadGiftNameOverrides({});
    } else {
      console.error('Error loading gift name overrides on startup:', error);
      eventProcessor.loadGiftNameOverrides({});
    }
  }
}

/**
 * Initialize gift database on first run
 * @param {Object} giftUpdater - Gift updater instance
 */
async function initializeGiftDatabase(giftUpdater) {
  try {
    const { TIKTOK_GIFTS } = require('../renderer/tiktok-gifts.js');
    const result = await giftUpdater.initialize(TIKTOK_GIFTS);

    if (result.success) {
      console.log('✅ Gift database initialized successfully');
    } else {
      console.error('❌ Failed to initialize gift database:', result.error);
    }
  } catch (error) {
    console.error('❌ Error initializing gift database:', error);
  }
}

/**
 * Set up application lifecycle handlers
 * @param {Object} services - Service instances
 */
function setupAppLifecycle(services) {
  const { hoellPoller, restorationManager } = services;

  // Cleanup on quit
  app.on('before-quit', () => {
    if (hoellPoller && hoellPoller.isPolling) {
      hoellPoller.stop();
      console.log('🎁 HoellStream polling stopped');
    }

    if (restorationManager) {
      restorationManager.cleanup();
      console.log('⏱️ ItemRestorationManager cleaned up');
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Note: This would need mainWindow recreated
      console.log('🔄 Activate event - window recreation needed');
    }
  });
}

/**
 * Register custom protocol for serving gift images
 */
function registerGiftImageProtocol() {
  try {
    protocol.handle('gift-image', (request) => {
      const url = new URL(request.url);
      let filename = url.host || url.pathname.substring(1);

      // SECURITY: Sanitize filename - remove path separators only
      filename = filename.replace(/[\/\\]/g, '');

      // Validate filename
      if (!filename || filename.length === 0 || filename.includes('..')) {
        console.error('[gift-image protocol] Invalid filename after sanitization');
        return new Response('Bad Request: Invalid filename', { status: 400 });
      }

      const imagesDir = path.join(app.getPath('userData'), 'gift-images');
      const imagePath = path.resolve(imagesDir, filename);

      // SECURITY: Use path.relative to ensure the path is within allowed directory
      const relativePath = path.relative(imagesDir, imagePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        console.error(`[gift-image protocol] Path traversal attempt detected: ${request.url}`);
        return new Response('Forbidden: Path traversal detected', { status: 403 });
      }

      console.log(`[gift-image protocol] Request: ${request.url} -> ${imagePath}`);

      // Convert Windows path separators for file:// URL
      const fileUrl = `file://${imagePath.replace(/\\/g, '/')}`;
      console.log(`[gift-image protocol] Fetching: ${fileUrl}`);
      return net.fetch(fileUrl);
    });
    console.log('✅ gift-image:// protocol registered');
  } catch (error) {
    console.error('❌ Failed to register gift-image protocol:', error);
  }
}

/**
 * Threshold status writer management
 */
let thresholdStatusInterval = null;
const OVERLAY_SETTINGS_FILE = path.join(app.getPath('userData'), 'overlay-settings.json');

/**
 * Write threshold status to JSON file for overlay polling
 * @param {Object} eventProcessor - Event processor instance
 */
async function writeThresholdStatusFile(eventProcessor) {
  try {
    if (!eventProcessor) return;

    const fs = require('fs').promises;
    let savePath = app.getPath('downloads');

    try {
      const settingsData = await fs.readFile(OVERLAY_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(settingsData);
      if (settings.savePath) savePath = settings.savePath;
    } catch (error) {
      // Use default downloads path
    }

    const status = eventProcessor.getThresholdStatus();
    const statusFilePath = path.join(savePath, 'threshold-status.json');

    await fs.writeFile(statusFilePath, JSON.stringify({ status }, null, 2), 'utf8');
  } catch (error) {
    // Silently fail - this is a background task
    console.warn('Failed to write threshold status file:', error.message);
  }
}

/**
 * Start periodic threshold status writing
 * @param {Object} eventProcessor - Event processor instance
 * @returns {NodeJS.Timeout} Interval ID
 */
function startThresholdStatusWriter(eventProcessor) {
  if (thresholdStatusInterval) {
    clearInterval(thresholdStatusInterval);
  }

  // Write immediately
  writeThresholdStatusFile(eventProcessor);

  // Then write every 2 seconds
  thresholdStatusInterval = setInterval(() => {
    writeThresholdStatusFile(eventProcessor);
  }, 2000);

  console.log('📊 Started threshold status writer (2s interval)');
  return thresholdStatusInterval;
}

/**
 * Stop threshold status writer
 */
function stopThresholdStatusWriter() {
  if (thresholdStatusInterval) {
    clearInterval(thresholdStatusInterval);
    thresholdStatusInterval = null;
    console.log('📊 Stopped threshold status writer');
  }
}

module.exports = {
  createMainWindow,
  initializeClients,
  initializeServices,
  loadGiftMappingsOnStartup,
  loadThresholdConfigsOnStartup,
  loadGiftNameOverridesOnStartup,
  initializeGiftDatabase,
  setupAppLifecycle,
  registerGiftImageProtocol,
  startThresholdStatusWriter,
  stopThresholdStatusWriter
};
