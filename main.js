const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;

// We'll initialize these after creating the window
let mainWindow;
let actionConsoleWindow = null;
let sniClient;
let luaClient;  // Lua connector client for emulator mode
let gameOps;
let expandedOps;
let hoellOps;
let luaGameOps;      // Lua game operations wrapper
let luaExpandedOps;  // Lua expanded operations wrapper
let luaHoellOps;     // Lua HoellCC operations wrapper
let hoellPoller;
let tikfinityClient;
let restorationManager;
let giftUpdater;
let eventProcessor;
let sourceManager;
let scriptEngine;
let snesAPI;
let connectionMode = 'sni';  // 'sni' or 'lua'
// Built-in SNI controller removed - please run SNI externally on port 8191

// Function to auto-connect to SNI and select first device
async function autoConnectSNI() {
  try {
    console.log('🔌 Auto-connecting to SNI...');
    await sniClient.connect('localhost', 8191);
    const devices = await sniClient.listDevices();

    if (devices && devices.length > 0) {
      console.log(`📱 Found ${devices.length} device(s), auto-selecting first one...`);
      sniClient.selectDevice(devices[0]);

      // HoellStream polling must be started manually via toggle button
      // (Auto-start removed - user has manual control)

      // Start indoors monitoring for stored chicken attacks
      if (expandedOps) {
        expandedOps.startIndoorsMonitoring();
        console.log('🐔 Indoors monitoring started for stored chicken attacks');
      }

      // Notify renderer about successful connection
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('sni-auto-connected', {
          success: true,
          device: devices[0]
        });
      }

      console.log('✅ Auto-connected to device:', devices[0].uri);
    } else {
      console.log('⚠️ No devices found');
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('sni-auto-connected', {
          success: false,
          error: 'No devices found'
        });
      }
    }
  } catch (error) {
    console.error('❌ Auto-connect failed:', error.message);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('sni-auto-connected', {
        success: false,
        error: error.message
      });
    }
  }
}

function createWindow() {
  // Load saved window bounds or use defaults
  let windowBounds = {
    width: 900,
    height: 850
  };

  try {
    const savedBounds = require('fs').readFileSync(WINDOW_SETTINGS_FILE, 'utf8');
    const parsedBounds = JSON.parse(savedBounds);
    // Merge saved bounds with defaults
    windowBounds = { ...windowBounds, ...parsedBounds };
    console.log('📐 Loaded saved window position:', windowBounds);
  } catch (error) {
    // File doesn't exist on first run, use defaults
    console.log('📐 Using default window position');
  }

  mainWindow = new BrowserWindow({
    ...windowBounds,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile('renderer/index-full.html');

  // Save window bounds when moved or resized
  const saveWindowBounds = () => {
    const bounds = mainWindow.getBounds();
    require('fs').writeFileSync(WINDOW_SETTINGS_FILE, JSON.stringify(bounds, null, 2), 'utf8');
  };

  // Debounce to avoid excessive file writes
  let saveBoundsTimeout;
  const debouncedSave = () => {
    clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(saveWindowBounds, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  // Save immediately on close
  mainWindow.on('close', saveWindowBounds);

  // Initialize SNI client after window is created
  const SNIClient = require('./src/sni/client');
  const GameOperations = require('./src/sni/operations');
  const WorkingSMWOperations = require('./src/sni/operations-working');
  const HoellCCOperations = require('./src/sni/operations-hoellcc');
  const LuaConnectorClient = require('./src/emulator/lua-connector-client');
  const { LuaGameOperations, LuaExpandedOperations, LuaHoellOperations } = require('./src/emulator/lua-operations');
  const HoellStreamPoller = require('./src/hoellstream/poller');
  const TikFinityWebSocketClient = require('./src/tikfinity/websocket-client');
  const ItemRestorationManager = require('./src/item-restoration/restoration-manager');

  let GiftUpdater;
  try {
    GiftUpdater = require('./src/gift-updater');
    console.log('✅ GiftUpdater module loaded successfully');
  } catch (error) {
    console.error('❌ Failed to require GiftUpdater module:', error);
    console.error('Stack:', error.stack);
  }

  const EventProcessor = require('./src/gift-sources/event-processor');
  const GiftSourceManager = require('./src/gift-sources/source-manager');
  const ScriptEngine = require('./src/lua/script-engine');
  const SNESApi = require('./src/lua/snes-api');

  // Initialize SNI client and operations
  sniClient = new SNIClient();
  gameOps = new GameOperations(sniClient);
  expandedOps = new WorkingSMWOperations(sniClient);
  hoellOps = new HoellCCOperations(sniClient);
  console.log('🎮 SNI operations initialized');

  // Initialize Lua connector client (not connected by default)
  luaClient = new LuaConnectorClient();
  console.log('🎮 Lua connector client initialized (not connected)');

  // Set up Lua client event listeners
  luaClient.on('connected', () => {
    console.log('✅ Lua connector connected');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('lua-connected');
    }
  });

  luaClient.on('disconnected', () => {
    console.log('❌ Lua connector disconnected');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('lua-disconnected');
    }
  });

  luaClient.on('error', (err) => {
    console.error('❌ Lua connector error:', err.message);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('lua-error', { error: err.message });
    }
  });

  // Initialize ItemRestorationManager
  restorationManager = new ItemRestorationManager(expandedOps);
  console.log('⏱️ ItemRestorationManager initialized');

  // Load TIKTOK_GIFTS database for the poller
  let giftDatabase = null;
  try {
    const { TIKTOK_GIFTS } = require('./renderer/tiktok-gifts.js');
    giftDatabase = TIKTOK_GIFTS;
    console.log('📚 Loaded TIKTOK_GIFTS database for poller');
  } catch (error) {
    console.error('⚠️ Failed to load TIKTOK_GIFTS database:', error);
  }

  // Initialize HoellStream poller (but don't start polling yet)
  // Pass both expandedOps and gameOps (basic operations like KO player)
  hoellPoller = new HoellStreamPoller(expandedOps, gameOps, {
    pollIntervalMs: 2000,
    debugMode: true,
    giftDatabase: giftDatabase
  });
  console.log('🎁 HoellStream poller initialized (polling will start when device connects)');

  // Connect restoration manager to poller (deprecated - kept for backward compatibility)
  hoellPoller.setRestorationManager(restorationManager);

  // Initialize EventProcessor
  eventProcessor = new EventProcessor(expandedOps, gameOps, {
    debugMode: true,
    giftDatabase: giftDatabase
  });
  console.log('🎁 EventProcessor initialized');

  // Connect restoration manager to EventProcessor
  eventProcessor.setRestorationManager(restorationManager);

  // Connect main window for event emission
  eventProcessor.setMainWindow(mainWindow);

  // Connect EventProcessor to HoellStream Poller
  hoellPoller.setEventProcessor(eventProcessor);

  // Initialize TikFinity WebSocket client
  tikfinityClient = new TikFinityWebSocketClient({
    url: 'ws://localhost:21213/',
    debugMode: true
  });
  console.log('🎁 TikFinity WebSocket client initialized');

  // Initialize Lua Scripting (SNESApi + ScriptEngine)
  snesAPI = new SNESApi(sniClient, gameOps, expandedOps, hoellOps);
  console.log('📜 SNESApi initialized');

  scriptEngine = new ScriptEngine({
    timeout: 10000, // 10 second timeout
    scriptsDir: path.join(__dirname, 'scripts'),
    snesAPI: snesAPI,
    debugMode: true
  });
  console.log('📜 ScriptEngine initialized');

  // Connect ScriptEngine to EventProcessor
  eventProcessor.setScriptEngine(scriptEngine);
  console.log('📜 ScriptEngine connected to EventProcessor');

  // Initialize GiftSourceManager
  sourceManager = new GiftSourceManager();
  sourceManager.initialize(hoellPoller, tikfinityClient, eventProcessor);
  console.log('🎁 GiftSourceManager initialized');

  // Initialize Gift Updater
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

  // Bootstrap gift database on first run
  initializeGiftDatabase();

  // Load gift mappings from file on startup
  loadGiftMappingsOnStartup();

  // Load threshold configs from file on startup
  loadThresholdConfigsOnStartup();

  // Load gift name overrides from file on startup
  loadGiftNameOverridesOnStartup();

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// IPC Handlers
ipcMain.handle('connect-sni', async (event, host, port) => {
  try {
    await sniClient.connect(host, port);
    const devices = await sniClient.listDevices();
    return { success: true, devices };
  } catch (error) {
    console.error('Connection error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-device', async (event, deviceInfo) => {
  try {
    sniClient.selectDevice(deviceInfo);

    // HoellStream polling must be started manually via toggle button
    // (Auto-start removed - user has manual control)

    // Start indoors monitoring for stored chicken attacks
    if (expandedOps) {
      expandedOps.startIndoorsMonitoring();
      console.log('🐔 Indoors monitoring started for stored chicken attacks');
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// restart-sni IPC handler removed - SNI must be run externally

// Generic SMW operation handler with HoellCC fallback
ipcMain.handle('execute-smw-operation', async (event, operationName, ...args) => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }

    // Try ZanesWorld operations first (expandedOps)
    if (typeof expandedOps[operationName] === 'function') {
      const result = await expandedOps[operationName](...args);
      return { success: true, result };
    }

    // Fallback to HoellCC operations
    if (hoellOps && typeof hoellOps[operationName] === 'function') {
      const result = await hoellOps[operationName](...args);
      return { success: true, result };
    }

    // Operation not found in either module
    throw new Error(`Unknown operation: ${operationName}`);
  } catch (error) {
    console.error(`Error executing ${operationName}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-heart', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    return await gameOps.addHeartContainer();
  } catch (error) {
    console.error('Add heart error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-heart', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    return await gameOps.removeHeartContainer();
  } catch (error) {
    console.error('Remove heart error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('kill-player', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    return await gameOps.killPlayer();
  } catch (error) {
    console.error('KO player error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('warp-eastern', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    return await gameOps.warpToEasternPalace();
  } catch (error) {
    console.error('Warp error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fake-mirror', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    return await expandedOps.fakeMirror();
  } catch (error) {
    console.error('Fake Mirror error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('chaos-dungeon-warp', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    return await expandedOps.chaosDungeonWarp();
  } catch (error) {
    console.error('Chaos Dungeon Warp error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-world', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    return await expandedOps.toggleWorld();
  } catch (error) {
    console.error('Toggle World error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-memory', async () => {
  try {
    if (!sniClient.deviceURI) {
      throw new Error('No device selected');
    }
    await sniClient.testMemoryAccess();
    return { success: true };
  } catch (error) {
    console.error('Test memory error:', error);
    return { success: false, error: error.message };
  }
});

// ============= EXPANDED OPERATIONS =============

// Rupees
ipcMain.handle('set-rupees', async (event, amount) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setRupees(amount);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Bombs & Arrows
ipcMain.handle('set-bombs', async (event, amount) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setBombs(amount);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-arrows', async (event, amount) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setArrows(amount);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Equipment
ipcMain.handle('set-sword', async (event, level) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setSword(level);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-shield', async (event, level) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setShield(level);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Items
ipcMain.handle('toggle-boots', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleBoots();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-flippers', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleFlippers();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-invincibility', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleInvincibility();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Freeze Player
ipcMain.handle('toggle-freeze-player', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleFreezePlayer();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Ice Physics (slippery floor)
ipcMain.handle('give-ice-physics', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveIcePhysics();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Enemy Spawning
ipcMain.handle('spawn-enemy', async (event, enemyType) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.spawnEnemyNearLink(enemyType);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('spawn-random-enemy', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.spawnRandomEnemy();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('despawn-floor-blocks', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.despawnFloorBlocks();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Physics Modifiers (SMW)
ipcMain.handle('moon-jump', async (event, durationSeconds = 30) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.moonJump(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tiny-jump', async (event, durationSeconds = 30) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.tinyJump(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('low-gravity', async (event, durationSeconds = 30) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.lowGravity(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('high-gravity', async (event, durationSeconds = 30) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.highGravity(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Bee Swarm Attack
ipcMain.handle('spawn-bee-swarm', async (event, count) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.spawnBeeSwarm(count);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-bee-swarm', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.stopBeeSwarm();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Chicken Attack
ipcMain.handle('trigger-chicken-attack', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.triggerChickenAttack(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Enemy Waves
ipcMain.handle('trigger-enemy-waves', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.triggerEnemyWaves(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('trigger-bee-swarm-waves', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.triggerBeeSwarmWaves(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Invisible Enemies
ipcMain.handle('make-enemies-invisible', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.makeEnemiesInvisible(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Infinite Magic
ipcMain.handle('enable-infinite-magic', async (event, durationSeconds) => {
  console.log(`[Main] enable-infinite-magic IPC handler called with duration: ${durationSeconds}`);
  try {
    if (!sniClient.deviceURI) {
      console.log('[Main] No device selected!');
      throw new Error('No device selected');
    }
    console.log('[Main] Calling expandedOps.enableInfiniteMagic...');
    const result = await expandedOps.enableInfiniteMagic(durationSeconds);
    console.log('[Main] enableInfiniteMagic result:', result);
    return result;
  } catch (error) {
    console.error('[Main] enable-infinite-magic error:', error);
    return { success: false, error: error.message };
  }
});

// Delete All Saves
ipcMain.handle('delete-all-saves', async (event) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.deleteAllSaves();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// MarioMod Detection (HoellCC)
ipcMain.handle('check-mariomod-patch', async () => {
  try {
    if (!sniClient.deviceURI) {
      return { success: false, error: 'No device selected', installed: false };
    }

    const isInstalled = await hoellOps.spawner.checkMarioModPresent();
    return {
      success: true,
      installed: isInstalled,
      message: isInstalled
        ? 'MarioMod patch detected - All spawn operations available'
        : 'MarioMod patch NOT detected - Spawn operations will not work'
    };
  } catch (error) {
    return { success: false, error: error.message, installed: false };
  }
});

// Bottles
ipcMain.handle('add-bottle', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.addBottle();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-bottle', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.removeBottle();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fill-bottles-potion', async (event, potionType) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.fillAllBottlesWithPotion(potionType);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Presets
ipcMain.handle('give-starter-pack', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveStarterPack();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-endgame-pack', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveEndgamePack();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get inventory
ipcMain.handle('get-inventory', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    const inventory = await expandedOps.getFullInventory();
    return { success: true, inventory };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// More equipment operations
ipcMain.handle('set-armor', async (event, level) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setArmor(level);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-gloves', async (event, level) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setGloves(level);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// More toggles
ipcMain.handle('toggle-moon-pearl', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleMoonPearl();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-hookshot', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleHookshot();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-lamp', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleLamp();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-hammer', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleHammer();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-book', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleBook();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-bug-net', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleBugNet();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-somaria', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleSomaria();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-byrna', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleByrna();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-mirror', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleMirror();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-boomerang', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleBoomerang();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Magic items
ipcMain.handle('toggle-fire-rod', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleFireRod();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-fire-rod', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveFireRod();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-ice-rod', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleIceRod();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-ice-rod', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveIceRod();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-capes', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveCapes();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Flute
ipcMain.handle('give-flute', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveFlute();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-flute', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.removeFlute();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deactivate-flute', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.deactivateFlute();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-medallion', async (event, medallionName) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleMedallion(medallionName);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-all-medallions', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleAllMedallions();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-all-medallions', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveAllMedallions();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Magic system
ipcMain.handle('enable-magic', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.enableMagic();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-magic', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.removeMagic();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-magic-upgrade', async (event, level) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setMagicUpgrade(level);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Hearts
ipcMain.handle('add-heart-piece', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.addHeartPiece();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-hearts', async (event, count) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.setHearts(count);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Chaotic Features
ipcMain.handle('enable-ice-world', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.enableIceWorld(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('spawn-boss-rush', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.spawnBossRush(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('enable-item-lock', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.enableItemLock(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('enable-glass-cannon', async (event, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.enableGlassCannon(durationSeconds);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('blessing-and-curse', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.blessingAndCurse();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Pendants & Crystals
ipcMain.handle('toggle-pendant', async (event, pendantName) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.togglePendant(pendantName);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-all-pendants', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleAllPendants();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-all-pendants', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveAllPendants();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-crystal', async (event, crystalNum) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleCrystal(crystalNum);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-all-crystals', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleAllCrystals();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-all-crystals', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveAllCrystals();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Keys
ipcMain.handle('add-small-key', async (event, dungeon) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.addSmallKey(dungeon);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-small-key', async (event, dungeon) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.removeSmallKey(dungeon);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-small-keys', async (event, dungeon, count) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveSmallKeys(dungeon, count);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-big-key', async (event, dungeon) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.toggleBigKey(dungeon);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('give-big-key', async (event, dungeon) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.giveBigKey(dungeon);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-rupees', async (event, amount) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.addRupees(amount);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-rupee', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.addRupee();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-rupee', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.removeRupee();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-bomb', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.addBomb();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-bomb', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.removeBomb();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-arrow', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.addArrow();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-arrow', async () => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    return await expandedOps.removeArrow();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============= HOELLSTREAM CONTROLS =============

const pathModule = require('path');
const https = require('https');

// Gift mappings file path - stored in user data directory (OS-specific, uses app name)
// Example paths:
//   Windows: C:\Users\{user}\AppData\Roaming\snes-controller\gift-mappings.json
//   macOS: ~/Library/Application Support/snes-controller/gift-mappings.json
//   Linux: ~/.config/snes-controller/gift-mappings.json
const GIFT_MAPPINGS_FILE = pathModule.join(app.getPath('userData'), 'gift-mappings.json');
const GIFT_NAME_OVERRIDES_FILE = pathModule.join(app.getPath('userData'), 'gift-name-overrides.json');
const CUSTOM_GIFTS_FILE = pathModule.join(app.getPath('userData'), 'custom-gifts.json');
const GIFT_IMAGE_OVERRIDES_FILE = pathModule.join(app.getPath('userData'), 'gift-image-overrides.json');
const THRESHOLD_CONFIGS_FILE = pathModule.join(app.getPath('userData'), 'threshold-configs.json');
const OVERLAY_SETTINGS_FILE = pathModule.join(app.getPath('userData'), 'overlay-settings.json');
const WINDOW_SETTINGS_FILE = pathModule.join(app.getPath('userData'), 'window-settings.json');

// Load gift mappings on startup
async function loadGiftMappingsOnStartup() {
  try {
    const data = await fs.readFile(GIFT_MAPPINGS_FILE, 'utf8');
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

// Load threshold configs on startup
async function loadThresholdConfigsOnStartup() {
  try {
    const data = await fs.readFile(THRESHOLD_CONFIGS_FILE, 'utf8');
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

// Load gift name overrides on startup
async function loadGiftNameOverridesOnStartup() {
  try {
    const data = await fs.readFile(GIFT_NAME_OVERRIDES_FILE, 'utf8');
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

// Initialize gift database on first run
async function initializeGiftDatabase() {
  try {
    // Load initial gifts from tiktok-gifts.js
    const { TIKTOK_GIFTS } = require('./renderer/tiktok-gifts.js');
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

// Save gift mappings to JSON file
ipcMain.handle('save-gift-mappings', async (event, mappings) => {
  try {
    await fs.writeFile(GIFT_MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf8');
    console.log(`💾 Saved ${Object.keys(mappings).length} gift mappings to ${GIFT_MAPPINGS_FILE}`);

    // Notify action console to refresh
    if (actionConsoleWindow && !actionConsoleWindow.isDestroyed()) {
      actionConsoleWindow.webContents.send('action-console-update');
    }

    return { success: true, count: Object.keys(mappings).length };
  } catch (error) {
    console.error('Error saving gift mappings:', error);
    return { success: false, error: error.message };
  }
});

// Load gift mappings from JSON file
ipcMain.handle('load-gift-mappings', async () => {
  try {
    const data = await fs.readFile(GIFT_MAPPINGS_FILE, 'utf8');
    const mappings = JSON.parse(data);
    console.log(`📂 Loaded ${Object.keys(mappings).length} gift mappings from ${GIFT_MAPPINGS_FILE}`);
    return { success: true, mappings };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - return empty mappings
      console.log('📂 No gift mappings file found, starting fresh');
      return { success: true, mappings: {} };
    }
    console.error('Error loading gift mappings:', error);
    return { success: false, error: error.message };
  }
});

// Reload gift mappings in the EventProcessor
ipcMain.handle('reload-gift-mappings', async () => {
  try {
    if (!eventProcessor) {
      return { success: false, error: 'EventProcessor not initialized' };
    }

    // Load mappings from file
    const data = await fs.readFile(GIFT_MAPPINGS_FILE, 'utf8');
    const mappings = JSON.parse(data);

    // Update EventProcessor with new mappings
    eventProcessor.updateMappings(mappings);

    console.log(`🔄 Reloaded ${Object.keys(mappings).length} gift mappings into EventProcessor`);
    return { success: true, count: Object.keys(mappings).length };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - use empty mappings
      eventProcessor.updateMappings({});
      return { success: true, count: 0 };
    }
    console.error('Error reloading gift mappings:', error);
    return { success: false, error: error.message };
  }
});

// ============= THRESHOLD CONFIGURATIONS =============

// Save threshold configs to JSON file
ipcMain.handle('save-threshold-configs', async (event, thresholds) => {
  try {
    await fs.writeFile(THRESHOLD_CONFIGS_FILE, JSON.stringify(thresholds, null, 2), 'utf8');
    console.log(`💾 Saved ${Object.keys(thresholds).length} threshold configs to ${THRESHOLD_CONFIGS_FILE}`);
    return { success: true, count: Object.keys(thresholds).length };
  } catch (error) {
    console.error('Error saving threshold configs:', error);
    return { success: false, error: error.message };
  }
});

// Load threshold configs from JSON file
ipcMain.handle('load-threshold-configs', async () => {
  try {
    const data = await fs.readFile(THRESHOLD_CONFIGS_FILE, 'utf8');
    const thresholds = JSON.parse(data);
    console.log(`📂 Loaded ${Object.keys(thresholds).length} threshold configs from ${THRESHOLD_CONFIGS_FILE}`);
    return { success: true, thresholds };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - return empty thresholds
      console.log('📂 No threshold configs file found, starting fresh');
      return { success: true, thresholds: {} };
    }
    console.error('Error loading threshold configs:', error);
    return { success: false, error: error.message };
  }
});

// Reload threshold configs in the EventProcessor
ipcMain.handle('reload-threshold-configs', async () => {
  try {
    if (!eventProcessor) {
      return { success: false, error: 'EventProcessor not initialized' };
    }

    // Load threshold configs from file
    const data = await fs.readFile(THRESHOLD_CONFIGS_FILE, 'utf8');
    const thresholds = JSON.parse(data);

    // Update EventProcessor with new threshold configs
    await eventProcessor.loadThresholdConfigs(thresholds);

    console.log(`🔄 Reloaded ${Object.keys(thresholds).length} threshold configs into EventProcessor`);
    return { success: true, count: Object.keys(thresholds).length };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - use empty thresholds
      await eventProcessor.loadThresholdConfigs({});
      return { success: true, count: 0 };
    }
    console.error('Error reloading threshold configs:', error);
    return { success: false, error: error.message };
  }
});

// Get current threshold status (progress for all configured thresholds)
ipcMain.handle('get-threshold-status', async () => {
  try {
    if (!eventProcessor) {
      return { success: false, error: 'EventProcessor not initialized' };
    }
    const status = eventProcessor.getThresholdStatus();
    return { success: true, status };
  } catch (error) {
    console.error('Error getting threshold status:', error);
    return { success: false, error: error.message };
  }
});

// Periodically write threshold status to JSON file for overlay polling
let thresholdStatusInterval = null;

async function writeThresholdStatusFile() {
  try {
    if (!eventProcessor) return;

    // Get current overlay save path
    let savePath = app.getPath('downloads');
    try {
      const settingsData = await fs.readFile(OVERLAY_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(settingsData);
      if (settings.savePath) savePath = settings.savePath;
    } catch (error) {
      // Use default downloads path
    }

    const status = eventProcessor.getThresholdStatus();
    const statusFilePath = pathModule.join(savePath, 'threshold-status.json');

    await fs.writeFile(statusFilePath, JSON.stringify({ status }, null, 2), 'utf8');
  } catch (error) {
    // Silently fail - this is a background task
    console.warn('Failed to write threshold status file:', error.message);
  }
}

// Start periodic threshold status writing when HoellStream is connected
function startThresholdStatusWriter() {
  if (thresholdStatusInterval) {
    clearInterval(thresholdStatusInterval);
  }
  // Write immediately
  writeThresholdStatusFile();
  // Then write every 2 seconds
  thresholdStatusInterval = setInterval(writeThresholdStatusFile, 2000);
  console.log('📊 Started threshold status writer (2s interval)');
}

function stopThresholdStatusWriter() {
  if (thresholdStatusInterval) {
    clearInterval(thresholdStatusInterval);
    thresholdStatusInterval = null;
    console.log('📊 Stopped threshold status writer');
  }
}

// ============= GIFT NAME OVERRIDES =============

// Save gift name overrides to JSON file
ipcMain.handle('save-gift-name-overrides', async (event, overrides) => {
  try {
    await fs.writeFile(GIFT_NAME_OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8');
    console.log(`💾 Saved ${Object.keys(overrides).length} gift name overrides to ${GIFT_NAME_OVERRIDES_FILE}`);
    return { success: true, count: Object.keys(overrides).length };
  } catch (error) {
    console.error('Error saving gift name overrides:', error);
    return { success: false, error: error.message };
  }
});

// Load gift name overrides from JSON file
ipcMain.handle('load-gift-name-overrides', async () => {
  try {
    const data = await fs.readFile(GIFT_NAME_OVERRIDES_FILE, 'utf8');
    const overrides = JSON.parse(data);
    console.log(`📂 Loaded ${Object.keys(overrides).length} gift name overrides from ${GIFT_NAME_OVERRIDES_FILE}`);
    return { success: true, overrides };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - return empty overrides
      console.log('📂 No gift name overrides file found, starting fresh');
      return { success: true, overrides: {} };
    }
    console.error('Error loading gift name overrides:', error);
    return { success: false, error: error.message };
  }
});

// Reload gift name overrides in the EventProcessor
ipcMain.handle('reload-gift-name-overrides', async () => {
  try {
    if (!eventProcessor) {
      return { success: false, error: 'EventProcessor not initialized' };
    }

    // Load gift name overrides from file
    const data = await fs.readFile(GIFT_NAME_OVERRIDES_FILE, 'utf8');
    const overrides = JSON.parse(data);

    // Update EventProcessor with new gift name overrides
    eventProcessor.loadGiftNameOverrides(overrides);

    console.log(`🔄 Reloaded ${Object.keys(overrides).length} gift name overrides into EventProcessor`);
    return { success: true, count: Object.keys(overrides).length };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - use empty overrides
      eventProcessor.loadGiftNameOverrides({});
      return { success: true, count: 0 };
    }
    console.error('Error reloading gift name overrides:', error);
    return { success: false, error: error.message };
  }
});

// ============= CUSTOM GIFTS =============

// Save custom gifts to JSON file
ipcMain.handle('save-custom-gifts', async (event, customGifts) => {
  try {
    await fs.writeFile(CUSTOM_GIFTS_FILE, JSON.stringify(customGifts, null, 2), 'utf8');
    console.log(`💾 Saved ${customGifts.length} custom gifts to ${CUSTOM_GIFTS_FILE}`);
    return { success: true, count: customGifts.length };
  } catch (error) {
    console.error('Error saving custom gifts:', error);
    return { success: false, error: error.message };
  }
});

// Load custom gifts from JSON file
ipcMain.handle('load-custom-gifts', async () => {
  try {
    const data = await fs.readFile(CUSTOM_GIFTS_FILE, 'utf8');
    const customGifts = JSON.parse(data);
    console.log(`📂 Loaded ${customGifts.length} custom gifts from ${CUSTOM_GIFTS_FILE}`);
    return { success: true, customGifts };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - return empty array
      console.log('📂 No custom gifts file found, starting fresh');
      return { success: true, customGifts: [] };
    }
    console.error('Error loading custom gifts:', error);
    return { success: false, error: error.message };
  }
});

// ============= GIFT IMAGE OVERRIDES =============

// Save gift image overrides to JSON file
ipcMain.handle('save-gift-image-overrides', async (event, overrides) => {
  try {
    await fs.writeFile(GIFT_IMAGE_OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8');
    console.log(`💾 Saved ${Object.keys(overrides).length} gift image overrides to ${GIFT_IMAGE_OVERRIDES_FILE}`);
    return { success: true, count: Object.keys(overrides).length };
  } catch (error) {
    console.error('Error saving gift image overrides:', error);
    return { success: false, error: error.message };
  }
});

// Load gift image overrides from JSON file
ipcMain.handle('load-gift-image-overrides', async () => {
  try {
    const data = await fs.readFile(GIFT_IMAGE_OVERRIDES_FILE, 'utf8');
    const overrides = JSON.parse(data);
    console.log(`📂 Loaded ${Object.keys(overrides).length} gift image overrides from ${GIFT_IMAGE_OVERRIDES_FILE}`);
    return { success: true, overrides };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - return empty overrides
      console.log('📂 No gift image overrides file found, starting fresh');
      return { success: true, overrides: {} };
    }
    console.error('Error loading gift image overrides:', error);
    return { success: false, error: error.message };
  }
});

// ============= GIFT IMAGE DOWNLOAD =============

// SECURITY: Validate image URL to prevent SSRF
function validateImageUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Whitelist allowed domains
    const allowedDomains = [
      'p16-webcast.tiktokcdn.com',
      'p19-webcast.tiktokcdn.com',
      'p77-webcast.tiktokcdn.com',
      'streamtoearn.io',
      'tiktokcdn.com'
    ];

    const isAllowed = allowedDomains.some(domain => {
      return parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain);
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Domain not allowed: ${parsedUrl.hostname}. Only TikTok CDN URLs are permitted.`
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Download a single image from URL
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    // SECURITY: Validate URL before downloading
    const validation = validateImageUrl(url);
    if (!validation.valid) {
      reject(new Error(`URL validation failed: ${validation.error}`));
      return;
    }

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = require('fs').createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        require('fs').unlink(filepath, () => {}); // Delete failed file
        reject(err);
      });
    }).on('error', reject);
  });
}

// Download all gift images from CDN URLs
ipcMain.handle('download-all-gift-images', async (event) => {
  try {
    console.log('🖼️ Starting gift images download...');

    // Download to userData directory (writable location)
    const userDataPath = app.getPath('userData');
    const imagesDir = pathModule.join(userDataPath, 'gift-images');

    // Create directory if it doesn't exist
    try {
      await fs.mkdir(imagesDir, { recursive: true });
      console.log(`📁 Using images directory: ${imagesDir}`);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Load active gifts database (has all current gifts with image URLs)
    let imagesToDownload = [];

    if (giftUpdater) {
      const activeGifts = await giftUpdater.getActiveGifts();
      if (activeGifts && activeGifts.images) {
        // Use active-gifts.json which has all gifts from database updates
        for (const [coinValue, gifts] of Object.entries(activeGifts.images)) {
          for (const [giftName, giftData] of Object.entries(gifts)) {
            if (giftData && giftData.cdn) {
              const sanitized = giftName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
              const filename = `${sanitized}_${coinValue}.webp`;
              imagesToDownload.push({
                url: giftData.cdn,
                filename,
                giftName,
                coinValue
              });
            }
          }
        }
      }
    }

    // Fallback to hardcoded GIFT_IMAGES if active gifts not available
    if (imagesToDownload.length === 0) {
      console.log('⚠️ Using fallback hardcoded gift images');
      const giftImagesModule = require('./renderer/gift-images.js');
      const { GIFT_IMAGES } = giftImagesModule;

      for (const [coinValue, gifts] of Object.entries(GIFT_IMAGES)) {
        for (const [giftName, giftData] of Object.entries(gifts)) {
          if (giftData && giftData.cdn) {
            const sanitized = giftName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${sanitized}_${coinValue}.webp`;
            imagesToDownload.push({
              url: giftData.cdn,
              filename,
              giftName,
              coinValue
            });
          }
        }
      }
    }

    console.log(`📦 Found ${imagesToDownload.length} images to download from active-gifts.json`);

    if (imagesToDownload.length === 0) {
      console.error('❌ No images found to download! Check if active-gifts.json has images field.');
    }

    // Download images with progress updates
    let downloaded = 0;
    let failed = 0;
    const total = imagesToDownload.length;

    for (const img of imagesToDownload) {
      const filepath = pathModule.join(imagesDir, img.filename);

      // Send progress update to renderer
      mainWindow.webContents.send('image-download-progress', {
        current: downloaded + failed + 1,
        total,
        filename: img.filename,
        giftName: img.giftName,
        status: 'downloading'
      });

      try {
        await downloadImage(img.url, filepath);
        downloaded++;
        console.log(`✅ Downloaded: ${img.filename}`);

        // Send success update
        mainWindow.webContents.send('image-download-progress', {
          current: downloaded + failed,
          total,
          filename: img.filename,
          giftName: img.giftName,
          status: 'success'
        });
      } catch (error) {
        failed++;
        console.error(`❌ Failed to download ${img.filename}:`, error.message);

        // Send error update
        mainWindow.webContents.send('image-download-progress', {
          current: downloaded + failed,
          total,
          filename: img.filename,
          giftName: img.giftName,
          status: 'error',
          error: error.message
        });
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Download complete! Success: ${downloaded}, Failed: ${failed}`);

    return {
      success: true,
      downloaded,
      failed,
      total,
      imagesDir
    };
  } catch (error) {
    console.error('Error downloading gift images:', error);
    return { success: false, error: error.message };
  }
});

// Get the downloaded images directory path
ipcMain.handle('get-downloaded-images-path', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const imagesDir = pathModule.join(userDataPath, 'gift-images');
    return { success: true, path: imagesDir };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Download a single gift image from URL
ipcMain.handle('download-single-gift-image', async (event, giftName, coins, url) => {
  try {
    // SECURITY: Validate URL to prevent SSRF attacks
    const validation = validateImageUrl(url);
    if (!validation.valid) {
      console.error('URL validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    console.log(`🖼️ Downloading single image: ${giftName} (${coins} coins) from ${url}`);

    // Download to userData directory
    const userDataPath = app.getPath('userData');
    const imagesDir = pathModule.join(userDataPath, 'gift-images');

    // Create directory if it doesn't exist
    try {
      await fs.mkdir(imagesDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Sanitize filename
    const sanitized = giftName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitized}_${coins}.webp`;
    const filepath = pathModule.join(imagesDir, filename);

    // Download the image
    await downloadImage(url, filepath);
    console.log(`✅ Downloaded: ${filename}`);

    // Update active-gifts.json to include this image
    if (giftUpdater) {
      const activeGifts = await giftUpdater.getActiveGifts();
      if (activeGifts && activeGifts.images) {
        // Initialize coin value group if it doesn't exist
        if (!activeGifts.images[coins]) {
          activeGifts.images[coins] = {};
        }

        // Update or add the image data
        activeGifts.images[coins][giftName] = {
          cdn: url,
          local: `./gift-images/${filename}`
        };

        // Save updated active-gifts.json
        const activeGiftsPath = pathModule.join(userDataPath, 'active-gifts.json');
        await fs.writeFile(activeGiftsPath, JSON.stringify(activeGifts, null, 2), 'utf8');
        console.log(`💾 Updated active-gifts.json for ${giftName}`);
      }
    }

    return {
      success: true,
      filename,
      filepath
    };
  } catch (error) {
    console.error('Error downloading single gift image:', error);
    return { success: false, error: error.message };
  }
});

// Download missing gift images only
ipcMain.handle('download-missing-gift-images', async (event) => {
  try {
    console.log('🔍 Checking for missing gift images...');

    // Download to userData directory (writable location)
    const userDataPath = app.getPath('userData');
    const imagesDir = pathModule.join(userDataPath, 'gift-images');

    // Create directory if it doesn't exist
    try {
      await fs.mkdir(imagesDir, { recursive: true });
      console.log(`📁 Using images directory: ${imagesDir}`);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Load active gifts database
    if (!giftUpdater) {
      return { success: false, error: 'Gift updater not initialized' };
    }

    const activeGifts = await giftUpdater.getActiveGifts();
    if (!activeGifts || !activeGifts.images) {
      return { success: false, error: 'No active gifts found' };
    }

    // Check which images are missing
    let missingImages = [];

    for (const [coinValue, gifts] of Object.entries(activeGifts.images)) {
      for (const [giftName, giftData] of Object.entries(gifts)) {
        if (giftData && giftData.cdn && giftData.local) {
          // Extract filename from local path
          const filename = giftData.local.replace('./gift-images/', '');
          const filepath = pathModule.join(imagesDir, filename);

          // Check if file exists
          try {
            await fs.access(filepath);
            // File exists, skip it
          } catch {
            // File doesn't exist, add to download list
            missingImages.push({
              url: giftData.cdn,
              filename,
              filepath,
              giftName,
              coinValue
            });
          }
        }
      }
    }

    console.log(`📦 Found ${missingImages.length} missing images to download`);

    if (missingImages.length === 0) {
      return {
        success: true,
        downloaded: 0,
        failed: 0,
        total: 0,
        message: 'All images already downloaded'
      };
    }

    // Download missing images with progress updates
    let downloaded = 0;
    let failed = 0;
    const total = missingImages.length;

    for (const img of missingImages) {
      // Send progress update to renderer
      mainWindow.webContents.send('image-download-progress', {
        current: downloaded + failed + 1,
        total,
        filename: img.filename,
        giftName: img.giftName,
        status: 'downloading'
      });

      try {
        await downloadImage(img.url, img.filepath);
        downloaded++;
        console.log(`✅ Downloaded missing: ${img.filename}`);

        // Send success update
        mainWindow.webContents.send('image-download-progress', {
          current: downloaded + failed,
          total,
          filename: img.filename,
          giftName: img.giftName,
          status: 'success'
        });
      } catch (error) {
        failed++;
        console.error(`❌ Failed to download ${img.filename}:`, error.message);

        // Send error update
        mainWindow.webContents.send('image-download-progress', {
          current: downloaded + failed,
          total,
          filename: img.filename,
          giftName: img.giftName,
          status: 'error',
          error: error.message
        });
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Missing images download complete! Success: ${downloaded}, Failed: ${failed}`);

    return {
      success: true,
      downloaded,
      failed,
      total,
      imagesDir
    };
  } catch (error) {
    console.error('Error downloading missing gift images:', error);
    return { success: false, error: error.message };
  }
});

// ============= OVERLAY BUILDER =============

// Save overlay HTML file to Downloads folder
ipcMain.handle('save-overlay-file', async (event, htmlContent) => {
  try {
    const downloadsPath = app.getPath('downloads');
    const filePath = pathModule.join(downloadsPath, 'TikTok-Gift-Overlay.html');

    await fs.writeFile(filePath, htmlContent, 'utf8');
    console.log(`🎬 Saved overlay file to ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving overlay file:', error);
    return { success: false, error: error.message };
  }
});

// Toggle HoellStream polling on/off
ipcMain.handle('toggle-hoellstream', async () => {
  try {
    if (!hoellPoller) {
      return { success: false, error: 'HoellStream poller not initialized' };
    }

    if (hoellPoller.isPolling) {
      hoellPoller.stop();
      stopThresholdStatusWriter();

      // Notify renderer about HoellStream disconnection
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('hoellstream-status', { connected: false });
      }

      return { success: true, polling: false, message: 'HoellStream polling stopped' };
    } else {
      hoellPoller.start();
      startThresholdStatusWriter();

      // Notify renderer about HoellStream connection
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('hoellstream-status', { connected: true });
      }

      return { success: true, polling: true, message: 'HoellStream polling started' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get HoellStream stats
ipcMain.handle('get-hoellstream-stats', async () => {
  try {
    if (!hoellPoller) {
      return { success: false, error: 'HoellStream poller not initialized' };
    }
    const stats = hoellPoller.getStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear seen events (useful for testing)
ipcMain.handle('clear-hoellstream-cache', async () => {
  try {
    if (!eventProcessor) {
      return { success: false, error: 'EventProcessor not initialized' };
    }
    eventProcessor.clearSeenEvents();
    return { success: true, message: 'Seen events cache cleared' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============= TIKFINITY WEBSOCKET =============

// Connect to TikFinity WebSocket
ipcMain.handle('connect-tikfinity', async () => {
  try {
    if (!tikfinityClient) {
      return { success: false, error: 'TikFinity client not initialized' };
    }
    tikfinityClient.connect();
    return { success: true, message: 'TikFinity connection initiated' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Disconnect from TikFinity WebSocket
ipcMain.handle('disconnect-tikfinity', async () => {
  try {
    if (!tikfinityClient) {
      return { success: false, error: 'TikFinity client not initialized' };
    }
    tikfinityClient.disconnect();
    return { success: true, message: 'TikFinity disconnected' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get TikFinity connection status
ipcMain.handle('get-tikfinity-status', async () => {
  try {
    if (!tikfinityClient) {
      return { success: false, error: 'TikFinity client not initialized' };
    }
    return {
      success: true,
      connected: tikfinityClient.isConnected(),
      url: tikfinityClient.getUrl()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start gift polling with selected source (hoellstream or tikfinity)
ipcMain.handle('start-gift-polling', async (event, source) => {
  try {
    if (!sourceManager) {
      return { success: false, error: 'GiftSourceManager not initialized' };
    }
    await sourceManager.startPolling(source);
    return { success: true, message: `Gift polling started with ${source}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop gift polling
ipcMain.handle('stop-gift-polling', async () => {
  try {
    if (!sourceManager) {
      return { success: false, error: 'GiftSourceManager not initialized' };
    }
    await sourceManager.stopPolling();
    return { success: true, message: 'Gift polling stopped' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get gift polling stats
ipcMain.handle('get-gift-polling-stats', async () => {
  try {
    if (!sourceManager) {
      return { success: false, error: 'GiftSourceManager not initialized' };
    }
    const stats = sourceManager.getStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Toggle gift polling on/off (unified handler - source-aware)
ipcMain.handle('toggle-gift-polling', async (event, source) => {
  try {
    if (!sourceManager) {
      return { success: false, error: 'Gift source manager not initialized' };
    }

    const isCurrentlyPolling = sourceManager.isPolling();

    if (isCurrentlyPolling) {
      // Stop current source
      await sourceManager.stopPolling();
      stopThresholdStatusWriter();

      // Notify renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('hoellstream-status', { connected: false });
        mainWindow.webContents.send('tikfinity-status', { connected: false });
      }

      return {
        success: true,
        polling: false,
        source: sourceManager.getActiveSource(),
        message: 'Gift polling stopped'
      };
    } else {
      // Start selected source
      await sourceManager.startPolling(source);
      startThresholdStatusWriter();

      // Notify renderer
      if (mainWindow && mainWindow.webContents) {
        if (source === 'hoellstream') {
          mainWindow.webContents.send('hoellstream-status', { connected: true });
        } else if (source === 'tikfinity') {
          mainWindow.webContents.send('tikfinity-status', { connected: true });
        }
      }

      return {
        success: true,
        polling: true,
        source: source,
        message: `${source} polling started`
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Lua Connector (Emulator Mode) IPC Handlers
// ============================================================================

// Connect to Lua connector (emulator mode)
ipcMain.handle('connect-lua', async (event, host, port) => {
  try {
    if (!luaClient) {
      return { success: false, error: 'Lua client not initialized' };
    }
    await luaClient.connect(host || 'localhost', port || 65399);
    return { success: true, message: 'Connected to Lua connector' };
  } catch (error) {
    console.error('Lua connector connection error:', error);
    return { success: false, error: error.message };
  }
});

// Disconnect from Lua connector
ipcMain.handle('disconnect-lua', async () => {
  try {
    if (!luaClient) {
      return { success: false, error: 'Lua client not initialized' };
    }
    luaClient.disconnect();
    return { success: true, message: 'Disconnected from Lua connector' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get Lua connector status
ipcMain.handle('get-lua-status', async () => {
  try {
    if (!luaClient) {
      return { success: false, error: 'Lua client not initialized' };
    }
    return {
      success: true,
      connected: luaClient.isConnected()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set connection mode (SNI or Lua)
ipcMain.handle('set-connection-mode', async (event, mode) => {
  try {
    if (mode !== 'sni' && mode !== 'lua') {
      return { success: false, error: 'Invalid connection mode. Must be "sni" or "lua"' };
    }

    connectionMode = mode;
    console.log(`🔄 Connection mode set to: ${mode}`);

    // Switch operations references based on mode
    if (mode === 'lua') {
      // Create Lua operation wrappers
      luaGameOps = new LuaGameOperations(luaClient);
      luaExpandedOps = new LuaExpandedOperations(luaClient);
      luaHoellOps = new LuaHoellOperations(luaClient);

      // Update SNES API to use Lua operations
      snesAPI = new SNESApi(luaClient, luaGameOps, luaExpandedOps, luaHoellOps);

      // Update ScriptEngine with new API
      if (scriptEngine) {
        scriptEngine.snesAPI = snesAPI;
      }

      // Update EventProcessor with Lua operations
      if (eventProcessor) {
        eventProcessor.updateOperations(luaExpandedOps, luaGameOps);
      }

      console.log('✅ Switched to Lua connector operations');
    } else {
      // Switch back to SNI operations
      snesAPI = new SNESApi(sniClient, gameOps, expandedOps, hoellOps);

      // Update ScriptEngine with new API
      if (scriptEngine) {
        scriptEngine.snesAPI = snesAPI;
      }

      // Update EventProcessor with SNI operations
      if (eventProcessor) {
        eventProcessor.updateOperations(expandedOps, gameOps);
      }

      console.log('✅ Switched to SNI operations');
    }

    return { success: true, mode: connectionMode };
  } catch (error) {
    console.error('Error setting connection mode:', error);
    return { success: false, error: error.message };
  }
});

// Get current connection mode
ipcMain.handle('get-connection-mode', async () => {
  return { success: true, mode: connectionMode };
});

// ============= ITEM RESTORATION SYSTEM =============

// Disable item temporarily (for manual testing or TikTok integration)
ipcMain.handle('disable-item-temp', async (event, itemName, durationSeconds) => {
  try {
    if (!sniClient.deviceURI) throw new Error('No device selected');
    if (!restorationManager) throw new Error('Restoration manager not initialized');
    return await restorationManager.disableItemTemporarily(itemName, durationSeconds);
  } catch (error) {
    console.error('Disable item error:', error);
    return { success: false, error: error.message };
  }
});

// Manually restore item early (cancel scheduled restoration)
ipcMain.handle('restore-item', async (event, itemName) => {
  try {
    if (!restorationManager) throw new Error('Restoration manager not initialized');
    return await restorationManager.restoreItem(itemName);
  } catch (error) {
    console.error('Restore item error:', error);
    return { success: false, error: error.message };
  }
});

// Get all active restorations
ipcMain.handle('get-active-restorations', async () => {
  try {
    if (!restorationManager) throw new Error('Restoration manager not initialized');
    const active = restorationManager.getActiveRestorations();
    return { success: true, restorations: active };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Restore all items immediately
ipcMain.handle('restore-all-items', async () => {
  try {
    if (!restorationManager) throw new Error('Restoration manager not initialized');
    return await restorationManager.restoreAll();
  } catch (error) {
    console.error('Restore all items error:', error);
    return { success: false, error: error.message };
  }
});

// Get list of supported items for disable/restore
ipcMain.handle('get-supported-items', async () => {
  try {
    if (!restorationManager) throw new Error('Restoration manager not initialized');
    const items = restorationManager.getSupportedItems();
    return { success: true, items };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============= ACTION CONSOLE POPUP =============

ipcMain.handle('open-action-console-popup', async () => {
  if (actionConsoleWindow && !actionConsoleWindow.isDestroyed()) {
    actionConsoleWindow.focus();
    return { success: true, message: 'Window already open' };
  }

  actionConsoleWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Action Console',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  actionConsoleWindow.loadFile(path.join(__dirname, 'renderer', 'action-console-popup.html'));

  // Connect action console window to EventProcessor for event emission
  if (eventProcessor) {
    eventProcessor.setActionConsoleWindow(actionConsoleWindow);
  }

  actionConsoleWindow.on('closed', () => {
    actionConsoleWindow = null;
  });

  return { success: true };
});

ipcMain.handle('set-always-on-top', async (event, enabled) => {
  if (actionConsoleWindow && !actionConsoleWindow.isDestroyed()) {
    actionConsoleWindow.setAlwaysOnTop(enabled);
    return { success: true };
  }
  return { success: false, error: 'Action console window not open' };
});

ipcMain.handle('execute-gift-action', async (event, actionData) => {
  try {
    if (!sniClient.deviceURI && !luaClient.isConnected) {
      return { success: false, error: 'No device connected' };
    }

    const { action, params } = actionData;

    // Use current connection mode operations
    const ops = connectionMode === 'lua' ? luaExpandedOps : expandedOps;
    const basicOps = connectionMode === 'lua' ? luaGameOps : gameOps;

    // Check which operations object has the action
    let targetOps = null;
    if (typeof ops[action] === 'function') {
      targetOps = ops;
    } else if (typeof basicOps[action] === 'function') {
      targetOps = basicOps;
    } else if (typeof hoellOps[action] === 'function') {
      targetOps = hoellOps;
    } else {
      return { success: false, error: `Unknown action: ${action}` };
    }

    // Execute the action
    if (params && Object.keys(params).length > 0) {
      const paramValue = Object.values(params)[0];
      return await targetOps[action](paramValue);
    } else {
      return await targetOps[action]();
    }

  } catch (error) {
    console.error('Execute gift action error:', error);
    return { success: false, error: error.message };
  }
});

// ============= GIFT DATABASE UPDATE SYSTEM =============

// Update gift database from streamtoearn.io API
ipcMain.handle('update-gift-database', async (event, options = {}) => {
  try {
    if (!giftUpdater) {
      console.error('❌ GiftUpdater is not initialized. Type:', typeof giftUpdater);
      console.error('Check console logs above for initialization errors.');
      throw new Error('Gift updater not initialized - check console for initialization errors');
    }

    // Set progress callback to send updates to renderer
    giftUpdater.progressCallback = (progress) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('gift-update-progress', progress);
      }
    };

    const result = await giftUpdater.updateGiftDatabase(options);
    return result;
  } catch (error) {
    console.error('Update gift database error:', error);
    return { success: false, error: error.message };
  }
});

// Get version history
ipcMain.handle('get-database-versions', async () => {
  try {
    if (!giftUpdater) throw new Error('Gift updater not initialized');
    const versions = await giftUpdater.getVersionHistory();
    return { success: true, versions };
  } catch (error) {
    console.error('Get database versions error:', error);
    return { success: false, error: error.message };
  }
});

// Rollback database to previous version
ipcMain.handle('rollback-database', async (event, backupPath) => {
  try {
    if (!giftUpdater) throw new Error('Gift updater not initialized');

    // SECURITY: Validate that backup path is within the allowed directory
    const userDataPath = app.getPath('userData');
    const backupsDir = pathModule.join(userDataPath, 'gift-backups');
    const normalizedBackupPath = pathModule.normalize(backupPath);
    const normalizedBackupsDir = pathModule.normalize(backupsDir);

    if (!normalizedBackupPath.startsWith(normalizedBackupsDir)) {
      console.error('Path traversal attempt in rollback-database:', backupPath);
      return { success: false, error: 'Invalid backup path: must be in gift-backups directory' };
    }

    const result = await giftUpdater.rollback(normalizedBackupPath);
    return result;
  } catch (error) {
    console.error('Rollback database error:', error);
    return { success: false, error: error.message };
  }
});

// Get active gifts
ipcMain.handle('get-active-gifts', async () => {
  try {
    if (!giftUpdater) throw new Error('Gift updater not initialized');
    const activeGifts = await giftUpdater.getActiveGifts();
    return { success: true, activeGifts };
  } catch (error) {
    console.error('Get active gifts error:', error);
    return { success: false, error: error.message };
  }
});

// Load archived gifts
ipcMain.handle('load-archived-gifts', async () => {
  try {
    if (!giftUpdater) throw new Error('Gift updater not initialized');
    const archivedGifts = await giftUpdater.getArchivedGifts();
    return { success: true, archivedGifts };
  } catch (error) {
    console.error('Load archived gifts error:', error);
    return { success: false, error: error.message };
  }
});

// Restore archived gift to active database
ipcMain.handle('restore-archived-gift', async (event, giftName, coins) => {
  try {
    if (!giftUpdater) throw new Error('Gift updater not initialized');
    const result = await giftUpdater.restoreArchivedGift(giftName, coins);
    return result;
  } catch (error) {
    console.error('Restore archived gift error:', error);
    return { success: false, error: error.message };
  }
});

// Delete archived gift permanently
ipcMain.handle('delete-archived-gift', async (event, giftName, coins) => {
  try {
    if (!giftUpdater) throw new Error('Gift updater not initialized');
    const result = await giftUpdater.deleteArchivedGift(giftName, coins);
    return result;
  } catch (error) {
    console.error('Delete archived gift error:', error);
    return { success: false, error: error.message };
  }
});

// Check if gift mappings reference archived gifts
ipcMain.handle('check-mappings-for-archived-gifts', async (event, giftMappings) => {
  try {
    if (!giftUpdater) throw new Error('Gift updater not initialized');
    const warnings = await giftUpdater.checkMappingsForArchivedGifts(giftMappings);
    return { success: true, warnings };
  } catch (error) {
    console.error('Check mappings for archived gifts error:', error);
    return { success: false, error: error.message };
  }
});

// Register protocol as privileged before app is ready
app.whenReady().then(async () => {
  // Register custom protocol for serving gift images from userData
  try {
    protocol.handle('gift-image', (request) => {
      const url = new URL(request.url);
      // For gift-image://filename.webp, the filename is in url.host, not url.pathname
      let filename = url.host || url.pathname.substring(1);

      // SECURITY: Sanitize filename to prevent path traversal
      // Remove path traversal sequences and path separators
      filename = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');

      // Validate filename is not empty after sanitization
      if (!filename || filename.length === 0) {
        console.error('[gift-image protocol] Invalid filename after sanitization');
        return new Response('Bad Request: Invalid filename', { status: 400 });
      }

      const imagesDir = path.join(app.getPath('userData'), 'gift-images');
      const imagePath = path.join(imagesDir, filename);

      // SECURITY: Validate that resolved path is within the allowed directory
      const normalizedPath = path.normalize(imagePath);
      const normalizedDir = path.normalize(imagesDir);

      if (!normalizedPath.startsWith(normalizedDir)) {
        console.error(`[gift-image protocol] Path traversal attempt detected: ${request.url}`);
        return new Response('Forbidden: Path traversal detected', { status: 403 });
      }

      console.log(`[gift-image protocol] Request: ${request.url} -> ${normalizedPath}`);

      // Convert Windows path separators for file:// URL
      const fileUrl = `file://${normalizedPath.replace(/\\/g, '/')}`;
      console.log(`[gift-image protocol] Fetching: ${fileUrl}`);
      return net.fetch(fileUrl);
    });
    console.log('✅ gift-image:// protocol registered');
  } catch (error) {
    console.error('❌ Failed to register gift-image protocol:', error);
  }

  createWindow();

  // Auto-connect to external SNI (assumes SNI is already running on port 8191)
  setTimeout(() => {
    autoConnectSNI();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
  if (restorationManager) {
    restorationManager.cleanup();
    console.log('⏱️ ItemRestorationManager cleaned up');
  }
  // SNI process management removed - external SNI will continue running
});