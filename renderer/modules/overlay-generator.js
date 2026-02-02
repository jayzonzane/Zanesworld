/**
 * @fileoverview Overlay Generator Module
 * @module overlay-generator
 *
 * Handles overlay HTML generation including:
 * - Populating gift selection for overlay
 * - Managing gift order and state
 * - Generating HTML overlay files
 * - Managing overlay save path
 * - Threshold integration for overlay
 */

// Import dependencies
import { addManagedEventListener } from './utils.js';
import { findCoinValueForGift, getCurrentImageUrl } from './gift-database.js';

// ============= STATE =============

// Track last known gift list and overlay state
let lastKnownGiftList = null;
let overlayGiftState = {}; // { giftName: { checked: true/false, customText: "..." } }
let overlayGiftOrder = []; // Array of gift names in custom order
let overlayThresholdDisplayMode = 'separate'; // 'separate' or 'inline'

// Store custom overlay save path
let customOverlaySavePath = null;

// ============= OVERLAY STATE MANAGEMENT =============

/**
 * Save current overlay state
 */
export function saveOverlayState() {
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

/**
 * Move gift up in the list
 * @param {string} giftName - Gift name
 */
export function moveGiftUp(giftName) {
  const container = document.getElementById('overlay-gift-list');
  const items = Array.from(container.querySelectorAll('.overlay-gift-item'));
  const index = items.findIndex(item => item.querySelector('.overlay-gift-checkbox').value === giftName);

  if (index > 0) {
    // Swap with previous item
    container.insertBefore(items[index], items[index - 1]);
    saveOverlayState();
  }
}

/**
 * Move gift down in the list
 * @param {string} giftName - Gift name
 */
export function moveGiftDown(giftName) {
  const container = document.getElementById('overlay-gift-list');
  const items = Array.from(container.querySelectorAll('.overlay-gift-item'));
  const index = items.findIndex(item => item.querySelector('.overlay-gift-checkbox').value === giftName);

  if (index < items.length - 1) {
    // Swap with next item
    container.insertBefore(items[index + 1], items[index]);
    saveOverlayState();
  }
}

// ============= OVERLAY GIFT SELECTION =============

/**
 * Populate overlay gift selection from mapped gifts
 * @param {boolean} forceRefresh - Force refresh even if gift list hasn't changed
 */
export async function populateOverlayGiftSelection(forceRefresh = false) {
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

// ============= OVERLAY SAVE PATH =============

/**
 * Load and display current overlay save path
 */
export async function loadOverlaySavePath() {
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

/**
 * Browse for overlay save path
 */
export async function browseOverlayPath() {
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

/**
 * Reset overlay save path to default
 */
export async function resetOverlayPath() {
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

// ============= OVERLAY GENERATION =============

/**
 * Get threshold action description
 * @param {string} actionName - Action name
 * @param {Object} params - Action parameters
 * @returns {string} Action description
 */
export function getThresholdActionDescription(actionName, params) {
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

/**
 * Generate overlay HTML file
 */
export async function generateOverlay() {
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

/**
 * Generate overlay HTML content
 * @param {Array} gifts - Array of gift objects
 * @param {number} width - Overlay width
 * @param {number} height - Overlay height
 * @param {number} stagger - Stagger time in ms
 * @param {number} pause - Pause time in ms
 * @param {boolean} continuousLoop - Continuous loop enabled
 * @param {number} spacing - Spacing between items
 * @param {Array} selectedThresholds - Array of threshold objects
 * @param {string} thresholdDisplayMode - 'separate' or 'inline'
 * @param {boolean} stationaryMode - Stationary mode enabled
 * @returns {string} HTML content
 */
export function generateOverlayHTML(gifts, width, height, stagger, pause, continuousLoop = true, spacing = 100, selectedThresholds = [], thresholdDisplayMode = 'separate', stationaryMode = false) {
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
<body${stationaryMode ? ' class="stationary"' : ''}>
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

// ============= EXPORTS =============

// Export state for external access
export { lastKnownGiftList, overlayGiftState, overlayGiftOrder, overlayThresholdDisplayMode, customOverlaySavePath };
