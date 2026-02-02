// Gift Settings Modal Handler

// ============= EVENT LISTENER CLEANUP SYSTEM =============
// Store references for cleanup to prevent memory leaks
const eventListeners = [];

function addManagedEventListener(element, event, handler, options) {
  if (!element) return;
  element.addEventListener(event, handler, options);
  eventListeners.push({ element, event, handler, options });
}

function cleanupEventListeners() {
  console.log(`[Gift Settings] Cleaning up ${eventListeners.length} event listeners`);
  eventListeners.forEach(({ element, event, handler, options }) => {
    try {
      element.removeEventListener(event, handler, options);
    } catch (error) {
      console.error('[Gift Settings] Failed to remove event listener:', error.message);
    }
  });
  eventListeners.length = 0;
}

// Add cleanup on window unload
window.addEventListener('beforeunload', cleanupEventListeners);

// ============= MODAL ELEMENTS =============
// Get modal elements
const modal = document.getElementById('gift-settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeBtn = document.querySelector('.modal-close');
const saveBtn = document.getElementById('save-gift-settings');
const saveDatabaseBtn = document.getElementById('save-gift-database');
const saveImagesBtn = document.getElementById('save-gift-images');
const cancelBtn = document.getElementById('cancel-gift-settings');
const resetDatabaseBtn = document.getElementById('reset-gift-database');

// Track selected gift names to prevent duplicates
let selectedGiftNames = new Set();

// Track gift name overrides
let giftNameOverrides = {};

// Track custom gifts
let customGifts = [];

// Track gift image overrides
let giftImageOverrides = {};

// Global storage for active and archived gifts data
window.allGiftsData = {
  active: {},
  archived: []
};

// Get gift name (with override applied)
function getGiftName(originalName, coinValue) {
  const key = `${coinValue}-${originalName}`;
  return giftNameOverrides[key] || originalName;
}

// Populate unified gift database with thumbnails and expandable image fields
async function populateGiftDatabase() {
  const container = document.getElementById('gift-database-list');
  container.innerHTML = '';

  // Load active gift images
  await loadActiveGiftImages();

  // Create flat list of all active gifts from active-gifts.json
  const allGifts = [];

  try {
    // Load from active-gifts.json (updated database)
    const result = await window.sniAPI.getActiveGifts();
    if (result && result.success && result.activeGifts && result.activeGifts.gifts) {
      // Store active gifts globally for mapping dropdowns
      window.allGiftsData.active = result.activeGifts.gifts;

      // OPTIMIZED: Use flatMap to avoid nested loops
      // activeGifts.gifts is organized by coin value
      const activeGifts = Object.entries(result.activeGifts.gifts).flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins), archived: false }))
      );
      allGifts.push(...activeGifts);
    } else if (typeof TIKTOK_GIFTS !== 'undefined') {
      // Fallback to hardcoded TIKTOK_GIFTS if active-gifts.json fails
      console.warn('Failed to load active-gifts.json, falling back to TIKTOK_GIFTS');
      window.allGiftsData.active = TIKTOK_GIFTS;
      // OPTIMIZED: Use flatMap to avoid nested loops
      const fallbackGifts = Object.entries(TIKTOK_GIFTS).flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins), archived: false }))
      );
      allGifts.push(...fallbackGifts);
    } else {
      container.innerHTML = '<p>Gift database not loaded</p>';
      return;
    }
  } catch (error) {
    console.error('Error loading active gifts:', error);
    // Fallback to TIKTOK_GIFTS
    if (typeof TIKTOK_GIFTS !== 'undefined') {
      window.allGiftsData.active = TIKTOK_GIFTS;
      // OPTIMIZED: Use flatMap to avoid nested loops
      const errorFallbackGifts = Object.entries(TIKTOK_GIFTS).flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins), archived: false }))
      );
      allGifts.push(...errorFallbackGifts);
    } else {
      container.innerHTML = '<p>Error loading gift database</p>';
      return;
    }
  }

  // Load and add archived gifts
  try {
    const archivedResult = await window.sniAPI.loadArchivedGifts();
    if (archivedResult && archivedResult.success && archivedResult.archivedGifts) {
      const archivedGifts = archivedResult.archivedGifts.gifts || [];
      // Store archived gifts globally for mapping dropdowns
      window.allGiftsData.archived = archivedGifts;

      archivedGifts.forEach(gift => {
        allGifts.push({
          name: gift.name,
          coins: gift.coins,
          archived: true
        });
      });
    }
  } catch (error) {
    console.error('Error loading archived gifts:', error);
  }

  // Sort by archived status (active first), then coin value, then name
  allGifts.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return a.coins - b.coins || a.name.localeCompare(b.name);
  });

  // Render each gift
  allGifts.forEach(gift => {
    const item = createUnifiedGiftItem(gift.name, gift.coins, gift.archived);
    container.appendChild(item);
  });

  // Set up search functionality
  setupGiftSearch();
}

// Create a unified gift item with 20x20 thumbnail and expandable details
function createUnifiedGiftItem(giftName, coins, archived = false) {
  const container = document.createElement('div');
  container.className = 'unified-gift-item';
  if (archived) {
    container.classList.add('archived-gift');
  }
  container.dataset.giftName = giftName;
  container.dataset.coins = coins;
  container.dataset.archived = archived;

  // Main row (clickable to expand)
  const mainRow = document.createElement('div');
  mainRow.className = 'gift-main-row';

  // Thumbnail (50x50px)
  const thumbnail = document.createElement('div');
  thumbnail.className = 'gift-thumbnail';
  const currentUrl = getCurrentImageUrl(giftName, coins);

  // Debug: Log first few images
  if (coins <= 5) {
    console.log(`[Image URL] ${giftName} (${coins}): ${currentUrl}`);
  }

  if (currentUrl) {
    const img = document.createElement('img');
    img.src = currentUrl;
    img.alt = giftName;
    img.title = `${giftName} (${coins} coins)`;

    // Debug: Log image load events
    img.onload = () => {
      if (coins <= 5) console.log(`[Image Loaded] ${giftName} (${coins})`);
    };
    img.onerror = (e) => {
      if (coins <= 5) console.error(`[Image Error] ${giftName} (${coins}):`, e);
    };

    thumbnail.appendChild(img);
  } else {
    thumbnail.innerHTML = '<span class="no-image-icon">📦</span>';
  }

  // Gift info
  const info = document.createElement('div');
  info.className = 'gift-info';

  const name = document.createElement('div');
  name.className = 'gift-name-display';
  name.textContent = getGiftName(giftName, coins);

  // Add archived badge if applicable
  if (archived) {
    const archivedBadge = document.createElement('span');
    archivedBadge.className = 'archived-badge';
    archivedBadge.textContent = 'ARCHIVED';
    archivedBadge.title = 'This gift is no longer active on TikTok';
    name.appendChild(document.createTextNode(' '));
    name.appendChild(archivedBadge);
  }

  const coinValue = document.createElement('div');
  coinValue.className = 'gift-coins-display';
  coinValue.textContent = `${coins} 💰`;

  info.appendChild(name);
  info.appendChild(coinValue);

  // Expand indicator
  const expandBtn = document.createElement('span');
  expandBtn.className = 'expand-indicator';
  expandBtn.textContent = '▶';

  mainRow.appendChild(thumbnail);
  mainRow.appendChild(info);
  mainRow.appendChild(expandBtn);

  // Details panel (expandable)
  const details = document.createElement('div');
  details.className = 'gift-details';
  details.style.display = 'none';

  // Name editor
  const nameGroup = document.createElement('div');
  nameGroup.className = 'detail-group';
  nameGroup.innerHTML = `
    <label>Gift Name:</label>
    <input type="text" class="gift-name-input" value="${getGiftName(giftName, coins)}"
           data-original-name="${giftName}" data-coins="${coins}">
  `;

  // Image URL editor
  const imageGroup = document.createElement('div');
  imageGroup.className = 'detail-group';
  const key = `${coins}-${giftName}`;
  const currentOverride = giftImageOverrides[key] || '';
  imageGroup.innerHTML = `
    <label>Image URL:</label>
    <div class="image-url-row">
      <input type="text" class="gift-image-url-input" value="${currentOverride}"
             data-gift-name="${giftName}" data-coins="${coins}"
             placeholder="${currentUrl || 'No image URL available'}">
      <button class="download-image-btn" data-gift-name="${giftName}" data-coins="${coins}">⬇ Download</button>
    </div>
    <div class="url-hint">Current: ${currentUrl ? currentUrl.substring(0, 50) + '...' : 'None'}</div>
  `;

  // Add download button event listener
  const downloadBtn = imageGroup.querySelector('.download-image-btn');
  addManagedEventListener(downloadBtn, 'click', async (e) => {
    e.stopPropagation(); // Prevent row expansion
    const urlInput = imageGroup.querySelector('.gift-image-url-input');
    const url = urlInput.value.trim();

    if (!url) {
      alert('Please enter an image URL first');
      return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Downloading...';

    try {
      const result = await window.sniAPI.downloadSingleGiftImage(giftName, coins, url);

      if (result.success) {
        downloadBtn.textContent = '✅ Downloaded!';

        // Reload the gift database to show the new image
        await loadActiveGiftImages();

        // Update the thumbnail image
        const img = thumbnail.querySelector('img');
        if (img) {
          const newUrl = getCurrentImageUrl(giftName, coins);
          img.src = newUrl;
        }

        setTimeout(() => {
          downloadBtn.textContent = '⬇ Download';
          downloadBtn.disabled = false;
        }, 2000);
      } else {
        downloadBtn.textContent = '❌ Failed';
        alert('Download failed: ' + result.error);
        setTimeout(() => {
          downloadBtn.textContent = '⬇ Download';
          downloadBtn.disabled = false;
        }, 2000);
      }
    } catch (error) {
      downloadBtn.textContent = '❌ Error';
      alert('Error: ' + error.message);
      setTimeout(() => {
        downloadBtn.textContent = '⬇ Download';
        downloadBtn.disabled = false;
      }, 2000);
    }
  });

  details.appendChild(nameGroup);
  details.appendChild(imageGroup);

  // Click to expand/collapse
  addManagedEventListener(mainRow, 'click', () => {
    const isExpanded = details.style.display !== 'none';
    details.style.display = isExpanded ? 'none' : 'block';
    expandBtn.textContent = isExpanded ? '▶' : '▼';
    container.classList.toggle('expanded', !isExpanded);
  });

  container.appendChild(mainRow);
  container.appendChild(details);

  return container;
}

// Setup gift search functionality
function setupGiftSearch() {
  const searchInput = document.getElementById('gift-search');
  if (!searchInput) return;

  addManagedEventListener(searchInput, 'input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.unified-gift-item');

    items.forEach(item => {
      const name = item.dataset.giftName.toLowerCase();
      const coins = item.dataset.coins;
      const matches = name.includes(searchTerm) || coins.includes(searchTerm);
      item.style.display = matches ? 'block' : 'none';
    });
  });
}

// Load gift name overrides
async function loadGiftNameOverrides() {
  try {
    const result = await window.sniAPI.loadGiftNameOverrides();
    if (result.success && result.overrides) {
      giftNameOverrides = result.overrides;
    }
  } catch (error) {
    console.error('Error loading gift name overrides:', error);
  }
}

// Load custom gifts
async function loadCustomGifts() {
  try {
    const result = await window.sniAPI.loadCustomGifts();
    if (result.success && result.customGifts) {
      customGifts = result.customGifts;
      // Add custom gifts to TIKTOK_GIFTS dynamically
      customGifts.forEach(gift => {
        if (!TIKTOK_GIFTS[gift.coins]) {
          TIKTOK_GIFTS[gift.coins] = [];
        }
        if (!TIKTOK_GIFTS[gift.coins].includes(gift.name)) {
          TIKTOK_GIFTS[gift.coins].push(gift.name);
        }
        // Add custom image if provided
        if (gift.imageUrl && typeof addCustomGiftImage !== 'undefined') {
          addCustomGiftImage(gift.name, gift.coins, gift.imageUrl);
        }
      });
      displayCustomGifts();
    }
  } catch (error) {
    console.error('Error loading custom gifts:', error);
  }
}

// Save custom gifts
async function saveCustomGifts() {
  try {
    const result = await window.sniAPI.saveCustomGifts(customGifts);
    return result;
  } catch (error) {
    console.error('Error saving custom gifts:', error);
    return { success: false, error: error.message };
  }
}

// Display custom gifts in the list
// OPTIMIZED: Uses DocumentFragment to batch DOM updates
function displayCustomGifts() {
  const container = document.getElementById('custom-gifts-list');
  if (!container) return;

  if (customGifts.length === 0) {
    container.innerHTML = '<p class="no-custom-gifts">No custom gifts added yet.</p>';
    return;
  }

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  customGifts.forEach((gift, index) => {
    const chip = document.createElement('div');
    chip.className = 'custom-gift-chip';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'custom-gift-name';
    nameSpan.textContent = `${gift.name} (${gift.coins} 💰)`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-custom';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove custom gift';
    removeBtn.dataset.index = index;

    chip.appendChild(nameSpan);
    chip.appendChild(removeBtn);
    fragment.appendChild(chip);
  });

  container.appendChild(fragment);
}

// Add custom gift
async function addCustomGift() {
  const nameInput = document.getElementById('custom-gift-name');
  const coinsInput = document.getElementById('custom-gift-coins');
  const imageInput = document.getElementById('custom-gift-image');

  const name = nameInput.value.trim();
  const coins = parseInt(coinsInput.value);
  const imageUrl = imageInput.value.trim();

  // Validation
  if (!name) {
    log('Gift name is required', 'error');
    return;
  }

  if (!coins || coins < 1 || coins > 50000) {
    log('Coin value must be between 1 and 50,000', 'error');
    return;
  }

  // Check if gift already exists
  const exists = customGifts.some(g => g.name === name && g.coins === coins);
  if (exists) {
    log('This custom gift already exists', 'error');
    return;
  }

  // Add to custom gifts array
  const newGift = { name, coins };
  if (imageUrl) {
    newGift.imageUrl = imageUrl;
  }
  customGifts.push(newGift);

  // Add to TIKTOK_GIFTS dynamically
  if (!TIKTOK_GIFTS[coins]) {
    TIKTOK_GIFTS[coins] = [];
  }
  if (!TIKTOK_GIFTS[coins].includes(name)) {
    TIKTOK_GIFTS[coins].push(name);
  }

  // Add custom image if provided
  if (imageUrl && typeof addCustomGiftImage !== 'undefined') {
    addCustomGiftImage(name, coins, imageUrl);
  }

  // Save to file
  const result = await saveCustomGifts();
  if (result.success) {
    log(`Custom gift "${name}" added successfully!`, 'success');
    displayCustomGifts();

    // Clear form
    nameInput.value = '';
    coinsInput.value = '';
    imageInput.value = '';

    // Refresh coin ranges if needed (in case new coin value added)
    if (typeof updateCoinRanges === 'function') {
      updateCoinRanges();
    }
  } else {
    log(`Failed to save custom gift: ${result.error}`, 'error');
  }
}

// Remove custom gift
async function removeCustomGift(index) {
  if (index < 0 || index >= customGifts.length) return;

  const gift = customGifts[index];
  const confirmMsg = `Remove custom gift "${gift.name}" (${gift.coins} coins)?`;

  if (!confirm(confirmMsg)) return;

  // Remove from array
  customGifts.splice(index, 1);

  // Remove from TIKTOK_GIFTS (only if it's not in the original database)
  if (TIKTOK_GIFTS[gift.coins]) {
    const giftIndex = TIKTOK_GIFTS[gift.coins].indexOf(gift.name);
    if (giftIndex > -1) {
      TIKTOK_GIFTS[gift.coins].splice(giftIndex, 1);
      // If no gifts left for this coin value, remove the coin value
      if (TIKTOK_GIFTS[gift.coins].length === 0) {
        delete TIKTOK_GIFTS[gift.coins];
      }
    }
  }

  // Save to file
  const result = await saveCustomGifts();
  if (result.success) {
    log(`Custom gift "${gift.name}" removed successfully!`, 'success');
    displayCustomGifts();

    // Refresh gift database view if open
    if (document.getElementById('tab-database').classList.contains('active')) {
      populateGiftDatabase();
    }
  } else {
    log(`Failed to save changes: ${result.error}`, 'error');
  }
}

// Save gift database
addManagedEventListener(saveDatabaseBtn, 'click', async () => {
  try {
    const nameOverrides = {};
    const nameChanges = {}; // Track original->new name mappings
    const imageOverrides = {};

    // Get all name inputs
    const nameInputs = document.querySelectorAll('.gift-name-input');
    nameInputs.forEach(input => {
      const originalName = input.dataset.originalName;
      const coins = input.dataset.coins;
      const newName = input.value.trim();

      if (newName && newName !== originalName) {
        const key = `${coins}-${originalName}`;
        nameOverrides[key] = newName;
        nameChanges[originalName] = newName;
      }
    });

    // Get all image URL inputs
    const imageInputs = document.querySelectorAll('.gift-image-url-input');
    imageInputs.forEach(input => {
      const giftName = input.dataset.giftName;
      const coins = input.dataset.coins;
      const url = input.value.trim();
      const key = `${coins}-${giftName}`;

      if (url) {
        imageOverrides[key] = url;
        // Update runtime image registry
        if (typeof addCustomGiftImage !== 'undefined') {
          addCustomGiftImage(giftName, parseInt(coins), url);
        }
      }
    });

    // Save both name and image overrides
    const [nameResult, imageResult] = await Promise.all([
      window.sniAPI.saveGiftNameOverrides(nameOverrides),
      window.sniAPI.saveGiftImageOverrides(imageOverrides)
    ]);

    if (nameResult.success && imageResult.success) {
      giftNameOverrides = nameOverrides;
      giftImageOverrides = imageOverrides;

      // Update existing gift mappings with new names
      if (Object.keys(nameChanges).length > 0) {
        await updateMappingsWithNewNames(nameChanges);
      }

      const totalSaved = Object.keys(nameOverrides).length + Object.keys(imageOverrides).length;
      log(`Saved ${Object.keys(nameOverrides).length} name(s) and ${Object.keys(imageOverrides).length} image(s)!`, 'success');

      // Reload the gift dropdowns to apply changes
      if (document.querySelectorAll('.gift-select').length > 0) {
        convertInputsToSelects();
        loadGiftSettings();
      }
    } else {
      const errors = [];
      if (!nameResult.success) errors.push(`Names: ${nameResult.error}`);
      if (!imageResult.success) errors.push(`Images: ${imageResult.error}`);
      log(`Failed to save: ${errors.join('; ')}`, 'error');
    }
  } catch (error) {
    log(`Error saving gift database: ${error.message}`, 'error');
  }
});

// Update gift mappings when gift names change
async function updateMappingsWithNewNames(nameChanges) {
  try {
    const result = await window.sniAPI.loadGiftMappings();
    if (!result.success || !result.mappings) return;

    let updatedCount = 0;
    const updatedMappings = {};

    // Go through existing mappings and update gift names
    Object.entries(result.mappings).forEach(([oldGiftName, mapping]) => {
      // Check if this gift name was changed
      const newGiftName = nameChanges[oldGiftName];

      if (newGiftName) {
        // Use the new name as the key
        updatedMappings[newGiftName] = mapping;
        updatedCount++;
        log(`Updated mapping: "${oldGiftName}" → "${newGiftName}"`, 'info');
      } else {
        // Keep existing mapping unchanged
        updatedMappings[oldGiftName] = mapping;
      }
    });

    if (updatedCount > 0) {
      // Save the updated mappings
      const saveResult = await window.sniAPI.saveGiftMappings(updatedMappings);
      if (saveResult.success) {
        log(`✅ Updated ${updatedCount} gift mapping(s) with new names`, 'success');
        await window.sniAPI.reloadGiftMappings();
      }
    }
  } catch (error) {
    console.error('Error updating mappings:', error);
    log(`⚠️ Failed to update some mappings: ${error.message}`, 'warning');
  }
}

// Reset gift database
addManagedEventListener(resetDatabaseBtn, 'click', async () => {
  if (!confirm('Reset all gift names to defaults? This will remove all your custom edits.')) {
    return;
  }

  try {
    const result = await window.sniAPI.saveGiftNameOverrides({});
    if (result.success) {
      giftNameOverrides = {};
      populateGiftDatabase();
      log('Gift database reset to defaults!', 'success');

      // Reload the gift dropdowns
      if (document.querySelectorAll('.gift-select').length > 0) {
        convertInputsToSelects();
        loadGiftSettings();
      }
    }
  } catch (error) {
    log(`Error resetting database: ${error.message}`, 'error');
  }
});

// Generate coin range dropdown options
// OPTIMIZED: Uses array join instead of string concatenation
function generateCoinValueOptions() {
  const options = ['<option value="">Select coin range...</option>'];
  if (typeof COIN_RANGES !== 'undefined') {
    COIN_RANGES.forEach(range => {
      options.push(`<option value="${range.min}-${range.max}">${range.label}</option>`);
    });
  }
  return options.join('');
}

// Get all gifts within a coin range from active and archived data
// OPTIMIZED: Uses flatMap and filter for better performance
function getGiftsForCoinRangeLive(minCoins, maxCoins) {
  const gifts = [];

  // Add active gifts
  if (window.allGiftsData.active && Object.keys(window.allGiftsData.active).length > 0) {
    const activeGifts = Object.entries(window.allGiftsData.active)
      .filter(([coins]) => {
        const coinValue = parseInt(coins);
        return coinValue >= minCoins && coinValue <= maxCoins;
      })
      .flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins), archived: false }))
      );
    gifts.push(...activeGifts);
  } else if (typeof TIKTOK_GIFTS !== 'undefined') {
    // Fallback to hardcoded TIKTOK_GIFTS
    const fallbackGifts = Object.entries(TIKTOK_GIFTS)
      .filter(([coins]) => {
        const coinValue = parseInt(coins);
        return coinValue >= minCoins && coinValue <= maxCoins;
      })
      .flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins), archived: false }))
      );
    gifts.push(...fallbackGifts);
  }

  // Add archived gifts
  if (window.allGiftsData.archived && window.allGiftsData.archived.length > 0) {
    const archivedGifts = window.allGiftsData.archived
      .filter(gift => gift.coins >= minCoins && gift.coins <= maxCoins)
      .map(gift => ({ name: gift.name, coins: gift.coins, archived: true }));
    gifts.push(...archivedGifts);
  }

  // Sort by archived status (active first), then coin value, then name
  return gifts.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return a.coins - b.coins || a.name.localeCompare(b.name);
  });
}

// Generate gift options for a coin range (with overrides applied)
// OPTIMIZED: Uses array join instead of string concatenation for better performance
function generateGiftOptionsForCoinValue(rangeValue, selectedGift = '') {
  const options = ['<option value="">Select a gift...</option>'];

  if (rangeValue) {
    // Parse range value (e.g., "1-5" or "1001-2000")
    const [minStr, maxStr] = rangeValue.split('-');
    const min = parseInt(minStr);
    const max = parseInt(maxStr);

    if (!isNaN(min) && !isNaN(max)) {
      const giftsWithCoins = getGiftsForCoinRangeLive(min, max);
      if (giftsWithCoins && giftsWithCoins.length > 0) {
        giftsWithCoins.forEach(giftObj => {
          // Apply name override if exists
          const displayName = getGiftName(giftObj.name, giftObj.coins);
          const selected = giftObj.name === selectedGift ? 'selected' : '';
          const archivedLabel = giftObj.archived ? ' [ARCHIVED]' : '';
          const archivedClass = giftObj.archived ? 'class="archived-option"' : '';
          options.push(`<option value="${giftObj.name}" ${selected} ${archivedClass}>${displayName} (${giftObj.coins})${archivedLabel}</option>`);
        });
      }
    }
  }

  return options.join('');
}

// Convert text inputs to cascading dropdown system
function convertInputsToSelects() {
  const inputs = document.querySelectorAll('.gift-input');
  inputs.forEach(input => {
    const actionItem = input.closest('.action-item');
    const hasDuration = actionItem && actionItem.classList.contains('action-item-with-duration');

    // Create container for both dropdowns
    const container = document.createElement('div');
    container.className = 'gift-dropdown-container';
    container.style.display = 'flex';
    container.style.gap = '10px';
    container.style.flexDirection = 'column';

    // Create coin value dropdown
    const coinSelect = document.createElement('select');
    coinSelect.className = 'coin-select';
    coinSelect.innerHTML = generateCoinValueOptions();

    // Create gift dropdown (initially empty)
    const giftSelect = document.createElement('select');
    giftSelect.className = 'gift-select';
    giftSelect.innerHTML = '<option value="">Select coin value first...</option>';
    giftSelect.disabled = true;

    // Copy data attributes to gift select
    giftSelect.dataset.action = input.dataset.action;
    if (input.dataset.params) giftSelect.dataset.params = input.dataset.params;
    if (input.dataset.item) giftSelect.dataset.item = input.dataset.item;
    if (input.dataset.enemy) giftSelect.dataset.enemy = input.dataset.enemy;
    if (input.dataset.value) giftSelect.dataset.value = input.dataset.value;
    if (input.dataset.dungeon) giftSelect.dataset.dungeon = input.dataset.dungeon;

    // Store reference to paired gift select
    coinSelect.dataset.pairedGiftSelect = Date.now() + Math.random();
    giftSelect.dataset.pairedSelectId = coinSelect.dataset.pairedGiftSelect;

    // Add both to container
    container.appendChild(coinSelect);
    container.appendChild(giftSelect);

    // For items with duration inputs, we need to preserve the grid layout
    if (hasDuration) {
      // Find the duration input (should be next sibling)
      const durationInput = actionItem.querySelector('.duration-input');

      // Replace input with container
      input.parentNode.replaceChild(container, input);

      // Make sure duration input is still visible and in the right place
      // It should already be in the grid as the third column
    } else {
      // Replace input with container
      input.parentNode.replaceChild(container, input);
    }
  });
}

// Handle coin value selection
addManagedEventListener(document, 'change', (e) => {
  if (e.target.classList.contains('coin-select')) {
    const coinSelect = e.target;
    const coinValue = coinSelect.value;
    const pairedId = coinSelect.dataset.pairedGiftSelect;
    const giftSelect = document.querySelector(`.gift-select[data-paired-select-id="${pairedId}"]`);

    if (giftSelect) {
      if (coinValue) {
        // Populate gift dropdown with gifts for this coin value
        giftSelect.innerHTML = generateGiftOptionsForCoinValue(coinValue);
        giftSelect.disabled = false;
      } else {
        // Reset gift dropdown
        giftSelect.innerHTML = '<option value="">Select coin value first...</option>';
        giftSelect.disabled = true;
      }
    }
  }
});

// Tab switching
// Event handlers for gift settings actions
addManagedEventListener(document, 'click', (e) => {
  // Handle Add Custom Gift button
  if (e.target.id === 'add-custom-gift') {
    addCustomGift();
  }

  // Handle Remove Custom Gift button
  if (e.target.classList.contains('btn-remove-custom')) {
    const index = parseInt(e.target.dataset.index);
    removeCustomGift(index);
  }

  // Handle Generate Overlay button
  if (e.target.id === 'generate-overlay') {
    generateOverlay();
  }

  // Handle Browse Overlay Path button
  if (e.target.id === 'browse-overlay-path') {
    browseOverlayPath();
  }

  // Handle Reset Overlay Path button
  if (e.target.id === 'reset-overlay-path') {
    resetOverlayPath();
  }
});

// Function to open modal
function openGiftSettings() {
  // Convert inputs to selects if not already done
  if (document.querySelectorAll('.gift-select').length === 0) {
    convertInputsToSelects();
  }
  loadGiftSettings();
  loadGiftNameOverrides();
  loadCustomGifts();
  loadGiftImageOverrides();

  // Initialize collapsible categories (only once)
  if (!document.querySelector('.category-header')) {
    setTimeout(() => initializeCollapsibleCategories(), 100);
  }
  // modal.style.display = 'block'; // No longer needed - using tabs
}

// Modal open/close handlers no longer needed - using tabs
// Open modal from button
// if (settingsBtn) {
//   settingsBtn.addEventListener('click', openGiftSettings);
// }

// Open modal from menu
// const menuGiftSettings = document.getElementById('menu-gift-settings');
// if (menuGiftSettings) {
//   menuGiftSettings.addEventListener('click', openGiftSettings);
// }

// Close modal handlers
// closeBtn.addEventListener('click', () => {
//   modal.style.display = 'none';
// });

// cancelBtn.addEventListener('click', () => {
//   modal.style.display = 'none';
// });

// Close on outside click
// window.addEventListener('click', (e) => {
//   if (e.target === modal) {
//     modal.style.display = 'none';
//   }
// });

// Close on Escape key
// document.addEventListener('keydown', (e) => {
//   if (e.key === 'Escape' && modal.style.display === 'block') {
//     modal.style.display = 'none';
//   }
// });

// Update all gift dropdowns to show/hide options based on selected gifts
function updateAllGiftDropdowns() {
  const allSelects = document.querySelectorAll('.gift-select');
  allSelects.forEach(select => {
    const currentValue = select.value;
    const options = select.querySelectorAll('option');

    options.forEach(option => {
      if (option.value === '') {
        // Always show "Select a gift..." option
        option.disabled = false;
        option.style.display = '';
      } else if (option.value === currentValue) {
        // Always show currently selected value
        option.disabled = false;
        option.style.display = '';
      } else if (selectedGiftNames.has(option.value)) {
        // Hide/disable gifts selected in other dropdowns
        option.disabled = true;
        option.style.display = 'none';
      } else {
        // Show available gifts
        option.disabled = false;
        option.style.display = '';
      }
    });
  });
}

// Find coin value for a gift name
function findCoinValueForGift(giftName) {
  if (typeof TIKTOK_GIFTS === 'undefined') return null;
  for (const [coinValue, gifts] of Object.entries(TIKTOK_GIFTS)) {
    if (gifts.includes(giftName)) {
      return parseInt(coinValue);
    }
  }
  return null;
}

// Find the coin range for a specific coin value
function findRangeForCoinValue(coinValue) {
  if (typeof COIN_RANGES === 'undefined') return null;
  for (const range of COIN_RANGES) {
    if (coinValue >= range.min && coinValue <= range.max) {
      return `${range.min}-${range.max}`;
    }
  }
  return null;
}

// Load existing gift settings
async function loadGiftSettings() {
  try {
    selectedGiftNames.clear();
    const result = await window.sniAPI.loadGiftMappings();
    if (result.success && result.mappings) {
      // Populate the cascading dropdowns with existing mappings
      Object.entries(result.mappings).forEach(([giftName, mapping]) => {
        const action = mapping.action;
        selectedGiftNames.add(giftName);

        // Find the coin value for this gift
        const coinValue = findCoinValueForGift(giftName);
        // Find the range that contains this coin value
        const rangeValue = coinValue ? findRangeForCoinValue(coinValue) : null;

        // Special handling for disableItem actions (with duration)
        if (action === 'disableItem' && mapping.params && mapping.params.itemName) {
          const itemName = mapping.params.itemName;
          const duration = mapping.params.duration;

          // Find gift select by action and item name
          const giftSelect = document.querySelector(`.gift-select[data-action="disableItem"][data-item="${itemName}"]`);
          if (giftSelect && rangeValue) {
            // Find and set the paired coin select
            const pairedId = giftSelect.dataset.pairedSelectId;
            const coinSelect = document.querySelector(`.coin-select[data-paired-gift-select="${pairedId}"]`);
            if (coinSelect) {
              coinSelect.value = rangeValue;
              // Populate gift dropdown with gifts in this range
              giftSelect.innerHTML = generateGiftOptionsForCoinValue(rangeValue, giftName);
              giftSelect.disabled = false;
              giftSelect.value = giftName;
            }

            // Also set the duration input
            const durationInput = document.querySelector(`.duration-input[data-item="${itemName}"]`);
            if (durationInput && duration) {
              durationInput.value = duration;
            }
          }
        } else if (action === 'triggerChickenAttack' || action === 'triggerEnemyWaves' || action === 'triggerBeeSwarmWaves' || action === 'makeEnemiesInvisible') {
          // Special handling for timed event actions (with duration)
          const duration = mapping.params && mapping.params.duration;
          const giftSelect = document.querySelector(`.gift-select[data-action="${action}"]`);
          if (giftSelect && rangeValue) {
            // Find and set the paired coin select
            const pairedId = giftSelect.dataset.pairedSelectId;
            const coinSelect = document.querySelector(`.coin-select[data-paired-gift-select="${pairedId}"]`);
            if (coinSelect) {
              coinSelect.value = rangeValue;
              // Populate gift dropdown with gifts in this range
              giftSelect.innerHTML = generateGiftOptionsForCoinValue(rangeValue, giftName);
              giftSelect.disabled = false;
              giftSelect.value = giftName;
            }

            // Also set the duration input
            const durationInput = document.querySelector(`.duration-input[data-action="${action}"]`);
            if (durationInput && duration) {
              durationInput.value = duration;
            }
          }
        } else {
          // Standard handling for other actions
          const paramsStr = mapping.params ? JSON.stringify(mapping.params) : '';
          const giftSelect = document.querySelector(`.gift-select[data-action="${action}"]`);
          if (giftSelect && rangeValue) {
            // Check if params match (for actions with parameters)
            const selectParams = giftSelect.dataset.params;
            if (!selectParams || selectParams === paramsStr) {
              // Find and set the paired coin select
              const pairedId = giftSelect.dataset.pairedSelectId;
              const coinSelect = document.querySelector(`.coin-select[data-paired-gift-select="${pairedId}"]`);
              if (coinSelect) {
                coinSelect.value = rangeValue;
                // Populate gift dropdown with gifts in this range
                giftSelect.innerHTML = generateGiftOptionsForCoinValue(rangeValue, giftName);
                giftSelect.disabled = false;
                giftSelect.value = giftName;
              }
            }
          }
        }
      });
      updateAllGiftDropdowns();
      log('Gift settings loaded', 'info');

      // Check for archived gift mappings
      setTimeout(() => {
        checkMappingsForArchivedGifts();
      }, 500);
    }
  } catch (error) {
    log(`Error loading gift settings: ${error.message}`, 'error');
  }
}

// Handle gift selection change
addManagedEventListener(document, 'change', (e) => {
  if (e.target.classList.contains('gift-select')) {
    const select = e.target;
    const oldValue = select.dataset.previousValue || '';
    const newValue = select.value;

    // Check if this gift is already mapped to another action
    if (newValue && oldValue !== newValue && selectedGiftNames.has(newValue)) {
      // Find which action it's mapped to
      const otherMapping = findMappingForGift(newValue, select);
      if (otherMapping) {
        const confirmed = confirm(
          `⚠️ "${newValue}" is already mapped to:\n"${otherMapping}"\n\n` +
          `Do you want to remove the old mapping and use it here instead?`
        );

        if (!confirmed) {
          // Revert to old value
          select.value = oldValue;
          return;
        } else {
          // Remove old mapping
          removeOtherMapping(newValue, select);
        }
      }
    }

    // Update selected gifts set
    if (oldValue) {
      selectedGiftNames.delete(oldValue);
    }
    if (newValue) {
      selectedGiftNames.add(newValue);
    }

    // Store new value for next change
    select.dataset.previousValue = newValue;

    // Update all dropdowns to reflect the change
    updateAllGiftDropdowns();
  }
});

// Find which action a gift is currently mapped to
function findMappingForGift(giftName, excludeSelect) {
  const allSelects = document.querySelectorAll('.gift-select');
  for (const select of allSelects) {
    if (select === excludeSelect) continue;
    if (select.value === giftName) {
      const actionItem = select.closest('.action-item');
      if (actionItem) {
        const actionName = actionItem.querySelector('.action-name');
        return actionName ? actionName.textContent : 'Unknown Action';
      }
    }
  }
  return null;
}

// Remove a gift from another mapping
function removeOtherMapping(giftName, excludeSelect) {
  const allSelects = document.querySelectorAll('.gift-select');
  for (const select of allSelects) {
    if (select === excludeSelect) continue;
    if (select.value === giftName) {
      // Remove from this mapping
      selectedGiftNames.delete(giftName);
      select.value = '';
      select.dataset.previousValue = '';

      // Also reset the paired coin select
      const pairedId = select.dataset.pairedSelectId;
      const coinSelect = document.querySelector(`.coin-select[data-paired-gift-select="${pairedId}"]`);
      if (coinSelect) {
        coinSelect.value = '';
        select.innerHTML = '<option value="">Select coin value first...</option>';
        select.disabled = true;
      }
    }
  }
}

// Reset all gift mappings
const resetAllMappingsBtn = document.getElementById('reset-all-gift-mappings');
if (resetAllMappingsBtn) {
  addManagedEventListener(resetAllMappingsBtn, 'click', async () => {
    if (!confirm('Are you sure you want to clear ALL gift mappings? This cannot be undone.')) {
      return;
    }

    try {
      // Clear all gift select dropdowns
      const allGiftSelects = document.querySelectorAll('.gift-select');
      allGiftSelects.forEach(select => {
        const oldValue = select.value;
        if (oldValue) {
          selectedGiftNames.delete(oldValue);
        }
        select.value = '';
        select.dataset.previousValue = '';
      });

      // Clear all paired coin selects and disable gift selects
      const allCoinSelects = document.querySelectorAll('.coin-select');
      allCoinSelects.forEach(coinSelect => {
        coinSelect.value = '';
        const pairedId = coinSelect.dataset.pairedGiftSelect;
        const giftSelect = document.querySelector(`.gift-select[data-paired-select-id="${pairedId}"]`);
        if (giftSelect) {
          giftSelect.innerHTML = '<option value="">Select coin value first...</option>';
          giftSelect.disabled = true;
        }
      });

      // Clear all duration inputs
      const allDurationInputs = document.querySelectorAll('.duration-input');
      allDurationInputs.forEach(input => {
        input.value = input.defaultValue || 60;
      });

      // Update all dropdowns
      updateAllGiftDropdowns();

      // Save the empty mappings
      const result = await window.sniAPI.saveGiftMappings({});
      if (result.success) {
        log('All gift mappings cleared!', 'success');
        await window.sniAPI.reloadGiftMappings();

        // Force refresh overlay builder to reflect changes
        if (typeof populateOverlayGiftSelection === 'function') {
          await populateOverlayGiftSelection(true); // true = force refresh
        }
      } else {
        log(`Failed to clear mappings: ${result.error}`, 'error');
      }
    } catch (error) {
      log(`Error clearing gift mappings: ${error.message}`, 'error');
    }
  });
}

// Save gift settings
addManagedEventListener(saveBtn, 'click', async () => {
  try {
    const mappings = {};

    // Collect all filled dropdowns
    const selects = document.querySelectorAll('.gift-select');
    selects.forEach(select => {
      const giftName = select.value.trim();
      if (giftName) {
        const action = select.dataset.action;

        // Extract emoji from description text
        const actionItem = select.closest('.action-item');
        const descriptionText = actionItem.querySelector('.action-name').textContent;
        const emojiMatch = descriptionText.match(/^([\u{1F000}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/u);
        const emoji = emojiMatch ? emojiMatch[0] : '🎁';

        // Build mapping object
        const mapping = {
          action: action,
          emoji: emoji,
          description: descriptionText
        };

        // Special handling for disableItem actions (with duration input)
        if (action === 'disableItem') {
          const itemName = select.dataset.item;
          const durationInput = document.querySelector(`.duration-input[data-item="${itemName}"]`);
          const duration = durationInput ? parseInt(durationInput.value) : 60;

          mapping.params = {
            itemName: itemName,
            duration: duration
          };
        } else if (action === 'triggerChickenAttack' || action === 'triggerEnemyWaves' || action === 'triggerBeeSwarmWaves' || action === 'makeEnemiesInvisible') {
          // Special handling for timed event actions (with duration input)
          const durationInput = document.querySelector(`.duration-input[data-action="${action}"]`);
          const duration = durationInput ? parseInt(durationInput.value) : 60;

          mapping.params = {
            duration: duration
          };
        } else {
          // Standard param handling for other actions
          const paramsStr = select.dataset.params;
          if (paramsStr) {
            try {
              mapping.params = JSON.parse(paramsStr);
            } catch (e) {
              console.error('Error parsing params:', paramsStr, e);
            }
          }
        }

        mappings[giftName] = mapping;
      }
    });

    // Save to backend
    const result = await window.sniAPI.saveGiftMappings(mappings);
    if (result.success) {
      log(`Saved ${Object.keys(mappings).length} gift mappings!`, 'success');
      // modal.style.display = 'none'; // No longer needed - using tabs

      // Reload the poller with new mappings
      await window.sniAPI.reloadGiftMappings();
      log('Gift mappings reloaded in poller', 'success');

      // Refresh overlay builder if gift list changed
      if (typeof populateOverlayGiftSelection === 'function') {
        await populateOverlayGiftSelection(); // Don't force refresh - only update if gift list changed
      }

      // Refresh action console to show updated mappings
      if (typeof populateActionConsole === 'function') {
        await populateActionConsole();
      }
    } else {
      log(`Failed to save: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error saving gift settings: ${error.message}`, 'error');
  }
});

// ============= GIFT IMAGE DOWNLOAD =============

// Download all gift images button handler
const downloadAllImagesBtn = document.getElementById('download-all-images');
if (downloadAllImagesBtn) {
  addManagedEventListener(downloadAllImagesBtn, 'click', async () => {
    const progressDiv = document.getElementById('download-progress');
    const statusSpan = document.getElementById('download-status');
    const countSpan = document.getElementById('download-count');
    const progressBar = document.getElementById('download-progress-bar');
    const currentDiv = document.getElementById('download-current');

    // Disable button and show progress
    downloadAllImagesBtn.disabled = true;
    downloadAllImagesBtn.textContent = '⏳ Downloading...';
    progressDiv.style.display = 'block';
    statusSpan.textContent = 'Initializing download...';
    countSpan.textContent = '0 / ?';
    progressBar.style.width = '0%';

    try {
      // Start download
      const result = await window.sniAPI.downloadAllGiftImages();

      if (result.success) {
        statusSpan.textContent = '✅ Download Complete!';
        countSpan.textContent = `${result.downloaded} / ${result.total}`;
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #10b981, #059669)';

        if (result.failed > 0) {
          log(`Downloaded ${result.downloaded} images, ${result.failed} failed`, 'warning');
          currentDiv.textContent = `⚠️ ${result.failed} images failed to download. They will use CDN fallback.`;
        } else {
          log(`Successfully downloaded all ${result.downloaded} images!`, 'success');
          currentDiv.textContent = `📁 Images saved to app data directory`;
        }

        // Refresh the gift database to show downloaded images
        log('Refreshing gift images display...', 'info');
        await populateGiftDatabase();
        log('Gift images display updated!', 'success');

        // Re-enable button after a delay
        setTimeout(() => {
          downloadAllImagesBtn.disabled = false;
          downloadAllImagesBtn.textContent = '✅ Re-download Images';
          progressDiv.style.display = 'none';
        }, 5000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      statusSpan.textContent = '❌ Download Failed';
      progressBar.style.background = '#ef4444';
      currentDiv.textContent = `Error: ${error.message}`;
      log(`Failed to download images: ${error.message}`, 'error');

      // Re-enable button
      downloadAllImagesBtn.disabled = false;
      downloadAllImagesBtn.textContent = '🖼️ Download All Images (331 files)';

      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 5000);
    }
  });
}

// Listen for download progress updates
window.sniAPI.onImageDownloadProgress((data) => {
  const countSpan = document.getElementById('download-count');
  const progressBar = document.getElementById('download-progress-bar');
  const currentDiv = document.getElementById('download-current');

  if (data.status === 'downloading') {
    countSpan.textContent = `${data.current} / ${data.total}`;
    currentDiv.textContent = `Downloading: ${data.giftName}`;
  } else if (data.status === 'success') {
    const percent = (data.current / data.total) * 100;
    progressBar.style.width = `${percent}%`;
  } else if (data.status === 'error') {
    currentDiv.textContent = `⚠️ Failed: ${data.giftName} - ${data.error}`;
  }
});

// ============= OVERLAY BUILDER =============

// Track last known gift list and overlay state
let lastKnownGiftList = null;
let overlayGiftState = {}; // { giftName: { checked: true/false, customText: "..." } }
let overlayGiftOrder = []; // Array of gift names in custom order
let overlayThresholdDisplayMode = 'separate'; // 'separate' or 'inline'

// Save current overlay state
function saveOverlayState() {
  const checkboxes = document.querySelectorAll('.overlay-gift-checkbox');
  const textInputs = document.querySelectorAll('.overlay-text-input');
  const thresholdModeSelect = document.getElementById('overlay-threshold-display-mode');

  overlayGiftState = {};
  overlayGiftOrder = [];

  // Save threshold display mode
  if (thresholdModeSelect) {
    overlayThresholdDisplayMode = thresholdModeSelect.value;
  }

  // Save order based on DOM position
  const items = document.querySelectorAll('.overlay-gift-item');
  items.forEach(item => {
    const checkbox = item.querySelector('.overlay-gift-checkbox');
    if (checkbox) {
      const giftName = checkbox.value;
      overlayGiftOrder.push(giftName);
      overlayGiftState[giftName] = overlayGiftState[giftName] || {};
      overlayGiftState[giftName].checked = checkbox.checked;
    }
  });

  textInputs.forEach(input => {
    const giftName = input.dataset.giftName;
    overlayGiftState[giftName] = overlayGiftState[giftName] || {};
    overlayGiftState[giftName].customText = input.value;
  });
}

// Move gift up in the list
function moveGiftUp(giftName) {
  const container = document.getElementById('overlay-gift-list');
  const items = Array.from(container.querySelectorAll('.overlay-gift-item'));
  const index = items.findIndex(item => item.querySelector('.overlay-gift-checkbox').value === giftName);

  if (index > 0) {
    // Swap with previous item
    container.insertBefore(items[index], items[index - 1]);
    saveOverlayState();
  }
}

// Move gift down in the list
function moveGiftDown(giftName) {
  const container = document.getElementById('overlay-gift-list');
  const items = Array.from(container.querySelectorAll('.overlay-gift-item'));
  const index = items.findIndex(item => item.querySelector('.overlay-gift-checkbox').value === giftName);

  if (index < items.length - 1) {
    // Swap with next item
    container.insertBefore(items[index + 1], items[index]);
    saveOverlayState();
  }
}

// Populate overlay gift selection from mapped gifts
async function populateOverlayGiftSelection(forceRefresh = false) {
  const container = document.getElementById('overlay-gift-list');
  if (!container) return;

  try {
    const result = await window.sniAPI.loadGiftMappings();
    if (!result.success || !result.mappings || Object.keys(result.mappings).length === 0) {
      container.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">No gift mappings found. Map some gifts in the "Gift Mappings" tab first.</div>';
      lastKnownGiftList = null;
      return;
    }

    // Create a sorted gift list to compare
    const currentGiftList = Object.keys(result.mappings).sort().join(',');

    // Only repopulate if the gift list has changed or force refresh is requested
    if (!forceRefresh && lastKnownGiftList === currentGiftList && container.children.length > 0) {
      // Gift list hasn't changed, don't repopulate
      return;
    }

    // Save current state before rebuilding
    if (container.children.length > 0) {
      saveOverlayState();
    }

    // Update last known gift list
    lastKnownGiftList = currentGiftList;

    container.innerHTML = '';

    // Sort gifts based on saved order, or alphabetically
    let sortedEntries = Object.entries(result.mappings);
    if (overlayGiftOrder.length > 0) {
      // Sort by saved order, putting new gifts at the end
      sortedEntries = sortedEntries.sort(([nameA], [nameB]) => {
        const indexA = overlayGiftOrder.indexOf(nameA);
        const indexB = overlayGiftOrder.indexOf(nameB);
        if (indexA === -1 && indexB === -1) return nameA.localeCompare(nameB);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    sortedEntries.forEach(([giftName, mapping]) => {
      const item = document.createElement('div');
      item.className = 'overlay-gift-item';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '8px';

      // Reorder buttons container
      const reorderButtons = document.createElement('div');
      reorderButtons.className = 'overlay-reorder-buttons';
      reorderButtons.style.display = 'flex';
      reorderButtons.style.flexDirection = 'column';
      reorderButtons.style.gap = '2px';

      const upButton = document.createElement('button');
      upButton.className = 'btn-reorder btn-reorder-up';
      upButton.innerHTML = '▲';
      upButton.title = 'Move up';
      upButton.style.padding = '2px 8px';
      upButton.style.fontSize = '10px';
      upButton.style.background = '#4a5568';
      upButton.style.border = 'none';
      upButton.style.color = 'white';
      upButton.style.cursor = 'pointer';
      upButton.style.borderRadius = '3px';
      upButton.onclick = (e) => {
        e.preventDefault();
        moveGiftUp(giftName);
      };

      const downButton = document.createElement('button');
      downButton.className = 'btn-reorder btn-reorder-down';
      downButton.innerHTML = '▼';
      downButton.title = 'Move down';
      downButton.style.padding = '2px 8px';
      downButton.style.fontSize = '10px';
      downButton.style.background = '#4a5568';
      downButton.style.border = 'none';
      downButton.style.color = 'white';
      downButton.style.cursor = 'pointer';
      downButton.style.borderRadius = '3px';
      downButton.onclick = (e) => {
        e.preventDefault();
        moveGiftDown(giftName);
      };

      reorderButtons.appendChild(upButton);
      reorderButtons.appendChild(downButton);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'overlay-gift-checkbox';
      checkbox.value = giftName;
      checkbox.id = `overlay-gift-${giftName.replace(/\s+/g, '-')}`;

      // Restore previous state or default to checked
      checkbox.checked = overlayGiftState[giftName]?.checked !== undefined
        ? overlayGiftState[giftName].checked
        : true;

      const contentDiv = document.createElement('div');
      contentDiv.style.flex = '1';
      contentDiv.style.display = 'flex';
      contentDiv.style.flexDirection = 'column';

      const label = document.createElement('label');
      label.className = 'overlay-gift-label';
      label.htmlFor = checkbox.id;
      label.textContent = giftName;

      // Clean up action description for default text
      let actionText = mapping.description || mapping.action;
      actionText = actionText.replace(/^Disable\s+/i, '').replace(/^\W+/, '');

      // Create custom text input
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'overlay-text-input';
      textInput.placeholder = 'Custom overlay text...';

      // Restore previous custom text or use default
      textInput.value = overlayGiftState[giftName]?.customText || actionText;
      textInput.dataset.giftName = giftName;

      const textLabel = document.createElement('small');
      textLabel.style.display = 'block';
      textLabel.style.marginTop = '4px';
      textLabel.style.opacity = '0.7';
      textLabel.textContent = 'Overlay display text:';

      contentDiv.appendChild(label);
      contentDiv.appendChild(textLabel);
      contentDiv.appendChild(textInput);

      item.appendChild(reorderButtons);
      item.appendChild(checkbox);
      item.appendChild(contentDiv);
      container.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading mappings for overlay:', error);
    container.innerHTML = '<div style="color: #f44; text-align: center; padding: 20px;">Error loading gift mappings.</div>';
  }
}

// Load and display current overlay save path
async function loadOverlaySavePath() {
  try {
    const result = await window.sniAPI.getOverlaySavePath();
    if (result.success) {
      const pathInput = document.getElementById('overlay-save-path');
      if (pathInput) {
        pathInput.value = result.savePath;
        pathInput.placeholder = result.savePath;
      }
    }
  } catch (error) {
    console.error('Error loading overlay save path:', error);
  }
}

// Store custom overlay save path
let customOverlaySavePath = null;

// Browse for overlay save path
async function browseOverlayPath() {
  try {
    const result = await window.sniAPI.browseOverlayPath();
    if (result.success && result.path) {
      // Store the custom path
      customOverlaySavePath = result.path;

      // Update the display
      const pathInput = document.getElementById('overlay-save-path');
      if (pathInput) {
        pathInput.value = result.path;
        pathInput.placeholder = result.path;
      }
      log(`Overlay save location set to: ${result.path}`, 'success');
    } else if (!result.canceled) {
      log('Failed to select save location', 'error');
    }
  } catch (error) {
    log(`Error browsing for path: ${error.message}`, 'error');
  }
}

// Reset overlay save path to default
async function resetOverlayPath() {
  try {
    // Clear the custom path
    customOverlaySavePath = null;

    // Update the display with the default path
    const pathInput = document.getElementById('overlay-save-path');
    if (pathInput) {
      const defaultPath = 'Downloads\\TikTok-Gift-Overlay.html';
      pathInput.value = '';
      pathInput.placeholder = defaultPath;
    }
    log('Overlay save location reset to Downloads folder', 'success');
  } catch (error) {
    log(`Error resetting path: ${error.message}`, 'error');
  }
}

// Generate overlay HTML file
// Get threshold action description
function getThresholdActionDescription(actionName, params) {
  const THRESHOLD_ACTIONS = window.THRESHOLD_ACTIONS || [];
  const actionInfo = THRESHOLD_ACTIONS.find(a => a.action === actionName);

  let desc = actionInfo ? actionInfo.name : actionName;

  // Add params to description if present
  if (params && Object.keys(params).length > 0) {
    const paramsText = Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ');
    desc += ` (${paramsText})`;
  }

  return desc;
}

async function generateOverlay() {
  try {
    // Get configuration
    const width = parseInt(document.getElementById('overlay-width').value) || 1080;
    const height = parseInt(document.getElementById('overlay-height').value) || 200;
    // Convert seconds to milliseconds for HTML generation
    const stagger = (parseFloat(document.getElementById('overlay-stagger').value) || 2) * 1000;
    const pause = (parseFloat(document.getElementById('overlay-pause').value) || 30) * 1000;
    const spacing = parseInt(document.getElementById('overlay-spacing').value) || 150;
    const continuousLoop = document.getElementById('overlay-continuous-loop').checked;
    const stationaryMode = document.getElementById('overlay-stationary-mode')?.checked || false;

    // Get selected gifts in DOM order (respects custom ordering)
    const giftItems = document.querySelectorAll('.overlay-gift-item');
    const selectedGifts = [];
    giftItems.forEach(item => {
      const checkbox = item.querySelector('.overlay-gift-checkbox');
      if (checkbox && checkbox.checked) {
        selectedGifts.push(checkbox.value);
      }
    });

    if (selectedGifts.length === 0) {
      log('Please select at least one gift for the overlay', 'error');
      return;
    }

    // Load current mappings to get action descriptions
    const result = await window.sniAPI.loadGiftMappings();
    if (!result.success || !result.mappings) {
      log('Failed to load gift mappings', 'error');
      return;
    }

    // Build gifts array for overlay (in DOM order)
    const gifts = [];
    selectedGifts.forEach(giftName => {
      const mapping = result.mappings[giftName];
      if (!mapping) return;

      // Get custom text from the text input
      const textInput = document.querySelector(`.overlay-text-input[data-gift-name="${giftName}"]`);
      let action = textInput ? textInput.value : (mapping.description || mapping.action);

      // Clean up action text if it's still the default (remove emoji, "Disable", etc.)
      if (!textInput || !textInput.value) {
        action = action.replace(/^[\u{1F000}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u, '').trim();
        action = action.replace(/^Disable\s+/i, '');
      }

      // Find coin value for gift
      const coinValue = findCoinValueForGift(giftName);

      // Get image URL (with overrides applied) - use local paths for overlay
      let imageUrl = null;
      if (coinValue) {
        imageUrl = getCurrentImageUrl(giftName, coinValue, false); // false = use local paths
      }

      // If no image found, use fallback local path
      if (!imageUrl) {
        imageUrl = './gift-images/rose_1.webp'; // Rose as fallback (local)
      }

      gifts.push({
        name: giftName,
        action: action,
        img: imageUrl
      });
    });

    // Load threshold configurations for overlay
    let selectedThresholds = [];
    try {
      const thresholdResult = await window.sniAPI.loadThresholdConfigs();
      if (thresholdResult.success && thresholdResult.thresholds) {
        const allThresholds = thresholdResult.thresholds;

        // Convert threshold configs to overlay format
        Object.entries(allThresholds).forEach(([key, config]) => {
          // Skip value-based thresholds for inline mode (they always go in separate section)
          if (config.type === 'value') {
            selectedThresholds.push({
              giftName: '__VALUE_TOTAL__',
              displayName: 'Total Coin Value',
              target: config.target,
              action: config.action,
              description: getThresholdActionDescription(config.action, config.params),
              type: 'value'
            });
          } else {
            // Count-based threshold
            selectedThresholds.push({
              giftName: key,
              displayName: config.displayName || key,
              target: config.target,
              action: config.action,
              description: getThresholdActionDescription(config.action, config.params),
              type: 'count'
            });
          }
        });
      }
    } catch (error) {
      console.error('Error loading thresholds for overlay:', error);
    }

    // Get threshold display mode from UI
    const thresholdDisplayMode = document.getElementById('overlay-threshold-display-mode')?.value || 'separate';

    // Auto-add gifts that have thresholds but aren't in the carousel (INLINE MODE ONLY)
    if (thresholdDisplayMode === 'inline' && selectedThresholds.length > 0) {
      const giftNamesInCarousel = new Set(gifts.map(g => g.name));

      // Find count-based thresholds for gifts not in carousel
      const missingThresholdGifts = selectedThresholds.filter(t =>
        t.type === 'count' && !giftNamesInCarousel.has(t.giftName)
      );

      // Auto-add these gifts to the carousel
      for (const threshold of missingThresholdGifts) {
        console.log(`Auto-adding gift "${threshold.giftName}" to carousel (has threshold)`);

        // Load mapping to get action description
        const mapping = result.mappings[threshold.giftName];
        if (!mapping) {
          console.warn(`No mapping found for threshold gift: ${threshold.giftName}`);
          continue;
        }

        // Get image for the gift
        const coinValue = findCoinValueForGift(threshold.giftName);
        let imageUrl = null;
        if (coinValue) {
          imageUrl = getCurrentImageUrl(threshold.giftName, coinValue, false);
        }
        if (!imageUrl) {
          imageUrl = './gift-images/rose_1.webp'; // Fallback
        }

        // Add to gifts array
        gifts.push({
          name: threshold.giftName,
          action: threshold.description || mapping.description || mapping.action,
          img: imageUrl,
          hasThreshold: true, // Mark this as auto-added
          thresholdData: threshold
        });
      }
    }

    // Generate HTML content
    const html = generateOverlayHTML(gifts, width, height, stagger, pause, continuousLoop, spacing, selectedThresholds, thresholdDisplayMode, stationaryMode);

    // Save file via IPC (use custom path if set)
    log('Generating overlay HTML...', 'info');
    const saveResult = await window.sniAPI.saveOverlayFile(html, customOverlaySavePath);

    if (saveResult.success) {
      log(`✅ Overlay saved successfully!`, 'success');
      log(`📁 Location: ${saveResult.path}`, 'success');

      // Show success notification
      alert(`Overlay saved successfully!\n\nFile location:\n${saveResult.path}\n\nYou can now use this HTML file in OBS or your streaming software.`);
    } else {
      log(`❌ Failed to save overlay: ${saveResult.error}`, 'error');
      alert(`Failed to save overlay file:\n\n${saveResult.error}`);
    }
  } catch (error) {
    log(`Error generating overlay: ${error.message}`, 'error');
  }
}

// Generate overlay HTML content
function generateOverlayHTML(gifts, width, height, stagger, pause, continuousLoop = true, spacing = 100, selectedThresholds = [], thresholdDisplayMode = 'separate', stationaryMode = false) {
  // Attach threshold metadata to gifts for inline display
  if (thresholdDisplayMode === 'inline') {
    gifts = gifts.map(gift => {
      const threshold = selectedThresholds.find(t => t.type === 'count' && t.giftName === gift.name);
      if (threshold) {
        return {
          ...gift,
          thresholdData: threshold
        };
      }
      return gift;
    });
  }

  const giftsJSON = JSON.stringify(gifts, null, 2);
  const thresholdsJSON = JSON.stringify(selectedThresholds, null, 2);
  const count = gifts.length;
  const period = stagger * count;
  const loop = period + pause;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ALttPR TikTok Gift Actions - Animated Overlay</title>
<style>
  :root{
    --w: ${width}px;
    --h: ${height}px;
    --img-size: 96px;
    --top-text-size: 18px;
    --name-text-size: 14px;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: var(--w);
    height: var(--h);
    overflow: hidden;
    background: transparent;
    color: #fff;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans";
  }

  .lane {
    position: relative;
    width: var(--w);
    height: var(--h);
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, transparent 0, black 40px, black calc(100% - 40px), transparent 100%);
    mask-image: linear-gradient(to right, transparent 0, black 40px, black calc(100% - 40px), transparent 100%);
  }

  .item {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    grid-template-rows: auto auto auto;
    justify-items: center;
    text-align: center;
    min-width: 240px;
    padding: 0 20px;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,.7));
    will-change: transform;
  }

  .action {
    font-weight: 800;
    font-size: var(--top-text-size);
    line-height: 1.1;
    white-space: nowrap;
    text-shadow:
      0 0 6px rgba(0,0,0,.85),
      0 0 14px rgba(0,0,0,.55);
  }

  .pic {
    display: grid;
    place-items: center;
    height: calc(var(--img-size) + 8px);
    margin: 6px 0 2px;
  }

  .pic img {
    height: var(--img-size);
    width: auto;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
  }

  .name {
    font-size: var(--name-text-size);
    opacity: .9;
    letter-spacing: .2px;
    white-space: nowrap;
    text-shadow:
      0 0 6px rgba(0,0,0,.85),
      0 0 14px rgba(0,0,0,.55);
  }

  /* Stationary Mode Grid Layout */
  body.stationary .lane {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 30px;
    padding: 20px;
    -webkit-mask-image: none;
    mask-image: none;
  }

  body.stationary .item {
    position: relative;
    transform: none !important;
    visibility: visible !important;
    flex: 0 0 auto;
  }

  /* Inline Threshold Styles */
  .threshold-multiplier-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    background: linear-gradient(135deg, #f59e0b, #dc2626);
    color: white;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 900;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    z-index: 10;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .inline-progress-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 8px;
    background: rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .inline-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    transition: width 0.3s ease;
    position: relative;
  }

  .inline-progress-bar.completed {
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  /* Threshold Styles */
  .thresholds-container {
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    padding: 15px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .threshold-item {
    margin-bottom: 12px;
  }

  .threshold-item:last-child {
    margin-bottom: 0;
  }

  .threshold-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    font-size: 14px;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }

  .threshold-name {
    flex: 1;
  }

  .threshold-progress-text {
    margin-left: 10px;
    font-weight: 700;
    color: #4ade80;
  }

  .threshold-bar-container {
    height: 20px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  }

  .threshold-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 10px;
    transition: width 0.3s ease;
    position: relative;
  }

  .threshold-bar.completed {
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  .threshold-action {
    font-size: 12px;
    opacity: 0.8;
    margin-top: 2px;
    font-style: italic;
  }
</style>
</head>
<body>
  <div class="lane" id="lane" aria-label="TikTok Gift Actions"></div>

  ${selectedThresholds.filter(t => thresholdDisplayMode === 'separate' || t.type === 'value').length > 0 ? `<div class="thresholds-container" id="thresholds">
    ${selectedThresholds.filter(t => thresholdDisplayMode === 'separate' || t.type === 'value').map(t => `
    <div class="threshold-item" data-gift="${t.giftName}">
      <div class="threshold-label">
        <span class="threshold-name">${t.displayName}</span>
        <span class="threshold-progress-text" data-progress="${t.giftName}">0/${t.target}</span>
      </div>
      <div class="threshold-bar-container">
        <div class="threshold-bar" data-bar="${t.giftName}" style="width: 0%"></div>
      </div>
      <div class="threshold-action">${t.action}</div>
    </div>
    `).join('')}
  </div>` : ''}

<script>
/* -------- CONFIG -------- */
const STAGGER_MS = ${stagger};
const PAUSE_MS   = ${pause};
const CONTINUOUS_LOOP = ${continuousLoop};
const STATIONARY_MODE = ${stationaryMode};

/* -------- DATA -------- */
const gifts = ${giftsJSON};
const THRESHOLD_DISPLAY_MODE = '${thresholdDisplayMode}';

const lane = document.getElementById('lane');
const COUNT = gifts.length;
const PERIOD_MS = STAGGER_MS * COUNT;
const LOOP_MS   = CONTINUOUS_LOOP ? PERIOD_MS : (PERIOD_MS + PAUSE_MS);

function makeItem(g) {
  const el = document.createElement('div');
  el.className = 'item';
  el.dataset.giftName = g.name; // Add data attribute for threshold tracking

  const top = document.createElement('div');
  top.className = 'action';
  top.textContent = '"' + g.action.replace(/^Disable\\s+/i, "") + '"';

  const pic = document.createElement('div');
  pic.className = 'pic';
  pic.style.position = 'relative'; // For absolute positioning of badge and progress bar

  // Add threshold multiplier badge if gift has threshold (inline mode)
  if (g.thresholdData && THRESHOLD_DISPLAY_MODE === 'inline') {
    const badge = document.createElement('div');
    badge.className = 'threshold-multiplier-badge';
    badge.textContent = g.thresholdData.target + 'x';
    pic.appendChild(badge);
  }

  const img = document.createElement('img');
  img.alt = g.name;
  img.src = g.img;
  pic.appendChild(img);

  // Add inline progress bar if gift has threshold (inline mode)
  if (g.thresholdData && THRESHOLD_DISPLAY_MODE === 'inline') {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'inline-progress-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'inline-progress-bar';
    progressBar.dataset.bar = g.name; // For threshold polling to target
    progressBar.style.width = '0%';

    progressContainer.appendChild(progressBar);
    pic.appendChild(progressContainer);
  }

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = g.name;

  el.appendChild(top);
  el.appendChild(pic);
  el.appendChild(name);
  return el;
}

const els = gifts.map(makeItem);
els.forEach(el => lane.appendChild(el));

/* -------- STATIONARY OR ANIMATED MODE -------- */
if (STATIONARY_MODE) {
  // Add stationary class to body for CSS grid layout
  document.body.classList.add('stationary');
  // No animation needed - items are positioned via CSS flexbox
} else {
  /* -------- MEASURE & ANIMATE -------- */
  const TRAVEL_MS   = ${period};
  const TAIL_GAP_PX = ${spacing};

  let laneW = 0;
  let itemsW = new Array(COUNT).fill(280);

  function measure() {
    laneW = lane.clientWidth;
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      itemsW[i] = Math.max(240, Math.ceil(r.width || 280));
    });
  }

  function positionAt(t) {
    for (let i = 0; i < COUNT; i++) {
      const start = i * STAGGER_MS;
      let phase = t - start;
      if (phase < 0) phase += PERIOD_MS;

      const el = els[i];
      const w = itemsW[i];
      // Add extra spacing multiplier to increase gap between items
      const effectiveSpacing = TAIL_GAP_PX * 2;
      const dist = laneW + w + effectiveSpacing;

      if (phase >= 0 && phase <= TRAVEL_MS) {
        const p = phase / TRAVEL_MS;
        const x = laneW - p * dist;
        el.style.transform = 'translateX(' + x + 'px)';
        el.style.visibility = 'visible';
      } else {
        el.style.transform = 'translateX(' + (laneW + effectiveSpacing) + 'px)';
        el.style.visibility = 'hidden';
      }
    }
  }

  let startEpoch = performance.now();
  function tick(now) {
    const elapsed = now - startEpoch;
    const t = elapsed % LOOP_MS;

    if (CONTINUOUS_LOOP || t < PERIOD_MS) {
      positionAt(t);
    } else {
      els.forEach(el => {
        el.style.transform = 'translateX(' + (lane.clientWidth + TAIL_GAP_PX) + 'px)';
        el.style.visibility = 'hidden';
      });
    }
    requestAnimationFrame(tick);
  }

  function init() {
    measure();
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', measure);
  window.addEventListener('load', init);
  els.forEach(el => {
    const img = el.querySelector('img');
    img.addEventListener('load', measure, { once: true });
  });
}

/* -------- THRESHOLD TRACKING -------- */
const thresholds = ${thresholdsJSON};

if (thresholds.length > 0) {
  // Poll threshold status from a JSON file every 2 seconds
  async function updateThresholdProgress() {
    try {
      // Fetch threshold status from a file in the same directory
      const response = await fetch('./threshold-status.json?t=' + Date.now());
      if (!response.ok) {
        console.warn('Could not load threshold status');
        return;
      }

      const data = await response.json();
      if (!data.status || !Array.isArray(data.status)) {
        return;
      }

      // Update each threshold's progress bar
      data.status.forEach(item => {
        // Try to find separate section elements first
        const progressText = document.querySelector(\`[data-progress="\${item.giftName}"]\`);
        const progressBar = document.querySelector(\`[data-bar="\${item.giftName}"]\`);

        if (progressText && progressBar) {
          // Update separate section (traditional or value-based in inline mode)
          const current = item.current || 0;
          const target = item.target || 1;
          const percentage = Math.min(100, (current / target) * 100);

          progressText.textContent = \`\${current}/\${target}\`;
          progressBar.style.width = percentage + '%';

          if (current >= target) {
            progressBar.classList.add('completed');
          } else {
            progressBar.classList.remove('completed');
          }
        } else if (THRESHOLD_DISPLAY_MODE === 'inline') {
          // Try to find inline progress bar on carousel item
          const carouselItem = document.querySelector(\`.item[data-gift-name="\${item.giftName}"]\`);
          if (carouselItem) {
            const inlineBar = carouselItem.querySelector('[data-bar]');
            if (inlineBar) {
              const current = item.current || 0;
              const target = item.target || 1;
              const percentage = Math.min(100, (current / target) * 100);

              inlineBar.style.width = percentage + '%';

              if (current >= target) {
                inlineBar.classList.add('completed');
              } else {
                inlineBar.classList.remove('completed');
              }
            }
          }
        }
      });
    } catch (error) {
      // Silently fail if file doesn't exist or can't be loaded
      console.warn('Threshold status polling error:', error.message);
    }
  }

  // Update immediately on load
  updateThresholdProgress();

  // Poll every 2 seconds
  setInterval(updateThresholdProgress, 2000);
}
</script>
</body>
</html>`;
}

// ============= GIFT IMAGES MANAGER =============

// Get current image URL for a gift (from overrides or default)
// For UI previews, we use custom protocol or local paths; for overlay generation, use local paths
function getCurrentImageUrl(giftName, coinValue, forPreview = true) {
  const key = `${coinValue}-${giftName}`;

  // Check active-gifts.json for downloaded images FIRST (highest priority)
  if (window.activeGiftImages && window.activeGiftImages[coinValue]) {
    const giftImageData = window.activeGiftImages[coinValue][giftName];

    if (giftImageData && giftImageData.local) {
      // For preview, use gift-image:// protocol to load from userData
      // Extract filename from path
      const filename = giftImageData.local.replace('./gift-images/', '');

      if (forPreview) {
        // Use custom protocol for app display
        const url = `gift-image://${filename}`;
        if (coinValue <= 5) console.log(`[getCurrentImageUrl] ${giftName} (${coinValue}) -> ${url}`);
        return url;
      } else {
        // Use relative path for overlay generation
        return giftImageData.local;
      }
    }
  }

  // Check overrides second
  if (giftImageOverrides[key]) {
    if (coinValue <= 5) console.log(`[getCurrentImageUrl] ${giftName} (${coinValue}) -> override: ${giftImageOverrides[key]}`);
    return giftImageOverrides[key];
  }

  // Check default gift images (from gift-images.js)
  if (typeof getGiftImageUrl !== 'undefined') {
    const url = getGiftImageUrl(giftName, coinValue, true);
    if (coinValue <= 5) console.log(`[getCurrentImageUrl] ${giftName} (${coinValue}) -> fallback: ${url}`);
    return url;
  }

  return null;
}

// Load active gift images from database
async function loadActiveGiftImages() {
  try {
    console.log('[loadActiveGiftImages] Starting...');

    // Load the downloaded images path
    const pathResult = await window.sniAPI.getDownloadedImagesPath();
    if (pathResult && pathResult.success) {
      window.downloadedImagesPath = pathResult.path;
      console.log('[loadActiveGiftImages] Downloaded images path:', pathResult.path);
    }

    // Load active gift images metadata
    const result = await window.sniAPI.getActiveGifts();
    console.log('[loadActiveGiftImages] getActiveGifts result:', result);

    if (result && result.activeGifts) {
      console.log('[loadActiveGiftImages] activeGifts keys:', Object.keys(result.activeGifts));

      if (result.activeGifts.images) {
        // Store globally so getCurrentImageUrl can access it
        window.activeGiftImages = result.activeGifts.images;
        const coinValues = Object.keys(result.activeGifts.images);
        console.log(`[loadActiveGiftImages] ✅ Loaded ${coinValues.length} coin value groups`);
        console.log('[loadActiveGiftImages] Sample coin values:', coinValues.slice(0, 5));

        // Log sample gift from first coin value
        const firstCoin = coinValues[0];
        const giftsInFirst = Object.keys(result.activeGifts.images[firstCoin]);
        console.log(`[loadActiveGiftImages] Coin ${firstCoin} has ${giftsInFirst.length} gifts`);
        if (giftsInFirst.length > 0) {
          const sampleGift = result.activeGifts.images[firstCoin][giftsInFirst[0]];
          console.log(`[loadActiveGiftImages] Sample gift data:`, sampleGift);
        }

        // Automatically download missing images in the background
        downloadMissingImagesInBackground();
      } else {
        console.error('[loadActiveGiftImages] ❌ No images field in activeGifts!');
      }
    } else {
      console.error('[loadActiveGiftImages] ❌ No activeGifts in result!');
    }
  } catch (error) {
    console.error('[loadActiveGiftImages] Error:', error);
  }
}

// Download missing images in the background
async function downloadMissingImagesInBackground() {
  try {
    console.log('🔍 Checking for missing gift images...');
    const result = await window.sniAPI.downloadMissingGiftImages();

    if (result.success) {
      if (result.total > 0) {
        console.log(`✅ Downloaded ${result.downloaded} missing images (${result.failed} failed)`);

        // Reload the gift database display to show newly downloaded images
        if (document.getElementById('gift-database-list')) {
          populateGiftDatabase();
        }
        if (document.getElementById('gift-images-list')) {
          populateGiftImagesList();
        }
      } else {
        console.log('✅ All gift images already downloaded');
      }
    } else {
      console.error('❌ Error downloading missing images:', result.error);
    }
  } catch (error) {
    console.error('❌ Error in downloadMissingImagesInBackground:', error);
  }
}

// Load gift image overrides
async function loadGiftImageOverrides() {
  try {
    const result = await window.sniAPI.loadGiftImageOverrides();
    if (result.success && result.overrides) {
      giftImageOverrides = result.overrides;
    }
  } catch (error) {
    console.error('Error loading gift image overrides:', error);
  }
}

// Save gift image overrides
if (saveImagesBtn) {
  addManagedEventListener(saveImagesBtn, 'click', async () => {
  try {
    const inputs = document.querySelectorAll('.gift-image-url-input');
    const overrides = {};

    inputs.forEach(input => {
      const giftName = input.dataset.giftName;
      const coins = input.dataset.coins;
      const url = input.value.trim();
      const key = `${coins}-${giftName}`;

      if (url) {
        overrides[key] = url;
        // Update gift-images.js dynamically
        if (typeof addCustomGiftImage !== 'undefined') {
          addCustomGiftImage(giftName, parseInt(coins), url);
        }
      }
    });

    const result = await window.sniAPI.saveGiftImageOverrides(overrides);
    if (result.success) {
      giftImageOverrides = overrides;
      log(`Saved ${Object.keys(overrides).length} gift image URLs!`, 'success');
    } else {
      log(`Failed to save: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error saving gift images: ${error.message}`, 'error');
  }
});
}

// Populate gift images list
async function populateGiftImagesList() {
  const container = document.getElementById('gift-images-list');
  if (!container) return;

  // Load active gift images from database first
  await loadActiveGiftImages();

  // Get all unique gifts sorted by coin value from active-gifts.json
  const allGifts = [];

  try {
    // Load from active-gifts.json (updated database)
    // OPTIMIZED: Use flatMap to avoid nested loops
    const result = await window.sniAPI.getActiveGifts();
    if (result && result.success && result.activeGifts && result.activeGifts.gifts) {
      const gifts = Object.entries(result.activeGifts.gifts).flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins) }))
      );
      allGifts.push(...gifts);
    } else if (typeof TIKTOK_GIFTS !== 'undefined') {
      // Fallback to hardcoded TIKTOK_GIFTS
      console.warn('Failed to load active-gifts.json, falling back to TIKTOK_GIFTS for gift images');
      const gifts = Object.entries(TIKTOK_GIFTS).flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins) }))
      );
      allGifts.push(...gifts);
    } else {
      container.innerHTML = '<div class="no-gifts-message">Gift database not loaded</div>';
      return;
    }
  } catch (error) {
    console.error('Error loading active gifts for images:', error);
    // Fallback to TIKTOK_GIFTS
    // OPTIMIZED: Use flatMap to avoid nested loops
    if (typeof TIKTOK_GIFTS !== 'undefined') {
      const gifts = Object.entries(TIKTOK_GIFTS).flatMap(([coins, giftNames]) =>
        giftNames.map(name => ({ name, coins: parseInt(coins) }))
      );
      allGifts.push(...gifts);
    } else {
      container.innerHTML = '<div class="no-gifts-message">Error loading gift database</div>';
      return;
    }
  }

  allGifts.sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name));

  if (allGifts.length === 0) {
    container.innerHTML = '<div class="no-gifts-message">No gifts found in database</div>';
    return;
  }

  container.innerHTML = '';
  // OPTIMIZED: Use DocumentFragment to batch DOM updates
  const fragment = document.createDocumentFragment();

  allGifts.forEach(gift => {
    const currentUrl = getCurrentImageUrl(gift.name, gift.coins);

    const item = document.createElement('div');
    item.className = 'gift-image-item';

    // Preview
    const preview = document.createElement('div');
    preview.className = 'gift-image-preview';
    if (currentUrl) {
      const img = document.createElement('img');
      img.src = currentUrl;
      img.alt = gift.name;
      img.onerror = () => {
        preview.innerHTML = '<span>❌<br>Failed</span>';
        preview.classList.add('no-image');
      };
      preview.appendChild(img);
    } else {
      preview.innerHTML = '<span>No Image</span>';
      preview.classList.add('no-image');
    }

    // Info
    const info = document.createElement('div');
    info.className = 'gift-image-info';

    const nameSpan = document.createElement('div');
    nameSpan.className = 'gift-image-name';
    nameSpan.textContent = gift.name;

    const coinsSpan = document.createElement('div');
    coinsSpan.className = 'gift-image-coins';
    coinsSpan.textContent = `${gift.coins} 💰`;

    info.appendChild(nameSpan);
    info.appendChild(coinsSpan);

    // URL Input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gift-image-url-input';
    input.placeholder = 'https://p16-webcast.tiktokcdn.com/img/...';
    input.value = currentUrl || '';
    input.dataset.giftName = gift.name;
    input.dataset.coins = gift.coins;

    // Update preview on input change
    addManagedEventListener(input, 'change', () => {
      const newUrl = input.value.trim();
      preview.innerHTML = '';
      preview.classList.remove('no-image');

      if (newUrl) {
        const img = document.createElement('img');
        img.src = newUrl;
        img.alt = gift.name;
        img.onerror = () => {
          preview.innerHTML = '<span>❌<br>Invalid</span>';
          preview.classList.add('no-image');
        };
        preview.appendChild(img);
      } else {
        preview.innerHTML = '<span>No Image</span>';
        preview.classList.add('no-image');
      }
    });

    // Actions
    const actions = document.createElement('div');
    actions.className = 'gift-image-actions';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-clear-image';
    clearBtn.textContent = '🗑️ Clear';
    addManagedEventListener(clearBtn, 'click', () => {
      input.value = '';
      input.dispatchEvent(new Event('change'));
    });

    actions.appendChild(clearBtn);

    item.appendChild(preview);
    item.appendChild(info);
    item.appendChild(input);
    item.appendChild(actions);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

/**
 * ========================================
 * DATABASE UPDATES TAB FUNCTIONALITY
 * ========================================
 */

// Initialize Database Updates tab when modal loads
function initDatabaseUpdatesTab() {
  loadDatabaseStatus();
  loadVersionHistory();
  loadArchivedGiftsInline();
  setupDatabaseUpdateListeners();
}

// Load and display database status
async function loadDatabaseStatus() {
  try {
    // Load active gifts
    const activeResult = await window.sniAPI.getActiveGifts();
    if (activeResult && activeResult.activeGifts) {
      const activeGifts = activeResult.activeGifts.gifts || {};
      const activeCount = Object.values(activeGifts).reduce((sum, arr) => sum + arr.length, 0);
      document.getElementById('db-active-count').textContent = activeCount;

      // Show last updated timestamp
      if (activeResult.activeGifts.lastUpdated) {
        const date = new Date(activeResult.activeGifts.lastUpdated);
        document.getElementById('db-last-updated').textContent = date.toLocaleString();
      }
    }

    // Load archived gifts
    const archivedResult = await window.sniAPI.loadArchivedGifts();
    if (archivedResult && archivedResult.archivedGifts) {
      const archivedCount = archivedResult.archivedGifts.gifts?.length || 0;
      document.getElementById('db-archived-count').textContent = archivedCount;
    }
  } catch (error) {
    log('Error loading database status: ' + error.message, 'error');
  }
}

// Load and display version history
async function loadVersionHistory() {
  try {
    const result = await window.sniAPI.getDatabaseVersions();
    const container = document.getElementById('version-history-list');

    if (!result || !result.versions || !result.versions.backups || result.versions.backups.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No version history available</p>';
      return;
    }

    // Sort backups by timestamp (newest first)
    const backups = [...result.versions.backups].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    container.innerHTML = backups.map((backup, index) => `
      <div class="version-item" data-version-id="${index}">
        <div class="version-header" data-version-index="${index}" style="cursor: pointer;">
          <div class="version-info">
            <div class="version-timestamp">
              <span class="expand-arrow" id="arrow-${index}">▶</span>
              ${new Date(backup.timestamp).toLocaleString()}
            </div>
            <div class="version-meta">
              <span>📦 ${backup.giftCount} gifts</span>
              ${backup.changes ? `
                <span class="change-badge added">+${backup.changes.added}</span>
                <span class="change-badge removed">-${backup.changes.removed}</span>
                <span class="change-badge modified">~${backup.changes.modified}</span>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="version-details" id="version-details-${index}" style="display: none;">
          ${backup.changes && (backup.changes.added > 0 || backup.changes.removed > 0 || backup.changes.modified > 0) ? `
            <div class="version-details-content">
              <div class="version-summary">
                ${backup.changes.added > 0 && backup.details && backup.details.added ? `
                  <div class="change-section">
                    <p><strong>✅ Added (${backup.changes.added}):</strong></p>
                    <ul class="gift-list">
                      ${backup.details.added.map(g => `<li>${escapeHtml(g.name)} <span class="gift-coins-inline">(${g.coins} coins)</span></li>`).join('')}
                    </ul>
                  </div>
                ` : backup.changes.added > 0 ? `<p><strong>✅ Added:</strong> ${backup.changes.added} new gift${backup.changes.added !== 1 ? 's' : ''}</p>` : ''}

                ${backup.changes.removed > 0 && backup.details && backup.details.removed ? `
                  <div class="change-section">
                    <p><strong>📦 Archived (${backup.changes.removed}):</strong></p>
                    <ul class="gift-list">
                      ${backup.details.removed.map(g => `<li>${escapeHtml(g.name)} <span class="gift-coins-inline">(${g.coins} coins)</span></li>`).join('')}
                    </ul>
                  </div>
                ` : backup.changes.removed > 0 ? `<p><strong>📦 Archived:</strong> ${backup.changes.removed} gift${backup.changes.removed !== 1 ? 's' : ''}</p>` : ''}

                ${backup.changes.modified > 0 && backup.details && backup.details.modified ? `
                  <div class="change-section">
                    <p><strong>🔄 Modified (${backup.changes.modified}):</strong></p>
                    <ul class="gift-list">
                      ${backup.details.modified.map(g => `<li>${escapeHtml(g.name)} <span class="gift-coins-inline">(${g.oldCoins} → ${g.newCoins} coins)</span></li>`).join('')}
                    </ul>
                  </div>
                ` : backup.changes.modified > 0 ? `<p><strong>🔄 Modified:</strong> ${backup.changes.modified} gift${backup.changes.modified !== 1 ? 's' : ''} (coin value changed)</p>` : ''}
              </div>
            </div>
          ` : '<p style="color: #888; padding: 10px;">No changes in this version</p>'}
        </div>
      </div>
    `).join('');

    // Add click event listeners to version headers
    container.querySelectorAll('.version-header').forEach(header => {
      addManagedEventListener(header, 'click', (e) => {
        const versionIndex = header.getAttribute('data-version-index');
        const detailsDiv = document.getElementById(`version-details-${versionIndex}`);
        const arrow = document.getElementById(`arrow-${versionIndex}`);

        if (detailsDiv.style.display === 'none') {
          detailsDiv.style.display = 'block';
          arrow.textContent = '▼';
        } else {
          detailsDiv.style.display = 'none';
          arrow.textContent = '▶';
        }
      });
    });
  } catch (error) {
    log('Error loading version history: ' + error.message, 'error');
  }
}

// Load and display archived gifts inline
async function loadArchivedGiftsInline() {
  try {
    const result = await window.sniAPI.loadArchivedGifts();
    const container = document.getElementById('archived-gifts-inline-list');
    const countSpan = document.getElementById('archived-inline-count');

    if (!result.success) {
      container.innerHTML = '<p style="text-align: center; color: #f44; padding: 20px;">Error loading archived gifts</p>';
      countSpan.textContent = '0';
      return;
    }

    const archivedGifts = result.archivedGifts.gifts || [];
    countSpan.textContent = archivedGifts.length;

    if (archivedGifts.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No archived gifts</p>';
      return;
    }

    // Sort by coins (descending) then by name
    archivedGifts.sort((a, b) => {
      if (b.coins !== a.coins) return b.coins - a.coins;
      return a.name.localeCompare(b.name);
    });

    // Render archived gifts
    container.innerHTML = archivedGifts.map(gift => `
      <div class="archived-gift-card-inline" data-gift-name="${escapeHtml(gift.name)}" data-gift-coins="${gift.coins}">
        <div class="archived-gift-info">
          <div class="archived-gift-image">
            <img src="${gift.imageUrl || './gift-images/placeholder.webp'}"
                 alt="${escapeHtml(gift.name)}"
                 style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #1a1a1a;"
                 onerror="this.src='./gift-images/rose_1.webp'">
          </div>
          <div class="archived-gift-details">
            <div class="archived-gift-name">${escapeHtml(gift.name)}</div>
            <div class="archived-gift-meta">
              <span class="gift-coins">${gift.coins} coins</span>
              <span class="separator">•</span>
              <span class="archived-date">${formatArchivedDate(gift.archivedDate)}</span>
            </div>
          </div>
        </div>
        <div class="archived-gift-actions">
          <button class="btn-small btn-success" onclick="restoreGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            ↩️ Restore
          </button>
          <button class="btn-small btn-danger" onclick="deleteGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            🗑️ Delete
          </button>
        </div>
      </div>
    `).join('');

    // Setup search
    const searchInput = document.getElementById('archived-inline-search');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = (e) => filterArchivedGiftsInline(e.target.value, archivedGifts);
    }
  } catch (error) {
    log('Error loading archived gifts inline: ' + error.message, 'error');
  }
}

// Filter archived gifts inline by search term
function filterArchivedGiftsInline(searchTerm, allGifts) {
  const filtered = allGifts.filter(gift =>
    gift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gift.coins.toString().includes(searchTerm)
  );

  const container = document.getElementById('archived-gifts-inline-list');
  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No gifts match your search</p>';
  } else {
    container.innerHTML = filtered.map(gift => `
      <div class="archived-gift-card-inline" data-gift-name="${escapeHtml(gift.name)}" data-gift-coins="${gift.coins}">
        <div class="archived-gift-info">
          <div class="archived-gift-image">
            <img src="${gift.imageUrl || './gift-images/placeholder.webp'}"
                 alt="${escapeHtml(gift.name)}"
                 style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #1a1a1a;"
                 onerror="this.src='./gift-images/rose_1.webp'">
          </div>
          <div class="archived-gift-details">
            <div class="archived-gift-name">${escapeHtml(gift.name)}</div>
            <div class="archived-gift-meta">
              <span class="gift-coins">${gift.coins} coins</span>
              <span class="separator">•</span>
              <span class="archived-date">${formatArchivedDate(gift.archivedDate)}</span>
            </div>
          </div>
        </div>
        <div class="archived-gift-actions">
          <button class="btn-small btn-success" onclick="restoreGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            ↩️ Restore
          </button>
          <button class="btn-small btn-danger" onclick="deleteGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            🗑️ Delete
          </button>
        </div>
      </div>
    `).join('');
  }
}

// Restore gift from inline list
async function restoreGiftInline(giftName, coins) {
  if (!confirm(`Restore "${giftName}" (${coins} coins) to active gifts?`)) {
    return;
  }

  try {
    log(`Restoring ${giftName}...`, 'info');
    const result = await window.sniAPI.restoreArchivedGift(giftName, coins);

    if (result.success) {
      log(`✅ ${giftName} restored successfully!`, 'success');

      // Reload archived gifts and database status
      await loadArchivedGiftsInline();
      await loadDatabaseStatus();
      // Also refresh the Gift Database & Images tab
      await populateGiftDatabase();
      await populateGiftImagesList();
    } else {
      log(`Failed to restore ${giftName}: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error restoring gift: ${error.message}`, 'error');
  }
}

// Delete gift from inline list
async function deleteGiftInline(giftName, coins) {
  if (!confirm(`Permanently delete "${giftName}" (${coins} coins) from archive?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    log(`Deleting ${giftName} from archive...`, 'info');
    const result = await window.sniAPI.deleteArchivedGift(giftName, coins);

    if (result.success) {
      log(`🗑️ ${giftName} deleted from archive`, 'success');

      // Reload archived gifts and database status
      await loadArchivedGiftsInline();
      await loadDatabaseStatus();
      // Also refresh the Gift Database & Images tab
      await populateGiftDatabase();
      await populateGiftImagesList();
    } else {
      log(`Failed to delete ${giftName}: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error deleting gift: ${error.message}`, 'error');
  }
}

// Format archived date
function formatArchivedDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Setup event listeners for database update controls
function setupDatabaseUpdateListeners() {
  // Update button
  const updateBtn = document.getElementById('update-gift-database-btn');
  if (updateBtn) {
    addManagedEventListener(updateBtn, 'click', triggerDatabaseUpdate);
  }

  // Listen for progress updates
  window.sniAPI.onGiftUpdateProgress((data) => {
    updateProgress(data);
  });
}

// Trigger database update
async function triggerDatabaseUpdate() {
  const updateBtn = document.getElementById('update-gift-database-btn');
  const progressContainer = document.getElementById('update-progress-container');
  const resultsContainer = document.getElementById('update-results-container');

  // Disable button and show progress
  updateBtn.disabled = true;
  updateBtn.textContent = '⏳ Updating...';
  progressContainer.style.display = 'block';
  resultsContainer.style.display = 'none';

  try {
    log('Starting gift database update...', 'info');

    const result = await window.sniAPI.updateGiftDatabase({});

    // Hide progress, show results
    progressContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    const resultsCard = resultsContainer.querySelector('.results-card');
    const resultsTitle = document.getElementById('results-title');
    const resultsSummary = document.getElementById('results-summary');

    if (result.success) {
      if (result.noChanges) {
        resultsCard.classList.remove('error');
        resultsTitle.textContent = '✅ Database Up to Date';
        resultsSummary.innerHTML = '<p>No changes detected. Your gift database is already current.</p>';
        log('✅ Database is already up to date', 'success');
      } else {
        resultsCard.classList.remove('error');
        resultsTitle.textContent = '✅ Update Complete';

        const { added, removed, modified, total } = result.changes;
        let summaryHTML = `
          <p><strong>${total} total changes:</strong></p>
          <ul style="margin-left: 20px; margin-top: 10px;">
            <li>✅ ${added} new gift${added !== 1 ? 's' : ''} added</li>
            <li>📦 ${removed} gift${removed !== 1 ? 's' : ''} archived</li>
            <li>🔄 ${modified} gift${modified !== 1 ? 's' : ''} modified</li>
          </ul>
        `;

        // Add detailed new gifts list
        if (result.details && result.details.added && result.details.added.length > 0) {
          summaryHTML += `
            <details style="margin-top: 15px; cursor: pointer;">
              <summary style="font-weight: 600; color: #4CAF50;">📥 New Gifts (${result.details.added.length})</summary>
              <ul style="margin: 10px 0 0 20px; max-height: 150px; overflow-y: auto;">
                ${result.details.added.map(g => `<li>${g.name} (${g.coins} coins)</li>`).join('')}
              </ul>
            </details>
          `;
        }

        // Add restored gifts list (gifts that were archived and automatically restored)
        if (result.details && result.details.restored && result.details.restored.length > 0) {
          summaryHTML += `
            <details style="margin-top: 10px; cursor: pointer;">
              <summary style="font-weight: 600; color: #00BCD4;">♻️ Auto-Restored from Archive (${result.details.restored.length})</summary>
              <ul style="margin: 10px 0 0 20px; max-height: 150px; overflow-y: auto;">
                ${result.details.restored.map(g => `<li>${g.name} (${g.coins} coins)</li>`).join('')}
              </ul>
            </details>
          `;
        }

        // Add detailed archived gifts list
        if (result.details && result.details.removed && result.details.removed.length > 0) {
          summaryHTML += `
            <details style="margin-top: 10px; cursor: pointer;">
              <summary style="font-weight: 600; color: #FF9800;">📦 Archived Gifts (${result.details.removed.length})</summary>
              <ul style="margin: 10px 0 0 20px; max-height: 150px; overflow-y: auto;">
                ${result.details.removed.map(g => `<li>${g.name} (${g.coins} coins)</li>`).join('')}
              </ul>
            </details>
          `;
        }

        // Add modified gifts list
        if (result.details && result.details.modified && result.details.modified.length > 0) {
          summaryHTML += `
            <details style="margin-top: 10px; cursor: pointer;">
              <summary style="font-weight: 600; color: #2196F3;">🔄 Modified Gifts (${result.details.modified.length})</summary>
              <ul style="margin: 10px 0 0 20px; max-height: 150px; overflow-y: auto;">
                ${result.details.modified.map(g => `<li>${g.name}: ${g.oldCoins} → ${g.newCoins} coins</li>`).join('')}
              </ul>
            </details>
          `;
        }

        // Add downloaded images list
        if (result.imageDownloads && result.imageDownloads.downloaded && result.imageDownloads.downloaded.length > 0) {
          summaryHTML += `
            <details style="margin-top: 10px; cursor: pointer;">
              <summary style="font-weight: 600; color: #9C27B0;">🖼️ Images Downloaded (${result.imageDownloads.downloaded.length})</summary>
              <ul style="margin: 10px 0 0 20px; max-height: 150px; overflow-y: auto;">
                ${result.imageDownloads.downloaded.map(g => `<li>${g.name} (${g.coins} coins) - ${g.filename}</li>`).join('')}
              </ul>
            </details>
          `;
        }

        // Add failed downloads if any
        if (result.imageDownloads && result.imageDownloads.failed && result.imageDownloads.failed.length > 0) {
          summaryHTML += `
            <details style="margin-top: 10px; cursor: pointer;">
              <summary style="font-weight: 600; color: #f44336;">⚠️ Failed Downloads (${result.imageDownloads.failed.length})</summary>
              <ul style="margin: 10px 0 0 20px; max-height: 150px; overflow-y: auto;">
                ${result.imageDownloads.failed.map(g => `<li>${g.name} (${g.coins} coins) - ${g.error}</li>`).join('')}
              </ul>
            </details>
          `;
        }

        summaryHTML += '<p style="margin-top: 15px;">Database has been updated successfully!</p>';
        resultsSummary.innerHTML = summaryHTML;

        log(`✅ Update complete: ${total} total changes`, 'success');

        // Reload database status, version history, and archived gifts
        setTimeout(() => {
          loadDatabaseStatus();
          loadVersionHistory();
          loadArchivedGiftsInline();
          // Also refresh the Gift Database & Images tab to show new gifts
          populateGiftDatabase();
          populateGiftImagesList();
        }, 500);
      }
    } else if (result.requiresConfirmation) {
      resultsCard.classList.add('error');
      resultsTitle.textContent = '⚠️ Large Update Detected';
      resultsSummary.innerHTML = `
        <p>${result.message}</p>
        <p style="margin-top: 15px;">This is a significant change. Please review carefully before proceeding.</p>
        <button class="btn-primary" style="margin-top: 15px;" onclick="confirmLargeUpdate()">
          Confirm Update
        </button>
      `;
    } else {
      resultsCard.classList.add('error');
      resultsTitle.textContent = '❌ Update Failed';
      resultsSummary.innerHTML = `
        <p><strong>Error:</strong> ${result.error || 'Unknown error occurred'}</p>
        ${result.userMessage ? `<p style="margin-top: 10px;">${result.userMessage}</p>` : ''}
      `;
      log(`❌ Update failed: ${result.error}`, 'error');
    }
  } catch (error) {
    progressContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    const resultsCard = resultsContainer.querySelector('.results-card');
    resultsCard.classList.add('error');
    document.getElementById('results-title').textContent = '❌ Update Failed';
    document.getElementById('results-summary').innerHTML = `
      <p><strong>Error:</strong> ${error.message}</p>
    `;
    log(`❌ Update error: ${error.message}`, 'error');
  } finally {
    // Re-enable button
    updateBtn.disabled = false;
    updateBtn.textContent = '🔄 Update from streamtoearn.io';
  }
}

// Confirm large update (>50% changes)
async function confirmLargeUpdate() {
  const updateBtn = document.getElementById('update-gift-database-btn');
  const progressContainer = document.getElementById('update-progress-container');
  const resultsContainer = document.getElementById('update-results-container');

  updateBtn.disabled = true;
  updateBtn.textContent = '⏳ Updating...';
  progressContainer.style.display = 'block';
  resultsContainer.style.display = 'none';

  try {
    const result = await window.sniAPI.updateGiftDatabase({ confirmLargeUpdate: true });

    progressContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    const resultsCard = resultsContainer.querySelector('.results-card');
    const resultsTitle = document.getElementById('results-title');
    const resultsSummary = document.getElementById('results-summary');

    if (result.success) {
      resultsCard.classList.remove('error');
      resultsTitle.textContent = '✅ Update Complete';

      const { added, removed, modified, total } = result.changes;
      resultsSummary.innerHTML = `
        <p><strong>${total} total changes:</strong></p>
        <ul style="margin-left: 20px; margin-top: 10px;">
          <li>✅ ${added} new gift${added !== 1 ? 's' : ''} added</li>
          <li>📦 ${removed} gift${removed !== 1 ? 's' : ''} archived</li>
          <li>🔄 ${modified} gift${modified !== 1 ? 's' : ''} modified</li>
        </ul>
      `;

      setTimeout(() => {
        loadDatabaseStatus();
        loadVersionHistory();
        loadArchivedGiftsInline();
        // Also refresh the Gift Database & Images tab to show new gifts
        populateGiftDatabase();
        populateGiftImagesList();
      }, 500);
    }
  } catch (error) {
    progressContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    const resultsCard = resultsContainer.querySelector('.results-card');
    resultsCard.classList.add('error');
    document.getElementById('results-title').textContent = '❌ Update Failed';
    document.getElementById('results-summary').innerHTML = `<p>${error.message}</p>`;
  } finally {
    updateBtn.disabled = false;
    updateBtn.textContent = '🔄 Update from streamtoearn.io';
  }
}

// Update progress indicator
function updateProgress(data) {
  const progressStage = document.getElementById('update-progress-stage');
  const progressPercent = document.getElementById('update-progress-percent');
  const progressBar = document.getElementById('update-progress-bar');
  const progressMessage = document.getElementById('update-progress-message');

  if (progressStage) progressStage.textContent = data.stage || 'Processing...';
  if (progressMessage) progressMessage.textContent = data.message || '';

  // Calculate progress percentage based on stage
  const stageProgress = {
    'starting': 5,
    'loading': 10,
    'fetching': 25,
    'comparing': 40,
    'backup': 50,
    'archiving': 60,
    'downloading_images': 75,
    'updating': 90,
    'complete': 100,
    'error': 0
  };

  const percent = stageProgress[data.stage] || 0;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressBar) progressBar.style.width = `${percent}%`;
}

// Confirm and perform rollback
async function confirmRollback(backupPath, timestamp) {
  const date = new Date(timestamp).toLocaleString();

  if (!confirm(`Rollback to version from ${date}?\n\nThis will restore the gift database to its previous state. Current data will be backed up first.`)) {
    return;
  }

  try {
    log(`Rolling back to ${date}...`, 'info');
    const result = await window.sniAPI.rollbackDatabase(backupPath);

    if (result.success) {
      log(`✅ Rollback successful!`, 'success');

      // Reload database status and version history
      setTimeout(() => {
        loadDatabaseStatus();
        loadVersionHistory();
        loadArchivedGiftsInline();
        // Also refresh the Gift Database & Images tab to show updated gifts
        populateGiftDatabase();
        populateGiftImagesList();
      }, 500);
    } else {
      log(`❌ Rollback failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`❌ Rollback error: ${error.message}`, 'error');
  }
}

// Make confirmRollback global so it can be called from onclick
window.confirmRollback = confirmRollback;
window.confirmLargeUpdate = confirmLargeUpdate;

/**
 * ========================================
 * MAPPING WARNING SYSTEM FOR ARCHIVED GIFTS
 * ========================================
 */

let archivedGiftMappings = [];
let showOnlyArchivedMappings = false;

// Check all gift mappings for archived gifts
async function checkMappingsForArchivedGifts() {
  try {
    const mappingsResult = await window.sniAPI.loadGiftMappings();
    if (!mappingsResult.success || !mappingsResult.mappings) {
      return;
    }

    const warnings = await window.sniAPI.checkMappingsForArchivedGifts(mappingsResult.mappings);
    archivedGiftMappings = warnings || [];

    if (archivedGiftMappings.length > 0) {
      displayMappingWarnings();
      showArchivalBanner();
    } else {
      hideArchivalBanner();
    }
  } catch (error) {
    log('Error checking archived gift mappings: ' + error.message, 'error');
  }
}

// Display warning badges on affected mappings
function displayMappingWarnings() {
  // Remove any existing warnings first
  document.querySelectorAll('.archived-gift-warning').forEach(el => el.remove());

  archivedGiftMappings.forEach(warning => {
    const giftKey = `${warning.giftName} (${warning.coins} coins)`;

    // Find the gift select that has this mapping
    const giftSelects = document.querySelectorAll('.gift-select');
    giftSelects.forEach(select => {
      if (select.value === giftKey) {
        // Add warning badge
        if (!select.nextElementSibling || !select.nextElementSibling.classList.contains('archived-gift-warning')) {
          const badge = document.createElement('div');
          badge.className = 'archived-gift-warning';
          badge.innerHTML = `
            <span class="warning-icon">⚠️</span>
            <span class="warning-text">ARCHIVED</span>
            <button class="btn-remap" data-gift="${giftKey}" data-action="${warning.action}">
              🔄 Remap
            </button>
          `;
          select.parentNode.insertBefore(badge, select.nextSibling);
        }
      }
    });
  });

  // Add event listeners for remap buttons
  document.querySelectorAll('.btn-remap').forEach(btn => {
    addManagedEventListener(btn, 'click', (e) => {
      const giftKey = e.target.dataset.gift;
      const action = e.target.dataset.action;
      handleRemapArchivedGift(giftKey, action);
    });
  });
}

// Show banner at top of gift mappings tab
function showArchivalBanner() {
  const mappingsSubtab = document.getElementById('gift-mappings-subtab');
  if (!mappingsSubtab) return;

  // Remove existing banner if present
  const existingBanner = mappingsSubtab.querySelector('.archived-gifts-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  const banner = document.createElement('div');
  banner.className = 'archived-gifts-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <span class="banner-icon">⚠️</span>
      <div class="banner-text">
        <strong>${archivedGiftMappings.length} mapping${archivedGiftMappings.length !== 1 ? 's' : ''} reference${archivedGiftMappings.length === 1 ? 's' : ''} archived gifts</strong>
        <p>These gifts are no longer available on TikTok. Consider remapping to active gifts.</p>
      </div>
      <div class="banner-actions">
        <button class="btn-filter-archived" onclick="toggleArchivedFilter()">
          ${showOnlyArchivedMappings ? '📋 Show All' : '🔍 Show Only Archived'}
        </button>
        <button class="btn-view-archived" onclick="showArchivedGiftsModal()">
          📦 View Archived Gifts
        </button>
      </div>
    </div>
  `;

  // Insert banner at the top of the tab body
  const tabBody = mappingsSubtab.querySelector('.tab-body');
  if (tabBody) {
    tabBody.insertBefore(banner, tabBody.firstChild);
  }
}

// Hide archival banner
function hideArchivalBanner() {
  const banner = document.querySelector('.archived-gifts-banner');
  if (banner) {
    banner.remove();
  }
}

// Toggle filter to show only archived mappings
function toggleArchivedFilter() {
  showOnlyArchivedMappings = !showOnlyArchivedMappings;
  applyArchivedFilter();

  // Update button text
  const filterBtn = document.querySelector('.btn-filter-archived');
  if (filterBtn) {
    filterBtn.textContent = showOnlyArchivedMappings ? '📋 Show All' : '🔍 Show Only Archived';
  }
}

// Apply filter to show/hide mappings
function applyArchivedFilter() {
  const actionItems = document.querySelectorAll('.action-item, .action-item-with-duration');

  if (!showOnlyArchivedMappings) {
    // Show all mappings
    actionItems.forEach(item => {
      item.style.display = '';
    });
    return;
  }

  // Get list of archived gift keys
  const archivedKeys = archivedGiftMappings.map(w => `${w.giftName} (${w.coins} coins)`);

  // Show only action items with archived gift mappings
  actionItems.forEach(item => {
    const giftSelect = item.querySelector('.gift-select');
    if (giftSelect && archivedKeys.includes(giftSelect.value)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// Handle remapping an archived gift
async function handleRemapArchivedGift(giftKey, action) {
  // Extract gift name and coins from key
  const match = giftKey.match(/^(.+?)\s+\((\d+)\s+coins\)$/);
  if (!match) return;

  const giftName = match[1];
  const coins = parseInt(match[2]);

  const confirmRestore = confirm(
    `"${giftName}" is currently archived.\n\n` +
    `Would you like to:\n` +
    `1. Restore it from the archive (if it's available again on TikTok)\n` +
    `2. Manually remap to a different active gift\n\n` +
    `Click OK to restore, Cancel to manually remap.`
  );

  if (confirmRestore) {
    // Try to restore the gift
    try {
      const result = await window.sniAPI.restoreArchivedGift(giftName, coins);
      if (result.success) {
        log(`✅ ${giftName} restored successfully!`, 'success');

        // Refresh warnings
        setTimeout(() => {
          checkMappingsForArchivedGifts();
        }, 500);
      } else {
        log(`Failed to restore ${giftName}: ${result.error}`, 'error');
      }
    } catch (error) {
      log(`Error restoring gift: ${error.message}`, 'error');
    }
  } else {
    // User wants to manually remap - clear the current selection
    const giftSelects = document.querySelectorAll('.gift-select');
    giftSelects.forEach(select => {
      if (select.value === giftKey) {
        select.value = '';
        select.dataset.previousValue = '';
        selectedGiftNames.delete(giftKey);

        // Highlight the select so user knows which one to update
        select.style.border = '2px solid #FF9800';
        select.focus();

        setTimeout(() => {
          select.style.border = '';
        }, 3000);
      }
    });

    log('Please select a new gift from the dropdown', 'info');
  }
}

// Make toggle function global
window.toggleArchivedFilter = toggleArchivedFilter;

// ============================================
// COLLAPSIBLE ACTION CATEGORIES
// ============================================

function initializeCollapsibleCategories() {
  const settingsScroll = document.querySelector('#gift-mappings-subtab .settings-scroll');
  if (!settingsScroll) {
    return;
  }

  const categories = settingsScroll.querySelectorAll('.settings-category');
  
  categories.forEach(category => {
    const h4 = category.querySelector('h4');
    if (!h4) return;

    // Store category title
    const title = h4.textContent;
    
    // Create header structure
    const header = document.createElement('div');
    header.className = 'category-header expanded';
    header.innerHTML = `
      <h4>${title}</h4>
      <span class="category-arrow">▶</span>
    `;

    // Collect all action items
    const actionItems = Array.from(category.querySelectorAll('.action-item'));
    
    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'category-content expanded';
    
    const itemsWrapper = document.createElement('div');
    itemsWrapper.className = 'category-items';
    actionItems.forEach(item => itemsWrapper.appendChild(item));
    content.appendChild(itemsWrapper);

    // Replace h4 with header and add content wrapper
    h4.replaceWith(header);
    category.appendChild(content);

    // Add click handler
    addManagedEventListener(header, 'click', () => {
      const isExpanded = header.classList.contains('expanded');

      if (isExpanded) {
        header.classList.remove('expanded');
        content.classList.remove('expanded');
      } else {
        header.classList.add('expanded');
        content.classList.add('expanded');
      }
    });
  });

  // Now reorganize: Move Reset Bird to Core and move Item Disable section
  reorganizeActions();
}

function reorganizeActions() {
  const settingsScroll = document.querySelector('#gift-mappings-subtab .settings-scroll');
  if (!settingsScroll) return;

  // Find the Core category
  const coreCategory = Array.from(settingsScroll.querySelectorAll('.settings-category')).find(cat => {
    const header = cat.querySelector('.category-header h4');
    return header && header.textContent.includes('Core');
  });

  // Find the Flute category
  const fluteCategory = Array.from(settingsScroll.querySelectorAll('.settings-category')).find(cat => {
    const header = cat.querySelector('.category-header h4');
    return header && header.textContent.includes('Flute');
  });

  // Find the Item Disable category
  const disableCategory = Array.from(settingsScroll.querySelectorAll('.settings-category')).find(cat => {
    const header = cat.querySelector('.category-header h4');
    return header && header.textContent.includes('Item Disable');
  });

  // Find the Set Hearts category
  const heartsCategory = Array.from(settingsScroll.querySelectorAll('.settings-category')).find(cat => {
    const header = cat.querySelector('.category-header h4');
    return header && header.textContent.includes('Set Hearts');
  });

  // Move Reset Bird from Flute to Core (position after Enemy Swarm)
  if (coreCategory && fluteCategory) {
    const resetBirdItem = Array.from(fluteCategory.querySelectorAll('.action-item')).find(item => {
      const actionName = item.querySelector('.action-name');
      return actionName && actionName.textContent.includes('Reset Bird');
    });

    if (resetBirdItem) {
      const coreItems = coreCategory.querySelector('.category-items');
      if (coreItems) {
        // Find Enemy Swarm action
        const enemySwarmItem = Array.from(coreItems.querySelectorAll('.action-item')).find(item => {
          const actionName = item.querySelector('.action-name');
          return actionName && actionName.textContent.includes('Enemy Swarm');
        });

        if (enemySwarmItem) {
          // Insert Reset Bird after Enemy Swarm
          enemySwarmItem.parentNode.insertBefore(resetBirdItem, enemySwarmItem.nextSibling);
        } else {
          // Fallback: append to end if Enemy Swarm not found
          coreItems.appendChild(resetBirdItem);
        }
      }
    }
  }

  // Move heart actions from Core to Set Hearts section (at the top)
  if (coreCategory && heartsCategory) {
    const coreItems = coreCategory.querySelector('.category-items');
    const heartsItems = heartsCategory.querySelector('.category-items');

    if (coreItems && heartsItems) {
      // Find the three heart actions in Core
      const addHeartItem = Array.from(coreItems.querySelectorAll('.action-item')).find(item => {
        const actionName = item.querySelector('.action-name');
        return actionName && actionName.textContent.includes('Add Heart Container');
      });

      const removeHeartItem = Array.from(coreItems.querySelectorAll('.action-item')).find(item => {
        const actionName = item.querySelector('.action-name');
        return actionName && actionName.textContent.includes('Remove Heart Container');
      });

      const heartPieceItem = Array.from(coreItems.querySelectorAll('.action-item')).find(item => {
        const actionName = item.querySelector('.action-name');
        return actionName && actionName.textContent.includes('Add Heart Piece');
      });

      // Get the first item in hearts section to insert before
      const firstHeartItem = heartsItems.querySelector('.action-item');

      // Move items to top of hearts section in order
      if (addHeartItem && firstHeartItem) {
        heartsItems.insertBefore(addHeartItem, firstHeartItem);
      }
      if (removeHeartItem && firstHeartItem) {
        // Insert after Add Heart Container
        const newFirst = heartsItems.querySelector('.action-item');
        if (newFirst && newFirst.nextSibling) {
          heartsItems.insertBefore(removeHeartItem, newFirst.nextSibling);
        } else {
          heartsItems.appendChild(removeHeartItem);
        }
      }
      if (heartPieceItem) {
        // Insert after Remove Heart Container
        const addHeartInHearts = Array.from(heartsItems.querySelectorAll('.action-item')).find(item => {
          const actionName = item.querySelector('.action-name');
          return actionName && actionName.textContent.includes('Add Heart Container');
        });
        const removeHeartInHearts = Array.from(heartsItems.querySelectorAll('.action-item')).find(item => {
          const actionName = item.querySelector('.action-name');
          return actionName && actionName.textContent.includes('Remove Heart Container');
        });

        if (removeHeartInHearts && removeHeartInHearts.nextSibling) {
          heartsItems.insertBefore(heartPieceItem, removeHeartInHearts.nextSibling);
        } else if (addHeartInHearts && addHeartInHearts.nextSibling) {
          heartsItems.insertBefore(heartPieceItem, addHeartInHearts.nextSibling);
        } else {
          heartsItems.appendChild(heartPieceItem);
        }
      }
    }
  }

  // Move Item Disable category to position 2 (right after Core)
  if (disableCategory && coreCategory) {
    coreCategory.parentNode.insertBefore(disableCategory, coreCategory.nextSibling);
  }
}

// Collapse/Expand all categories
function toggleAllCategories() {
  const collapseBtn = document.getElementById('collapse-all-categories');
  const headers = document.querySelectorAll('.category-header');
  const contents = document.querySelectorAll('.category-content');

  if (!collapseBtn || headers.length === 0) {
    return;
  }

  // Check if all are expanded
  const allExpanded = Array.from(headers).every(h => h.classList.contains('expanded'));

  if (allExpanded) {
    // Collapse all
    headers.forEach(h => h.classList.remove('expanded'));
    contents.forEach(c => c.classList.remove('expanded'));
    collapseBtn.innerHTML = '📂 Expand All';
  } else {
    // Expand all
    headers.forEach(h => h.classList.add('expanded'));
    contents.forEach(c => c.classList.add('expanded'));
    collapseBtn.innerHTML = '📁 Collapse All';
  }
}

// Initialize collapsible categories with retry logic
function tryInitializeCollapsible() {
  // Check if categories exist
  const settingsScroll = document.querySelector('#gift-mappings-subtab .settings-scroll');
  const categories = settingsScroll ? settingsScroll.querySelectorAll('.settings-category') : [];

  if (categories.length > 0 && !document.querySelector('.category-header')) {
    initializeCollapsibleCategories();

    // Attach button handler
    setTimeout(() => {
      const collapseAllBtn = document.getElementById('collapse-all-categories');
      if (collapseAllBtn && !collapseAllBtn.hasAttribute('data-listener-attached')) {
        addManagedEventListener(collapseAllBtn, 'click', toggleAllCategories);
        collapseAllBtn.setAttribute('data-listener-attached', 'true');
      }
    }, 50);

    return true;
  }
  return false;
}

// Run when the gift settings tab is opened
document.addEventListener('DOMContentLoaded', () => {
  // Initialize when the Gift Settings tab is clicked
  const giftSettingsTabBtn = document.querySelector('[data-tab="gift-settings-tab"]');

  if (giftSettingsTabBtn) {
    addManagedEventListener(giftSettingsTabBtn, 'click', () => {
      // Try immediately
      if (!tryInitializeCollapsible()) {
        // If not ready, retry a few times
        let attempts = 0;
        const retryInterval = setInterval(() => {
          attempts++;

          if (tryInitializeCollapsible() || attempts >= 10) {
            clearInterval(retryInterval);
          }
        }, 100);
      }
    });
  }

  // Also initialize when subtab button is clicked (in case user switches between subtabs)
  const mappingsBtn = document.querySelector('[data-subtab="gift-mappings-subtab"]');
  if (mappingsBtn) {
    addManagedEventListener(mappingsBtn, 'click', () => {
      setTimeout(() => tryInitializeCollapsible(), 100);
    });
  }
});
