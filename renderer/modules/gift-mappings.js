/**
 * @fileoverview Gift Mappings Module
 * @module gift-mappings
 *
 * Handles gift-to-action mappings including:
 * - Converting inputs to cascading dropdown system
 * - Loading and saving gift mappings
 * - Managing gift selection conflicts
 * - Archived gift detection and warning system
 * - Collapsible category organization
 */

// Import dependencies
import { addManagedEventListener } from './utils.js';
import {
  findCoinValueForGift,
  getGiftName,
  generateGiftOptionsForCoinValue,
  updateMappingsWithNewNames
} from './gift-database.js';

// ============= STATE =============

// Track selected gift names to prevent duplicates
let selectedGiftNames = new Set();

// Track archived gift mappings
let archivedGiftMappings = [];
let showOnlyArchivedMappings = false;

// ============= DROPDOWN GENERATION =============

/**
 * Generate coin range dropdown options
 * OPTIMIZED: Uses array join instead of string concatenation
 * @returns {string} HTML options string
 */
export function generateCoinValueOptions() {
  const options = ['<option value="">Select coin range...</option>'];
  if (typeof COIN_RANGES !== 'undefined') {
    COIN_RANGES.forEach(range => {
      options.push(`<option value="${range.min}-${range.max}">${range.label}</option>`);
    });
  }
  return options.join('');
}

/**
 * Convert text inputs to cascading dropdown system
 */
export function convertInputsToSelects() {
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

/**
 * Update all gift dropdowns to show/hide options based on selected gifts
 */
export function updateAllGiftDropdowns() {
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

/**
 * Find coin value for a gift name
 * @param {string} giftName - Gift name
 * @returns {number|null} Coin value or null
 */
export function findCoinValueForGift(giftName) {
  if (typeof TIKTOK_GIFTS === 'undefined') return null;
  for (const [coinValue, gifts] of Object.entries(TIKTOK_GIFTS)) {
    if (gifts.includes(giftName)) {
      return parseInt(coinValue);
    }
  }
  return null;
}

/**
 * Find the coin range for a specific coin value
 * @param {number} coinValue - Coin value
 * @returns {string|null} Range string or null
 */
export function findRangeForCoinValue(coinValue) {
  if (typeof COIN_RANGES === 'undefined') return null;
  for (const range of COIN_RANGES) {
    if (coinValue >= range.min && coinValue <= range.max) {
      return `${range.min}-${range.max}`;
    }
  }
  return null;
}

// ============= LOAD/SAVE MAPPINGS =============

/**
 * Load existing gift settings
 */
export async function loadGiftSettings() {
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

/**
 * Find which action a gift is currently mapped to
 * @param {string} giftName - Gift name
 * @param {HTMLElement} excludeSelect - Select element to exclude
 * @returns {string|null} Action name or null
 */
export function findMappingForGift(giftName, excludeSelect) {
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

/**
 * Remove a gift from another mapping
 * @param {string} giftName - Gift name
 * @param {HTMLElement} excludeSelect - Select element to exclude
 */
export function removeOtherMapping(giftName, excludeSelect) {
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

// ============= ARCHIVED GIFT WARNING SYSTEM =============

/**
 * Check all gift mappings for archived gifts
 */
export async function checkMappingsForArchivedGifts() {
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

/**
 * Display warning badges on affected mappings
 */
export function displayMappingWarnings() {
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

/**
 * Show banner at top of gift mappings tab
 */
export function showArchivalBanner() {
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

/**
 * Hide archival banner
 */
export function hideArchivalBanner() {
  const banner = document.querySelector('.archived-gifts-banner');
  if (banner) {
    banner.remove();
  }
}

/**
 * Toggle filter to show only archived mappings
 */
export function toggleArchivedFilter() {
  showOnlyArchivedMappings = !showOnlyArchivedMappings;
  applyArchivedFilter();

  // Update button text
  const filterBtn = document.querySelector('.btn-filter-archived');
  if (filterBtn) {
    filterBtn.textContent = showOnlyArchivedMappings ? '📋 Show All' : '🔍 Show Only Archived';
  }
}

/**
 * Apply filter to show/hide mappings
 */
export function applyArchivedFilter() {
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

/**
 * Handle remapping an archived gift
 * @param {string} giftKey - Gift key (e.g., "Rose (1 coins)")
 * @param {string} action - Action name
 */
export async function handleRemapArchivedGift(giftKey, action) {
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

// ============= COLLAPSIBLE CATEGORIES =============

/**
 * Initialize collapsible categories
 */
export function initializeCollapsibleCategories() {
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

/**
 * Reorganize actions into proper categories
 */
export function reorganizeActions() {
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

/**
 * Collapse/Expand all categories
 */
export function toggleAllCategories() {
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

/**
 * Initialize collapsible categories with retry logic
 */
export function tryInitializeCollapsible() {
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

// ============= EXPORTS =============

// Export state for external access
export { selectedGiftNames, archivedGiftMappings, showOnlyArchivedMappings };
