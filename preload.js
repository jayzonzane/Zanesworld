const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('sniAPI', {
  // Generic SMW operation executor
  executeSMWOperation: (operationName, ...args) => ipcRenderer.invoke('execute-smw-operation', operationName, ...args),

  // Original functions
  connect: (host, port) => ipcRenderer.invoke('connect-sni', host, port),
  selectDevice: (deviceInfo) => ipcRenderer.invoke('select-device', deviceInfo),
  restartSNI: () => ipcRenderer.invoke('restart-sni'),
  addHeart: () => ipcRenderer.invoke('add-heart'),
  removeHeart: () => ipcRenderer.invoke('remove-heart'),
  killPlayer: () => ipcRenderer.invoke('kill-player'),
  warpEastern: () => ipcRenderer.invoke('warp-eastern'),
  fakeMirror: () => ipcRenderer.invoke('fake-mirror'),
  chaosDungeonWarp: () => ipcRenderer.invoke('chaos-dungeon-warp'),
  toggleWorld: () => ipcRenderer.invoke('toggle-world'),
  testMemory: () => ipcRenderer.invoke('test-memory'),

  // Resources
  setRupees: (amount) => ipcRenderer.invoke('set-rupees', amount),
  addRupees: (amount) => ipcRenderer.invoke('add-rupees', amount),
  addRupee: () => ipcRenderer.invoke('add-rupee'),
  removeRupee: () => ipcRenderer.invoke('remove-rupee'),
  setBombs: (amount) => ipcRenderer.invoke('set-bombs', amount),
  addBomb: () => ipcRenderer.invoke('add-bomb'),
  removeBomb: () => ipcRenderer.invoke('remove-bomb'),
  setArrows: (amount) => ipcRenderer.invoke('set-arrows', amount),
  addArrow: () => ipcRenderer.invoke('add-arrow'),
  removeArrow: () => ipcRenderer.invoke('remove-arrow'),

  // Equipment
  setSword: (level) => ipcRenderer.invoke('set-sword', level),
  setShield: (level) => ipcRenderer.invoke('set-shield', level),
  setArmor: (level) => ipcRenderer.invoke('set-armor', level),
  setGloves: (level) => ipcRenderer.invoke('set-gloves', level),

  // Toggles
  toggleBoots: () => ipcRenderer.invoke('toggle-boots'),
  toggleFlippers: () => ipcRenderer.invoke('toggle-flippers'),
  toggleMoonPearl: () => ipcRenderer.invoke('toggle-moon-pearl'),
  toggleHookshot: () => ipcRenderer.invoke('toggle-hookshot'),
  toggleLamp: () => ipcRenderer.invoke('toggle-lamp'),
  toggleHammer: () => ipcRenderer.invoke('toggle-hammer'),
  toggleBook: () => ipcRenderer.invoke('toggle-book'),
  toggleBugNet: () => ipcRenderer.invoke('toggle-bug-net'),
  toggleSomaria: () => ipcRenderer.invoke('toggle-somaria'),
  toggleByrna: () => ipcRenderer.invoke('toggle-byrna'),
  toggleMirror: () => ipcRenderer.invoke('toggle-mirror'),
  toggleBoomerang: () => ipcRenderer.invoke('toggle-boomerang'),
  toggleInvincibility: () => ipcRenderer.invoke('toggle-invincibility'),

  // Freeze Player
  toggleFreezePlayer: () => ipcRenderer.invoke('toggle-freeze-player'),

  // Ice Physics (slippery floor)
  giveIcePhysics: () => ipcRenderer.invoke('give-ice-physics'),

  // Enemy Spawning
  spawnEnemy: (enemyType) => ipcRenderer.invoke('spawn-enemy', enemyType),
  spawnRandomEnemy: () => ipcRenderer.invoke('spawn-random-enemy'),
  despawnFloorBlocks: () => ipcRenderer.invoke('despawn-floor-blocks'),
  spawnBeeSwarm: (count) => ipcRenderer.invoke('spawn-bee-swarm', count),
  stopBeeSwarm: () => ipcRenderer.invoke('stop-bee-swarm'),
  triggerChickenAttack: (durationSeconds) => ipcRenderer.invoke('trigger-chicken-attack', durationSeconds),
  triggerEnemyWaves: (durationSeconds) => ipcRenderer.invoke('trigger-enemy-waves', durationSeconds),
  triggerBeeSwarmWaves: (durationSeconds) => ipcRenderer.invoke('trigger-bee-swarm-waves', durationSeconds),
  makeEnemiesInvisible: (durationSeconds) => ipcRenderer.invoke('make-enemies-invisible', durationSeconds),
  enableInfiniteMagic: (durationSeconds) => ipcRenderer.invoke('enable-infinite-magic', durationSeconds),

  // Physics Modifiers (SMW)
  moonJump: (durationSeconds) => ipcRenderer.invoke('moon-jump', durationSeconds),
  tinyJump: (durationSeconds) => ipcRenderer.invoke('tiny-jump', durationSeconds),
  lowGravity: (durationSeconds) => ipcRenderer.invoke('low-gravity', durationSeconds),
  highGravity: (durationSeconds) => ipcRenderer.invoke('high-gravity', durationSeconds),

  // Chaotic Features
  enableIceWorld: (durationSeconds) => ipcRenderer.invoke('enable-ice-world', durationSeconds),
  spawnBossRush: (durationSeconds) => ipcRenderer.invoke('spawn-boss-rush', durationSeconds),
  enableItemLock: (durationSeconds) => ipcRenderer.invoke('enable-item-lock', durationSeconds),
  enableGlassCannon: (durationSeconds) => ipcRenderer.invoke('enable-glass-cannon', durationSeconds),
  blessingAndCurse: () => ipcRenderer.invoke('blessing-and-curse'),

  // Magic Items
  toggleFireRod: () => ipcRenderer.invoke('toggle-fire-rod'),
  giveFireRod: () => ipcRenderer.invoke('give-fire-rod'),
  toggleIceRod: () => ipcRenderer.invoke('toggle-ice-rod'),
  giveIceRod: () => ipcRenderer.invoke('give-ice-rod'),
  giveCapes: () => ipcRenderer.invoke('give-capes'),

  // Flute
  giveFlute: () => ipcRenderer.invoke('give-flute'),
  removeFlute: () => ipcRenderer.invoke('remove-flute'),
  deactivateFlute: () => ipcRenderer.invoke('deactivate-flute'),

  toggleMedallion: (name) => ipcRenderer.invoke('toggle-medallion', name),
  toggleAllMedallions: () => ipcRenderer.invoke('toggle-all-medallions'),
  giveAllMedallions: () => ipcRenderer.invoke('give-all-medallions'),

  // Magic System
  enableMagic: () => ipcRenderer.invoke('enable-magic'),
  removeMagic: () => ipcRenderer.invoke('remove-magic'),
  setMagicUpgrade: (level) => ipcRenderer.invoke('set-magic-upgrade', level),

  // Bottles
  addBottle: () => ipcRenderer.invoke('add-bottle'),
  removeBottle: () => ipcRenderer.invoke('remove-bottle'),
  fillBottlesPotion: (type) => ipcRenderer.invoke('fill-bottles-potion', type),

  // Hearts
  addHeartPiece: () => ipcRenderer.invoke('add-heart-piece'),
  setHearts: (count) => ipcRenderer.invoke('set-hearts', count),

  // Progress
  togglePendant: (name) => ipcRenderer.invoke('toggle-pendant', name),
  toggleAllPendants: () => ipcRenderer.invoke('toggle-all-pendants'),
  giveAllPendants: () => ipcRenderer.invoke('give-all-pendants'),
  toggleCrystal: (num) => ipcRenderer.invoke('toggle-crystal', num),
  toggleAllCrystals: () => ipcRenderer.invoke('toggle-all-crystals'),
  giveAllCrystals: () => ipcRenderer.invoke('give-all-crystals'),

  // Keys
  addSmallKey: (dungeon) => ipcRenderer.invoke('add-small-key', dungeon),
  removeSmallKey: (dungeon) => ipcRenderer.invoke('remove-small-key', dungeon),
  giveSmallKeys: (dungeon, count) => ipcRenderer.invoke('give-small-keys', dungeon, count),
  toggleBigKey: (dungeon) => ipcRenderer.invoke('toggle-big-key', dungeon),
  giveBigKey: (dungeon) => ipcRenderer.invoke('give-big-key', dungeon),

  // Presets
  giveStarterPack: () => ipcRenderer.invoke('give-starter-pack'),
  giveEndgamePack: () => ipcRenderer.invoke('give-endgame-pack'),

  // State
  getInventory: () => ipcRenderer.invoke('get-inventory'),

  // HoellStream Controls
  toggleHoellStream: () => ipcRenderer.invoke('toggle-hoellstream'),
  getHoellStreamStats: () => ipcRenderer.invoke('get-hoellstream-stats'),
  clearHoellStreamCache: () => ipcRenderer.invoke('clear-hoellstream-cache'),

  // TikFinity Controls
  connectTikFinity: () => ipcRenderer.invoke('connect-tikfinity'),
  disconnectTikFinity: () => ipcRenderer.invoke('disconnect-tikfinity'),
  getTikFinityStatus: () => ipcRenderer.invoke('get-tikfinity-status'),

  // Lua Connector Controls (Emulator Mode)
  connectLua: (host, port) => ipcRenderer.invoke('connect-lua', host, port),
  disconnectLua: () => ipcRenderer.invoke('disconnect-lua'),
  getLuaStatus: () => ipcRenderer.invoke('get-lua-status'),
  setConnectionMode: (mode) => ipcRenderer.invoke('set-connection-mode', mode),
  getConnectionMode: () => ipcRenderer.invoke('get-connection-mode'),

  // Unified Gift Source Controls
  toggleGiftPolling: (source) => ipcRenderer.invoke('toggle-gift-polling', source),
  startGiftPolling: (source) => ipcRenderer.invoke('start-gift-polling', source),
  stopGiftPolling: () => ipcRenderer.invoke('stop-gift-polling'),
  getGiftPollingStats: () => ipcRenderer.invoke('get-gift-polling-stats'),

  // Gift Mappings
  saveGiftMappings: (mappings) => ipcRenderer.invoke('save-gift-mappings', mappings),
  loadGiftMappings: () => ipcRenderer.invoke('load-gift-mappings'),
  reloadGiftMappings: () => ipcRenderer.invoke('reload-gift-mappings'),

  // Threshold Configurations
  saveThresholdConfigs: (thresholds) => ipcRenderer.invoke('save-threshold-configs', thresholds),
  loadThresholdConfigs: () => ipcRenderer.invoke('load-threshold-configs'),
  reloadThresholdConfigs: () => ipcRenderer.invoke('reload-threshold-configs'),
  getThresholdStatus: () => ipcRenderer.invoke('get-threshold-status'),

  // Gift Name Overrides
  saveGiftNameOverrides: (overrides) => ipcRenderer.invoke('save-gift-name-overrides', overrides),
  loadGiftNameOverrides: () => ipcRenderer.invoke('load-gift-name-overrides'),
  reloadGiftNameOverrides: () => ipcRenderer.invoke('reload-gift-name-overrides'),

  // Custom Gifts
  saveCustomGifts: (customGifts) => ipcRenderer.invoke('save-custom-gifts', customGifts),
  loadCustomGifts: () => ipcRenderer.invoke('load-custom-gifts'),

  // Gift Image Overrides
  saveGiftImageOverrides: (overrides) => ipcRenderer.invoke('save-gift-image-overrides', overrides),
  loadGiftImageOverrides: () => ipcRenderer.invoke('load-gift-image-overrides'),

  // Gift Image Download
  downloadAllGiftImages: () => ipcRenderer.invoke('download-all-gift-images'),
  downloadMissingGiftImages: () => ipcRenderer.invoke('download-missing-gift-images'),
  downloadSingleGiftImage: (giftName, coins, url) => ipcRenderer.invoke('download-single-gift-image', giftName, coins, url),
  onImageDownloadProgress: (callback) => ipcRenderer.on('image-download-progress', (event, data) => callback(data)),
  getDownloadedImagesPath: () => ipcRenderer.invoke('get-downloaded-images-path'),

  // Overlay Builder
  browseOverlayPath: () => ipcRenderer.invoke('browse-overlay-path'),
  saveOverlayFile: (htmlContent, customPath) => ipcRenderer.invoke('save-overlay-file', htmlContent, customPath),

  // Item Restoration System
  disableItemTemp: (itemName, durationSeconds) => ipcRenderer.invoke('disable-item-temp', itemName, durationSeconds),
  restoreItem: (itemName) => ipcRenderer.invoke('restore-item', itemName),
  getActiveRestorations: () => ipcRenderer.invoke('get-active-restorations'),
  restoreAllItems: () => ipcRenderer.invoke('restore-all-items'),
  getSupportedItems: () => ipcRenderer.invoke('get-supported-items'),

  // Gift Database Update System
  updateGiftDatabase: (options) => ipcRenderer.invoke('update-gift-database', options),
  getDatabaseVersions: () => ipcRenderer.invoke('get-database-versions'),
  rollbackDatabase: (backupPath) => ipcRenderer.invoke('rollback-database', backupPath),
  getActiveGifts: () => ipcRenderer.invoke('get-active-gifts'),
  loadArchivedGifts: () => ipcRenderer.invoke('load-archived-gifts'),
  restoreArchivedGift: (giftName, coins) => ipcRenderer.invoke('restore-archived-gift', giftName, coins),
  deleteArchivedGift: (giftName, coins) => ipcRenderer.invoke('delete-archived-gift', giftName, coins),
  checkMappingsForArchivedGifts: (giftMappings) => ipcRenderer.invoke('check-mappings-for-archived-gifts', giftMappings),
  onGiftUpdateProgress: (callback) => ipcRenderer.on('gift-update-progress', (event, data) => callback(data)),

  // Delete Saves
  deleteAllSaves: () => ipcRenderer.invoke('delete-all-saves'),

  // MarioMod Detection (HoellCC)
  checkMarioModPatch: () => ipcRenderer.invoke('check-mariomod-patch'),

  // Event listeners
  onSNIAutoConnected: (callback) => ipcRenderer.on('sni-auto-connected', (event, data) => callback(data)),
  onHoellStreamStatus: (callback) => ipcRenderer.on('hoellstream-status', (event, data) => callback(data)),
  onGiftActivity: (callback) => ipcRenderer.on('gift-activity', (event, data) => callback(data)),
  onLuaConnected: (callback) => ipcRenderer.on('lua-connected', () => callback()),
  onLuaDisconnected: (callback) => ipcRenderer.on('lua-disconnected', () => callback()),
  onLuaError: (callback) => ipcRenderer.on('lua-error', (event, data) => callback(data)),

  /* ========================================================================
   * HOELLCC EXTENDED OPERATIONS (120 operations)
   * Available via executeSMWOperation(operationName, ...args)
   * Requires MarioMod ASM patch for spawn operations
   * ======================================================================== */

  // ENVIRONMENTAL EFFECTS (7 operations)
  // - setWaterMode, setLandMode, setWaterModeTimed
  // - setIceMode, setDryMode, setIceModeTimed
  // - freezePlayer, unfreezePlayer

  // SPEED CONTROL (5 operations)
  // - kickRight, kickLeft, kickUp
  // - pushRight, pushLeft

  // SILVER P-SWITCH (2 operations)
  // - activateSilverPSwitch, spawnSilverPSwitch

  // ENEMY SPAWNS (43 operations - MarioMod required)
  // - spawnGreenKoopa, spawnRedKoopa, spawnSpiny, spawnGoomba
  // - spawnGreenParatroopa, spawnRedParatroopa, spawnBobOmb
  // - spawnRex, spawnNinji, spawnParaGoomba, spawnLakitu
  // - spawnMontyMole, spawnMagikoopa, spawnWiggler
  // - spawnPiranhaPlant, spawnBulletBill, spawnHammerBro
  // - spawnSumoBro, spawnThwomp, spawnBoo, spawnBigBoo
  // - spawnBanzaiBill, spawnFishinBoo, spawnThwimp, spawnPokey
  // - spawnDinoRhino, spawnDryBones, spawnBonyBeetle
  // - spawnMagikoopa2, spawnReznor, spawnFishingLakitu
  // - spawnSwooper, spawnChargingChuck, spawnClappingChuck
  // - spawnSplittingChuck, spawnJumpingChuck, spawnKoopaKid
  // - spawnHotHead, spawnMechaKoopa, spawnCheepCheep
  // - spawnBlurp, spawnPorcupuffer, spawnBeachKoopa

  // POWER-UP SPAWNS (5 operations - MarioMod required)
  // - spawnStar, spawnFeather, spawnFireFlower
  // - spawnPBalloon, spawnItemBox

  // HELPER SPAWNS (8 operations - MarioMod required)
  // - spawnYoshi, spawnBabyYoshi, spawnLakituCloud
  // - spawnBluePSwitch, spawnBeanstalk, spawnKey
  // - spawnSpringboard, spawnPSwitch

  // MARIOMOD BLOCK OPERATIONS (5 operations - MarioMod required)
  // - spawnKaizoBlock, spawnMuncher, spawnMuncherOnJump
  // - spawnCustomBlock, replaceRandomSprite

  // CHAOS/RANDOM (3 operations)
  // - spawnRandomEnemy, spawnBulletBillStorm, despawnFloorBlocks

  // PHYSICS MODIFIERS (4 operations - No patch required)
  // - moonJump, tinyJump, lowGravity, highGravity

  /* ========================================================================
   * OPERATION CATEGORIES OBJECT
   * For programmatic access to operation lists
   * ======================================================================== */
  hoellCCCategories: {
    environmental: ['setWaterMode', 'setLandMode', 'setWaterModeTimed', 'setIceMode', 'setDryMode', 'setIceModeTimed', 'freezePlayer', 'unfreezePlayer'],
    speed: ['kickRight', 'kickLeft', 'kickUp', 'pushRight', 'pushLeft'],
    silverPSwitch: ['activateSilverPSwitch', 'spawnSilverPSwitch'],
    enemySpawns: ['spawnGreenKoopa', 'spawnRedKoopa', 'spawnSpiny', 'spawnGoomba', 'spawnGreenParatroopa', 'spawnRedParatroopa', 'spawnBobOmb', 'spawnRex', 'spawnNinji', 'spawnParaGoomba', 'spawnLakitu', 'spawnMontyMole', 'spawnMagikoopa', 'spawnWiggler', 'spawnPiranhaPlant', 'spawnBulletBill', 'spawnHammerBro', 'spawnSumoBro', 'spawnThwomp', 'spawnBoo', 'spawnBigBoo', 'spawnBanzaiBill', 'spawnFishinBoo', 'spawnThwimp', 'spawnPokey', 'spawnDinoRhino', 'spawnDryBones', 'spawnBonyBeetle', 'spawnMagikoopa2', 'spawnReznor', 'spawnFishingLakitu', 'spawnSwooper', 'spawnChargingChuck', 'spawnClappingChuck', 'spawnSplittingChuck', 'spawnJumpingChuck', 'spawnKoopaKid', 'spawnHotHead', 'spawnMechaKoopa', 'spawnCheepCheep', 'spawnBlurp', 'spawnPorcupuffer', 'spawnBeachKoopa'],
    powerUpSpawns: ['spawnStar', 'spawnFeather', 'spawnFireFlower', 'spawnPBalloon', 'spawnItemBox'],
    helperSpawns: ['spawnYoshi', 'spawnBabyYoshi', 'spawnLakituCloud', 'spawnBluePSwitch', 'spawnBeanstalk', 'spawnKey', 'spawnSpringboard', 'spawnPSwitch'],
    marioModBlocks: ['spawnKaizoBlock', 'spawnMuncher', 'spawnMuncherOnJump', 'spawnCustomBlock', 'replaceRandomSprite'],
    chaos: ['spawnRandomEnemy', 'spawnBulletBillStorm', 'despawnFloorBlocks'],
    physics: ['moonJump', 'tinyJump', 'lowGravity', 'highGravity']
  },

  // Action Console Popup
  openActionConsolePopup: () => ipcRenderer.invoke('open-action-console-popup')
});

// Expose API for popup windows (action console, etc.)
contextBridge.exposeInMainWorld('electronAPI', {
  openActionConsolePopup: () => ipcRenderer.invoke('open-action-console-popup'),
  loadGiftMappings: () => ipcRenderer.invoke('load-gift-mappings'),
  executeGiftAction: (actionData) => ipcRenderer.invoke('execute-gift-action', actionData),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('set-always-on-top', enabled),
  onActionConsoleUpdate: (callback) => ipcRenderer.on('action-console-update', () => callback()),
  getActiveGifts: () => ipcRenderer.invoke('get-active-gifts'),
  getThresholdStatus: () => ipcRenderer.invoke('get-threshold-status'),
  onGiftActivity: (callback) => ipcRenderer.on('gift-activity', (event, data) => callback(data))
});