/**
 * IPC Handler Registration Module
 * Handles all Electron IPC communication between renderer and main process
 *
 * @module ipc-handlers
 */

const { ipcMain, app, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

/**
 * SECURITY: Validate image URL to prevent SSRF
 * @param {string} url - URL to validate
 * @returns {Object} Validation result with valid flag and optional error
 */
function validateImageUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Whitelist allowed domains (exact match or proper subdomain)
    const allowedDomains = [
      'p16-webcast.tiktokcdn.com',
      'p19-webcast.tiktokcdn.com',
      'p77-webcast.tiktokcdn.com',
      'streamtoearn.io'
    ];

    const allowedBaseDomains = [
      'tiktokcdn.com'  // Allow any subdomain of tiktokcdn.com
    ];

    const isAllowed = allowedDomains.includes(parsedUrl.hostname) ||
      allowedBaseDomains.some(domain => {
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

/**
 * Download a single image from URL
 * @param {string} url - URL to download from
 * @param {string} filepath - Local file path to save to
 * @returns {Promise} Resolves when download completes
 */
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
        require('fs').unlink(filepath, (unlinkErr) => {
          if (unlinkErr) console.error('[gift-image cleanup] Error:', unlinkErr.message);
        });
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Register all IPC handlers with dependencies
 * @param {Object} deps - Dependencies object containing all required services
 */
function registerIPCHandlers(deps) {
  const {
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
    filePaths,
    getLuaOpsInstance,
    setLuaOpsInstance,
    getSnesApiInstance,
    setSnesApiInstance,
    getConnectionMode,
    setConnectionMode,
    startThresholdStatusWriter,
    stopThresholdStatusWriter
  } = deps;

  // ============================================================================
  // SNI Connection Handlers
  // ============================================================================

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

      if (smwOps) {
        smwOps.startIndoorsMonitoring();
        console.log('🐔 Indoors monitoring started for stored chicken attacks');
      }

      return { success: true };
    } catch (error) {
      console.error('[IPC handler] Error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Generic Operations Handler
  // ============================================================================

  ipcMain.handle('execute-smw-operation', async (event, operationName, ...args) => {
    try {
      if (!sniClient.deviceURI) {
        throw new Error('No device selected');
      }

      if (typeof smwOps[operationName] === 'function') {
        const result = await smwOps[operationName](...args);
        return { success: true, result };
      }

      throw new Error(`Unknown operation: ${operationName}`);
    } catch (error) {
      console.error(`Error executing ${operationName}:`, error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Basic Operations Handlers
  // ============================================================================

  ipcMain.handle('fake-mirror', async () => {
    try {
      if (!sniClient.deviceURI) throw new Error('No device selected');
      return await smwOps.fakeMirror();
    } catch (error) {
      console.error('Fake Mirror error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('chaos-dungeon-warp', async () => {
    try {
      if (!sniClient.deviceURI) throw new Error('No device selected');
      return await smwOps.chaosDungeonWarp();
    } catch (error) {
      console.error('Chaos Dungeon Warp error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('toggle-world', async () => {
    try {
      if (!sniClient.deviceURI) throw new Error('No device selected');
      return await smwOps.toggleWorld();
    } catch (error) {
      console.error('Toggle World error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('test-memory', async () => {
    try {
      if (!sniClient.deviceURI) throw new Error('No device selected');
      await sniClient.testMemoryAccess();
      return { success: true };
    } catch (error) {
      console.error('Test memory error:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Expanded Operations Handlers (Rupees, Bombs, Arrows, Equipment, etc.)
  // ============================================================================

  const createSimpleHandler = (handlerName, method) => {
    ipcMain.handle(handlerName, async (event, ...args) => {
      try {
        if (!sniClient.deviceURI) throw new Error('No device selected');
        return await smwOps[method](...args);
      } catch (error) {
        console.error(`[${handlerName}] Error:`, error.message);
        return { success: false, error: error.message };
      }
    });
  };

  // Rupees & Resources
  createSimpleHandler('set-rupees', 'setRupees');
  createSimpleHandler('add-rupees', 'addRupees');
  createSimpleHandler('add-rupee', 'addRupee');
  createSimpleHandler('remove-rupee', 'removeRupee');
  createSimpleHandler('set-bombs', 'setBombs');
  createSimpleHandler('add-bomb', 'addBomb');
  createSimpleHandler('remove-bomb', 'removeBomb');
  createSimpleHandler('set-arrows', 'setArrows');
  createSimpleHandler('add-arrow', 'addArrow');
  createSimpleHandler('remove-arrow', 'removeArrow');

  // Equipment
  createSimpleHandler('set-sword', 'setSword');
  createSimpleHandler('set-shield', 'setShield');
  createSimpleHandler('set-armor', 'setArmor');
  createSimpleHandler('set-gloves', 'setGloves');

  // Items - Toggles
  createSimpleHandler('toggle-boots', 'toggleBoots');
  createSimpleHandler('toggle-flippers', 'toggleFlippers');
  createSimpleHandler('toggle-moon-pearl', 'toggleMoonPearl');
  createSimpleHandler('toggle-hookshot', 'toggleHookshot');
  createSimpleHandler('toggle-lamp', 'toggleLamp');
  createSimpleHandler('toggle-hammer', 'toggleHammer');
  createSimpleHandler('toggle-book', 'toggleBook');
  createSimpleHandler('toggle-bug-net', 'toggleBugNet');
  createSimpleHandler('toggle-somaria', 'toggleSomaria');
  createSimpleHandler('toggle-byrna', 'toggleByrna');
  createSimpleHandler('toggle-mirror', 'toggleMirror');
  createSimpleHandler('toggle-boomerang', 'toggleBoomerang');
  createSimpleHandler('toggle-fire-rod', 'toggleFireRod');
  createSimpleHandler('toggle-ice-rod', 'toggleIceRod');

  // Items - Give/Remove
  createSimpleHandler('give-fire-rod', 'giveFireRod');
  createSimpleHandler('give-ice-rod', 'giveIceRod');
  createSimpleHandler('give-capes', 'giveCapes');
  createSimpleHandler('give-flute', 'giveFlute');
  createSimpleHandler('remove-flute', 'removeFlute');
  createSimpleHandler('deactivate-flute', 'deactivateFlute');

  // Medallions
  createSimpleHandler('toggle-medallion', 'toggleMedallion');
  createSimpleHandler('toggle-all-medallions', 'toggleAllMedallions');
  createSimpleHandler('give-all-medallions', 'giveAllMedallions');

  // Pendants & Crystals
  createSimpleHandler('toggle-pendant', 'togglePendant');
  createSimpleHandler('toggle-all-pendants', 'toggleAllPendants');
  createSimpleHandler('give-all-pendants', 'giveAllPendants');
  createSimpleHandler('toggle-crystal', 'toggleCrystal');
  createSimpleHandler('toggle-all-crystals', 'toggleAllCrystals');
  createSimpleHandler('give-all-crystals', 'giveAllCrystals');

  // Keys
  createSimpleHandler('add-small-key', 'addSmallKey');
  createSimpleHandler('remove-small-key', 'removeSmallKey');
  createSimpleHandler('give-small-keys', 'giveSmallKeys');
  createSimpleHandler('toggle-big-key', 'toggleBigKey');
  createSimpleHandler('give-big-key', 'giveBigKey');

  // Bottles
  createSimpleHandler('add-bottle', 'addBottle');
  createSimpleHandler('remove-bottle', 'removeBottle');
  createSimpleHandler('fill-bottles-potion', 'fillAllBottlesWithPotion');

  // Magic System
  createSimpleHandler('enable-magic', 'enableMagic');
  createSimpleHandler('remove-magic', 'removeMagic');
  createSimpleHandler('set-magic-upgrade', 'setMagicUpgrade');

  // Hearts
  createSimpleHandler('add-heart-piece', 'addHeartPiece');
  createSimpleHandler('set-hearts', 'setHearts');

  // Presets
  createSimpleHandler('give-starter-pack', 'giveStarterPack');
  createSimpleHandler('give-endgame-pack', 'giveEndgamePack');

  // Special Effects & Physics
  createSimpleHandler('toggle-invincibility', 'toggleInvincibility');
  createSimpleHandler('toggle-freeze-player', 'toggleFreezePlayer');
  createSimpleHandler('give-ice-physics', 'giveIcePhysics');
  createSimpleHandler('moon-jump', 'moonJump');
  createSimpleHandler('tiny-jump', 'tinyJump');
  createSimpleHandler('low-gravity', 'lowGravity');
  createSimpleHandler('high-gravity', 'highGravity');

  // Enemy Operations
  createSimpleHandler('spawn-enemy', 'spawnEnemyNearLink');
  createSimpleHandler('spawn-random-enemy', 'spawnRandomEnemy');
  createSimpleHandler('despawn-floor-blocks', 'despawnFloorBlocks');
  createSimpleHandler('spawn-bee-swarm', 'spawnBeeSwarm');
  createSimpleHandler('stop-bee-swarm', 'stopBeeSwarm');
  createSimpleHandler('trigger-chicken-attack', 'triggerChickenAttack');
  createSimpleHandler('trigger-enemy-waves', 'triggerEnemyWaves');
  createSimpleHandler('trigger-bee-swarm-waves', 'triggerBeeSwarmWaves');
  createSimpleHandler('make-enemies-invisible', 'makeEnemiesInvisible');

  // Chaotic Features
  createSimpleHandler('enable-infinite-magic', 'enableInfiniteMagic');
  createSimpleHandler('delete-all-saves', 'deleteAllSaves');
  createSimpleHandler('enable-ice-world', 'enableIceWorld');
  createSimpleHandler('spawn-boss-rush', 'spawnBossRush');
  createSimpleHandler('enable-item-lock', 'enableItemLock');
  createSimpleHandler('enable-glass-cannon', 'enableGlassCannon');
  createSimpleHandler('blessing-and-curse', 'blessingAndCurse');

  // Inventory
  ipcMain.handle('get-inventory', async () => {
    try {
      if (!sniClient.deviceURI) throw new Error('No device selected');
      const inventory = await smwOps.getFullInventory();
      return { success: true, inventory };
    } catch (error) {
      console.error('[IPC handler] Error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // MarioMod Detection
  ipcMain.handle('check-mariomod-patch', async () => {
    try {
      if (!sniClient.deviceURI) {
        return { success: false, error: 'No device selected', installed: false };
      }
      const isInstalled = await smwOps.spawner.checkMarioModPresent();
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

  // ============================================================================
  // Gift Mappings & Settings Handlers
  // ============================================================================

  ipcMain.handle('save-gift-mappings', async (event, mappings) => {
    try {
      await fs.writeFile(filePaths.GIFT_MAPPINGS, JSON.stringify(mappings, null, 2), 'utf8');
      console.log(`💾 Saved ${Object.keys(mappings).length} gift mappings`);

      if (deps.actionConsoleWindow && !deps.actionConsoleWindow.isDestroyed()) {
        deps.actionConsoleWindow.webContents.send('action-console-update');
      }

      return { success: true, count: Object.keys(mappings).length };
    } catch (error) {
      console.error('Error saving gift mappings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-gift-mappings', async () => {
    try {
      const data = await fs.readFile(filePaths.GIFT_MAPPINGS, 'utf8');
      const mappings = JSON.parse(data);
      return { success: true, mappings };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, mappings: {} };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reload-gift-mappings', async () => {
    try {
      if (!eventProcessor) {
        return { success: false, error: 'EventProcessor not initialized' };
      }
      const data = await fs.readFile(filePaths.GIFT_MAPPINGS, 'utf8');
      const mappings = JSON.parse(data);
      eventProcessor.updateMappings(mappings);
      return { success: true, count: Object.keys(mappings).length };
    } catch (error) {
      if (error.code === 'ENOENT') {
        eventProcessor.updateMappings({});
        return { success: true, count: 0 };
      }
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Threshold Configuration Handlers
  // ============================================================================

  ipcMain.handle('save-threshold-configs', async (event, thresholds) => {
    try {
      await fs.writeFile(filePaths.THRESHOLDS, JSON.stringify(thresholds, null, 2), 'utf8');
      console.log(`💾 Saved ${Object.keys(thresholds).length} threshold configs`);
      return { success: true, count: Object.keys(thresholds).length };
    } catch (error) {
      console.error('Error saving threshold configs:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-threshold-configs', async () => {
    try {
      const data = await fs.readFile(filePaths.THRESHOLDS, 'utf8');
      const thresholds = JSON.parse(data);
      return { success: true, thresholds };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, thresholds: {} };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reload-threshold-configs', async () => {
    try {
      if (!eventProcessor) {
        return { success: false, error: 'EventProcessor not initialized' };
      }
      const data = await fs.readFile(filePaths.THRESHOLDS, 'utf8');
      const thresholds = JSON.parse(data);
      await eventProcessor.loadThresholdConfigs(thresholds);
      return { success: true, count: Object.keys(thresholds).length };
    } catch (error) {
      if (error.code === 'ENOENT') {
        await eventProcessor.loadThresholdConfigs({});
        return { success: true, count: 0 };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-threshold-status', async () => {
    try {
      if (!eventProcessor) {
        return { success: false, error: 'EventProcessor not initialized' };
      }
      const status = eventProcessor.getThresholdStatus();
      return { success: true, status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Gift Name Overrides Handlers
  // ============================================================================

  ipcMain.handle('save-gift-name-overrides', async (event, overrides) => {
    try {
      await fs.writeFile(filePaths.GIFT_NAME_OVERRIDES, JSON.stringify(overrides, null, 2), 'utf8');
      console.log(`💾 Saved ${Object.keys(overrides).length} gift name overrides`);
      return { success: true, count: Object.keys(overrides).length };
    } catch (error) {
      console.error('Error saving gift name overrides:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-gift-name-overrides', async () => {
    try {
      const data = await fs.readFile(filePaths.GIFT_NAME_OVERRIDES, 'utf8');
      const overrides = JSON.parse(data);
      return { success: true, overrides };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, overrides: {} };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reload-gift-name-overrides', async () => {
    try {
      if (!eventProcessor) {
        return { success: false, error: 'EventProcessor not initialized' };
      }
      const data = await fs.readFile(filePaths.GIFT_NAME_OVERRIDES, 'utf8');
      const overrides = JSON.parse(data);
      eventProcessor.loadGiftNameOverrides(overrides);
      return { success: true, count: Object.keys(overrides).length };
    } catch (error) {
      if (error.code === 'ENOENT') {
        eventProcessor.loadGiftNameOverrides({});
        return { success: true, count: 0 };
      }
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Custom Gifts & Image Overrides Handlers
  // ============================================================================

  const CUSTOM_GIFTS_FILE = path.join(app.getPath('userData'), 'custom-gifts.json');
  const GIFT_IMAGE_OVERRIDES_FILE = path.join(app.getPath('userData'), 'gift-image-overrides.json');

  ipcMain.handle('save-custom-gifts', async (event, customGifts) => {
    try {
      await fs.writeFile(CUSTOM_GIFTS_FILE, JSON.stringify(customGifts, null, 2), 'utf8');
      return { success: true, count: customGifts.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-custom-gifts', async () => {
    try {
      const data = await fs.readFile(CUSTOM_GIFTS_FILE, 'utf8');
      const customGifts = JSON.parse(data);
      return { success: true, customGifts };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, customGifts: [] };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-gift-image-overrides', async (event, overrides) => {
    try {
      await fs.writeFile(GIFT_IMAGE_OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8');
      return { success: true, count: Object.keys(overrides).length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-gift-image-overrides', async () => {
    try {
      const data = await fs.readFile(GIFT_IMAGE_OVERRIDES_FILE, 'utf8');
      const overrides = JSON.parse(data);
      return { success: true, overrides };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, overrides: {} };
      }
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Gift Image Download Handlers
  // ============================================================================

  ipcMain.handle('download-all-gift-images', async (event) => {
    try {
      const userDataPath = app.getPath('userData');
      const imagesDir = path.join(userDataPath, 'gift-images');
      await fs.mkdir(imagesDir, { recursive: true });

      let imagesToDownload = [];

      if (giftUpdater) {
        const activeGifts = await giftUpdater.getActiveGifts();
        if (activeGifts && activeGifts.images) {
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

      if (imagesToDownload.length === 0) {
        const giftImagesModule = require('../renderer/gift-images.js');
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

      let downloaded = 0;
      let failed = 0;
      const total = imagesToDownload.length;

      for (const img of imagesToDownload) {
        const filepath = path.join(imagesDir, img.filename);

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
          mainWindow.webContents.send('image-download-progress', {
            current: downloaded + failed,
            total,
            filename: img.filename,
            giftName: img.giftName,
            status: 'success'
          });
        } catch (error) {
          failed++;
          mainWindow.webContents.send('image-download-progress', {
            current: downloaded + failed,
            total,
            filename: img.filename,
            giftName: img.giftName,
            status: 'error',
            error: error.message
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        success: true,
        downloaded,
        failed,
        total,
        imagesDir
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-downloaded-images-path', async () => {
    try {
      const imagesDir = path.join(app.getPath('userData'), 'gift-images');
      return { success: true, path: imagesDir };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('download-single-gift-image', async (event, giftName, coins, url) => {
    try {
      const validation = validateImageUrl(url);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const userDataPath = app.getPath('userData');
      const imagesDir = path.join(userDataPath, 'gift-images');
      await fs.mkdir(imagesDir, { recursive: true });

      const sanitized = giftName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${sanitized}_${coins}.webp`;
      const filepath = path.join(imagesDir, filename);

      await downloadImage(url, filepath);

      if (giftUpdater) {
        const activeGifts = await giftUpdater.getActiveGifts();
        if (activeGifts && activeGifts.images) {
          if (!activeGifts.images[coins]) {
            activeGifts.images[coins] = {};
          }
          activeGifts.images[coins][giftName] = {
            cdn: url,
            local: `./gift-images/${filename}`
          };
          const activeGiftsPath = path.join(userDataPath, 'active-gifts.json');
          await fs.writeFile(activeGiftsPath, JSON.stringify(activeGifts, null, 2), 'utf8');
        }
      }

      return { success: true, filename, filepath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('download-missing-gift-images', async (event) => {
    try {
      const userDataPath = app.getPath('userData');
      const imagesDir = path.join(userDataPath, 'gift-images');
      await fs.mkdir(imagesDir, { recursive: true });

      if (!giftUpdater) {
        return { success: false, error: 'Gift updater not initialized' };
      }

      const activeGifts = await giftUpdater.getActiveGifts();
      if (!activeGifts || !activeGifts.images) {
        return { success: false, error: 'No active gifts found' };
      }

      let missingImages = [];
      for (const [coinValue, gifts] of Object.entries(activeGifts.images)) {
        for (const [giftName, giftData] of Object.entries(gifts)) {
          if (giftData && giftData.cdn && giftData.local) {
            const filename = giftData.local.replace('./gift-images/', '');
            const filepath = path.join(imagesDir, filename);
            try {
              await fs.access(filepath);
            } catch {
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

      if (missingImages.length === 0) {
        return {
          success: true,
          downloaded: 0,
          failed: 0,
          total: 0,
          message: 'All images already downloaded'
        };
      }

      let downloaded = 0;
      let failed = 0;
      const total = missingImages.length;

      for (const img of missingImages) {
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
          mainWindow.webContents.send('image-download-progress', {
            current: downloaded + failed,
            total,
            filename: img.filename,
            giftName: img.giftName,
            status: 'success'
          });
        } catch (error) {
          failed++;
          mainWindow.webContents.send('image-download-progress', {
            current: downloaded + failed,
            total,
            filename: img.filename,
            giftName: img.giftName,
            status: 'error',
            error: error.message
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        success: true,
        downloaded,
        failed,
        total,
        imagesDir
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Overlay Builder Handlers
  // ============================================================================

  ipcMain.handle('browse-overlay-path', async (event) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Save Overlay HTML File',
        defaultPath: path.join(app.getPath('downloads'), 'TikTok-Gift-Overlay.html'),
        filters: [
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-overlay-file', async (event, htmlContent, customPath = null) => {
    try {
      let filePath;
      if (customPath) {
        filePath = customPath;
      } else {
        filePath = path.join(app.getPath('downloads'), 'TikTok-Gift-Overlay.html');
      }
      await fs.writeFile(filePath, htmlContent, 'utf8');
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Gift Source Control Handlers (HoellStream & TikFinity)
  // ============================================================================

  ipcMain.handle('toggle-hoellstream', async () => {
    try {
      if (!hoellPoller) {
        return { success: false, error: 'HoellStream poller not initialized' };
      }

      if (hoellPoller.isPolling) {
        hoellPoller.stop();
        stopThresholdStatusWriter();
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('hoellstream-status', { connected: false });
        }
        return { success: true, polling: false, message: 'HoellStream polling stopped' };
      } else {
        hoellPoller.start();
        startThresholdStatusWriter();
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('hoellstream-status', { connected: true });
        }
        return { success: true, polling: true, message: 'HoellStream polling started' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

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

  ipcMain.handle('stop-gift-polling', async () => {
    try {
      if (!sourceManager) {
        return { success: false, error: 'GiftSourceManager not initialized' };
      }
      await sourceManager.stopPolling();
      stopThresholdStatusWriter();
      return { success: true, message: 'Gift polling stopped' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

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

  ipcMain.handle('toggle-gift-polling', async (event, source) => {
    try {
      if (!sourceManager) {
        return { success: false, error: 'Gift source manager not initialized' };
      }

      const isCurrentlyPolling = sourceManager.isPolling();

      if (isCurrentlyPolling) {
        await sourceManager.stopPolling();
        stopThresholdStatusWriter();

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
        await sourceManager.startPolling(source);
        startThresholdStatusWriter();

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
  // Lua Connector (Emulator Mode) Handlers
  // ============================================================================

  ipcMain.handle('connect-lua', async (event, host, port) => {
    try {
      if (!luaClient) {
        return { success: false, error: 'Lua client not initialized' };
      }
      await luaClient.connect(host || 'localhost', port || 65399);
      return { success: true, message: 'Connected to Lua connector' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

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

  ipcMain.handle('set-connection-mode', async (event, mode) => {
    try {
      if (mode !== 'sni' && mode !== 'lua') {
        return { success: false, error: 'Invalid connection mode. Must be "sni" or "lua"' };
      }

      setConnectionMode(mode);
      console.log(`🔄 Connection mode set to: ${mode}`);

      if (mode === 'lua') {
        const { LuaGameOperations, LuaExpandedOperations, LuaHoellOperations } = require('./emulator/lua-operations');
        const SNESApi = require('./lua/snes-api');

        const newLuaGameOps = new LuaGameOperations(luaClient);
        const newLuaExpandedOps = new LuaExpandedOperations(luaClient);
        const newLuaHoellOps = new LuaHoellOperations(luaClient);

        setLuaOpsInstance({
          luaGameOps: newLuaGameOps,
          luaExpandedOps: newLuaExpandedOps,
          luaHoellOps: newLuaHoellOps
        });

        const newSnesAPI = new SNESApi(luaClient, newLuaExpandedOps);
        setSnesApiInstance(newSnesAPI);

        if (scriptEngine) {
          scriptEngine.snesAPI = newSnesAPI;
        }

        if (eventProcessor) {
          eventProcessor.updateOperations(newLuaExpandedOps);
        }

        console.log('✅ Switched to Lua connector operations');
      } else {
        const SNESApi = require('./lua/snes-api');
        const newSnesAPI = new SNESApi(sniClient, smwOps);
        setSnesApiInstance(newSnesAPI);

        if (scriptEngine) {
          scriptEngine.snesAPI = newSnesAPI;
        }

        if (eventProcessor) {
          eventProcessor.updateOperations(smwOps);
        }

        console.log('✅ Switched to SNI operations');
      }

      return { success: true, mode: getConnectionMode() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-connection-mode', async () => {
    return { success: true, mode: getConnectionMode() };
  });

  // ============================================================================
  // Item Restoration System Handlers
  // ============================================================================

  ipcMain.handle('disable-item-temp', async (event, itemName, durationSeconds) => {
    try {
      if (!sniClient.deviceURI) throw new Error('No device selected');
      if (!restorationManager) throw new Error('Restoration manager not initialized');
      return await restorationManager.disableItemTemporarily(itemName, durationSeconds);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('restore-item', async (event, itemName) => {
    try {
      if (!restorationManager) throw new Error('Restoration manager not initialized');
      return await restorationManager.restoreItem(itemName);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-active-restorations', async () => {
    try {
      if (!restorationManager) throw new Error('Restoration manager not initialized');
      const active = restorationManager.getActiveRestorations();
      return { success: true, restorations: active };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('restore-all-items', async () => {
    try {
      if (!restorationManager) throw new Error('Restoration manager not initialized');
      return await restorationManager.restoreAll();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-supported-items', async () => {
    try {
      if (!restorationManager) throw new Error('Restoration manager not initialized');
      const items = restorationManager.getSupportedItems();
      return { success: true, items };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Action Console Handlers
  // ============================================================================

  ipcMain.handle('open-action-console-popup', async () => {
    const { BrowserWindow } = require('electron');

    if (deps.actionConsoleWindow && !deps.actionConsoleWindow.isDestroyed()) {
      deps.actionConsoleWindow.focus();
      return { success: true, message: 'Window already open' };
    }

    deps.actionConsoleWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'Action Console',
      backgroundColor: '#1a1a2e',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    deps.actionConsoleWindow.loadFile(path.join(__dirname, '..', 'renderer', 'action-console-popup.html'));

    if (eventProcessor) {
      eventProcessor.setActionConsoleWindow(deps.actionConsoleWindow);
    }

    deps.actionConsoleWindow.on('closed', () => {
      deps.actionConsoleWindow = null;
    });

    return { success: true };
  });

  ipcMain.handle('set-always-on-top', async (event, enabled) => {
    if (deps.actionConsoleWindow && !deps.actionConsoleWindow.isDestroyed()) {
      deps.actionConsoleWindow.setAlwaysOnTop(enabled);
      return { success: true };
    }
    return { success: false, error: 'Action console window not open' };
  });

  ipcMain.handle('execute-gift-action', async (event, actionData) => {
    try {
      if (!sniClient.deviceURI && !luaClient.isConnected()) {
        return { success: false, error: 'No device connected' };
      }

      let { action, params } = actionData;

      if (action === 'addCoins50') {
        action = 'addCoins';
        params = { amount: 50 };
      }

      const mode = getConnectionMode();
      const luaOps = getLuaOpsInstance();
      const ops = mode === 'lua' ? luaOps.luaExpandedOps : smwOps;
      const basicOps = mode === 'lua' ? luaOps.luaGameOps : smwOps;

      let targetOps = null;
      if (typeof ops[action] === 'function') {
        targetOps = ops;
      } else if (typeof basicOps[action] === 'function') {
        targetOps = basicOps;
      } else if (luaOps.luaHoellOps && typeof luaOps.luaHoellOps[action] === 'function') {
        targetOps = luaOps.luaHoellOps;
      } else {
        return { success: false, error: `Unknown action: ${action}` };
      }

      if (params && Object.keys(params).length > 0) {
        const paramValue = Object.values(params)[0];
        return await targetOps[action](paramValue);
      } else {
        return await targetOps[action]();
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Gift Database Update System Handlers
  // ============================================================================

  ipcMain.handle('update-gift-database', async (event, options = {}) => {
    try {
      if (!giftUpdater) {
        throw new Error('Gift updater not initialized - check console for initialization errors');
      }

      giftUpdater.progressCallback = (progress) => {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('gift-update-progress', progress);
        }
      };

      const result = await giftUpdater.updateGiftDatabase(options);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-database-versions', async () => {
    try {
      if (!giftUpdater) throw new Error('Gift updater not initialized');
      const versions = await giftUpdater.getVersionHistory();
      return { success: true, versions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('rollback-database', async (event, backupPath) => {
    try {
      if (!giftUpdater) throw new Error('Gift updater not initialized');

      const userDataPath = app.getPath('userData');
      const backupsDir = path.join(userDataPath, 'gift-backups');
      const normalizedBackupPath = path.normalize(backupPath);
      const normalizedBackupsDir = path.normalize(backupsDir);

      if (!normalizedBackupPath.startsWith(normalizedBackupsDir)) {
        console.error('Path traversal attempt in rollback-database:', backupPath);
        return { success: false, error: 'Invalid backup path: must be in gift-backups directory' };
      }

      const result = await giftUpdater.rollback(normalizedBackupPath);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-active-gifts', async () => {
    try {
      if (!giftUpdater) throw new Error('Gift updater not initialized');
      const activeGifts = await giftUpdater.getActiveGifts();
      return { success: true, activeGifts };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-archived-gifts', async () => {
    try {
      if (!giftUpdater) throw new Error('Gift updater not initialized');
      const archivedGifts = await giftUpdater.getArchivedGifts();
      return { success: true, archivedGifts };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('restore-archived-gift', async (event, giftName, coins) => {
    try {
      if (!giftUpdater) throw new Error('Gift updater not initialized');
      const result = await giftUpdater.restoreArchivedGift(giftName, coins);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-archived-gift', async (event, giftName, coins) => {
    try {
      if (!giftUpdater) throw new Error('Gift updater not initialized');
      const result = await giftUpdater.deleteArchivedGift(giftName, coins);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('check-mappings-for-archived-gifts', async (event, giftMappings) => {
    try {
      if (!giftUpdater) throw new Error('Gift updater not initialized');
      const warnings = await giftUpdater.checkMappingsForArchivedGifts(giftMappings);
      return { success: true, warnings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('✅ All IPC handlers registered');
}

module.exports = { registerIPCHandlers };
