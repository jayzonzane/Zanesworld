/**
 * @fileoverview Gift Database Module
 * @module gift-database
 *
 * Handles gift data management including:
 * - Loading and managing active/archived gifts from database
 * - Gift name overrides and custom gifts
 * - Gift image management and overrides
 * - Gift search and filtering
 * - Gift database UI population
 */

// Import dependencies
import { addManagedEventListener } from './utils.js';

// ============= STATE =============
// Global storage for active and archived gifts data
window.allGiftsData = {
  active: {},
  archived: []
};

// Track gift name overrides
let giftNameOverrides = {};

// Track custom gifts
let customGifts = [];

// Track gift image overrides
let giftImageOverrides = {};

// ============= GIFT NAME FUNCTIONS =============

/**
 * Get gift name with override applied
 * @param {string} originalName - Original gift name
 * @param {number} coinValue - Coin value
 * @returns {string} Display name (overridden or original)
 */
export function getGiftName(originalName, coinValue) {
  const key = `${coinValue}-${originalName}`;
  return giftNameOverrides[key] || originalName;
}

// ============= DATABASE POPULATION =============

/**
 * Populate unified gift database with thumbnails and expandable image fields
 */
export async function populateGiftDatabase() {
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

/**
 * Create a unified gift item with 50x50 thumbnail and expandable details
 * @param {string} giftName - Gift name
 * @param {number} coins - Coin value
 * @param {boolean} archived - Is gift archived
 * @returns {HTMLElement} Gift item element
 */
export function createUnifiedGiftItem(giftName, coins, archived = false) {
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

/**
 * Setup gift search functionality
 */
export function setupGiftSearch() {
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

// ============= GIFT NAME OVERRIDES =============

/**
 * Load gift name overrides from storage
 */
export async function loadGiftNameOverrides() {
  try {
    const result = await window.sniAPI.loadGiftNameOverrides();
    if (result.success && result.overrides) {
      giftNameOverrides = result.overrides;
    }
  } catch (error) {
    console.error('Error loading gift name overrides:', error);
  }
}

// ============= CUSTOM GIFTS =============

/**
 * Load custom gifts from storage
 */
export async function loadCustomGifts() {
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

/**
 * Save custom gifts to storage
 */
export async function saveCustomGifts() {
  try {
    const result = await window.sniAPI.saveCustomGifts(customGifts);
    return result;
  } catch (error) {
    console.error('Error saving custom gifts:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Display custom gifts in the list
 * OPTIMIZED: Uses DocumentFragment to batch DOM updates
 */
export function displayCustomGifts() {
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

/**
 * Add custom gift
 */
export async function addCustomGift() {
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

/**
 * Remove custom gift
 * @param {number} index - Index of gift to remove
 */
export async function removeCustomGift(index) {
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

/**
 * Update gift mappings when gift names change
 * @param {Object} nameChanges - Map of old name -> new name
 */
export async function updateMappingsWithNewNames(nameChanges) {
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

// ============= GIFT RANGE FUNCTIONS =============

/**
 * Get all gifts within a coin range from active and archived data
 * OPTIMIZED: Uses flatMap and filter for better performance
 * @param {number} minCoins - Minimum coin value
 * @param {number} maxCoins - Maximum coin value
 * @returns {Array} Array of gift objects
 */
export function getGiftsForCoinRangeLive(minCoins, maxCoins) {
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

/**
 * Generate gift options for a coin range (with overrides applied)
 * OPTIMIZED: Uses array join instead of string concatenation for better performance
 * @param {string} rangeValue - Range value (e.g., "1-5")
 * @param {string} selectedGift - Currently selected gift
 * @returns {string} HTML options string
 */
export function generateGiftOptionsForCoinValue(rangeValue, selectedGift = '') {
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

// ============= GIFT IMAGE FUNCTIONS =============

/**
 * Get current image URL for a gift (from overrides or default)
 * For UI previews, we use custom protocol or local paths; for overlay generation, use local paths
 * @param {string} giftName - Gift name
 * @param {number} coinValue - Coin value
 * @param {boolean} forPreview - Is this for preview (true) or overlay generation (false)
 * @returns {string|null} Image URL or null
 */
export function getCurrentImageUrl(giftName, coinValue, forPreview = true) {
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

/**
 * Load active gift images from database
 */
export async function loadActiveGiftImages() {
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

/**
 * Download missing images in the background
 */
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

/**
 * Load gift image overrides from storage
 */
export async function loadGiftImageOverrides() {
  try {
    const result = await window.sniAPI.loadGiftImageOverrides();
    if (result.success && result.overrides) {
      giftImageOverrides = result.overrides;
    }
  } catch (error) {
    console.error('Error loading gift image overrides:', error);
  }
}

/**
 * Populate gift images list
 */
export async function populateGiftImagesList() {
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
