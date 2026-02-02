/**
 * ZanesWorld Main Process - Electron Application Entry Point (Refactored)
 *
 * This is the orchestrator module that coordinates all application components.
 * The heavy lifting has been moved to focused modules:
 * - src/ipc-handlers.js: All IPC handler registrations
 * - src/connection-manager.js: SNI/Lua connection logic
 * - src/initialization.js: App startup and window creation
 *
 * @module main
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const crypto = require('crypto');

// Import refactored modules
const { registerIPCHandlers } = require('./src/ipc-handlers');
const { ConnectionManager } = require('./src/connection-manager');
const {
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
} = require('./src/initialization');

// ============================================================================
// CONSTANTS
// ============================================================================

const IPC_CHANNELS = {
  // SNI Connection
  CONNECT_SNI: 'connect-sni',
  DISCONNECT_SNI: 'disconnect-sni',
  LIST_SNI_DEVICES: 'list-sni-devices',
  SELECT_SNI_DEVICE: 'select-sni-device',

  // Operations
  EXECUTE_SMW_OPERATION: 'execute-smw-operation',

  // Lua Connector
  CONNECT_LUA: 'connect-lua',
  DISCONNECT_LUA: 'disconnect-lua',

  // Gift Sources
  START_HOELLSTREAM_POLLING: 'start-hoellstream-polling',
  STOP_HOELLSTREAM_POLLING: 'stop-hoellstream-polling',
  CONNECT_TIKFINITY: 'connect-tikfinity',
  DISCONNECT_TIKFINITY: 'disconnect-tikfinity',

  // Settings
  SAVE_GIFT_MAPPINGS: 'save-gift-mappings',
  LOAD_GIFT_MAPPINGS: 'load-gift-mappings',
  SAVE_THRESHOLD_CONFIGS: 'save-threshold-configs',
  LOAD_THRESHOLD_CONFIGS: 'load-threshold-configs',

  // Scripts
  SAVE_SCRIPT: 'save-script',
  LOAD_SCRIPTS: 'load-scripts',
  DELETE_SCRIPT: 'delete-script',
  TEST_SCRIPT: 'test-script'
};

const ERROR_MESSAGES = {
  NO_DEVICE: 'No device selected',
  UNKNOWN_OPERATION: 'Unknown operation',
  CONNECTION_FAILED: 'Connection failed',
  INVALID_PARAMETERS: 'Invalid parameters provided'
};

const FILE_PATHS = {
  GIFT_MAPPINGS: path.join(app.getPath('userData'), 'gift-mappings.json'),
  THRESHOLDS: path.join(app.getPath('userData'), 'thresholds.json'),
  WINDOW_SETTINGS: path.join(app.getPath('userData'), 'window-settings.json'),
  SCRIPTS_DIR: path.join(app.getPath('userData'), 'scripts'),
  GIFT_NAME_OVERRIDES: path.join(app.getPath('userData'), 'gift-name-overrides.json')
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Safe JSON parsing with detailed error messages
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @param {string} context - Context description for error logging
 * @returns {*} Parsed JSON or fallback value
 */
function safeJSONParse(jsonString, fallback = null, context = 'unknown') {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(`❌ JSON parse error in ${context}:`, error.message);
    console.error(`   First 100 chars: ${jsonString.substring(0, 100)}`);
    return fallback;
  }
}

/**
 * Generate cryptographically secure random ID
 * @returns {string} 32-character hexadecimal ID
 */
function generateSecureId() {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

let mainWindow = null;
let actionConsoleWindow = null;
let connectionManager = null;
let connectionMode = 'sni';  // 'sni' or 'lua'

// Client instances
let sniClient = null;
let luaClient = null;
let smwOps = null;

// Lua operations (initialized when mode switches to 'lua')
let luaGameOps = null;
let luaExpandedOps = null;
let luaHoellOps = null;

// Service instances
let hoellPoller = null;
let tikfinityClient = null;
let restorationManager = null;
let giftUpdater = null;
let eventProcessor = null;
let sourceManager = null;
let scriptEngine = null;
let snesAPI = null;

// ============================================================================
// CONNECTION MODE MANAGEMENT
// ============================================================================

/**
 * Get current connection mode
 * @returns {string} Current connection mode
 */
function getConnectionMode() {
  return connectionMode;
}

/**
 * Set connection mode
 * @param {string} mode - New connection mode ('sni' or 'lua')
 */
function setConnectionMode(mode) {
  connectionMode = mode;
  if (connectionManager) {
    connectionManager.setConnectionMode(mode);
  }
}

/**
 * Get Lua operations instances
 * @returns {Object} Lua operations instances
 */
function getLuaOpsInstance() {
  return {
    luaGameOps,
    luaExpandedOps,
    luaHoellOps
  };
}

/**
 * Set Lua operations instances
 * @param {Object} ops - Lua operations instances
 */
function setLuaOpsInstance(ops) {
  luaGameOps = ops.luaGameOps;
  luaExpandedOps = ops.luaExpandedOps;
  luaHoellOps = ops.luaHoellOps;
}

/**
 * Get SNES API instance
 * @returns {Object} SNES API instance
 */
function getSnesApiInstance() {
  return snesAPI;
}

/**
 * Set SNES API instance
 * @param {Object} api - SNES API instance
 */
function setSnesApiInstance(api) {
  snesAPI = api;
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Initialize the entire application
 */
async function initializeApplication() {
  // Register custom protocol for gift images
  registerGiftImageProtocol();

  // Create main window
  mainWindow = createMainWindow(FILE_PATHS);

  // Initialize clients (SNI and Lua)
  const clients = initializeClients();
  sniClient = clients.sniClient;
  luaClient = clients.luaClient;
  smwOps = clients.smwOps;
  luaGameOps = clients.luaGameOps;
  luaExpandedOps = clients.luaExpandedOps;
  luaHoellOps = clients.luaHoellOps;

  // Initialize connection manager
  connectionManager = new ConnectionManager(sniClient, luaClient, mainWindow, smwOps);

  // Set up Lua event listeners
  connectionManager.setupLuaEventListeners(mainWindow);

  // Initialize services (pollers, processors, managers)
  const services = initializeServices(clients, mainWindow);
  restorationManager = services.restorationManager;
  hoellPoller = services.hoellPoller;
  tikfinityClient = services.tikfinityClient;
  eventProcessor = services.eventProcessor;
  sourceManager = services.sourceManager;
  scriptEngine = services.scriptEngine;
  snesAPI = services.snesAPI;
  giftUpdater = services.giftUpdater;

  // Bootstrap gift database on first run
  if (giftUpdater) {
    await initializeGiftDatabase(giftUpdater);
  }

  // Load saved configurations
  await loadGiftMappingsOnStartup(FILE_PATHS.GIFT_MAPPINGS, eventProcessor);
  await loadThresholdConfigsOnStartup(FILE_PATHS.THRESHOLDS, eventProcessor);
  await loadGiftNameOverridesOnStartup(FILE_PATHS.GIFT_NAME_OVERRIDES, eventProcessor);

  // Register all IPC handlers
  registerIPCHandlers({
    sniClient,
    luaClient,
    smwOps,
    luaGameOps,
    luaExpandedOps,
    luaHoellOps,
    hoellPoller,
    tikfinityClient,
    eventProcessor,
    giftUpdater,
    restorationManager,
    scriptEngine,
    sourceManager,
    snesAPI,
    mainWindow,
    actionConsoleWindow,
    connectionMode,
    filePaths: FILE_PATHS,
    getLuaOpsInstance,
    setLuaOpsInstance,
    getSnesApiInstance,
    setSnesApiInstance,
    getConnectionMode,
    setConnectionMode,
    startThresholdStatusWriter: () => startThresholdStatusWriter(eventProcessor),
    stopThresholdStatusWriter
  });

  // Set up application lifecycle handlers
  setupAppLifecycle(services);

  // Auto-connect to SNI after a short delay
  setTimeout(() => {
    connectionManager.autoConnectSNI();
  }, 1000);
}

// ============================================================================
// ELECTRON APP LIFECYCLE
// ============================================================================

app.whenReady().then(async () => {
  await initializeApplication();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initializeApplication();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  if (hoellPoller && hoellPoller.isPolling) {
    hoellPoller.stop();
    console.log('🎁 HoellStream polling stopped');
  }

  stopThresholdStatusWriter();

  if (restorationManager) {
    restorationManager.cleanup();
    console.log('⏱️ ItemRestorationManager cleaned up');
  }
});

// ============================================================================
// EXPORTS (for testing or module reuse)
// ============================================================================

module.exports = {
  // Utilities
  safeJSONParse,
  generateSecureId,

  // Constants
  IPC_CHANNELS,
  ERROR_MESSAGES,
  FILE_PATHS,

  // State accessors
  getConnectionMode,
  setConnectionMode,
  getLuaOpsInstance,
  setLuaOpsInstance,
  getSnesApiInstance,
  setSnesApiInstance
};
